'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/uploadFixture');
const { createService } = require('../services/imageUploads');
const denied=(p,code)=>assert.rejects(p,e=>e.code===code&&!e.cause);

test('missing request trust, provider, config or quota indexes denies before issuance',async()=>{
  for(const changes of [{authorizeRequest:undefined},{createProvider:undefined},{verifyAsset:undefined},{environment:'production'}]) {
    const f=fixture(changes);await assert.rejects(f.service.issue({purpose:'profile',targetId:2},f.request(2)));assert.equal(f.intents.length,0);
  }
  const f=fixture();f.Intent.listIndexes=async()=>[];
  await denied(f.service.issue({purpose:'profile',targetId:2},f.request(2)),'INDEX_UNVERIFIED');
});
test('trusted actor and purpose/target bindings reject spoofing and current authorization failures',async()=>{
  const f=fixture();
  for(const data of [{purpose:'material',targetId:10},{purpose:'profile',targetId:2,actorId:1},{purpose:'profile',targetId:'2'}])await denied(f.service.issue(data,f.request(2)),'INVALID_INPUT');
  await denied(f.service.issue({purpose:'profile',targetId:3},f.request(2)),'DENIED');
  await denied(f.service.issue({purpose:'course',targetId:10},f.request(3)),'DENIED');
  f.student.accountState='disabled';await denied(f.service.issue({purpose:'profile',targetId:2},f.request(2)),'DENIED');
});
test('intent reserves random server identity and exact ten-minute window with no TTL deletion',async()=>{
  const f=fixture();const r=await f.service.issue({purpose:'profile',targetId:2},f.request(2));const i=f.intents[0];
  assert.match(r.id,/^[a-f0-9-]{36}$/);assert.equal(i.expiresAt-i.createdAt,600000);assert.equal(i.actorId,2);assert.equal(i.state,'issued');assert.equal(i.outstanding,true);
  assert.equal(i.environment,'development');assert.equal(i.cloudName,'synthetic-cloud');assert.ok(i.publicId.includes(r.id));
  assert.deepEqual(Object.keys(r).sort(),['expiresAt','id','state']);assert.ok(!f.Intent.schema.indexes().some(([,o])=>o.expireAfterSeconds!==undefined));
});
test('target and user outstanding limits, rolling-hour quota and expired-record preservation',async()=>{
  const f=fixture();const req=f.request(1);
  await f.service.issue({purpose:'course',targetId:10},req);
  await denied(f.service.issue({purpose:'course',targetId:10},req),'CONFLICT');
  await f.service.issue({purpose:'profile',targetId:1},req);
  f.addCourse(11);await denied(f.service.issue({purpose:'course',targetId:11},req),'LIMIT_EXCEEDED');
  f.advance(600000);await f.service.issue({purpose:'course',targetId:11},req);assert.equal(f.intents.length,3);assert.equal(f.intents.filter(x=>x.state==='expired').length,2);
  for(let n=0;n<7;n++){f.intents.at(-1).state='rejected';f.intents.at(-1).outstanding=false;await f.service.issue({purpose:'course',targetId:11},req);}
  f.intents.at(-1).outstanding=false;f.intents.at(-1).state='rejected';await denied(f.service.issue({purpose:'course',targetId:11},req),'LIMIT_EXCEEDED');
  f.advance(3600000);await f.service.issue({purpose:'course',targetId:11},req);
});
test('inspection precedes provider transfer; private attachment preserves previous reference',async()=>{
  const f=fixture();const old=f.student.profileImage.toObject();const req=f.request(2);const i=await f.service.issue({purpose:'profile',targetId:2},req);
  const r=await f.service.upload(i.id,Buffer.from('synthetic bytes'),req);
  assert.deepEqual(r,{id:i.id,state:'attached'});assert.deepEqual(f.events,['inspect','upload','verify']);
  assert.equal(f.student.profileImage.classification,'private');assert.equal(f.student.profileImage.deliveryType,'authenticated');
  assert.equal(f.intents[0].previousAsset.assetId,old.assetId);assert.equal(f.intents[0].state,'attached');assert.equal(f.intents[0].outstanding,false);
  assert.equal(f.options.overwrite,false);assert.equal(f.options.type,'authenticated');assert.equal(f.options.resource_type,'image');
  assert.deepEqual(await f.service.reconcile(i.id,req),r);await denied(f.service.upload(i.id,Buffer.from('again'),req),'CONFLICT');assert.equal(f.events.filter(x=>x==='upload').length,1);
});
test('course upload stays private and does not change publication state',async()=>{
  const f=fixture();f.c.lifecycle='draft';const req=f.request(1);const i=await f.service.issue({purpose:'course',targetId:10},req);
  await f.service.upload(i.id,Buffer.from('synthetic'),req);assert.equal(f.c.lifecycle,'draft');assert.equal(f.c.coverImage.classification,'private');
});
test('malformed, oversize and unavailable inspection never reach provider',async()=>{
  for(const changes of [{inspectImage:async()=>{throw Error('decode');}},{inspectImage:async()=>({format:'pdf',bytes:1,sha256:'a'.repeat(64)})}]){
    const f=fixture(changes);const req=f.request(2);const i=await f.service.issue({purpose:'profile',targetId:2},req);
    await assert.rejects(f.service.upload(i.id,Buffer.from('bad'),req));assert.equal(f.events.includes('upload'),false);assert.equal(f.student.profileImage.assetId,'synthetic');
  }
  const f=fixture();const req=f.request(2);const i=await f.service.issue({purpose:'profile',targetId:2},req);await denied(f.service.upload(i.id,Buffer.alloc(5_000_001),req),'INVALID_INPUT');
});
test('provider metadata and independently verified digest must exactly match reservation',async()=>{
  for(const override of [{publicId:'foreign'},{environment:'production'},{cloudName:'wrong'},{deliveryType:'upload'},{sha256:'a'.repeat(64)},{bytes:999},{format:'jpg'},{assetId:''},{version:0}]){
    const f=fixture({verifiedOverride:override});const req=f.request(2);const i=await f.service.issue({purpose:'profile',targetId:2},req);
    await denied(f.service.upload(i.id,Buffer.from('synthetic'),req),'ASSET_UNVERIFIED');assert.equal(f.student.profileImage.assetId,'synthetic');assert.equal(f.intents[0].state,'recovery');
  }
});
test('lost provider response is reconciled without a second transfer',async()=>{
  const f=fixture({lostResponse:true});const req=f.request(2);const i=await f.service.issue({purpose:'profile',targetId:2},req);
  await denied(f.service.upload(i.id,Buffer.from('synthetic'),req),'UNAVAILABLE');assert.equal(f.intents[0].state,'recovery');
  assert.equal((await f.service.reconcile(i.id,req)).state,'attached');assert.equal(f.events.filter(x=>x==='upload').length,1);
});
test('expiry and changed actor or target prevent attachment and preserve old assets',async()=>{
  for(const mutate of [f=>f.advance(600000),f=>{f.student.accountState='disabled';},f=>{f.student.profileImage.assetId='changed';}]) {
    const f=fixture({beforeVerify:()=>mutate(f)});const req=f.request(2);const i=await f.service.issue({purpose:'profile',targetId:2},req);
    await assert.rejects(f.service.upload(i.id,Buffer.from('synthetic'),req));assert.notEqual(f.student.profileImage.assetId,'provider-asset');assert.notEqual(f.intents[0].state,'attached');
  }
});
test('foreign intent cannot be read or consumed, and expired intents remain recorded',async()=>{
  const f=fixture();const i=await f.service.issue({purpose:'profile',targetId:2},f.request(2));
  await denied(f.service.reconcile(i.id,f.request(3)),'NOT_FOUND');f.advance(600000);
  await denied(f.service.upload(i.id,Buffer.from('synthetic'),f.request(2)),'CONFLICT');assert.equal(f.intents.length,1);assert.equal(f.intents[0].state,'expired');
});
test('intent schema rejects unsafe bindings and lifecycle inconsistencies',async()=>{
  const f=fixture();await f.service.issue({purpose:'profile',targetId:2},f.request(2));
  const raw=f.intents[0].toObject({transform:false});
  for(const change of [{actorId:'2'},{targetId:-1},{environment:'other'},{expiresAt:new Date(raw.createdAt.getTime()+1)},{state:'attached'},{outstanding:false},{token:'client'},{id:'guessable'}]) {
    await assert.rejects(async()=>new f.Intent({...raw,...change}).validate());
  }
});
test('a competing replay cannot cancel the upload that owns inspection',async()=>{
  let entered,release;const ready=new Promise(r=>{entered=r;});const wait=new Promise(r=>{release=r;});
  const {createHash}=require('node:crypto');
  const f=fixture({inspectImage:async b=>{entered();await wait;return {format:'png',bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};}});
  const req=f.request(2);const i=await f.service.issue({purpose:'profile',targetId:2},req);
  const first=f.service.upload(i.id,Buffer.from('synthetic'),req).then(value=>({value}),error=>({error}));await ready;
  await denied(f.service.upload(i.id,Buffer.from('replay'),req),'CONFLICT');
  const state=f.intents[0].state;release();const result=await first;
  assert.equal(state,'inspecting');assert.equal(result.value?.state,'attached');
});
test('abandoned inspection can expire through reconciliation without provider access',async()=>{
  const f=fixture();const req=f.request(2);const i=await f.service.issue({purpose:'profile',targetId:2},req);f.intents[0].state='inspecting';f.advance(600000);
  assert.deepEqual(await f.service.reconcile(i.id,req),{id:i.id,state:'expired'});assert.equal(f.intents[0].outstanding,false);assert.equal(f.events.length,0);
});
test('expiry during final asset attestation cannot commit an expired attachment',async()=>{
  const f=fixture({verifyAsset:async()=>{f.advance(600000);return true;}});const req=f.request(2);const i=await f.service.issue({purpose:'profile',targetId:2},req);
  await denied(f.service.upload(i.id,Buffer.from('synthetic'),req),'CONFLICT');assert.equal(f.student.profileImage.assetId,'synthetic');
});
test('bounded work retains slots on timeout and cannot attach after cancellation',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let release;const wait=new Promise(r=>{release=r;});let entered=0,ready;
  const arrived=new Promise(r=>{ready=r;});const {createHash}=require('node:crypto');
  const f=fixture({inspectImage:async b=>{if(++entered===2)ready();await wait;return {format:'png',bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};}});
  const a=await f.service.issue({purpose:'profile',targetId:2},f.request(2));const b=await f.service.issue({purpose:'profile',targetId:3},f.request(3));const c=await f.service.issue({purpose:'profile',targetId:1},f.request(1));
  const first=f.service.upload(a.id,Buffer.from('a'),f.request(2));const second=f.service.upload(b.id,Buffer.from('b'),f.request(3));
  const outcomes=Promise.all([first,second].map(p=>p.then(()=>null,e=>e.code)));await arrived;
  t.mock.timers.tick(15000);assert.deepEqual(await outcomes,['UNAVAILABLE','UNAVAILABLE']);
  await denied(f.service.upload(c.id,Buffer.from('c'),f.request(1)),'LIMIT_EXCEEDED');
  release();for(let n=0;n<50;n++)await new Promise(r=>setImmediate(r));
  assert.equal(f.events.includes('upload'),false);assert.equal(f.student.profileImage.assetId,'synthetic');
  assert.equal(f.intents.find(i=>i.id===a.id).state,'rejected');
});
test('course/profile 5,000,000-byte boundary accepted after inspection',async()=>{
  const f=fixture();const req=f.request(2);const i=await f.service.issue({purpose:'profile',targetId:2},req);
  assert.equal((await f.service.upload(i.id,Buffer.alloc(5_000_000),req)).state,'attached');assert.equal(f.student.profileImage.bytes,5_000_000);
});
test('another admin can replace an expired never-uploaded target intent without deleting its history',async()=>{
  const f=fixture();f.instructor.role='admin';const first=await f.service.issue({purpose:'course',targetId:10},f.request(1));f.advance(600000);f.admin.accountState='disabled';
  const second=await f.service.issue({purpose:'course',targetId:10},f.request(3));assert.notEqual(second.id,first.id);assert.equal(f.intents[0].state,'expired');assert.equal(f.intents.length,2);
});
