'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { resolveSrv } = require('node:dns/promises');
const sharp = require('sharp');
const { createMongoConnection, bindModels } = require('../db/mongoConnection');
const { createService } = require('../services/imageUploads');
const { user, course } = require('./helpers/serviceFixture');
const host='teachable-testing.ntguusj.mongodb.net';
const dbName='teachable_21b_bc3e0f91742f90ce056b';
const denied=(p,code)=>assert.rejects(p,e=>e.code===code&&!e.cause);

test('Phase 3.2 synthetic Atlas upload intents and atomic attachment (no Cloudinary)',{
  skip:!process.env.MONGODB_TEST_MODE && 'BLOCKED: explicit Atlas fixture opt-in required',timeout:600000
},async t=>{
  const manager=createMongoConnection('synthetic-test');const owned=new Map();let connection,models,Intent;
  let time=Date.parse('2026-10-26T00:00:00Z');const tokens=new WeakMap();
  const request=id=>{const context=Object.freeze({});tokens.set(context,id);return {context};};
  const env={CLOUDINARY_ENV:'development',CLOUDINARY_CLOUD_NAME:'synthetic-cloud',CLOUDINARY_API_KEY:'synthetic-key',CLOUDINARY_API_SECRET:'synthetic-secret'};
  const remote=new Map();let uploads=0,lost=false,mutate=null;
  const provider={upload:async(bytes,options)=>{
    uploads++;assert.equal(options.type,'authenticated');assert.equal(options.overwrite,false);assert.equal(options.resource_type,'image');
    remote.set(options.public_id,{assetId:randomUUID(),publicId:options.public_id,environment:'development',cloudName:'synthetic-cloud',resourceType:'image',deliveryType:'authenticated',format:'png',bytes:bytes.length,version:1,sha256:createHash('sha256').update(bytes).digest('hex')});
    if(lost)throw Error('synthetic lost response');
  },verify:async binding=>{if(mutate)await mutate();return remote.get(binding.publicId);}};
  const bytes=await sharp({create:{width:2,height:2,channels:3,background:'red'}}).png().toBuffer();
  let services;
  const latestUser=id=>models.User.findOne({id}).select('+passwordHash +emailKey +publicProfileApprovedAt +integrityVersion');
  async function step(name,fn){let error;await t.test(name,async()=>{try{await fn();}catch(e){error=new Error(`Synthetic upload test failure: ${e?.code==='ERR_ASSERTION'?'assertion':e?.name==='ServiceError'?e.code:'database-or-harness'}; details suppressed`);throw error;}});if(error)throw error;}
  try {
    const records=await resolveSrv(`_mongodb._tcp.${host}`);assert.equal(records.length,3);assert.ok(records.every(r=>r.port===27017&&r.name.endsWith(host.slice(host.indexOf('.')))));
    connection=await manager.acquire();assert.equal(connection.name,dbName);assert.equal(connection.getClient().options.tls,true);
    const hello=await connection.db.admin().command({hello:1});assert.equal(hello.isWritablePrimary,true);assert.ok(hello.logicalSessionTimeoutMinutes>0);assert.equal(hello.setName,'atlas-9b57wc-shard-0');assert.deepEqual(hello.hosts.slice().sort(),records.map(r=>`${r.name}:${r.port}`).sort());
    const auth=await connection.db.admin().command({connectionStatus:1});assert.deepEqual(auth.authInfo.authenticatedUserRoles,[{role:'readWrite',db:dbName}]);
    assert.deepEqual(await connection.db.listCollections({},{nameOnly:true}).toArray(),[],'Refuse existing namespace');
    models=bindModels(connection);Intent=connection.model('UploadIntent',require('../models/UploadIntent'));
    for(const M of [...Object.values(models),Intent]){
      const name=M.collection.name;const validator={$jsonSchema:{description:`Synthetic Phase 3.2 owner ${randomUUID()}`}};
      await connection.db.createCollection(name,{validator});const entry=await connection.db.listCollections({name}).next();assert.ok(entry?.info?.uuid);assert.deepEqual(entry.options.validator,validator);owned.set(name,{uuid:entry.info.uuid,validator});
      for(const [key,options] of M.schema.indexes()) if(M===Intent||options.unique)await M.collection.createIndex(key,options);
    }
    await require('./helpers/referenceFixture').createReferenceFixture(connection,owned);
    require('./helpers/referenceFixture').transactionalSeeds({...models,...(connection.models.UploadIntent?{UploadIntent:connection.models.UploadIntent}:{})});
    for(const [id,role] of [[1,'admin'],[2,'student'],[3,'admin'],[4,'admin']])await new models.User(user(id,role)).save();
    for(const id of [10,11,12,13])await new models.Course({...course(id),lifecycle:'draft'}).save();
    const deps={manager,authenticate:async ctx=>tokens.get(ctx),authorizeRequest:async req=>req.context,verifyAsset:async()=>true,environment:'development',env,clock:()=>new Date(time),createProvider:()=>provider};
    services=[createService(deps),createService(deps)];
    await step('installed unique/partial indexes and concurrent same-target issuance across actors',async()=>{
      const results=await Promise.allSettled([services[0].issue({purpose:'course',targetId:10},request(1)),services[1].issue({purpose:'course',targetId:10},request(3))]);
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(await Intent.countDocuments({purpose:'course',targetId:10,outstanding:true}),1);
      const i=await Intent.findOne({purpose:'course',targetId:10});i.state='rejected';i.outstanding=false;await i.save();
    });
    await step('three simultaneous intents across service instances cannot exceed two per actor',async()=>{
      const results=await Promise.allSettled([10,11,12].map((targetId,n)=>services[n%2].issue({purpose:'course',targetId},request(1))));
      t.diagnostic(JSON.stringify({quotaResults:results.map(r=>r.status==='fulfilled'?'fulfilled':['RETRY_EXHAUSTED','CONFLICT','LIMIT_EXCEEDED','UNAVAILABLE'].includes(r.reason?.code)?r.reason.code:'rejected')}));
      assert.equal(results.filter(r=>r.status==='fulfilled').length,2);assert.equal(await Intent.countDocuments({actorId:1,outstanding:true}),2);
      for(const i of await Intent.find({actorId:1,outstanding:true})){i.state='rejected';i.outstanding=false;await i.save();}
    });
    await step('ten-per-hour limit persists across instances and expired records are retained',async()=>{
      for(let n=0;n<10;n++){const issued=await services[n%2].issue({purpose:'profile',targetId:4},request(4));const i=await Intent.findOne({id:issued.id});i.state='rejected';i.outstanding=false;await i.save();}
      await denied(services[1].issue({purpose:'profile',targetId:4},request(4)),'LIMIT_EXCEEDED');assert.equal(await Intent.countDocuments({actorId:4}),10);
      time+=3600001;const issued=await services[0].issue({purpose:'profile',targetId:4},request(4));time+=600000;
      assert.equal((await services[1].reconcile(issued.id,request(4))).state,'expired');assert.equal(await Intent.countDocuments({actorId:4}),11);
    });
    await step('real decoding, restricted provider contract and atomic private profile attachment',async()=>{
      const req=request(2);const issued=await services[0].issue({purpose:'profile',targetId:2},req);
      assert.equal((await services[0].upload(issued.id,bytes,req)).state,'attached');
      const i=await Intent.findOne({id:issued.id});const u=await latestUser(2);assert.equal(u.profileImage.assetId,i.asset.assetId);assert.equal(i.previousAsset.assetId,'synthetic');assert.equal(i.outstanding,false);
      const before=uploads;await denied(services[1].upload(issued.id,bytes,req),'CONFLICT');assert.equal((await services[1].reconcile(issued.id,req)).state,'attached');assert.equal(uploads,before);
    });
    await step('failed intent save rolls back profile attachment and can reconcile once',async()=>{
      const req=request(2);const previous=(await latestUser(2)).profileImage.assetId;const issued=await services[0].issue({purpose:'profile',targetId:2},req);
      const original=Intent.prototype.save;let failOnce=true;
      Intent.prototype.save=function(...args){if(this.state==='attached'&&failOnce){failOnce=false;throw Error('synthetic abort');}return original.apply(this,args);};
      try{await denied(services[0].upload(issued.id,bytes,req),'UNAVAILABLE');}finally{Intent.prototype.save=original;}
      assert.equal((await latestUser(2)).profileImage.assetId,previous);assert.equal((await Intent.findOne({id:issued.id})).state,'recovery');
      const before=uploads;assert.equal((await services[1].reconcile(issued.id,req)).state,'attached');assert.equal(uploads,before);
    });
    await step('unknown committed result never reports success prematurely or transfers twice',async()=>{
      const req=request(2);const issued=await services[0].issue({purpose:'profile',targetId:2},req);
      const start=connection.startSession;let lostCommit=true;
      connection.startSession=async function(...args){const session=await start.apply(this,args);const tx=session.withTransaction.bind(session);session.withTransaction=async(...a)=>{const r=await tx(...a);if(r?.state==='attached'&&lostCommit){lostCommit=false;throw Error('synthetic unknown commit result');}return r;};return session;};
      try{await denied(services[0].upload(issued.id,bytes,req),'UNAVAILABLE');}finally{connection.startSession=start;}
      const i=await Intent.findOne({id:issued.id});assert.equal(i.state,'attached');assert.equal((await latestUser(2)).profileImage.assetId,i.asset.assetId);
      const before=uploads;assert.equal((await services[1].reconcile(issued.id,req)).state,'attached');assert.equal(uploads,before);
    });
    await step('provider response loss preserves intent and course then reconciles privately',async()=>{
      const req=request(3);const issued=await services[0].issue({purpose:'course',targetId:13},req);lost=true;
      try{await denied(services[0].upload(issued.id,bytes,req),'UNAVAILABLE');}finally{lost=false;}
      assert.equal((await models.Course.findOne({id:13})).coverImage.assetId,'synthetic');const before=uploads;
      assert.equal((await services[1].reconcile(issued.id,req)).state,'attached');assert.equal(uploads,before);const c=await models.Course.findOne({id:13});assert.equal(c.lifecycle,'draft');assert.equal(c.coverImage.classification,'private');
    });
    await step('authorization revoked after upload denies attachment and retains staged evidence',async()=>{
      const req=request(2);const previous=(await latestUser(2)).profileImage.assetId;const issued=await services[0].issue({purpose:'profile',targetId:2},req);
      mutate=async()=>{const u=await latestUser(2);u.accountState='disabled';u.integrityVersion++;await u.save();};
      try{await denied(services[0].upload(issued.id,bytes,req),'DENIED');}finally{mutate=null;}
      assert.equal((await latestUser(2)).profileImage.assetId,previous);assert.equal((await Intent.findOne({id:issued.id})).state,'staged');
    });
  } finally {
    try {
      if(connection)for(const [name,owner] of owned){const entry=await connection.db.listCollections({name}).next();assert.ok(entry?.info?.uuid);assert.deepEqual(entry.info.uuid,owner.uuid);assert.deepEqual(entry.options.validator,owner.validator);await connection.db.collection(name).drop();owned.delete(name);}
      if(connection){assert.deepEqual(await connection.db.listCollections({},{nameOnly:true}).toArray(),[]);t.diagnostic('Owned UUID/marker cleanup verified; synthetic namespace empty.');}
    }finally{await manager.close();}
  }
});
