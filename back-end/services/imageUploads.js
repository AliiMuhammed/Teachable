'use strict';
const { randomUUID, createHash } = require('node:crypto');
const { readCloudinaryConfig } = require('../config/cloudinary');
const { support, fail, fields, id, asset } = require('./serviceSupport');
const intentSchema = require('../models/UploadIntent');
const { inspectImage: decodeImage } = require('../assets/inspectImage');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
let processing = 0;
const plainAsset = value => Object.fromEntries(['assetId','publicId','environment','displayName','resourceType','deliveryType','classification','format','version','bytes'].map(key => [key,value[key]]));
const sameAsset = (a,b) => Object.keys(plainAsset(a)).every(key => a[key] === b[key]);
const receipt = intent => ({ id: intent.id, state: intent.state });

function createService(dependencies = {}) {
  const { run } = support(dependencies);
  const { environment, env, authorizeRequest, createProvider, verifyAsset, inspectImage = decodeImage, clock = () => new Date() } = dependencies;
  const now = () => { const date = clock(); if (!(date instanceof Date) || !Number.isFinite(date.getTime())) fail('UNAVAILABLE'); return date; };
  async function context(request) {
    if (typeof authorizeRequest !== 'function') fail('TRUST_REQUIRED');
    let ctx;
    try { ctx = await authorizeRequest(request); } catch { fail('TRUST_REQUIRED'); }
    if (ctx == null) fail('TRUST_REQUIRED');
    return ctx;
  }
  function provider() {
    if (typeof createProvider !== 'function' || typeof verifyAsset !== 'function' || typeof inspectImage !== 'function') fail('WORKFLOW_REQUIRED');
    try {
      const config = readCloudinaryConfig(environment, env);
      const adapter = createProvider(config);
      if (typeof adapter?.upload !== 'function' || typeof adapter?.verify !== 'function') throw 0;
      return { adapter, cloudName: config.cloud_name };
    } catch { fail('WORKFLOW_REQUIRED'); }
  }
  function model(s) {
    const connection = s.models.User.db;
    const M = connection.models.UploadIntent || connection.model('UploadIntent', intentSchema);
    if (M.schema !== intentSchema || M.db !== connection || M.collection.name !== 'uploadIntents') fail('UNAVAILABLE');
    return M;
  }
  async function indexes(M) {
    const installed = await M.listIndexes();
    for (const [key, options] of intentSchema.indexes()) {
      if (!installed.some(index => JSON.stringify(index.key) === JSON.stringify(key) &&
        Boolean(index.unique) === Boolean(options.unique) && !index.sparse && !index.hidden &&
        index.expireAfterSeconds === undefined && (!index.collation || index.collation.locale === 'simple') &&
        JSON.stringify(index.partialFilterExpression) === JSON.stringify(options.partialFilterExpression))) fail('INDEX_UNVERIFIED');
    }
  }
  async function target(s, purpose, targetId) {
    id(targetId);
    if (purpose === 'profile') { s.self(targetId); return s.actor; }
    if (purpose !== 'course') fail('INVALID_INPUT');
    s.role('admin');
    const course = await s.required('Course', { id: targetId });
    if (course.lifecycle === 'archived') fail('WORKFLOW_REQUIRED');
    return course;
  }
  const query = (M, s, filter) => M.findOne(filter).session(s.session).maxTimeMS(5000);
  async function load(s, key, cloudName) {
    if (typeof key !== 'string' || !uuid.test(key)) fail('INVALID_INPUT');
    const M = model(s); await indexes(M);
    const intent = await query(M, s, { id:key, actorId:s.actor.id, environment, cloudName });
    if (!intent) fail('NOT_FOUND');
    const doc = await target(s, intent.purpose, intent.targetId);
    return { intent, doc };
  }
  const imageField = intent => intent.purpose === 'profile' ? 'profileImage' : 'coverImage';
  const save = (intent,s) => intent.save({ session:s.session });
  async function change(key, request, cloudName, fn) {
    return run(await context(request), async s => {
      const { intent, doc } = await load(s,key,cloudName);
      await s.lockActor();
      return fn(s,intent,doc);
    });
  }
  async function recovery(key,request,cloudName,ownsInspection=false) {
    try {
      await change(key,request,cloudName,async(s,i)=>{
        if (['uploading','staged'].includes(i.state)) { i.state='recovery'; await save(i,s); }
        else if (ownsInspection && i.state==='inspecting') { i.state='rejected';i.outstanding=false;await save(i,s); }
      });
    } catch { /* The committed pre-transfer intent remains recoverable when the DB or actor is unavailable. */ }
  }
  // Retain the slot until work actually settles, even if a provider ignores cancellation.
  async function bounded(work) {
    if (processing >= 2) fail('LIMIT_EXCEEDED');
    processing++;
    const controller = new AbortController(); let timer;
    const pending = Promise.resolve().then(() => work(controller.signal)).finally(() => { processing--; clearTimeout(timer); });
    const timeout = new Promise((_,reject) => { timer=setTimeout(()=>{controller.abort();try{fail('UNAVAILABLE');}catch(e){reject(e);}},15000); });
    return Promise.race([pending,timeout]);
  }
  function alive(signal) { if (signal.aborted) fail('UNAVAILABLE'); }
  async function complete(key,request,p,signal) {
    const snapshot = await change(key,request,p.cloudName,async(s,i)=>{
      if(['attached','expired','rejected'].includes(i.state)) return {done:receipt(i)};
      if(['issued','inspecting'].includes(i.state) && now()>=i.expiresAt) {
        i.state='expired';i.outstanding=false;await save(i,s);return {done:receipt(i)};
      }
      if(!['uploading','staged','recovery'].includes(i.state)) fail('CONFLICT');
      return { publicId:i.publicId, environment:i.environment, cloudName:i.cloudName, sha256:i.sha256, format:i.format, bytes:i.bytes };
    });
    if(snapshot.done) return snapshot.done;
    alive(signal);
    let verified;
    try { verified=await p.adapter.verify(Object.freeze({...snapshot}),signal); } catch { fail('UNAVAILABLE'); }
    alive(signal);
    if(!verified || ['publicId','environment','cloudName','sha256','format','bytes'].some(k=>verified[k]!==snapshot[k]) ||
      verified.resourceType!=='image' || verified.deliveryType!=='authenticated' ||
      typeof verified.assetId!=='string' || !verified.assetId.trim() || verified.assetId.length>255 ||
      !Number.isSafeInteger(verified.version) || verified.version<1) fail('ASSET_UNVERIFIED');
    const value=asset({assetId:verified.assetId,publicId:snapshot.publicId,environment,displayName:'Image',resourceType:'image',deliveryType:'authenticated',classification:'private',format:snapshot.format,bytes:snapshot.bytes,version:verified.version},true);
    const result=await change(key,request,p.cloudName,async(s,i,doc)=>{
      alive(signal);
      if(i.state==='attached') return receipt(i);
      if(!['uploading','staged','recovery'].includes(i.state) || i.sha256!==snapshot.sha256) fail('CONFLICT');
      i.asset=value;
      if(now()>=i.expiresAt) {i.state='expired';i.outstanding=false;await save(i,s);return {expired:true};}
      if(!sameAsset(doc[imageField(i)],i.previousAsset)) fail('CONFLICT');
      await s.verify(value,i.purpose,i.purpose==='course'?i.targetId:undefined);
      alive(signal);
      if(now()>=i.expiresAt) {i.state='expired';i.outstanding=false;await save(i,s);return {expired:true};}
      doc[imageField(i)]=value;
      // lockActor already saved a profile actor; explicitly save the new image in this transaction.
      if(i.purpose==='profile') await doc.save({session:s.session}); else await s.touch(doc);
      i.state='attached';i.outstanding=false;await save(i,s);
      return receipt(i);
    });
    if(result.expired) fail('CONFLICT');
    return result;
  }
  return Object.freeze({
    issue: async(data,request)=>{
      fields(data,['purpose','targetId'],['purpose','targetId']);
      const ctx=await context(request);
      const p=provider();
      const key=randomUUID();
      for(let attempt=0;attempt<2;attempt++) {
      const result=await run(ctx,async s=>{
        const doc=await target(s,data.purpose,data.targetId);await s.lockActor();await s.touch(doc);
        const M=model(s);await indexes(M);const time=now();
        const outstanding=await M.find({actorId:s.actor.id,outstanding:true}).session(s.session).limit(3).maxTimeMS(5000);
        let expired=false;
        for(const i of outstanding) if(['issued','inspecting'].includes(i.state) && time>=i.expiresAt) {i.state='expired';i.outstanding=false;await save(i,s);expired=true;}
        const reserved=await query(M,s,{purpose:data.purpose,targetId:data.targetId,outstanding:true});
        if(reserved && ['issued','inspecting'].includes(reserved.state) && time>=reserved.expiresAt) {
          reserved.state='expired';reserved.outstanding=false;await save(reserved,s);expired=true;
        }
        // Commit expiry first: unique index keys are not reused inside the same transaction.
        if(expired) return {retry:true};
        if(outstanding.filter(i=>i.outstanding).length>=2) fail('LIMIT_EXCEEDED');
        const recent=await M.find({actorId:s.actor.id,createdAt:{$gte:new Date(time.getTime()-3600000)}}).session(s.session).limit(10).maxTimeMS(5000);
        if(recent.length>=10) fail('LIMIT_EXCEEDED');
        if(reserved) fail('CONFLICT');
        const intent=new M({id:key,actorId:s.actor.id,purpose:data.purpose,targetId:data.targetId,environment,cloudName:p.cloudName,publicId:`teachable/${environment}/${key}`,createdAt:time,expiresAt:new Date(time.getTime()+600000),state:'issued',outstanding:true,previousAsset:plainAsset(doc[data.purpose==='profile'?'profileImage':'coverImage'])});
        await save(intent,s);return { ...receipt(intent),expiresAt:intent.expiresAt.toISOString() };
      });
      if(!result.retry) return result;
      }
      fail('CONFLICT');
    },
    upload: async(key,bytes,request)=>{
      if(!Buffer.isBuffer(bytes) || bytes.length<1 || bytes.length>5_000_000) fail('INVALID_INPUT');
      // Authenticate before copying/decoding; ingress must bound allocation before this service call.
      await context(request);
      const p=provider();
      return bounded(async signal=>{
        const input=Buffer.from(bytes);
        let ownsInspection=false;
        try {
          const claimed=await change(key,request,p.cloudName,async(s,i)=>{
            alive(signal);if(i.state!=='issued') fail('CONFLICT');
            if(now()>=i.expiresAt){i.state='expired';i.outstanding=false;await save(i,s);return false;}
            i.state='inspecting';await save(i,s);return true;
          });
          if(!claimed) fail('CONFLICT');
          ownsInspection=true;
          let inspected;
          try { inspected=await inspectImage(input,signal); } catch { fail('INVALID_INPUT'); }
          alive(signal);
          const digest=createHash('sha256').update(input).digest('hex');
          if(!inspected || !['jpg','png','webp'].includes(inspected.format) || inspected.bytes!==input.length || inspected.sha256!==digest) fail('INVALID_INPUT');
          const options=await change(key,request,p.cloudName,async(s,i)=>{
            alive(signal);if(i.state!=='inspecting') fail('CONFLICT');
            if(now()>=i.expiresAt){i.state='expired';i.outstanding=false;await save(i,s);return null;}
            i.sha256=digest;i.format=inspected.format;i.bytes=input.length;i.state='uploading';await save(i,s);
            return Object.freeze({public_id:i.publicId,resource_type:'image',type:'authenticated',overwrite:false,format:i.format});
          });
          if(!options) fail('CONFLICT');
          alive(signal);
          try { await p.adapter.upload(input,options,signal); } catch { fail('UNAVAILABLE'); }
          alive(signal);
          await change(key,request,p.cloudName,async(s,i)=>{if(i.state==='uploading'){i.state='staged';await save(i,s);}});
          return await complete(key,request,p,signal);
        } catch(error) {
          if(ownsInspection) await recovery(key,request,p.cloudName,true);
          if(error?.name==='ServiceError') throw error;
          fail('UNAVAILABLE');
        }
      });
    },
    reconcile: async(key,request)=>{
      await context(request);const p=provider();
      return bounded(async signal=>{
        try{return await complete(key,request,p,signal);}
        catch(error){await recovery(key,request,p.cloudName);if(error?.name==='ServiceError')throw error;fail('UNAVAILABLE');}
      });
    }
  });
}
module.exports = { createService };
