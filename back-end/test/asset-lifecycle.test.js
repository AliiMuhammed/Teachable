'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');
const denied = p => assert.rejects(p, e => e.code === 'ASSET_LIFECYCLE' && !e.cause);
const lifecycle = () => require('../services/assetLifecycle');

test('cleanup is disabled by default before resolving identity or invoking any dependency', async () => {
  let called=0; const service=lifecycle().createService({resolveCandidate:()=>{called++;}});
  for(const name of ['assess','approve','execute','reconcile','inspect']) await denied(service[name](randomUUID(),{}));
  assert.equal(called,0);
});

test('all four reference models reject untransactional new reference saves before database I/O',async()=>{
  const {user,course,asset}=require('./helpers/serviceFixture');
  const connection=mongoose.createConnection();
  try {
    const values={User:user(901,'student'),Course:course(902),Material:{id:903,name:'Synthetic',course:new mongoose.Types.ObjectId(),asset:asset()},UploadIntent:{id:randomUUID(),actorId:1,purpose:'profile',targetId:1,environment:'development',cloudName:'synthetic-cloud',publicId:'synthetic/reserved',createdAt:new Date(0),expiresAt:new Date(600000),state:'issued',outstanding:true,previousAsset:asset()}};
    for(const [name,value] of Object.entries(values)){
      const M=connection.model(name,require('../models/'+name));
      await assert.rejects(new M(value).save(),e=>e.code==='ASSET_LIFECYCLE');
      await assert.rejects(M.insertMany([value]),e=>e.code==='ASSET_LIFECYCLE');
    }
  } finally {await connection.destroy();}
});

test('lifecycle schema refuses identity edits, unknown fields, unsafe audit payloads and invalid state',async()=>{
  const schema=require('../models/AssetLifecycle');const c=mongoose.createConnection();
  try {const M=c.model('AssetLifecycle',schema);await assert.rejects(new M({key:'x',kind:'case',state:'approved',events:[{secret:'no'}]}).validate());assert.equal(schema.options.autoCreate,false);assert.equal(schema.options.strict,'throw');assert.ok(schema.indexes().some(([k,o])=>k.key===1&&o.unique));assert.ok(!schema.indexes().some(([,o])=>o.expireAfterSeconds!==undefined));}
  finally {await c.destroy();}
});

const fixture=options=>require('./helpers/lifecycleFixture').fixture(options);
async function approved(f){const c=await f.service.assess(f.token,f.request);assert.equal(c.state,'candidate');return f.service.approve(c.id,f.request);}

test('never-referenced synthetic case requires explicit approval and independently verified absence',async()=>{
 const f=fixture(),c=await f.service.assess(f.token,f.request);await denied(f.service.execute(c.id,f.request));
 await f.service.approve(c.id,f.request);assert.equal((await f.service.execute(c.id,f.request)).state,'deletion-verified');
 assert.deepEqual(f.calls,['delete']);await f.service.execute(c.id,f.request);await f.service.reconcile(c.id,f.request);assert.equal(f.calls.length,1);
 const persisted=f.rows.AssetLifecycle.find(x=>x.key===c.id);assert.equal(persisted.events.at(-1).reason,'absence-verified');assert.ok(!JSON.stringify(persisted.toObject({transform:false})).includes('synthetic-secret'));
});
for(const kind of ['User','Course','Material','removed','archived','shared','previous','reserved','expired','staged','recovery'])test('protects '+kind+' references without calling delete',async()=>{
 const f=fixture();const a={...f.identity};delete a.cloudName;
 if(kind==='User'||kind==='shared')f.student.profileImage=a;
 if(kind==='Course'||kind==='archived'||kind==='shared'){f.c.coverImage=a;if(kind==='archived')f.c.lifecycle='archived';}
 if(kind==='Material'||kind==='removed'){f.rows.Material[0].asset=a;if(kind==='removed')f.rows.Material[0].removedAt=new Date();}
 if(['previous','reserved','expired','staged','recovery'].includes(kind)){
  const i={publicId:kind==='previous'?'another':a.publicId,environment:a.environment,cloudName:f.identity.cloudName,state:kind,outstanding:kind!=='expired'};if(kind==='previous')i.previousAsset=a;f.intents.push(i);
 }
 const c=await f.service.assess(f.token,f.request);assert.equal(c.state,'held');assert.equal(c.reason,'referenced');await denied(f.service.approve(c.id,f.request));assert.equal(f.calls.length,0);
});
for(const field of ['historyClear','backupClear','restoreClear','legalHoldClear','retentionClear','neverReferenced','syntheticFixture'])test('unknown '+field+' holds candidate',async()=>{
 const f=fixture();const verify=f.deps.verifyClearance;f.deps.verifyClearance=async b=>({...await verify(b),[field]:undefined});f.service=lifecycle().createService(f.deps);
 const c=await f.service.assess(f.token,f.request);assert.equal(c.state,'held');await denied(f.service.execute(c.id,f.request));assert.equal(f.calls.length,0);
});
test('missing trusted authority and resolver, forged client identity and wrong database fail closed',async()=>{
 const f=fixture();await denied(f.service.assess(f.token,{}));await denied(f.service.assess(f.identity,f.request));
 for(const changes of [{authorizeOwner:undefined},{resolveCandidate:undefined},{verifyIsolation:undefined}])await denied(lifecycle().createService({...f.deps,...changes}).assess(f.token,f.request));
 f.models.User.db.name='production';await denied(f.service.assess(f.token,f.request));assert.equal(f.calls.length,0);
});
test('identity mismatch immediately before dispatch remains uncertain and never calls delete',async()=>{
 for(const field of ['assetId','publicId','environment','cloudName','resourceType','deliveryType','version','classification']){
 const f=fixture(),c=await approved(f);f.deps.provider.verifyIdentity=async b=>({...b,present:true,[field]:field==='version'?2:'foreign'});
 assert.equal((await f.service.execute(c.id,f.request)).state,'uncertain');assert.equal(f.calls.length,0);
 }
});
test('lost deletion response reconciles through absence, never repeats deletion',async()=>{
 const f=fixture(),c=await approved(f),del=f.deps.provider.delete;f.deps.provider.delete=async(...a)=>{await del(...a);throw Error('secret provider response');};
 assert.equal((await f.service.execute(c.id,f.request)).state,'uncertain');assert.equal(f.calls.length,1);
 f.service=lifecycle().createService(f.deps);assert.equal((await f.service.reconcile(c.id,f.request)).state,'deletion-verified');assert.equal(f.calls.length,1);
});
test('unverified absence and stale approvals cannot release a pending fence',async()=>{
 const f=fixture(),c=await approved(f);f.deps.provider.verifyAbsence=async()=>({absent:true});
 assert.equal((await f.service.execute(c.id,f.request)).state,'uncertain');assert.ok(f.rows.AssetLifecycle[0].pendingCase);
 f.deps.authorizeOwner=async()=>null;f.service=lifecycle().createService(f.deps);await denied(f.service.reconcile(c.id,f.request));assert.ok(f.rows.AssetLifecycle[0].pendingCase);
});
test('candidate assessment alone permits new references; confirmed tombstones reject identity reuse',async()=>{
 const f=fixture(),c=await f.service.assess(f.token,f.request);const a={...f.identity};delete a.cloudName;
 const M=f.models.Material;await new M({id:99,name:'New reference',course:f.c._id,asset:a}).save();assert.equal((await f.service.approve(c.id,f.request)).state,'held');
 const g=fixture(),d=await approved(g);await g.service.execute(d.id,g.request);const b={...g.identity};delete b.cloudName;
 await denied(new g.models.Material({id:100,name:'Forbidden reuse',course:g.c._id,asset:b}).save());assert.equal(g.rows.Material.length,1);
});

test('authorized inspection exposes bounded audit without exposing provider credentials',async()=>{
 const f=fixture(),c=await approved(f);await f.service.execute(c.id,f.request);const view=await f.service.inspect(c.id,f.request);
 assert.ok(Array.isArray(view.events));assert.equal(view.events.at(-1).state,'deletion-verified');assert.equal(view.identity.assetId,f.identity.assetId);assert.ok(view.approvalId);await denied(f.service.inspect(c.id,{}));
});

test('late identity verification after timeout never dispatches deletion and keeps the fence',async()=>{
 const f=fixture(),c=await approved(f);let finish;f.deps.provider.verifyIdentity=b=>new Promise(r=>{finish=()=>r({...b,present:true});});
 const result=await f.service.execute(c.id,f.request);assert.equal(result.state,'uncertain');finish();await new Promise(r=>setImmediate(r));assert.equal(f.calls.length,0);assert.ok(f.rows.AssetLifecycle[0].pendingCase);
});

test('missing or malformed guard/index and foreign transaction client fail closed',async()=>{
 for(const variant of ['guard','index','client']){
 const f=fixture();if(variant==='guard')f.rows.AssetLifecycle.length=0;
 if(variant==='index')f.models.AssetLifecycle.listIndexes=async()=>[];
 if(variant==='client')f.models.User.db.startSession=async()=>({client:{},inTransaction:()=>true,withTransaction:async fn=>fn(),endSession:async()=>{}});
 await denied(f.service.assess(f.token,f.request));assert.equal(f.calls.length,0);
 }
});

test('stale case authorization after identity verification prevents dispatch',async()=>{
 const f=fixture(),c=await approved(f);f.deps.provider.verifyIdentity=async b=>{f.deps.authorizeOwner=async()=>null;return {...b,present:true};};assert.equal((await f.service.execute(c.id,f.request)).state,'uncertain');assert.equal(f.calls.length,0);
});

test('forged absence identity/version/attempt cannot release a fence',async()=>{
 for(const field of ['assetId','environment','cloudName','version','attemptId']){
 const f=fixture(),c=await approved(f);f.deps.provider.verifyAbsence=async(b,a)=>({...b,attemptId:a,absent:true,[field]:field==='version'?2:'foreign'});
 assert.equal((await f.service.execute(c.id,f.request)).state,'uncertain');assert.ok(f.rows.AssetLifecycle[0].pendingCase);assert.equal(f.calls.length,1);
 }
});

test('held candidate can be reassessed with fresh clearance without reopening completed attempts',async()=>{
 const f=fixture();const verify=f.deps.verifyClearance;f.deps.verifyClearance=async()=>null;
 const held=await f.service.assess(f.token,f.request);assert.equal(held.state,'held');f.deps.verifyClearance=verify;
 const candidate=await f.service.assess(f.token,f.request);assert.equal(candidate.id,held.id);assert.equal(candidate.state,'candidate');
 await f.service.approve(candidate.id,f.request);await f.service.execute(candidate.id,f.request);assert.equal((await f.service.assess(f.token,f.request)).state,'deletion-verified');assert.equal(f.calls.length,1);
});

test('persisted case identity and terminal tombstone audit cannot be rewritten',async()=>{
 const schema=require('../models/AssetLifecycle'),c=mongoose.createConnection(),M=c.model('AssetLifecycle',schema);const {asset}=require('./helpers/serviceFixture');
 const raw={key:randomUUID(),kind:'case',asset:asset(),cloudName:'synthetic-cloud',state:'deletion-verified',reason:'absence-verified',authorityId:randomUUID(),approvalId:randomUUID(),attemptId:randomUUID(),events:[{state:'deletion-verified',reason:'absence-verified',at:new Date(),correlation:randomUUID()}]};
 try{
  for(const field of ['assetId','publicId','environment','version']){const d=M.hydrate(raw);d.asset[field]=field==='version'?2:'changed';await assert.rejects(d.validate());}
  const state=M.hydrate(raw);state.state='candidate';await assert.rejects(state.validate());
  const audit=M.hydrate(raw);audit.events[0].reason='clear';await assert.rejects(audit.validate());
 }finally{await c.destroy();}
});

test('reassessment rejects aliases with changed identity and requires authority over the existing case',async()=>{
 for(const field of ['version','publicId','environment','cloudName']){
  const f=fixture();await f.service.assess(f.token,f.request);f.identity[field]=field==='version'?2:field==='environment'?'preview':'changed';await denied(f.service.assess(f.token,f.request));
 }
 const f=fixture(),c=await f.service.assess(f.token,f.request),auth=f.deps.authorizeOwner;
 f.deps.authorizeOwner=async(r,b)=>b.caseId===c.id?null:auth(r,b);await denied(f.service.assess(f.token,f.request));
});

test('unexpected TTL index and lifecycle model purges are refused',async()=>{
 const f=fixture(),indexes=f.models.AssetLifecycle.listIndexes;f.models.AssetLifecycle.listIndexes=async()=>[...await indexes(),{key:{'events.at':1},expireAfterSeconds:1}];await denied(f.service.assess(f.token,f.request));
 const c=mongoose.createConnection();try{const M=c.model('AssetLifecycle',require('../models/AssetLifecycle'));await assert.rejects(M.deleteMany({}),/Lifecycle deletion is not supported/);await assert.rejects(M.deleteOne({}),/Lifecycle deletion is not supported/);}finally{await c.destroy();}
});

test('find-and-delete model shortcuts cannot erase lifecycle tombstones or guards',async()=>{
 const c=mongoose.createConnection();try{const M=c.model('AssetLifecycle',require('../models/AssetLifecycle'));
  for(const query of [M.findOneAndDelete({key:'reference-fence'}),M.findByIdAndDelete(new mongoose.Types.ObjectId())]){query.setOptions({bufferTimeoutMS:1});await assert.rejects(query,/Lifecycle deletion is not supported/);}
 }finally{await c.destroy();}
});
