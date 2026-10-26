'use strict';
const { deflateRawSync, crc32 } = require('node:zlib');
const { PDFDocument, PDFName, PDFString } = require('pdf-lib');
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const OFFICE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
function zip(entries) {
  const locals=[], central=[]; let offset=0;
  for (const [name, value, options={}] of entries) {
    const data=Buffer.isBuffer(value)?value:Buffer.from(value); const filename=Buffer.from(name);
    const compressed=Buffer.concat([options.stored?data:deflateRawSync(data),options.compressedTail||Buffer.alloc(0)]); const method=options.stored?0:8;
    const checksum=options.crc??crc32(data); const expanded=options.size??data.length;
    const local=Buffer.alloc(30); local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(options.flags||0,6);local.writeUInt16LE(method,8);local.writeUInt32LE(checksum,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(expanded,22);local.writeUInt16LE(filename.length,26);
    locals.push(local,filename,compressed);
    const header=Buffer.alloc(46);header.writeUInt32LE(0x02014b50);header.writeUInt16LE(20,4);header.writeUInt16LE(20,6);header.writeUInt16LE(options.flags||0,8);header.writeUInt16LE(method,10);header.writeUInt32LE(checksum,16);header.writeUInt32LE(compressed.length,20);header.writeUInt32LE(expanded,24);header.writeUInt16LE(filename.length,28);header.writeUInt32LE(options.attributes||0,38);header.writeUInt32LE(offset,42);
    central.push(header,filename);offset+=local.length+filename.length+compressed.length;
  }
  const directory=Buffer.concat(central), end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,directory,end]);
}
function officeEntries(format='docx') {
  const main=format==='docx'?'word/document.xml':'ppt/presentation.xml';
  const mainType=format==='docx'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml':'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml';
  const entries=[['[Content_Types].xml',`<Types xmlns="${CT}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/${main}" ContentType="${mainType}"/>${format==='pptx'?'<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>':''}</Types>`],['_rels/.rels',`<Relationships xmlns="${REL}"><Relationship Id="rId1" Type="${OFFICE}officeDocument" Target="${main}"/></Relationships>`]];
  if(format==='docx')entries.push([main,'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Synthetic course material</w:t></w:r></w:p></w:body></w:document>']);
  else entries.push([main,'<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst><p:sldSz cx="9144000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>'],['ppt/_rels/presentation.xml.rels',`<Relationships xmlns="${REL}"><Relationship Id="rId1" Type="${OFFICE}slide" Target="slides/slide1.xml"/></Relationships>`],['ppt/slides/slide1.xml','<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld></p:sld>']);
  return entries;
}
async function pdf(change) {
  const document=await PDFDocument.create();document.addPage([200,200]).drawText('Synthetic course material',{x:10,y:100,size:10});
  await document.flush();
  if(change)await change(document,{PDFName,PDFString});
  return Buffer.from(await document.save({useObjectStreams:false}));
}
module.exports={zip,officeEntries,pdf,REL,OFFICE};
