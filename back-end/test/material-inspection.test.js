'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash, randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const { join } = require('node:path');
const sharp = require('sharp');
const { zip, officeEntries, pdf, REL, OFFICE } = require('./materialInspectionFixtures');
const { inspectMaterial } = require('../assets/inspectMaterial');
const invalid=async bytes=>assert.rejects(inspectMaterial(bytes),error=>error.code==='INVALID_INPUT');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const format of ['jpeg','png','webp'])test(`material fully decodes ${format}`,async()=>{
  const bytes=await sharp({create:{width:2,height:2,channels:3,background:'#123456'}}).toFormat(format).toBuffer();
  const inspected=await inspectMaterial(bytes);assert.deepEqual(inspected,{format:format==='jpeg'?'jpg':format,bytes:bytes.length,sha256:digest(bytes)});assert.ok(Object.isFrozen(inspected));
  await invalid(bytes.subarray(0,Math.floor(bytes.length/2)));
  await invalid(Buffer.concat([bytes,Buffer.from('trailing payload')]));
});
test('material image limit is 10MB while existing image factory remains 5MB',async()=>{
  const bytes=await sharp(randomBytes(1400*1400*3),{raw:{width:1400,height:1400,channels:3}}).png().toBuffer();assert.ok(bytes.length>5_000_000&&bytes.length<10_000_000);
  assert.equal((await inspectMaterial(bytes)).format,'png');
  await assert.rejects(require('../assets/inspectImage').inspectImage(bytes),error=>error.code==='INVALID_INPUT');
  const oversized=Buffer.alloc(10_000_001);bytes.copy(oversized,0,0,16);await invalid(oversized);
});
test('rejects invalid input, unsupported documents and oversized bytes',async()=>{
  for(const bytes of ['https://example.invalid/a.pdf',Buffer.alloc(0),Buffer.alloc(25_000_001),Buffer.from('%PDF-1.7\nno objects'),Buffer.from('PK\x03\x04fake zip'),Buffer.from('<svg/>'),Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1])])await invalid(bytes);
});
test('reads generated PDF objects, page resources and compressed text stream',async()=>{
  const bytes=await pdf();assert.deepEqual(await inspectMaterial(bytes),{format:'pdf',bytes:bytes.length,sha256:digest(bytes)});
  await invalid(bytes.subarray(0,bytes.length-8));await invalid(Buffer.concat([bytes,Buffer.from('hidden data')]));
  await invalid(Buffer.from(bytes.toString('latin1').replace(/startxref\n\d+/, 'startxref\n1'),'latin1'));
});
for(const name of ['OpenAction','AA','JavaScript','JS','EmbeddedFiles','RichMedia','AcroForm','XFA','Launch','Encrypt','URI','AF'])test(`PDF rejects active/encrypted/embedded key ${name}`,async()=>{
  await invalid(await pdf((document,{PDFName})=>{document.catalog.set(PDFName.of(name),document.context.obj({}));}));
});
test('PDF inspects unreachable objects and escaped dictionary names',async()=>{
  await invalid(await pdf((document,{PDFName})=>{document.context.register(document.context.obj({JS:'payload'}));}));
  const bytes=await pdf((document,{PDFName})=>document.catalog.set(PDFName.of('XX'),document.context.obj({})));
  await invalid(Buffer.from(bytes.toString('latin1').replace('/XX','/#4a#53'),'latin1'));
});
test('PDF rejects broken references, invalid compressed streams and unsupported object streams',async()=>{
  const { PDFRef }=require('pdf-lib');
  await invalid(await pdf((document,{PDFName})=>document.catalog.set(PDFName.of('Pages'),PDFRef.of(9999))));
  const bytes=await pdf();const corrupted=Buffer.from(bytes);const start=corrupted.indexOf(Buffer.from('stream\n'));assert.ok(start>0);corrupted[start+7]^=0xff;await invalid(corrupted);
  const doc=await require('pdf-lib').PDFDocument.create();doc.addPage();await invalid(Buffer.from(await doc.save()));
});
for(const format of ['docx','pptx'])test(`reads generated ${format} package parts and relationship graph`,async()=>{
  const bytes=zip(officeEntries(format));assert.deepEqual(await inspectMaterial(bytes),{format,bytes:bytes.length,sha256:digest(bytes)});
});
for(const [name,change]of [
  ['missing main part',entries=>entries.filter(([name])=>name!=='word/document.xml')],
  ['well-formed XML with wrong main root',entries=>entries.map(([name,data])=>[name,name==='word/document.xml'?'<x xmlns="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>':data])],
  ['malformed XML',entries=>entries.map(([name,data])=>[name,name==='word/document.xml'?'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body></w:document>':data])],
  ['DTD and entity',entries=>entries.map(([name,data])=>[name,name==='word/document.xml'?'<!DOCTYPE x [<!ENTITY secret SYSTEM "file:///etc/passwd">]>'+data:data])],
  ['external relationship',entries=>[...entries,['word/_rels/document.xml.rels',`<Relationships xmlns="${REL}"><Relationship Id="rId9" Type="${OFFICE}image" TargetMode="External" Target="https://example.invalid/secret"/></Relationships>`]]],
  ['dangling relationship',entries=>[...entries,['word/_rels/document.xml.rels',`<Relationships xmlns="${REL}"><Relationship Id="rId9" Type="${OFFICE}image" Target="media/missing.png"/></Relationships>`]]],
  ['DDE field',entries=>entries.map(([name,data])=>[name,name==='word/document.xml'?data.replace('<w:p>','<w:p><w:fldSimple w:instr="DDEAUTO cmd"/>'):data])],
  ['executable attachment',entries=>[...entries,['word/embeddings/payload.exe',Buffer.from('MZpayload')]]],
  ['macro payload',entries=>[...entries,['word/vbaProject.bin',Buffer.from('macro')]]],
  ['unknown XML namespace',entries=>entries.map(([name,data])=>[name,name==='word/document.xml'?data.replace('<w:p>','<w:p><x:unknown xmlns:x="urn:unknown"/>'):data])],
  ['duplicate name',entries=>[...entries,entries[2]]],
  ['case-ambiguous name',entries=>[...entries,['word/Document.xml',entries[2][1]]]],
  ['path traversal',entries=>[...entries,['../outside.xml','<x/>']]],
  ['encrypted ZIP entry',entries=>entries.map(([name,data])=>[name,data,{flags:1}])],
  ['bad CRC',entries=>entries.map(([name,data])=>[name,data,{crc:1}])],
  ['unverified nested ZIP',entries=>[...entries,['word/media/package.zip',zip([['innermost.xml','<x/>']])]]],
])test(`Office rejects ${name}`,async()=>{await invalid(zip(change(officeEntries())));});
test('Office rejects CRC-correct active content hidden in an unreferenced XML part',async()=>{
  await invalid(zip([...officeEntries(),['word/hidden.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:object/></w:body></w:document>']]));
});
test('archive rejects >1000 entries and >100MB advertised or actual expansion',async()=>{
  await invalid(zip([...officeEntries(),...Array.from({length:1001},(_,i)=>[`word/item${i}.xml`,'<x/>'])]));
  await invalid(zip([...officeEntries(),['word/bomb.xml','<x/>',{size:100_000_001}]]));
  await invalid(zip([...officeEntries(),['word/bomb.xml',Buffer.alloc(100_000_001,65)]]));
  await invalid(zip([...officeEntries(),['word/lying.xml',Buffer.alloc(1_000_000,65),{size:10}]]));
});
test('archives nested beyond four levels are rejected',async()=>{
  let bytes=zip([['leaf.xml','<x/>']]);for(let i=0;i<5;i++)bytes=zip([['nested.zip',bytes]]);
  await invalid(zip([...officeEntries(),['word/nested.zip',bytes]]));
});
test('input snapshot binds inspected bytes to the returned digest',async()=>{
  const bytes=await pdf(), expected=digest(bytes);const pending=inspectMaterial(bytes);bytes.fill(0);assert.equal((await pending).sha256,expected);
});
test('inspection aborts before startup and while worker is running',async()=>{
  await assert.rejects(inspectMaterial(await pdf(),AbortSignal.abort()),error=>error.code==='UNAVAILABLE');
  const controller=new AbortController();const pending=inspectMaterial(await pdf(),controller.signal);controller.abort();await assert.rejects(pending,error=>error.code==='UNAVAILABLE');
});
test('two-worker admission bound rejects a third inspection',async()=>{
  const bytes=await pdf();const first=inspectMaterial(bytes),second=inspectMaterial(bytes);await assert.rejects(inspectMaterial(bytes),error=>error.code==='LIMIT_EXCEEDED');await Promise.all([first,second]);
});
test('worker excludes application secrets and enforces five-second kill',async()=>{
  // A preload intercepts only spawn; the inspected public wrapper and timer run unchanged.
  const script=`const cp=require('node:child_process'), original=cp.spawn;cp.spawn=(exe,args,options)=>{if(Object.keys(options.env).some(k=>!['NODE_PATH','SHARP_IGNORE_GLOBAL_LIBVIPS'].includes(k)))process.exit(3);return original(exe,['-e','process.stdin.resume();setInterval(()=>{},1000)'],options)};const {inspectMaterial}=require(${JSON.stringify(join(__dirname,'../assets/inspectMaterial'))});const start=Date.now();inspectMaterial(Buffer.from('%PDF-1.7\\n')).then(()=>process.exit(4),e=>{if(e.code!=='UNAVAILABLE'||Date.now()-start<4500||Date.now()-start>7000)process.exit(5)})`;
  const started=Date.now();const child=spawn(process.execPath,['-e',script],{env:{NODE_PATH:process.env.NODE_PATH,PRIVATE_TEST_SECRET:'never-forwarded'},stdio:'ignore'});
  const code=await new Promise(resolve=>child.on('close',resolve));assert.equal(code,0);assert.ok(Date.now()-started<7500);
});
test('PDF rejects reachable unclassified streams and unverifiable font encodings',async()=>{
  await invalid(await pdf((document,{PDFName})=>document.catalog.set(PDFName.of('Hidden'),document.context.register(document.context.flateStream(Buffer.from('unverifiable content'))))));
  await invalid(await pdf((document,{PDFName})=>{
    for(const [,object]of document.context.enumerateIndirectObjects())if(object.get?.(PDFName.of('Type'))?.toString()==='/Font')object.set(PDFName.of('Encoding'),PDFName.of('UnknownEncoding'));
  }));
});
test('ZIP rejects a valid deflate stream followed by concealed compressed bytes',async()=>{
  await invalid(zip(officeEntries().map(([name,data])=>[name,data,{compressedTail:Buffer.from('hidden zip payload')}])));
});
test('Office rejects unrecognized elements inside a known namespace',async()=>{
  await invalid(zip(officeEntries().map(([name,data])=>[name,name==='word/document.xml'?data.replace('<w:p>','<w:p><w:unverifiable/>'):data])));
});
test('PDF rejects concealed bytes after a valid compressed content stream',async()=>{
  await invalid(await pdf(document=>{
    const ref=document.getPages()[0].node.Contents().get(0), stream=document.context.lookup(ref);
    document.context.assign(ref,document.context.stream(Buffer.concat([Buffer.from(stream.getContents()),Buffer.from('hidden payload')]),{Filter:'FlateDecode'}));
  }));
});
test('Office rejects a declared XML encoding that disagrees with decoded UTF-8',async()=>{
  await invalid(zip(officeEntries().map(([name,data])=>[name,name==='word/document.xml'?'<?xml version="1.0" encoding="UTF-16"?>'+data:data])));
});
test('material JPEG rejects payload concealed between the first EOI and an appended EOI',async()=>{
  const bytes=await sharp({create:{width:2,height:2,channels:3,background:'white'}}).jpeg().toBuffer();
  await invalid(Buffer.concat([bytes,Buffer.from('hidden payload'),Buffer.from([0xff,0xd9])]));
});
test('Office rejects malformed known element placement and missing slide content tree',async()=>{
  await invalid(zip(officeEntries().map(([name,data])=>[name,name==='word/document.xml'?data.replace('<w:t>Synthetic course material</w:t>','<w:p/>'):data])));
  await invalid(zip(officeEntries('pptx').map(([name,data])=>[name,name==='ppt/slides/slide1.xml'?'<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>':data])));
});
test('PDF rejects invalid page geometry and non-right-angle rotation',async()=>{
  await invalid(await pdf((document,{PDFName,PDFString})=>document.getPages()[0].node.set(PDFName.of('CropBox'),PDFString.of('malformed'))));
  await invalid(await pdf((document,{PDFName})=>document.getPages()[0].node.set(PDFName.of('Rotate'),document.context.obj(45))));
});

for(const [name,replace] of [
  ['missing numeric ID',xml=>xml.replace(' id="256"','')],
  ['missing relationship ID',xml=>xml.replace(' r:id="rId1"','')],
  ['missing both required IDs',xml=>xml.replace(' id="256" r:id="rId1"','')],
  ['duplicate numeric ID',xml=>xml.replace('</p:sldIdLst>','<p:sldId id="256" r:id="rId1"/></p:sldIdLst>')],
  ['equivalent duplicate numeric ID',xml=>xml.replace('</p:sldIdLst>','<p:sldId id="0256" r:id="rId1"/></p:sldIdLst>')],
  ['non-numeric ID',xml=>xml.replace('id="256"','id="invalid"')],
  ['fractional ID',xml=>xml.replace('id="256"','id="256.5"')],
  ['below-range ID',xml=>xml.replace('id="256"','id="255"')],
  ['above-range ID',xml=>xml.replace('id="256"','id="2147483648"')],
  ['dangling relationship ID',xml=>xml.replace('r:id="rId1"','r:id="missing"')]
])test(`PPTX rejects ${name} on slide-list entries`,async()=>{
  await invalid(zip(officeEntries('pptx').map(([part,data])=>[part,part==='ppt/presentation.xml'?replace(data):data])));
});
for(const [name,replace] of [
  ['raw body text',xml=>xml.replace('<w:body>','<w:body>unexpected raw text')],
  ['CDATA body text',xml=>xml.replace('<w:body>','<w:body><![CDATA[unexpected raw text]]>')],
  ['raw paragraph text',xml=>xml.replace('<w:p>','<w:p>unexpected raw text')],
  ['CDATA paragraph text',xml=>xml.replace('<w:p>','<w:p><![CDATA[unexpected raw text]]>')],
  ['duplicate paragraph properties',xml=>xml.replace('<w:p>','<w:p><w:pPr/><w:pPr/>')],
  ['late paragraph properties',xml=>xml.replace('</w:p>','<w:pPr/></w:p>')],
  ['duplicate run properties',xml=>xml.replace('<w:r>','<w:r><w:rPr/><w:rPr/>')],
  ['late run properties',xml=>xml.replace('</w:r>','<w:rPr/></w:r>')],
  ['duplicate table properties',xml=>xml.replace('<w:p>','<w:tbl><w:tblPr/><w:tblPr/><w:tr><w:tc><w:p/></w:tc></w:tr></w:tbl><w:p>')],
  ['late table properties',xml=>xml.replace('<w:p>','<w:tbl><w:tr><w:tc><w:p/></w:tc></w:tr><w:tblPr/></w:tbl><w:p>')],
  ['duplicate section properties',xml=>xml.replace('</w:body>','<w:sectPr/><w:sectPr/></w:body>')],
  ['nonterminal section properties',xml=>xml.replace('<w:body>','<w:body><w:sectPr/>')],
  ['duplicate singleton paragraph property',xml=>xml.replace('<w:p>','<w:p><w:pPr><w:jc w:val="left"/><w:jc w:val="right"/></w:pPr>')]
])test(`DOCX rejects ${name}`,async()=>{
  await invalid(zip(officeEntries().map(([part,data])=>[part,part==='word/document.xml'?replace(data):data])));
});
test('Office retains valid required slide IDs, formatted Word text, CDATA text and markup whitespace',async()=>{
  const word=zip(officeEntries().map(([part,data])=>[part,part==='word/document.xml'?data.replace('<w:body>','<w:body>\n  ').replace('<w:p>','<w:p><w:pPr><w:jc w:val="left"/></w:pPr>').replace('<w:r>','<w:r><w:rPr><w:b/></w:rPr>').replace('Synthetic course material','<![CDATA[Synthetic course material]]>').replace('</w:body>','<w:sectPr/></w:body>'):data]));
  assert.equal((await inspectMaterial(word)).format,'docx');
  assert.equal((await inspectMaterial(zip(officeEntries('pptx')))).format,'pptx');
});
test('PPTX slide numeric uniqueness is checked across distinct verified slide relationships',async()=>{
  function twoSlides(secondId) {
    const entries=officeEntries('pptx').map(([part,data])=>{
      if(part==='ppt/presentation.xml')data=data.replace('</p:sldIdLst>',`<p:sldId id="${secondId}" r:id="rId2"/></p:sldIdLst>`);
      if(part==='ppt/_rels/presentation.xml.rels')data=data.replace('</Relationships>',`<Relationship Id="rId2" Type="${OFFICE}slide" Target="slides/slide2.xml"/></Relationships>`);
      if(part==='[Content_Types].xml')data=data.replace('</Types>','<Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>');
      return [part,data];
    });
    entries.push(['ppt/slides/slide2.xml',entries.find(([part])=>part==='ppt/slides/slide1.xml')[1]]);
    return zip(entries);
  }
  assert.equal((await inspectMaterial(twoSlides('257'))).format,'pptx');
  await invalid(twoSlides('256'));await invalid(twoSlides('0256'));
});
