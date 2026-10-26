'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { createHash } = require('node:crypto');
const { inspectImage } = require('../assets/inspectImage');

for (const format of ['jpeg', 'png', 'webp']) test(`fully decodes synthetic ${format} bytes`, async () => {
  const bytes = await sharp({create:{width:2,height:2,channels:3,background:'#123456'}}).toFormat(format).toBuffer();
  assert.deepEqual(await inspectImage(bytes), {format:format==='jpeg'?'jpg':format,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  await assert.rejects(inspectImage(bytes.subarray(0, Math.floor(bytes.length/2))), e=>e.code==='INVALID_INPUT');
});
test('rejects strings, URLs, empty, oversized, unsupported and fake image bytes', async () => {
  for (const value of ['https://example.invalid/a.png',Buffer.alloc(0),Buffer.alloc(5_000_001),Buffer.from('PNG is not an image'),Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>')])
    await assert.rejects(inspectImage(value),e=>e.code==='INVALID_INPUT');
});
test('rejects images whose decoded dimensions exceed the resource bound', async () => {
  const bytes=await sharp({create:{width:4001,height:4000,channels:3,background:'black'}}).png().toBuffer();
  assert.ok(bytes.length<5_000_000);
  await assert.rejects(inspectImage(bytes),e=>e.code==='INVALID_INPUT');
});
test('aborted inspection fails closed', async()=>{
  await assert.rejects(inspectImage(Buffer.from('abc'),AbortSignal.abort()),e=>e.code==='UNAVAILABLE');
});
for(const [name,data] of [
  ['valid animation','iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACGFjVEwAAAACAAAAAPONk3AAAAAaZmNUTAAAAAAAAAACAAAAAgAAAAAAAAAAAAEACgAA6FTcAAAAABBJREFUeJxj+M/AAEQMEAoAH+4D/YtfFNQAAAAaZmNUTAAAAAEAAAACAAAAAgAAAAAAAAAAAAEACgAAcyc21AAAABNmZEFUAAAAAnicY2Bg+A9GYAoAF/YD/bF4aK8AAAAASUVORK5CYII='],
  ['malformed second frame','iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACGFjVEwAAAACAAAAAPONk3AAAAAaZmNUTAAAAAAAAAACAAAAAgAAAAAAAAAAAAEACgAA6FTcAAAAABBJREFUeJxj+M/AAEQMEAoAH+4D/YtfFNQAAAAaZmNUTAAAAAEAAAACAAAAAgAAAAAAAAAAAAEACgAAcyc21AAAABpmZEFUAAAAAm5vdCBkZWZsYXRlIGltYWdlIGRhdGEGXhJlAAAAAElFTkSuQmCC']
]) test(`APNG ${name} is rejected because subsequent frames cannot be attested`,async()=>{
  await assert.rejects(inspectImage(Buffer.from(data,'base64')),e=>e.code==='INVALID_INPUT');
});
