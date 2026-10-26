'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { resolveSrv } = require('node:dns/promises');
const sharp = require('sharp');
const { createMongoConnection, bindModels } = require('../db/mongoConnection');
const { createMaterialService, createService: imageService } = require('../services/imageUploads');
const { createService: accessService } = require('../services/materialAccess');
const { user, course, asset } = require('./helpers/serviceFixture');
const host='teachable-testing.ntguusj.mongodb.net', dbName='teachable_21b_bc3e0f91742f90ce056b';
const denied=(p,code)=>assert.rejects(p,e=>e.code===code&&!e.cause);

test('Phase 3.3 synthetic Atlas material lifecycle and private grant boundaries (no Cloudinary)', {
  skip:!process.env.MONGODB_TEST_MODE && 'BLOCKED: explicit Atlas fixture opt-in required', timeout:600000
}, async t => {
  const manager=createMongoConnection('synthetic-test'), owned=new Map(), tokens=new WeakMap(), remote=new Map();
  let connection,models,Intent,uploads=0,lost=false,onVerify=null,onGrant=null;
  let time=Date.parse('2026-10-26T00:00:00Z');
  const request=id=>{const context=Object.freeze({});tokens.set(context,id);return {context};};
  const env={CLOUDINARY_ENV:'development',CLOUDINARY_CLOUD_NAME:'synthetic-cloud',CLOUDINARY_API_KEY:'synthetic-key',CLOUDINARY_API_SECRET:'synthetic-secret'};
  const provider={
    upload:async(bytes,options)=>{
      uploads++;assert.equal(options.type,'authenticated');assert.equal(options.overwrite,false);
      remote.set(options.public_id,{assetId:randomUUID(),publicId:options.public_id,environment:'development',cloudName:'synthetic-cloud',
        resourceType:options.resource_type,deliveryType:'authenticated',format:options.format,bytes:bytes.length,version:1,sha256:createHash('sha256').update(bytes).digest('hex')});
      if(lost)throw Error('synthetic response loss');
    },
    verify:async binding=>{if(onVerify)await onVerify();return {...remote.get(binding.publicId),displayName:binding.displayName,classification:'private'};},
    grant:async binding=>{if(onGrant)await onGrant();return {url:'https://private.example.invalid/synthetic-grant',expiresAt:binding.expiresAt};},
    verifyGrant:async(candidate,binding)=>({...binding,url:candidate.url,expirationEnforced:true,private:true,cacheControl:'no-store',disposition:'attachment'})
  };
  const bytes=await sharp({create:{width:2,height:2,channels:3,background:'red'}}).png().toBuffer();
  const data={courseId:10,name:'Synthetic private material'};
  let services,images,access,assignment;
  async function step(name,fn){let failure;await t.test(name,async()=>{try{time+=3600001;await fn();}catch(e){failure=new Error(`Synthetic material test failure: ${e?.code==='ERR_ASSERTION'?'assertion':e?.name==='ServiceError'?e.code:'database-or-harness'}; details suppressed`);throw failure;}});if(failure)throw failure;}
  async function rejectOutstanding(actorId){for(const i of await Intent.find({actorId,outstanding:true})){i.state='rejected';i.outstanding=false;await i.save();}}
  async function materialFor(key){const i=await Intent.findOne({id:key});return models.Material.findOne({id:i.targetId});}
  try {
    const records=await resolveSrv(`_mongodb._tcp.${host}`);assert.equal(records.length,3);assert.ok(records.every(r=>r.port===27017&&r.name.endsWith('.ntguusj.mongodb.net')));
    connection=await manager.acquire();assert.equal(connection.name,dbName);assert.equal(connection.getClient().options.tls,true);
    const hello=await connection.db.admin().command({hello:1});assert.equal(hello.isWritablePrimary,true);assert.ok(hello.logicalSessionTimeoutMinutes>0);assert.equal(hello.setName,'atlas-9b57wc-shard-0');assert.deepEqual(hello.hosts.slice().sort(),records.map(r=>`${r.name}:${r.port}`).sort());
    const auth=await connection.db.admin().command({connectionStatus:1});assert.deepEqual(auth.authInfo.authenticatedUserRoles,[{role:'readWrite',db:dbName}]);
    assert.deepEqual(await connection.db.listCollections({},{nameOnly:true}).toArray(),[],'Refuse existing namespace');
    models=bindModels(connection);Intent=connection.model('UploadIntent',require('../models/UploadIntent'));
    for(const M of [...Object.values(models),Intent]){
      const name=M.collection.name,validator={$jsonSchema:{description:`Synthetic Phase 3.3 owner ${randomUUID()}`}};
      await connection.db.createCollection(name,{validator});const entry=await connection.db.listCollections({name}).next();assert.ok(entry?.info?.uuid);assert.deepEqual(entry.options.validator,validator);owned.set(name,{uuid:entry.info.uuid,validator});
      for(const [key,options] of M.schema.indexes())if(M===Intent||options.unique)await M.collection.createIndex(key,options);
    }
    for(const [id,role] of [[1,'admin'],[2,'student'],[3,'instructor']])await new models.User(user(id,role)).save();
    const c=await new models.Course(course(10)).save(),u=await models.User.findOne({id:3}),student=await models.User.findOne({id:2});
    assignment={id:20,course:c._id,instructor:u._id};await new models.InstructorAssignment(assignment).save();
    await new models.Enrollment({id:30,course:c._id,student:student._id,grade:null}).save();
    await new models.Material({id:40,name:'Original history',course:c._id,asset:{...asset(),environment:'development'}}).save();
    await new models.Counter({scope:'materials',lastAllocated:100}).save();
    const deps={manager,authenticate:async ctx=>tokens.get(ctx),authorizeRequest:async req=>req.context,verifyAsset:async()=>true,verifyCounter:async scope=>scope==='materials',
      scanMaterial:async(b,i)=>({clean:true,sha256:i.sha256}),environment:'development',env,clock:()=>new Date(time),createProvider:()=>provider};
    services=[createMaterialService(deps),createMaterialService(deps)];images=imageService(deps);access=accessService(deps);
    await step('server pending IDs, real structural image inspection, scanned atomic private attachment and history',async()=>{
      const req=request(3),issued=await services[0].issue(data,req);const before=await Intent.findOne({id:issued.id});
      assert.equal(before.targetId,101);assert.equal(before.courseId,10);assert.equal(String(before.course),String(c._id));assert.equal(await models.Material.countDocuments(),1);
      assert.equal((await services[0].upload(issued.id,bytes,req)).state,'attached');const m=await materialFor(issued.id),i=await Intent.findOne({id:issued.id});
      assert.equal(m.id,101);assert.equal(m.asset.resourceType,'image');assert.equal(m.asset.classification,'private');assert.equal(i.scannedSha256,i.sha256);
      assert.ok(await models.Material.findOne({id:40}));assert.equal(await models.Material.countDocuments(),2);
      const count=uploads;await denied(services[1].upload(issued.id,bytes,req),'CONFLICT');assert.equal((await services[1].reconcile(issued.id,req)).state,'attached');assert.equal(uploads,count);
    });
    await step('actual unique target index and concurrent cross-image/material quotas share one actor budget',async()=>{
      const req=request(1);await images.issue({purpose:'profile',targetId:1},req);
      const results=await Promise.allSettled(services.map(s=>s.issue(data,req)));assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
      assert.equal(await Intent.countDocuments({actorId:1,outstanding:true}),2);
      const i=await Intent.findOne({purpose:'material',outstanding:true});const duplicate=i.toObject({transform:false});delete duplicate._id;duplicate.id=randomUUID();duplicate.publicId='synthetic/duplicate';
      await assert.rejects(Intent.collection.insertOne(duplicate),e=>e.code===11000);
      await rejectOutstanding(1);
    });
    await step('rolling quota is durable across factories and expiry preserves pending target history',async()=>{
      const req=request(1);
      for(let n=0;n<10;n++){const i=n%2?await images.issue({purpose:'profile',targetId:1},req):await services[n%2].issue(data,req);const record=await Intent.findOne({id:i.id});record.state='rejected';record.outstanding=false;await record.save();}
      await denied(services[1].issue(data,req),'LIMIT_EXCEEDED');
      time+=3600001;const next=await services[0].issue(data,req);time+=600000;assert.equal((await services[1].reconcile(next.id,req)).state,'expired');assert.ok(await Intent.findOne({id:next.id}));assert.equal(await materialFor(next.id),null);
    });
    await step('concurrent consumption transfers and attaches once',async()=>{
      const req=request(3),i=await services[0].issue(data,req),before=uploads;
      const result=await Promise.allSettled(services.map(s=>s.upload(i.id,bytes,req)));assert.equal(result.filter(x=>x.status==='fulfilled').length,1);
      assert.equal(uploads,before+1);assert.ok(await materialFor(i.id));
    });
    await step('real transaction rollback retains pending numeric reservation and reconciles without transfer',async()=>{
      const req=request(3),i=await services[0].issue(data,req),counter=await models.Counter.findOne({scope:'materials'}).select('+lastAllocated');
      const original=Intent.prototype.save;let once=true;
      Intent.prototype.save=function(...args){if(this.state==='attached'&&once){once=false;throw Error('synthetic abort');}return original.apply(this,args);};
      try{await denied(services[0].upload(i.id,bytes,req),'UNAVAILABLE');}finally{Intent.prototype.save=original;}
      assert.equal(await materialFor(i.id),null);assert.equal((await Intent.findOne({id:i.id})).state,'recovery');
      assert.equal((await models.Counter.findOne({scope:'materials'}).select('+lastAllocated')).lastAllocated,counter.lastAllocated);
      const count=uploads;assert.equal((await services[1].reconcile(i.id,req)).state,'attached');assert.equal((await materialFor(i.id)).id,counter.lastAllocated);assert.equal(uploads,count);
    });
    await step('unknown committed result is durable and idempotent without duplicate material or provider transfer',async()=>{
      const req=request(3),i=await services[0].issue(data,req);const start=connection.startSession;let once=true;
      connection.startSession=async function(...a){const session=await start.apply(this,a),tx=session.withTransaction.bind(session);session.withTransaction=async(...args)=>{const r=await tx(...args);if(r?.state==='attached'&&once){once=false;throw Error('synthetic unknown commit');}return r;};return session;};
      try{await denied(services[0].upload(i.id,bytes,req),'UNAVAILABLE');}finally{connection.startSession=start;}
      assert.ok(await materialFor(i.id));const count=uploads,total=await models.Material.countDocuments();assert.equal((await services[1].reconcile(i.id,req)).state,'attached');assert.equal(uploads,count);assert.equal(await models.Material.countDocuments(),total);
    });
    await step('provider response loss leaves recoverable evidence and no partial material',async()=>{
      const req=request(3),i=await services[0].issue(data,req);lost=true;
      try{await denied(services[0].upload(i.id,bytes,req),'UNAVAILABLE');}finally{lost=false;}
      assert.equal(await materialFor(i.id),null);assert.equal((await Intent.findOne({id:i.id})).state,'recovery');const count=uploads;
      assert.equal((await services[1].reconcile(i.id,req)).state,'attached');assert.equal(uploads,count);
    });
    await step('assignment revocation after provider attestation blocks material attachment',async()=>{
      const req=request(3),i=await services[0].issue(data,req);onVerify=async()=>{await models.InstructorAssignment.collection.deleteOne({id:20});};
      try{await denied(services[0].upload(i.id,bytes,req),'DENIED');}finally{onVerify=null;}
      assert.equal(await materialFor(i.id),null);assert.equal((await Intent.findOne({id:i.id})).state,'staged');
      await new models.InstructorAssignment(assignment).save();assert.equal((await services[1].reconcile(i.id,req)).state,'attached');
    });
    await step('actual PDF/DOCX/PPTX inspection and raw attachment; private grants respect revocation and archived history',async()=>{
      const {pdf,zip,officeEntries}=require('./materialInspectionFixtures');
      const documents=[['pdf',await pdf()],['docx',zip(officeEntries('docx'))],['pptx',zip(officeEntries('pptx'))]];
      const req=request(3);let m;
      for(const [format,content] of documents){const i=await services[0].issue(data,req);await services[0].upload(i.id,content,req);m=await materialFor(i.id);assert.equal(m.asset.format,format);assert.equal(m.asset.resourceType,'raw');}
      const granted=await access.grant(m.id,request(2));assert.equal(Date.parse(granted.expiresAt)-time,300000);
      onGrant=async()=>{const u=await models.User.findOne({id:2}).select('+passwordHash +emailKey +publicProfileApprovedAt +integrityVersion');u.accountState='disabled';u.integrityVersion++;await u.save();};
      try{await denied(access.grant(m.id,request(2)),'DENIED');}finally{onGrant=null;}
      const u=await models.User.findOne({id:2}).select('+passwordHash +emailKey +publicProfileApprovedAt +integrityVersion');u.accountState='active';u.integrityVersion++;await u.save();
      const current=await models.Course.findOne({id:10}).select('+integrityVersion');current.lifecycle='archived';current.integrityVersion++;await current.save();
      assert.ok(await access.grant(m.id,request(2)));
      m.removedAt=new Date(time);m.removedBy=u._id;await m.save();await denied(access.grant(m.id,request(2)),'NOT_FOUND');
      assert.ok(await models.Material.findOne({id:40}));assert.ok(await models.Material.findOne({id:m.id}));
    });
  } finally {
    try {
      if(connection)for(const [name,owner] of owned){const entry=await connection.db.listCollections({name}).next();assert.ok(entry?.info?.uuid);assert.deepEqual(entry.info.uuid,owner.uuid);assert.deepEqual(entry.options.validator,owner.validator);await connection.db.collection(name).drop();owned.delete(name);}
      if(connection){assert.deepEqual(await connection.db.listCollections({},{nameOnly:true}).toArray(),[]);t.diagnostic('Exact host/database/TLS/role/replica set verified; owned marker/UUID cleanup complete; final namespace empty.');}
    } finally { await manager.close(); }
  }
});
