'use strict';
// No application imports, filesystem extraction, URLs, credentials, or provider/scanner access.
const { inflateSync, inflateRawSync, crc32 } = require('node:zlib');
const { posix } = require('node:path');
const { TextDecoder } = require('node:util');
const { decodeImage } = require('./imageInspectorWorker');
const MAX_EXPANDED = 100_000_000;
function requireValid(condition) { if (!condition) throw Error('unverifiable material'); }
async function image(bytes) {
  requireValid(bytes.length <= 10_000_000);
  if (bytes[0] === 0xff) {
    requireValid(bytes[1] === 0xd8); let cursor = 2, markers = 0, ended = false;
    while (cursor < bytes.length) {
      requireValid(++markers <= 10_000 && bytes[cursor++] === 0xff);
      while (bytes[cursor] === 0xff) cursor++;
      const marker = bytes[cursor++];
      if (marker === 0xd9) { ended = true; break; }
      requireValid(marker && ![0xd8,0x01,0xd0,0xd1,0xd2,0xd3,0xd4,0xd5,0xd6,0xd7].includes(marker) && cursor + 2 <= bytes.length);
      const size = bytes.readUInt16BE(cursor); requireValid(size >= 2 && cursor + size <= bytes.length); cursor += size;
      if (marker === 0xda) {
        while (cursor < bytes.length) {
          if (bytes[cursor] !== 0xff) { cursor++; continue; }
          let next = cursor + 1; while (bytes[next] === 0xff) next++;
          if (bytes[next] === 0 || bytes[next] >= 0xd0 && bytes[next] <= 0xd7) cursor = next + 1;
          else break;
        }
      }
    }
    requireValid(ended && cursor === bytes.length);
  }
  if (bytes.toString('ascii', 0, 4) === 'RIFF') requireValid(bytes.length >= 12 && bytes.readUInt32LE(4) === bytes.length - 8 && bytes.toString('ascii', 8, 12) === 'WEBP');
  return decodeImage(bytes);
}
async function pdf(bytes) {
  const lib = require('pdf-lib');
  const ObjectParser = require('pdf-lib/cjs/core/parser/PDFObjectParser').default;
  const ByteStream = require('pdf-lib/cjs/core/parser/ByteStream').default;
  const { PDFContext, PDFDict, PDFArray, PDFName, PDFNumber, PDFRef, PDFRawStream, PDFString, PDFHexString } = lib;
  const context = PDFContext.create(); let parsed = 0;
  // pdf-lib repairs malformed xrefs/streams; use its real object parser with strict boundaries instead.
  class StrictParser extends ObjectParser {
    parseObject() {
      this.depth = (this.depth || 0) + 1;
      requireValid(this.depth <= 64 && ++parsed <= 100_000);
      try { return super.parseObject(); } finally { this.depth--; }
    }
    parseName() {
      const start = this.bytes.offset(); super.parseName();
      const raw = Buffer.from(this.bytes.slice(start + 1, this.bytes.offset())).toString('latin1');
      requireValid(!/#(?![0-9a-fA-F]{2})/.test(raw));
      const decoded = raw.replace(/#([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
      requireValid(decoded.length > 0 && /^[\x21-\x7e]+$/.test(decoded) && !decoded.includes('#'));
      return PDFName.of(decoded);
    }
    parseHexString() {
      const value = super.parseHexString(); requireValid(/^[0-9a-fA-F\s]*$/.test(value.asString())); return value;
    }
    parseDict() {
      this.bytes.assertNext(60); this.bytes.assertNext(60); this.skipWhitespaceAndComments();
      const dict = PDFDict.withContext(context);
      while (this.bytes.peek() !== 62) {
        const key = this.parseName(); requireValid(!dict.has(key)); dict.set(key, this.parseObject()); this.skipWhitespaceAndComments();
      }
      this.bytes.assertNext(62); this.bytes.assertNext(62); return dict;
    }
    parseDictOrStream() {
      const dict = this.parseDict(); this.skipWhitespaceAndComments();
      const offset = this.bytes.offset();
      if (Buffer.from(this.bytes.slice(offset, offset + 6)).toString() !== 'stream') return dict;
      const prefix = Buffer.from(this.bytes.slice(offset, offset + 8)).toString('latin1').match(/^stream(?:\r\n|\n|\r)/);
      const length = dict.get(PDFName.of('Length'));
      requireValid(prefix && length instanceof PDFNumber && Number.isSafeInteger(length.asNumber()) && length.asNumber() >= 0);
      const start = offset + prefix[0].length, end = start + length.asNumber();
      requireValid(end <= this.bytes.length);
      const tail = Buffer.from(this.bytes.slice(end, end + 12)).toString('latin1').match(/^(?:\r\n|\n|\r)?endstream/);
      requireValid(tail); this.bytes.moveTo(end + tail[0].length); return PDFRawStream.of(dict, this.bytes.slice(start, end));
    }
  }
  const parser = data => new StrictParser(ByteStream.of(data), context, false);
  const text = bytes.toString('latin1'); const header = text.match(/^%PDF-1\.[0-7](?:\r\n|\n|\r)/);
  const ending = text.match(/startxref\s+(\d+)\s+%%EOF[\x00\x09\x0a\x0c\x0d\x20]*$/);
  requireValid(header && ending);
  const xref = Number(ending[1]); requireValid(Number.isSafeInteger(xref) && xref >= header[0].length && xref < ending.index);
  const xrefHead = text.slice(xref).match(/^xref\r?\n0 (\d+)\r?\n/); requireValid(xrefHead);
  const count = Number(xrefHead[1]); requireValid(count >= 2 && count <= 10_000);
  let cursor = xref + xrefHead[0].length; const offsets = [];
  for (let i = 0; i < count; i++) {
    const entry = text.slice(cursor).match(/^(\d{10}) (\d{5}) ([fn])(?: \r?\n|\r\n)/); requireValid(entry);
    requireValid(i === 0 ? entry[1] === '0000000000' && entry[2] === '65535' && entry[3] === 'f' : entry[2] === '00000' && entry[3] === 'n');
    if (i) { const offset = Number(entry[1]); requireValid(offset < xref && offset >= (offsets.at(-1) || header[0].length)); offsets.push(offset); }
    cursor += entry[0].length;
  }
  const trailerPrefix = text.slice(cursor).match(/^\s*trailer\s+/); requireValid(trailerPrefix); cursor += trailerPrefix[0].length;
  const trailerParser = parser(bytes.subarray(cursor)); const trailer = trailerParser.parseObject(); trailerParser.skipWhitespaceAndComments();
  requireValid(trailer instanceof PDFDict && cursor + trailerParser.bytes.offset() === ending.index);
  const get = (dict, name) => { requireValid(dict instanceof PDFDict); return dict.get(PDFName.of(name)); };
  const name = value => value instanceof PDFName ? value.decodeText() : undefined;
  const num = value => { requireValid(value instanceof PDFNumber && Number.isFinite(value.asNumber())); return value.asNumber(); };
  requireValid(num(get(trailer, 'Size')) === count);
  requireValid(trailer.keys().every(key => ['Root','Info','Size','ID'].includes(key.decodeText())));
  // Account for every byte before the first object and every object, including unreachable ones.
  const preface = parser(bytes.subarray(header[0].length, offsets[0])); preface.skipWhitespaceAndComments(); requireValid(preface.bytes.done());
  for (let i = 0; i < offsets.length; i++) {
    const end = offsets[i + 1] || xref; const chunk = bytes.subarray(offsets[i], end);
    const prefix = chunk.toString('latin1', 0, 40).match(new RegExp(`^${i + 1} 0 obj\\s+`)); requireValid(prefix);
    const part = parser(chunk.subarray(prefix[0].length)); const object = part.parseObject(); part.skipWhitespaceAndComments();
    requireValid(Buffer.from(part.bytes.slice(part.bytes.offset(), part.bytes.length)).toString('latin1').match(/^endobj\s*$/));
    context.assign(PDFRef.of(i + 1), object);
  }
  const forbidden = new Set(['Encrypt','OpenAction','AA','A','JS','JavaScript','Launch','URI','GoToR','GoToE','SubmitForm','ImportData','Rendition','RichMedia','Movie','Sound','EmbeddedFile','EmbeddedFiles','Filespec','EF','AF','AcroForm','XFA','Annots','Names','Collection','ObjStm','XRef','Prev','XRefStm','Metadata','FontFile','FontFile2','FontFile3','Type3','PS','F','FFilter','FDecodeParms','DecodeParms','SMask','OPI','Ref','Perms','PieceInfo','Alternate','Alternates']);
  const reachable = new Set(); const seen = new Set(), dictionaries = new Set(), verified = new Set(); let expanded = 0; const decoded = new Map();
  const resolve = value => { if (value instanceof PDFRef) { requireValid(value.generationNumber === 0); const result = context.lookup(value); requireValid(result); return result; } return value; };
  function walk(object, depth = 0) {
    requireValid(depth <= 64);
    if (object instanceof PDFRef) { requireValid(context.lookup(object)); if (reachable.has(object.toString())) return; reachable.add(object.toString()); return walk(resolve(object), depth + 1); }
    if (seen.has(object)) return; seen.add(object);
    if (object instanceof PDFName) requireValid(!forbidden.has(name(object)));
    if (object instanceof PDFNumber) requireValid(Number.isFinite(object.asNumber()) && Math.abs(object.asNumber()) <= Number.MAX_SAFE_INTEGER);
    if (object instanceof PDFArray) for (const item of object.asArray()) walk(item, depth + 1);
    if (object instanceof PDFRawStream) { walk(object.dict, depth + 1); return; }
    if (object instanceof PDFDict) dictionaries.add(object);
    if (object instanceof PDFDict) for (const [key, value] of object.entries()) {
      if (name(key) === 'Annots') { const annotations = resolve(value); requireValid(annotations instanceof PDFArray && annotations.size() === 0); continue; }
      walk(key, depth + 1); walk(value, depth + 1);
    }
  }
  // Validate dangerous names in all objects before reachability checks.
  for (const [, object] of context.enumerateIndirectObjects()) walk(object);
  seen.clear(); reachable.clear(); walk(trailer);
  requireValid(reachable.size === offsets.length);
  function dictionary(value, keys) {
    const dict = resolve(value); requireValid(dict instanceof PDFDict && dict.keys().every(key => keys.includes(name(key)))); verified.add(dict); return dict;
  }
  dictionary(trailer, ['Root','Info','Size','ID']);
  if (get(trailer, 'Info')) {
    const info = dictionary(get(trailer, 'Info'), ['Producer','Creator','CreationDate','ModDate','Title','Author','Subject','Keywords','Trapped']);
    for (const [key, value] of info.entries()) requireValid(name(key) === 'Trapped' ? ['True','False','Unknown'].includes(name(value)) : value instanceof PDFString || value instanceof PDFHexString);
  }
  for (const [, object] of context.enumerateIndirectObjects()) if (object instanceof PDFRawStream) {
    const filter = name(get(object.dict, 'Filter')); requireValid(!get(object.dict, 'Filter') || ['FlateDecode','DCTDecode'].includes(filter));
    const raw = Buffer.from(object.getContents()); let data;
    if (filter === 'DCTDecode') {
      dictionary(object.dict, ['Type','Subtype','Length','Filter','Width','Height','ColorSpace','BitsPerComponent','Interpolate']);
      requireValid(name(get(object.dict, 'Type')) === 'XObject' && name(get(object.dict, 'Subtype')) === 'Image' && num(get(object.dict, 'BitsPerComponent')) === 8);
      requireValid(['DeviceGray','DeviceRGB','DeviceCMYK'].includes(name(get(object.dict, 'ColorSpace'))));
      requireValid(await image(raw) === 'jpg');
      const dimensions = await require('sharp')(raw).metadata();
      requireValid(num(get(object.dict, 'Width')) === dimensions.width && num(get(object.dict, 'Height')) === dimensions.height);
      data = raw;
    }
    else {
      const inflated = filter === 'FlateDecode' ? inflateSync(raw, {info:true, maxOutputLength:MAX_EXPANDED - expanded + 1}) : null;
      requireValid(!inflated || inflated.engine.bytesWritten === raw.length);
      data = inflated ? inflated.buffer : raw;
      requireValid(name(get(object.dict, 'Subtype')) !== 'Image');
    }
    expanded += data.length; requireValid(expanded <= MAX_EXPANDED); decoded.set(object, data);
  }
  const standardFonts = new Set(['Courier','Courier-Bold','Courier-Oblique','Courier-BoldOblique','Helvetica','Helvetica-Bold','Helvetica-Oblique','Helvetica-BoldOblique','Times-Roman','Times-Bold','Times-Italic','Times-BoldItalic','Symbol','ZapfDingbats']);
  function resources(value) {
    const resource = resolve(value); if (!resource) return PDFDict.withContext(context); dictionary(resource, ['Font','XObject','ProcSet','ExtGState']);
    requireValid(resource.keys().every(key => ['Font','XObject','ProcSet','ExtGState'].includes(name(key))));
    const state = resolve(get(resource, 'ExtGState')); if (state) dictionary(state, []);
    const fonts = resolve(get(resource, 'Font')); if (fonts) { requireValid(fonts instanceof PDFDict); verified.add(fonts); for (const [, ref] of fonts.entries()) { const font = dictionary(ref, ['Type','Subtype','BaseFont','Encoding','Name']); requireValid(name(get(font, 'Type')) === 'Font' && name(get(font, 'Subtype')) === 'Type1' && standardFonts.has(name(get(font, 'BaseFont'))) && (!get(font, 'Encoding') || ['StandardEncoding','MacRomanEncoding','WinAnsiEncoding'].includes(name(get(font, 'Encoding'))))); } }
    const objects = resolve(get(resource, 'XObject')); if (objects) { requireValid(objects instanceof PDFDict); verified.add(objects); for (const [, ref] of objects.entries()) { const object = resolve(ref); requireValid(object instanceof PDFRawStream && name(get(object.dict, 'Subtype')) === 'Image' && name(get(object.dict, 'Filter')) === 'DCTDecode'); } }
    return resource;
  }
  const arity = { q:0,Q:0,cm:6,w:1,J:1,j:1,M:1,d:2,ri:1,i:1,m:2,l:2,c:6,v:4,y:4,h:0,re:4,S:0,s:0,f:0,F:0,'f*':0,B:0,'B*':0,b:0,'b*':0,n:0,W:0,'W*':0,BT:0,ET:0,Tc:1,Tw:1,Tz:1,TL:1,Tf:2,Tr:1,Ts:1,Td:2,TD:2,Tm:6,'T*':0,Tj:1,TJ:1,"'":1,'"':3,G:1,g:1,RG:3,rg:3,K:4,k:4,Do:1 };
  function content(data, resource) {
    const part = parser(data); let operands = [], graphics = 0, inText = false;
    while (true) {
      part.skipWhitespaceAndComments(); if (part.bytes.done()) break;
      const byte = part.bytes.peek();
      if ([40,60,47,91,43,45,46].includes(byte) || byte >= 48 && byte <= 57) { const value = part.parseObject(); requireValid(!(value instanceof PDFRef) && !(value instanceof PDFDict) && !(value instanceof PDFRawStream)); operands.push(value); requireValid(operands.length <= 32); continue; }
      const remaining = Buffer.from(part.bytes.slice(part.bytes.offset(), Math.min(part.bytes.offset() + 16, part.bytes.length))).toString('latin1');
      const token = remaining.match(/^[a-zA-Z*'"]+/); requireValid(token && Object.hasOwn(arity, token[0])); const op = token[0]; part.bytes.moveTo(part.bytes.offset() + op.length);
      requireValid(operands.length === arity[op]);
      if (op === 'q') graphics++; if (op === 'Q') requireValid(--graphics >= 0); requireValid(graphics <= 64);
      if (op === 'BT') { requireValid(!inText); inText = true; } if (op === 'ET') { requireValid(inText); inText = false; }
      if (op === 'Tf' || op === 'Do') { const dict = resolve(get(resource, op === 'Tf' ? 'Font' : 'XObject')); requireValid(operands[0] instanceof PDFName && dict instanceof PDFDict && dict.has(operands[0])); if (op === 'Tf') num(operands[1]); }
      else if (['Tj',"'",'"'].includes(op)) { requireValid(inText && (operands.at(-1) instanceof PDFString || operands.at(-1) instanceof PDFHexString)); if (op === '"') { num(operands[0]); num(operands[1]); } }
      else if (op === 'TJ') { requireValid(inText && operands[0] instanceof PDFArray); requireValid(operands[0].asArray().every(value => value instanceof PDFNumber || value instanceof PDFString || value instanceof PDFHexString)); }
      else if (op === 'd') { requireValid(operands[0] instanceof PDFArray); operands[0].asArray().forEach(num); num(operands[1]); }
      else if (op === 'ri') requireValid(operands[0] instanceof PDFName);
      else operands.forEach(num);
      operands = [];
    }
    requireValid(!operands.length && graphics === 0 && !inText);
  }
  const pagesSeen = new Set();
  function pages(ref, parent, inherited, depth = 0) {
    requireValid(ref instanceof PDFRef && depth <= 64 && !pagesSeen.has(ref.toString())); pagesSeen.add(ref.toString());
    const node = resolve(ref); requireValid(node instanceof PDFDict && (!parent || get(node, 'Parent')?.toString() === parent.toString()));
    const resource = get(node, 'Resources') || inherited.resource, box = get(node, 'MediaBox') || inherited.box;
    if (!parent) requireValid(!get(node, 'Parent'));
    for (const key of ['MediaBox','CropBox']) if (get(node, key)) {
      const geometry = resolve(get(node, key)); requireValid(geometry instanceof PDFArray && geometry.size() === 4);
      const values = geometry.asArray().map(num); requireValid(values[2] > values[0] && values[3] > values[1]);
    }
    if (get(node, 'Rotate')) requireValid(Number.isInteger(num(get(node, 'Rotate'))) && num(get(node, 'Rotate')) % 90 === 0);

    if (name(get(node, 'Type')) === 'Pages') { dictionary(node, ['Type','Kids','Count','Parent','Resources','MediaBox','CropBox','Rotate']); const children = resolve(get(node, 'Kids')); requireValid(children instanceof PDFArray && children.size() > 0); let count = 0; for (const kid of children.asArray()) count += pages(kid, ref, {resource, box}, depth + 1); requireValid(num(get(node, 'Count')) === count); return count; }
    requireValid(name(get(node, 'Type')) === 'Page'); dictionary(node, ['Type','Parent','Resources','MediaBox','CropBox','Rotate','Contents','Annots']); const rect = resolve(box); requireValid(rect instanceof PDFArray && rect.size() === 4); const dimensions = rect.asArray().map(num); requireValid(dimensions[2] > dimensions[0] && dimensions[3] > dimensions[1]);
    const current = resources(resource), stream = resolve(get(node, 'Contents'));
    for (const item of stream instanceof PDFArray ? stream.asArray().map(resolve) : stream ? [stream] : []) { requireValid(item instanceof PDFRawStream && decoded.has(item)); dictionary(item.dict, ['Length','Filter']); content(decoded.get(item), current); }
    return 1;
  }
  const catalog = dictionary(get(trailer, 'Root'), ['Type','Pages','Lang','PageLayout','PageMode']); requireValid(name(get(catalog, 'Type')) === 'Catalog'); pages(get(catalog, 'Pages'), null, {});
  requireValid([...dictionaries].every(dict => verified.has(dict)));
  return 'pdf';
}
const NS = {
  rel:'http://schemas.openxmlformats.org/package/2006/relationships', ct:'http://schemas.openxmlformats.org/package/2006/content-types',
  office:'http://schemas.openxmlformats.org/officeDocument/2006/relationships', w:'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  p:'http://schemas.openxmlformats.org/presentationml/2006/main', a:'http://schemas.openxmlformats.org/drawingml/2006/main',
  cp:'http://schemas.openxmlformats.org/package/2006/metadata/core-properties', ep:'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties'
};
const XML_NAMESPACES = new Set([...Object.values(NS),'http://purl.org/dc/elements/1.1/','http://purl.org/dc/terms/','http://purl.org/dc/dcmitype/','http://www.w3.org/2001/XMLSchema-instance','http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes','http://www.w3.org/XML/1998/namespace','http://www.w3.org/2000/xmlns/']);
// Deliberately passive OOXML subset; unknown extension markup is unverifiable and rejected.
const ELEMENTS = {
  [NS.w]: new Set(('document body p pPr r rPr t br tab cr noBreakHyphen softHyphen sectPr pgSz pgMar cols docGrid type titlePg pgNumType paperSrc formProt vAlign textDirection bidi rtlGutter tbl tblPr tblGrid gridCol tr trPr tc tcPr tblW tblBorders top left bottom right insideH insideV tblCellMar tblLayout tblLook tblStyle tblInd tblCaption tblDescription gridSpan vMerge tcW tcBorders shd noWrap tcMar tcFitText hideMark hMerge trHeight cantSplit tblHeader before after spacing ind jc keepNext keepLines pageBreakBefore widowControl numPr ilvl numId tabs pos hanging firstLine rStyle pStyle b i bCs iCs u strike dstrike caps smallCaps color sz szCs highlight vertAlign rFonts kern position fitText vanish lang eastAsianLayout emboss imprint outline shadow snapToGrid contextualSpacing suppressLineNumbers suppressAutoHyphens wordWrap overflowPunct topLinePunct autoSpaceDE autoSpaceDN adjustRightInd mirrorIndents textAlignment textboxTightWrap suppressOverlap bookmarkStart bookmarkEnd hyperlink drawing inline styles style name basedOn next link uiPriority qFormat semiHidden unhideWhenUsed locked aliases personal personalCompose personalReply rsid defaultPPr defaultRPr docDefaults pPrDefault rPrDefault latentStyles lsdException settings zoom proofState defaultTabStop characterSpacingControl compat compatSetting decimalSymbol listSeparator clrSchemeMapping themeFontLang updateFields fonts font altName family pitch charset notTrueType panose1 sig numbering abstractNum abstractNumId multiLevelType lvl start numFmt lvlText lvlJc suff lvlRestart isLgl numStyleLink styleLink lvlOverride startOverride nsid tmpl numIdMacAtCleanup').split(' ')),
  [NS.p]: new Set(('presentation sldIdLst sldId sldSz notesSz sldMasterIdLst sldMasterId sld sldLayout sldMaster cSld spTree nvGrpSpPr cNvPr cNvGrpSpPr nvPr grpSpPr sp nvSpPr cNvSpPr spPr txBody txStyles titleStyle bodyStyle otherStyle clrMap clrMapOvr masterClrMapping overrideClrMapping sldLayoutIdLst sldLayoutId transition timing showPr defaultTextStyle hf ph pic nvPicPr cNvPicPr blipFill graphicFrame nvGraphicFramePr cNvGraphicFramePr xfrm presentationPr viewPr tblStyleLst').split(' ')),
  [NS.a]: new Set(('theme themeElements clrScheme dk1 lt1 dk2 lt2 accent1 accent2 accent3 accent4 accent5 accent6 hlink folHlink sysClr srgbClr schemeClr prstClr fontScheme majorFont minorFont latin ea cs font fmtScheme fillStyleLst lnStyleLst effectStyleLst bgFillStyleLst objectDefaults extraClrSchemeLst custClrLst solidFill noFill gradFill gsLst gs lin path fillToRect tileRect pattFill fgClr bgClr ln prstDash custDash ds miter round bevel headEnd tailEnd effectStyle effectLst effectDag outerShdw innerShdw reflection glow softEdge blur xfrm off ext chOff chExt prstGeom avLst gdLst gd custGeom ahLst cxnLst rect pathLst moveTo lnTo cubicBezTo quadBezTo arcTo close pt spPr blip srcRect stretch fillRect tile alpha alphaMod alphaModFix alphaOff tint shade satMod lumMod lumOff hueMod graphic graphicData bodyPr lstStyle p pPr defRPr endParaRPr r rPr t br buNone buChar buFont buSzPct buSzPts buSzTx spcPct spcPts lnSpc spcBef spcAft tabLst tab autofit normAutofit noAutofit spAutoFit tbl tblPr tblGrid gridCol tr tc txBody tcPr fontRef fillRef lnRef effectRef style').split(' '))
};
const CHILDREN = {
  [NS.w]: {document:'body',body:'p tbl sectPr',p:'pPr r hyperlink bookmarkStart bookmarkEnd',r:'rPr t br tab cr noBreakHyphen softHyphen drawing',t:'',tbl:'tblPr tblGrid tr',tblGrid:'gridCol',tr:'trPr tc',tc:'tcPr p tbl',hyperlink:'r bookmarkStart bookmarkEnd'},
  [NS.p]: {presentation:'sldMasterIdLst sldIdLst sldSz notesSz defaultTextStyle',sldIdLst:'sldId',sldId:'',sld:'cSld clrMapOvr',sldLayout:'cSld clrMapOvr hf',sldMaster:'cSld clrMap sldLayoutIdLst hf txStyles',cSld:'spTree',spTree:'nvGrpSpPr grpSpPr sp pic graphicFrame',sp:'nvSpPr spPr txBody',nvSpPr:'cNvPr cNvSpPr nvPr'},
  [NS.a]: {p:'pPr r br endParaRPr',r:'rPr t',t:''}
};
const WORD_PREFIX = {p:['pPr'],r:['rPr'],tbl:['tblPr','tblGrid'],tr:['trPr'],tc:['tcPr']};
const WORD_PROPERTIES = new Set(['pPr','rPr','tblPr','trPr','tcPr','sectPr']);
const TEXT_ELEMENTS = {
  [NS.w]: new Set(['t']), [NS.a]: new Set(['t']),
  [NS.cp]: new Set('keywords lastModifiedBy revision lastPrinted category contentStatus version'.split(' ')),
  [NS.ep]: new Set('Template Manager Company Pages Words Characters PresentationFormat Lines Paragraphs Slides Notes TotalTime HiddenSlides MMClips ScaleCrop LinksUpToDate CharactersWithSpaces SharedDoc HyperlinkBase HyperlinksChanged Application AppVersion DocSecurity'.split(' ')),
  'http://purl.org/dc/elements/1.1/': new Set('title subject creator description identifier language'.split(' ')),
  'http://purl.org/dc/terms/': new Set(['created','modified']),
  'http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes': new Set('bstr lpstr lpwstr i1 i2 i4 i8 int ui1 ui2 ui4 ui8 uint r4 r8 decimal date filetime bool cy error clsid'.split(' '))
};
function xml(bytes) {
  const { SaxesParser } = require('saxes'); requireValid(bytes.length <= 8_000_000);
  const parser = new SaxesParser({xmlns:true}); const nodes = [], stack = []; let depth = 0, root;
  parser.on('xmldecl', declaration => { requireValid(declaration.version === '1.0' && (!declaration.encoding || declaration.encoding.toLowerCase() === 'utf-8')); });
  parser.on('doctype', () => { throw Error('DTD'); }); parser.on('processinginstruction', () => { throw Error('PI'); });
  parser.on('opentag', node => {
    requireValid(++depth <= 64 && nodes.length < 100_000 && XML_NAMESPACES.has(node.uri));
    requireValid(!ELEMENTS[node.uri] || ELEMENTS[node.uri].has(node.local));
    const parent = stack.at(-1), children = parent && CHILDREN[parent.uri]?.[parent.local];
    if (children !== undefined) requireValid(parent.uri === node.uri && children.split(' ').includes(node.local));
    if (parent?.uri === NS.w) {
      parent.childCounts ||= new Map(); const count = parent.childCounts.get(node.local) || 0;
      if (WORD_PROPERTIES.has(parent.local)) requireValid(count === 0);
      const prefix = WORD_PREFIX[parent.local];
      if (prefix) {
        const rank = prefix.indexOf(node.local);
        requireValid(rank === -1 || count === 0 && rank >= (parent.propertyRank ?? -1));
        parent.propertyRank = rank === -1 ? prefix.length : rank;
      }
      if (parent.local === 'body') requireValid(!parent.childCounts.has('sectPr'));
      parent.childCounts.set(node.local, count + 1);
    }
    stack.push(node);
    requireValid(!['object','control','oleObject','oleObj','externalData','video','audio','contentPart','altChunk','instrText','fldSimple','fldChar','embeddedFont','extLst','AlternateContent','customXml','smartTag','attachedTemplate'].includes(node.local));
    for (const attr of Object.values(node.attributes)) { requireValid(!attr.uri || XML_NAMESPACES.has(attr.uri)); requireValid(!['schemaLocation','noNamespaceSchemaLocation','base'].includes(attr.local)); }
    node.depth = depth; nodes.push(node); root ||= node;
  });
  const characterData = text => {
    const node = stack.at(-1);
    requireValid(/^[\x20\x09\x0a\x0d]*$/.test(text) || node && TEXT_ELEMENTS[node.uri]?.has(node.local));
  };
  parser.on('text', characterData); parser.on('cdata', characterData);
  parser.on('closetag', () => { depth--; stack.pop(); });
  parser.write(new TextDecoder('utf-8', {fatal:true}).decode(bytes)).close(); requireValid(root && depth === 0);
  return {root,nodes};
}
async function office(bytes) {
  const yauzl = require('yauzl');
  requireValid(bytes.length >= 22 && bytes.readUInt32LE(0) === 0x04034b50 && bytes.readUInt32LE(bytes.length - 22) === 0x06054b50);
  const eocd = bytes.length - 22;
  requireValid(bytes.readUInt32LE(eocd + 4) === 0 && bytes.readUInt16LE(eocd + 20) === 0);
  const count = bytes.readUInt16LE(eocd + 10), centralOffset = bytes.readUInt32LE(eocd + 16);
  requireValid(count > 0 && count <= 1000 && count === bytes.readUInt16LE(eocd + 8) && centralOffset + bytes.readUInt32LE(eocd + 12) === eocd);
  const archive = await yauzl.fromBufferPromise(bytes, {lazyEntries:true, strictFileNames:true, validateEntrySizes:true});
  const entries = new Map(), names = new Set(); let expanded = 0, localEnd = 0, directoryBytes = 0;
  try {
    for await (const entry of archive.eachEntry()) {
      const name = entry.fileName; directoryBytes += 46 + Buffer.byteLength(name);
      requireValid(entries.size < 1000 && /^[A-Za-z0-9_\[\]./-]+$/.test(name) && !name.startsWith('/') && !name.split('/').some(piece => piece === '.' || piece === '..' || piece === '') && !names.has(name.toLowerCase())); names.add(name.toLowerCase());
      requireValid(!entry.isEncrypted() && !(entry.generalPurposeBitFlag & ~0x806) && [0,8].includes(entry.compressionMethod) && !entry.extraFields.length && !entry.fileCommentLength);
      requireValid(!((entry.externalFileAttributes >>> 16) & 0xf000) || ((entry.externalFileAttributes >>> 16) & 0xf000) === 0x8000);
      expanded += entry.uncompressedSize; requireValid(Number.isSafeInteger(expanded) && expanded <= MAX_EXPANDED && entry.relativeOffsetOfLocalHeader === localEnd);
      const local = await archive.readLocalFileHeaderPromise(entry);
      requireValid(local.fileName.equals(Buffer.from(name)) && !local.extraFieldLength && local.generalPurposeBitFlag === entry.generalPurposeBitFlag && local.compressionMethod === entry.compressionMethod && local.crc32 === entry.crc32 && local.compressedSize === entry.compressedSize && local.uncompressedSize === entry.uncompressedSize);
      localEnd = local.fileDataStart + entry.compressedSize; requireValid(localEnd <= centralOffset);
      const compressed = bytes.subarray(local.fileDataStart, localEnd);
      const inflated = entry.compressionMethod === 8 ? inflateRawSync(compressed, {info:true, maxOutputLength:Math.max(1, entry.uncompressedSize)}) : null;
      requireValid(!inflated || inflated.engine.bytesWritten === compressed.length);
      const data = inflated ? inflated.buffer : Buffer.from(compressed);
      requireValid(data.length === entry.uncompressedSize && crc32(data) === entry.crc32);
      entries.set(name, data);
    }
  } finally { archive.close(); }
  requireValid(entries.size === count && localEnd === centralOffset && directoryBytes === eocd - centralOffset && entries.has('[Content_Types].xml') && entries.has('_rels/.rels'));
  const types = xml(entries.get('[Content_Types].xml')); requireValid(types.root.uri === NS.ct && types.root.local === 'Types');
  const defaults = new Map(), overrides = new Map();
  const attr = (node, key) => node.attributes[key]?.value;
  for (const node of types.nodes.slice(1)) {
    requireValid(node.depth === 2 && node.uri === NS.ct && ['Default','Override'].includes(node.local));
    const map = node.local === 'Default' ? defaults : overrides, key = attr(node, node.local === 'Default' ? 'Extension' : 'PartName');
    requireValid(key && !map.has(key) && attr(node, 'ContentType')); map.set(key, attr(node, 'ContentType'));
  }
  const officeType = 'application/vnd.openxmlformats-officedocument.';
  const roots = new Map([
    [officeType+'wordprocessingml.document.main+xml',[NS.w,'document']], [officeType+'wordprocessingml.styles+xml',[NS.w,'styles']], [officeType+'wordprocessingml.settings+xml',[NS.w,'settings']], [officeType+'wordprocessingml.fontTable+xml',[NS.w,'fonts']], [officeType+'wordprocessingml.numbering+xml',[NS.w,'numbering']],
    [officeType+'presentationml.presentation.main+xml',[NS.p,'presentation']], [officeType+'presentationml.slide+xml',[NS.p,'sld']], [officeType+'presentationml.slideLayout+xml',[NS.p,'sldLayout']], [officeType+'presentationml.slideMaster+xml',[NS.p,'sldMaster']], [officeType+'presentationml.presProps+xml',[NS.p,'presentationPr']], [officeType+'presentationml.viewProps+xml',[NS.p,'viewPr']], [officeType+'presentationml.tableStyles+xml',[NS.a,'tblStyleLst']],
    [officeType+'theme+xml',[NS.a,'theme']], ['application/vnd.openxmlformats-package.core-properties+xml',[NS.cp,'coreProperties']], [officeType+'extended-properties+xml',[NS.ep,'Properties']]
  ]);
  const parts = new Map(), relationships = new Map();
  const relationTypes = new Set(['officeDocument','styles','settings','fontTable','numbering','theme','image','slide','slideLayout','slideMaster','presProps','viewProps','tableStyles','extended-properties','core-properties']);
  for (const [name, data] of entries) {
    if (name === '[Content_Types].xml') continue;
    const type = overrides.get('/' + name) || defaults.get(name.split('.').at(-1)); requireValid(type);
    if (name.endsWith('.rels')) {
      requireValid(type === 'application/vnd.openxmlformats-package.relationships+xml'); const parsed = xml(data); requireValid(parsed.root.uri === NS.rel && parsed.root.local === 'Relationships');
      const source = name === '_rels/.rels' ? '' : name.replace(/(^|\/)_[r]els\/([^/]+)\.rels$/, '$1$2'); requireValid(source !== name && (!source || entries.has(source)) && !relationships.has(source));
      const rels = new Map();
      for (const node of parsed.nodes.slice(1)) {
        const id = attr(node,'Id'), target = attr(node,'Target'), kind = attr(node,'Type');
        requireValid(node.depth === 2 && node.uri === NS.rel && node.local === 'Relationship' && id && !rels.has(id) && target && !attr(node,'TargetMode') && !/[\\:%?#\x00-\x20]/.test(target) && !target.startsWith('/'));
        const short = kind?.split('/').at(-1); requireValid(relationTypes.has(short) && (kind === NS.office + '/' + short || kind === 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties'));
        const resolved = posix.normalize(posix.join(posix.dirname(source),target)); requireValid(!resolved.startsWith('../') && entries.has(resolved) && !resolved.endsWith('.rels') && resolved !== '[Content_Types].xml'); rels.set(id,{target:resolved,kind:short});
      }
      relationships.set(source,rels);
    } else if (roots.has(type)) {
      const parsed = xml(data), expected = roots.get(type); requireValid(parsed.root.uri === expected[0] && parsed.root.local === expected[1]); if (expected[0] === NS.p && ['sld','sldLayout','sldMaster'].includes(expected[1])) {
        requireValid(parsed.nodes.filter(node => node.uri === NS.p && node.local === 'cSld' && node.depth === 2).length === 1);
        requireValid(parsed.nodes.filter(node => node.uri === NS.p && node.local === 'spTree' && node.depth === 3).length === 1);
      }
      parts.set(name,{type,...parsed});
    } else if (['image/png','image/jpeg','image/webp'].includes(type)) {
      requireValid(await image(data) === ({'image/png':'png','image/jpeg':'jpg','image/webp':'webp'})[type]); parts.set(name,{type});
    } else throw Error('unsupported part');
  }
  for (const key of overrides.keys()) requireValid(key.startsWith('/') && entries.has(key.slice(1)));
  const rootRels = relationships.get(''); requireValid(rootRels);
  const mains = [...rootRels.values()].filter(rel=>rel.kind === 'officeDocument'); requireValid(mains.length === 1);
  const main = parts.get(mains[0].target); requireValid(main);
  const format = main.type === officeType+'wordprocessingml.document.main+xml' ? 'docx' : main.type === officeType+'presentationml.presentation.main+xml' ? 'pptx' : null; requireValid(format);
  for (const part of parts.values()) if (part.root) requireValid(part.root.uri !== (format === 'docx' ? NS.p : NS.w));
  if (format === 'docx') {
    requireValid(main.nodes.filter(node => node.uri === NS.w && node.local === 'body' && node.depth === 2).length === 1);
    requireValid(main.nodes.filter(node => node.depth === 3).every(node => node.uri === NS.w && ['p','tbl','sectPr'].includes(node.local)));
  }
  else {
    const slides = main.nodes.filter(node=>node.uri === NS.p && node.local === 'sldId' && node.depth === 3);
    requireValid(slides.length > 0); const ids = new Set(), references = new Set();
    const rels = relationships.get(mains[0].target);
    for (const slide of slides) {
      const id = slide.attributes.id, referencesToSlide = Object.values(slide.attributes).filter(attribute=>attribute.uri === NS.office && attribute.local === 'id');
      requireValid(id && !id.uri && /^\d+$/.test(id.value)); const numericId = Number(id.value);
      requireValid(Number.isInteger(numericId) && numericId >= 256 && numericId <= 2147483647 && !ids.has(numericId));
      requireValid(referencesToSlide.length === 1); const reference = referencesToSlide[0].value;
      requireValid(/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(reference) && !references.has(reference) && rels?.get(reference)?.kind === 'slide');
      ids.add(numericId); references.add(reference);
    }
  }
  const reached = new Set();
  function visit(source, depth = 0) {
    if (reached.has(source)) return; requireValid(depth <= 64); if (source) reached.add(source);
    const rels = relationships.get(source) || new Map(), part = parts.get(source);
    requireValid(!source || [...rels.values()].every(rel => rel.kind !== 'officeDocument'));
    for (const node of part?.nodes || []) for (const attribute of Object.values(node.attributes)) if (attribute.uri === NS.office) {
      requireValid(['id','embed'].includes(attribute.local) && rels.has(attribute.value));
      if (node.uri === NS.p && node.local === 'sldId') requireValid(rels.get(attribute.value).kind === 'slide');
      if (node.uri === NS.a && node.local === 'blip') requireValid(rels.get(attribute.value).kind === 'image');
    }
    for (const rel of rels.values()) {
      const target = parts.get(rel.target); requireValid(target);
      if (rel.kind === 'image') requireValid(target.type.startsWith('image/'));
      else if (rel.kind !== 'officeDocument') requireValid(target.root && (rel.kind === 'core-properties' ? target.root.local === 'coreProperties' : rel.kind === 'extended-properties' ? target.root.local === 'Properties' : rel.kind === 'fontTable' ? target.root.local === 'fonts' : rel.kind === 'slide' ? target.root.local === 'sld' : rel.kind === 'slideLayout' ? target.root.local === 'sldLayout' : rel.kind === 'slideMaster' ? target.root.local === 'sldMaster' : rel.kind === 'presProps' ? target.root.local === 'presentationPr' : rel.kind === 'viewProps' ? target.root.local === 'viewPr' : rel.kind === 'tableStyles' ? target.root.local === 'tblStyleLst' : target.root.local === rel.kind));
      visit(rel.target, depth + 1);
    }
  }
  visit(''); requireValid(reached.size === parts.size);
  return format;
}
async function main() {
  let length = 0; const chunks = [];
  for await (const chunk of process.stdin) { length += chunk.length; requireValid(length <= 25_000_000); chunks.push(chunk); }
  const bytes = Buffer.concat(chunks, length); requireValid(length > 0);
  let format;
  if (bytes.toString('ascii',0,5) === '%PDF-') format = await pdf(bytes);
  else if (bytes.length >= 4 && bytes.readUInt32LE(0) === 0x04034b50) format = await office(bytes);
  else format = await image(bytes);
  process.stdout.write(format);
}
main().catch(error => { process.exitCode = error.code === 'MODULE_NOT_FOUND' ? 2 : process.exitCode || 1; });
