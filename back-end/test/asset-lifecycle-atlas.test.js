'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {resolveSrv}=require('node:dns/promises');
const {createMongoConnection,bindModels}=require('../db/mongoConnection');
const {createService}=require('../services/assetLifecycle');
const {createReferenceFixture}=require('./helpers/referenceFixture');
const {user,course}=require('./helpers/serviceFixture');
const host='teachable-testing.ntguusj.mongodb.net',dbName='teachable_21b_bc3e0f91742f90ce056b';
const denied=p=>assert.rejects(p,e=>{if(e.code!=='ASSET_LIFECYCLE')process.stdout.write('# '+JSON.stringify({unexpectedRejection:{name:e.name,code:e.code,frames:e.stack?.split('\n').slice(1,5)}})+'\n');return e.code==='ASSET_LIFECYCLE';});

test('Phase 3.4 actual synthetic Atlas reference fences and lifecycle; provider is an in-memory fixture',{
 skip:!process.env.MONGODB_TEST_MODE&&'BLOCKED: explicit Atlas fixture opt-in required',timeout:600000
},async t=>{
 const manager=createMongoConnection('synthetic-test'),owned=new Map(),inventory=new Map(),remote=new Map(),requests=new WeakSet();
 let connection,models,Intent,Cases,service;let calls=0,onIdentity=null,onDelete=null,clear=true;const authorityId=randomUUID(),approvalId=randomUUID();
 const request=()=>{const r=Object.freeze({});requests.add(r);return r;};
 const req=request();
 async function ownership(){for(const [name,o] of owned){const entry=await connection.db.listCollections({name}).next();assert.ok(entry?.info?.uuid);assert.deepEqual(entry.info.uuid,o.uuid);assert.deepEqual(entry.options.validator,o.validator);}return true;}
 async function tx(fn){const session=await connection.startSession();try{return await session.withTransaction(()=>fn(session),{readConcern:{level:'snapshot'},writeConcern:{w:'majority'},readPreference:'primary'});}finally{await session.endSession();}}
 function candidate(){const token=randomUUID(),identity={assetId:randomUUID(),publicId:'synthetic/'+randomUUID(),environment:'development',cloudName:'synthetic-cloud',displayName:'Synthetic',resourceType:'image',deliveryType:'authenticated',classification:'private',format:'png',version:1,bytes:100};inventory.set(token,identity);remote.set(identity.assetId,true);return {token,identity};}
 const stored=i=>{const {cloudName,...a}=i;return a;};
 async function approved(item=candidate()){const c=await service.assess(item.token,req);assert.equal(c.state,'candidate');assert.equal((await service.approve(c.id,req)).state,'approved');return {...item,id:c.id};}
 async function releaseSynthetic(c){remote.set(c.identity.assetId,false);assert.equal((await service.reconcile(c.id,req)).state,'deletion-verified');}
 async function executed(c){const before=calls,result=await service.execute(c.id,req);assert.equal(calls,before+1);assert.ok(['deletion-verified','uncertain'].includes(result.state));if(result.state==='uncertain'){assert.equal(remote.get(c.identity.assetId),false);assert.equal((await Cases.findOne({key:'reference-fence'})).pendingCase,c.id);assert.equal((await service.reconcile(c.id,req)).state,'deletion-verified');}assert.equal(calls,before+1);}
 let next=100;
 async function material(identity,session){return new models.Material({id:++next,name:'Synthetic reference',course:parent._id,asset:stored(identity)}).save({session});}
 let parent;
 async function step(name,fn){let failure;await t.test(name,async()=>{try{await fn();}catch(e){t.diagnostic(JSON.stringify({assertion:e?.code==='ERR_ASSERTION',actual:typeof e?.actual==='string'&&['approved','uncertain','deletion-verified','deletion-pending'].includes(e.actual)?e.actual:typeof e?.actual==='number'?e.actual:null,expected:typeof e?.expected==='string'&&['approved','uncertain','deletion-verified','deletion-pending'].includes(e.expected)?e.expected:typeof e?.expected==='number'?e.expected:null,location:e?.stack?.split('\n').find(line=>line.includes('asset-lifecycle-atlas.test.js:'))?.trim()}));failure=new Error(`Synthetic lifecycle verification: ${e?.code==='ERR_ASSERTION'?'assertion':e?.code==='ASSET_LIFECYCLE'?'lifecycle-boundary':'database-or-harness'}; details suppressed`);throw failure;}});if(failure)throw failure;}
 try{
  const records=await resolveSrv('_mongodb._tcp.'+host);assert.equal(records.length,3);assert.ok(records.every(r=>r.port===27017&&r.name.endsWith('.ntguusj.mongodb.net')));
  connection=await manager.acquire();assert.equal(connection.name,dbName);assert.equal(connection.getClient().options.tls,true);assert.equal(connection.getClient().options.srvHost,host);
  const hello=await connection.db.admin().command({hello:1});assert.equal(hello.isWritablePrimary,true);assert.ok(hello.logicalSessionTimeoutMinutes>0);assert.equal(hello.setName,'atlas-9b57wc-shard-0');assert.deepEqual(hello.hosts.slice().sort(),records.map(r=>r.name+':'+r.port).sort());
  const auth=await connection.db.admin().command({connectionStatus:1});assert.deepEqual(auth.authInfo.authenticatedUserRoles,[{role:'readWrite',db:dbName}]);
  assert.deepEqual(await connection.db.listCollections({},{nameOnly:true}).toArray(),[]);
  models=bindModels(connection);Intent=connection.model('UploadIntent',require('../models/UploadIntent'));
  for(const M of [...Object.values(models),Intent]){const name=M.collection.name,validator={$jsonSchema:{description:'Synthetic lifecycle owner '+randomUUID()}};await connection.db.createCollection(name,{validator});const e=await connection.db.listCollections({name}).next();assert.ok(e?.info?.uuid);assert.deepEqual(e.options.validator,validator);owned.set(name,{uuid:e.info.uuid,validator});await M.createIndexes();}
  Cases=await createReferenceFixture(connection,owned);
  await tx(async session=>{await new models.User(user(1,'admin')).save({session});parent=await new models.Course(course(10)).save({session});});
  const deps={enabled:true,models,verifyIsolation:ownership,resolveCandidate:async token=>inventory.has(token)?{...inventory.get(token)}:null,
   authorizeOwner:async(r,b)=>requests.has(r)?{...b,authority:'project-owner',authorityId,approvalId,scope:'synthetic-only'}:null,
   verifyClearance:async b=>({...b,syntheticFixture:inventory.size>0&&[...inventory.values()].some(i=>i.assetId===b.assetId),neverReferenced:clear,historyClear:clear,backupClear:clear,restoreClear:clear,legalHoldClear:clear,retentionClear:clear}),
   provider:{verifyIdentity:async b=>{if(onIdentity)await onIdentity(b);return {...b,present:remote.get(b.assetId)===true};},delete:async(b,attemptId)=>{calls++;remote.set(b.assetId,false);if(onDelete)await onDelete(b,attemptId);},verifyAbsence:async(b,attemptId)=>({...b,attemptId,absent:remote.get(b.assetId)===false})}};
  service=createService(deps);
  await step('concurrent independent service claimants dispatch only once and persist absence/tombstone',async()=>{
   const c=await approved(),before=calls;const results=await Promise.allSettled([service.execute(c.id,req),createService(deps).execute(c.id,req)]);
   t.diagnostic(JSON.stringify({claimResults:results.map(r=>r.status==='fulfilled'?r.value.state:'rejected'),deleteCalls:calls-before}));assert.ok(results.some(r=>r.status==='fulfilled'));assert.equal(calls,before+1);assert.equal((await service.reconcile(c.id,req)).state,'deletion-verified');
   await denied(tx(s=>material(c.identity,s)));const changed={...c.identity,assetId:randomUUID(),version:2};await denied(tx(s=>material(changed,s)));
   await denied(tx(s=>material({...c.identity,publicId:'synthetic/other',environment:'preview'},s)));
  });
  await step('overlapping reference and claim transactions serialize and retry against fresh references',async()=>{
   const c=await approved(),before=calls;let arrived,release;
   const written=new Promise(r=>{arrived=r;}),resume=new Promise(r=>{release=r;});
   const writer=tx(async s=>{await material(c.identity,s);arrived();await resume;});
   await written;const save=Cases.prototype.save;let competed=false;
   Cases.prototype.save=function(...args){if(this.kind==='guard'&&!competed){competed=true;release();}return save.apply(this,args);};
   try{const result=await service.execute(c.id,req);await writer;assert.equal(result.state,'held');assert.equal(calls,before);assert.equal(competed,true);}
   finally{release();Cases.prototype.save=save;await writer;}
  });
  await step('reference committed before cleanup claim wins; duplicates and removed/archived rows stay protected',async()=>{
   const c=await approved();await tx(async s=>{const m=await material(c.identity,s);m.removedAt=new Date();m.removedBy=(await models.User.findOne({id:1}).session(s))._id;await m.save({session:s});await material(c.identity,s);});
   const before=calls;assert.equal((await service.execute(c.id,req)).state,'held');assert.equal(calls,before);
  });
  await step('durable pending claim blocks all reference-model writers including reserved intents',async()=>{
   const c=await approved();let release,arrived;const barrier=new Promise(r=>{arrived=r;});const resume=new Promise(r=>{release=r;});onIdentity=async()=>{arrived();await resume;};
   const work=service.execute(c.id,req);try{await barrier;
    await denied(tx(s=>material(candidate().identity,s)));
    await denied(tx(s=>new models.User(user(600,'student')).save({session:s})));
    await denied(tx(s=>new models.Course(course(600)).save({session:s})));
    const a=candidate().identity,createdAt=new Date();await denied(tx(s=>new Intent({id:randomUUID(),actorId:1,purpose:'profile',targetId:1,environment:a.environment,cloudName:a.cloudName,publicId:a.publicId,createdAt,expiresAt:new Date(+createdAt+600000),state:'issued',outstanding:true,previousAsset:stored(a)}).save({session:s})));
   }finally{release();onIdentity=null;}const result=await work;assert.ok(['deletion-verified','uncertain'].includes(result.state));if(result.state==='uncertain'){assert.equal((await Cases.findOne({key:'reference-fence'})).pendingCase,c.id);await releaseSynthetic(c);}
  });
  await step('reserved/expired intents protect identities even without verified asset metadata',async()=>{
   const c=candidate(),createdAt=new Date();await tx(s=>new Intent({id:randomUUID(),actorId:1,purpose:'profile',targetId:1,environment:c.identity.environment,cloudName:c.identity.cloudName,publicId:c.identity.publicId,createdAt,expiresAt:new Date(+createdAt+600000),state:'expired',outstanding:false,previousAsset:stored(candidate().identity)}).save({session:s}));
   assert.equal((await service.assess(c.token,req)).reason,'referenced');
  });
  await step('actual transaction rollback does not leave a case claim or authorize a side effect',async()=>{
   const c=await approved(),save=Cases.prototype.save;let once=true;Cases.prototype.save=function(...a){if(this.state==='deletion-pending'&&once){once=false;throw Error('synthetic rollback');}return save.apply(this,a);};const before=calls;
   try{await denied(service.execute(c.id,req));}finally{Cases.prototype.save=save;}
   assert.equal(calls,before);assert.equal((await Cases.findOne({key:c.id})).state,'approved');assert.equal((await Cases.findOne({key:'reference-fence'})).pendingCase,undefined);
   await executed(c);
  });
  await step('unknown committed dispatch never calls provider; restart reconciliation cannot blindly retry',async()=>{
   const c=await approved(),start=connection.startSession;let once=true;
   connection.startSession=async function(...a){const s=await start.apply(this,a),run=s.withTransaction.bind(s);s.withTransaction=async(...args)=>{const result=await run(...args);if(result?.attemptId&&once){once=false;throw Error('synthetic unknown commit');}return result;};return s;};const before=calls;
   try{await denied(service.execute(c.id,req));}finally{connection.startSession=start;}
   assert.equal(calls,before);assert.equal((await Cases.findOne({key:c.id})).state,'deletion-pending');
   assert.equal((await createService(deps).execute(c.id,req)).state,'deletion-pending');assert.equal(calls,before);
   assert.equal((await createService(deps).reconcile(c.id,req)).state,'uncertain');assert.ok((await Cases.findOne({key:'reference-fence'})).pendingCase);await releaseSynthetic(c);
  });
  await step('lost provider response and unknown absence commit reconcile without repeated deletion',async()=>{
   const c=await approved();onDelete=async()=>{throw Error('synthetic response loss');};const before=calls;
   try{assert.equal((await service.execute(c.id,req)).state,'uncertain');}finally{onDelete=null;}
   assert.equal(calls,before+1);assert.equal((await createService(deps).reconcile(c.id,req)).state,'deletion-verified');assert.equal(calls,before+1);
   const d=await approved(),start=connection.startSession;let once=true;connection.startSession=async function(...a){const s=await start.apply(this,a),run=s.withTransaction.bind(s);s.withTransaction=async(...args)=>{const result=await run(...args);if(result?.state==='deletion-verified'&&once){once=false;throw Error('synthetic lost absence commit');}return result;};return s;};
   try{await service.execute(d.id,req);}finally{connection.startSession=start;}
   const count=calls;assert.equal((await service.reconcile(d.id,req)).state,'deletion-verified');assert.equal(calls,count);
  });
  await step('revoked clearance before dispatch causes durable escalation with no deletion',async()=>{
   const c=await approved();onIdentity=async()=>{clear=false;};const before=calls;
   try{assert.equal((await service.execute(c.id,req)).state,'uncertain');assert.equal(calls,before);}finally{clear=true;onIdentity=null;}
   await releaseSynthetic(c);
  });
  await step('guard rollback/retry and missing fence do not silently enable reference writes',async()=>{
   const c=candidate();const before=await models.Material.countDocuments();await assert.rejects(tx(async s=>{await material(c.identity,s);throw Error('rollback');}));assert.equal(await models.Material.countDocuments(),before);
   const guard=await Cases.findOne({key:'reference-fence'});await Cases.collection.deleteOne({_id:guard._id});
   try{await denied(tx(s=>material(c.identity,s)));}finally{await Cases.collection.insertOne(guard.toObject({transform:false}));}
   assert.equal(await models.Material.countDocuments(),before);
  });
  await step('migration cannot restore a retained tombstone identity through its existing save paths',async()=>{
   const input=require('./helpers/migrationFixture').snapshot(),item=candidate();item.identity.bytes=input.assets[0].bytes;
   const c=await approved(item);await executed(c);
   await ownership();for(const M of [...Object.values(models),Intent])await M.collection.deleteMany({});
   for(const row of input.resolutions.users)row.profileImage=stored(c.identity);
   input.resolutions.courses[0].coverImage=stored(c.identity);input.resolutions.materials[0].asset=stored(c.identity);input.assets[0].assetId=c.identity.assetId;
   await assert.rejects(require('../migrations/migration').applyMigration(input,{models,dryRun:false,verifyTarget:ownership,verifyAsset:async()=>true,verifyHistory:async()=>true}),e=>e.code==='MIGRATION_WRITE');
   assert.equal(await models.User.countDocuments(),0);assert.equal((await Cases.findOne({key:c.id})).state,'deletion-verified');
  });
 }finally{
  try{if(connection){await ownership();for(const [name,o] of owned){const e=await connection.db.listCollections({name}).next();assert.deepEqual(e.info.uuid,o.uuid);assert.deepEqual(e.options.validator,o.validator);await connection.db.collection(name).drop();owned.delete(name);}assert.deepEqual(await connection.db.listCollections({},{nameOnly:true}).toArray(),[]);t.diagnostic('Exact host/db/TLS/role/replica preflight; random marker and UUID ownership; final namespace empty; no Cloudinary calls.');}}
  finally{await manager.close();}
 }
});
