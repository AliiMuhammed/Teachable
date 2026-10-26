'use strict';
const { createHash } = require('node:crypto');
const { fixture: serviceFixture, course } = require('./serviceFixture');
const schema = require('../../models/UploadIntent');
const { createService } = require('../../services/imageUploads');

// Real Mongoose validation with offline persistence; concurrency/rollback needs Atlas.
function fixture(overrides={}) {
  const f=serviceFixture();const connection=f.models.User.db;
  const Intent=connection.model('UploadIntent',schema);const intents=[];
  let now=Date.parse('2026-10-26T00:00:00Z');const events=[];const remote=new Map();
  Intent.listIndexes=async()=>schema.indexes().map(([key,options])=>({key,...options}));
  const at=(d,k)=>k.split('.').reduce((v,p)=>v?.[p],d);
  const matches=(d,filter)=>Object.entries(filter).every(([k,v])=>{
    if(k==='$or')return v.some(q=>matches(d,q));
    if(v && typeof v==='object' && !(v instanceof Date)) {
      if('$gte' in v)return d[k]>=v.$gte;
      if('$lte' in v)return d[k]<=v.$lte;
      if('$in' in v)return v.$in.includes(d[k]);
    }
    return String(at(d,k))===String(v);
  });
  const query=(filter,one)=>{
    let limit=100;
    const q={session:()=>q,maxTimeMS:()=>q,limit:n=>(limit=n,q),then:(yes,no)=>Promise.resolve().then(()=>{const a=intents.filter(d=>matches(d,filter)).slice(0,limit);return one?a[0]||null:a;}).then(yes,no)};return q;
  };
  Intent.find=filter=>query(filter,false);Intent.findOne=filter=>query(filter,true);
  Intent.prototype.save=async function(options={}){await this.validate();this.$session(options.session||this.$session()||await connection.startSession());await require('../../assets/referenceFence').fenceDocument(this,['asset','previousAsset','publicId','environment','cloudName']);if(!intents.includes(this))intents.push(this);this.$isNew=false;this.$__reset();return this;};
  const env={CLOUDINARY_ENV:'development',CLOUDINARY_CLOUD_NAME:'synthetic-cloud',CLOUDINARY_API_KEY:'synthetic-key',CLOUDINARY_API_SECRET:'synthetic-secret'};
  const provider={
    upload:async(bytes,options)=>{
      events.push('upload');f.options=options;
      remote.set(options.public_id,{assetId:'provider-asset',publicId:options.public_id,environment:'development',cloudName:'synthetic-cloud',resourceType:'image',deliveryType:'authenticated',format:'png',bytes:bytes.length,version:1,sha256:createHash('sha256').update(bytes).digest('hex')});
      if(overrides.lostResponse)throw Error('lost response');return {untrusted:'ignored'};
    },
    verify:async reservation=>{events.push('verify');if(overrides.beforeVerify)overrides.beforeVerify();return {...remote.get(reservation.publicId),...overrides.verifiedOverride};}
  };
  const dependencies={...f.dependencies,environment:'development',env,clock:()=>new Date(now),authorizeRequest:async req=>req.context,
    inspectImage:async bytes=>{events.push('inspect');return {format:'png',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};},
    createProvider:config=>{if(config.cloud_name!=='synthetic-cloud'||config.secure!==true)throw Error('configuration');return provider;},...overrides};
  return Object.assign(f,{Intent,intents,events,remote,dependencies,service:createService(dependencies),request:n=>({context:f.context(n)}),advance:ms=>{now+=ms;},addCourse:id=>f.put('Course',course(id))});
}
module.exports={fixture};
