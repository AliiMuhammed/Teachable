'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/materialFixture');
const { createService, createMaterialService } = require('../services/imageUploads');
const denied = (p, code) => assert.rejects(p, e => e.code === code && !e.cause);
const data = { courseId: 10, name: 'Private handout' };
const bytes = Buffer.from('synthetic structurally inspected document');

test('material workflow has a separate opt-in factory', () => assert.equal(typeof createMaterialService, 'function'));
test('missing scanner, identity, provider, counter or indexes refuses material issuance', async () => {
  for (const changes of [{scanMaterial:undefined},{authorizeRequest:undefined},{authenticate:undefined},{createProvider:undefined},{verifyCounter:undefined},{inspectMaterial:null}]) {
    const f=fixture(changes); await assert.rejects(f.material.issue(data,f.request(3))); assert.equal(f.intents.length,0);
  }
  const f=fixture();f.Intent.listIndexes=async()=>[];
  await denied(f.material.issue(data,f.request(3)),'INDEX_UNVERIFIED'); assert.equal(f.allocated(),100);
});
test('pending identity is server allocated and bound to current assigned instructor/course', async()=>{
  const f=fixture();const issued=await f.material.issue(data,f.request(3));const i=f.intents[0];
  assert.equal(i.targetId,101);assert.equal(i.courseId,10);assert.equal(String(i.course),String(f.c._id));
  assert.equal(i.materialName,'Private handout');assert.equal(i.purpose,'material');assert.equal(i.expiresAt-i.createdAt,600000);
  assert.equal(f.rows.Material.length,1);assert.equal(i.previousAsset,undefined);
  assert.deepEqual(Object.keys(issued).sort(),['expiresAt','id','state']);
  for(const input of [{...data,targetId:40},{...data,asset:{publicId:'foreign'}},{...data,name:''},{...data,courseId:'10'}])await denied(f.material.issue(input,f.request(3)),'INVALID_INPUT');
  await denied(f.material.issue(data,f.request(2)),'DENIED');f.rows.InstructorAssignment.length=0;
  await denied(f.material.issue(data,f.request(3)),'DENIED');
});
test('atomic material attachment retains existing records and reconciles without another transfer',async()=>{
  const f=fixture();const req=f.request(3);const issued=await f.material.issue(data,req);
  const r=await f.material.upload(issued.id,bytes,req);assert.equal(r.state,'attached');
  assert.deepEqual(f.events,['inspect','scan','upload','verify']);assert.equal(f.rows.Material.length,2);
  const m=f.rows.Material.find(x=>x.id===101);assert.equal(m.name,data.name);assert.equal(String(m.course),String(f.c._id));
  assert.equal(m.asset.resourceType,'raw');assert.equal(m.asset.classification,'private');assert.equal(m.asset.deliveryType,'authenticated');
  assert.equal(f.rows.Material[0].asset.assetId,'synthetic');assert.equal(f.options.overwrite,false);
  assert.equal(f.intents[0].scannedSha256,f.intents[0].sha256);
  assert.deepEqual(await f.material.reconcile(issued.id,req),r);
  await denied(f.material.upload(issued.id,bytes,req),'CONFLICT');assert.equal(f.events.filter(x=>x==='upload').length,1);
});
test('scanner errors, unclean/different digest and mutation deny transfer',async()=>{
  for(const scanMaterial of [async()=>{throw Error('scanner secret');},async()=>({clean:false}),async()=>({clean:true,sha256:'f'.repeat(64)}),async(b,i)=>{b[0]^=1;return {clean:true,sha256:i.sha256};}]) {
    const f=fixture({scanMaterial});const req=f.request(3);const i=await f.material.issue(data,req);
    await assert.rejects(f.material.upload(i.id,bytes,req));assert.equal(f.events.includes('upload'),false);assert.equal(f.intents[0].state,'rejected');assert.equal(f.rows.Material.length,1);
  }
});
test('material limits differ from unchanged course/profile limits',async()=>{
  for(const [format,size,allowed] of [['png',10_000_000,true],['png',10_000_001,false],['pdf',25_000_000,true],['pdf',25_000_001,false]]) {
    const f=fixture({format});const req=f.request(3);const i=await f.material.issue(data,req);
    if(allowed)assert.equal((await f.material.upload(i.id,Buffer.alloc(size),req)).state,'attached');
    else {await denied(f.material.upload(i.id,Buffer.alloc(size),req),'INVALID_INPUT');assert.equal(f.events.includes('upload'),false);}
  }
  const f=fixture();const req=f.request(1);const i=await f.service.issue({purpose:'profile',targetId:1},req);
  await denied(f.service.upload(i.id,Buffer.alloc(5_000_001),req),'INVALID_INPUT');
});
test('both factories share outstanding and rolling-hour quotas but reject each other intents',async()=>{
  const f=fixture();const req=f.request(1);const image=await f.service.issue({purpose:'profile',targetId:1},req);const material=await f.material.issue(data,req);
  await denied(f.material.issue(data,req),'LIMIT_EXCEEDED');assert.equal(f.allocated(),101);
  await denied(f.material.upload(image.id,bytes,req),'NOT_FOUND');await denied(f.service.upload(material.id,bytes,req),'NOT_FOUND');
  f.advance(600000);await f.material.issue(data,req);assert.equal(f.intents.filter(x=>x.state==='expired').length,2);
  for(let n=0;n<7;n++){const i=f.intents.at(-1);i.state='rejected';i.outstanding=false;await f.material.issue(data,req);}
  f.intents.at(-1).state='rejected';f.intents.at(-1).outstanding=false;
  await denied(f.material.issue(data,req),'LIMIT_EXCEEDED');assert.equal(f.intents.length,10);
});
test('stale permission, changed course binding or expiry denies attachment',async()=>{
  for(const change of [f=>{f.instructor.accountState='disabled';},f=>{f.rows.InstructorAssignment.length=0;},f=>{f.c.lifecycle='archived';},f=>f.advance(600000)]){
    const f=fixture({beforeVerify:change});const req=f.request(3);const i=await f.material.issue(data,req);
    await assert.rejects(f.material.upload(i.id,bytes,req));assert.equal(f.rows.Material.length,1);assert.notEqual(f.intents[0].state,'attached');
  }
});
test('provider substitution and missing independent asset proof prevent attachment',async()=>{
  for(const change of [{cloudName:'foreign'},{environment:'production'},{resourceType:'image'},{deliveryType:'upload'},{sha256:'0'.repeat(64)},{publicId:'foreign'}]){
    const f=fixture({verifiedOverride:change});const req=f.request(3);const i=await f.material.issue(data,req);
    await denied(f.material.upload(i.id,bytes,req),'ASSET_UNVERIFIED');assert.equal(f.rows.Material.length,1);
  }
  const f=fixture({verifyAsset:async()=>false});const req=f.request(3);const i=await f.material.issue(data,req);
  await denied(f.material.upload(i.id,bytes,req),'ASSET_UNVERIFIED');
});
test('lost transfer result reconciles once and expired records remain preserved',async()=>{
  const f=fixture({lostResponse:true});const req=f.request(3);const i=await f.material.issue(data,req);
  await denied(f.material.upload(i.id,bytes,req),'UNAVAILABLE');assert.equal(f.intents[0].state,'recovery');assert.equal(f.rows.Material.length,1);
  assert.equal((await f.material.reconcile(i.id,req)).state,'attached');assert.equal(f.rows.Material.length,2);
  assert.equal(f.events.filter(x=>x==='upload').length,1);
  const next=await f.material.issue(data,req);f.advance(600000);assert.equal((await f.material.reconcile(next.id,req)).state,'expired');assert.equal(f.intents.length,2);
});
test('durable material schema rejects unscanned and over-limit attachment evidence',async()=>{
  const f=fixture();const req=f.request(3);const i=await f.material.issue(data,req);await f.material.upload(i.id,bytes,req);
  const raw=f.intents[0].toObject({transform:false});
  for(const changes of [{scannedSha256:undefined},{scannedSha256:'a'.repeat(64)},{courseId:undefined},{course:undefined},{materialName:undefined},{format:'png',bytes:10_000_001}])await assert.rejects(new f.Intent({...raw,...changes}).validate());
});
