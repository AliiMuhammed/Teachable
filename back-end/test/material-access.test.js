'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture: base } = require('./helpers/serviceFixture');
const denied=(p,code)=>assert.rejects(p,e=>e.code===code&&!e.cause);
function fixture(overrides={}) {
  const f=base();let time=Date.parse('2026-10-26T00:00:00Z');let grants=0;
  f.rows.Material[0].asset.environment='development';
  const env={CLOUDINARY_ENV:'development',CLOUDINARY_CLOUD_NAME:'synthetic-cloud',CLOUDINARY_API_KEY:'synthetic-key',CLOUDINARY_API_SECRET:'synthetic-secret'};
  const provider={
    verify:async binding=>({...binding,...overrides.assetProof}),
    grant:async binding=>{grants++;if(overrides.onGrant)await overrides.onGrant(f);return {url:'https://private.example.invalid/grant',expiresAt:binding.expiresAt};},
    verifyGrant:async (candidate,binding)=>({...binding,url:candidate.url,expirationEnforced:true,private:true,cacheControl:'no-store',disposition:'attachment',...overrides.grantProof})
  };
  const dependencies={...f.dependencies,environment:'development',env,authorizeRequest:async req=>req.context,createProvider:()=>provider,clock:()=>new Date(time),...overrides};
  return Object.assign(f,{dependencies,provider,advance:ms=>{time+=ms;},grants:()=>grants,request:id=>({context:f.context(id)}),service:require('../services/materialAccess').createService(dependencies)});
}
test('private grants require current enrolled/admin/assigned access and archived history remains accessible',async()=>{
  const f=fixture();
  for(const id of [1,2,3]){const grant=await f.service.grant(40,f.request(id));assert.deepEqual(grant,{url:'https://private.example.invalid/grant',expiresAt:'2026-10-26T00:05:00.000Z'});}
  f.c.lifecycle='archived';assert.equal((await f.service.grant(40,f.request(2))).expiresAt,'2026-10-26T00:05:00.000Z');
  f.rows.Enrollment.length=0;await denied(f.service.grant(40,f.request(2)),'DENIED');assert.equal(f.grants(),4);
});
test('missing trust, provider expiry proof, config or independent ownership refuses grants',async()=>{
  for(const changes of [{authorizeRequest:undefined},{authenticate:undefined},{createProvider:undefined},{verifyAsset:undefined},{environment:'production'}]){
    const f=fixture(changes);await assert.rejects(f.service.grant(40,f.request(2)));assert.equal(f.grants(),0);
  }
  const f=fixture();f.provider.verifyGrant=undefined;await denied(f.service.grant(40,f.request(2)),'WORKFLOW_REQUIRED');assert.equal(f.grants(),0);
});
test('removed materials, disabled actors and revoked assignments never receive new grants',async()=>{
  for(const change of [f=>{f.student.accountState='disabled';},f=>{f.rows.Material[0].removedAt=new Date();f.rows.Material[0].removedBy=f.admin._id;},f=>{f.rows.Enrollment.length=0;}]){
    const f=fixture();change(f);await assert.rejects(f.service.grant(40,f.request(2)));assert.equal(f.grants(),0);
  }
  const f=fixture();f.rows.InstructorAssignment.length=0;await denied(f.service.grant(40,f.request(3)),'DENIED');
  await denied(f.service.grant({id:40,url:'https://evil.invalid'},f.request(1)),'INVALID_INPUT');
});
test('provider identity, environment, ownership and private resource type must exactly match stored asset',async()=>{
  for(const assetProof of [{assetId:'other'},{publicId:'other'},{cloudName:'other'},{environment:'production'},{resourceType:'raw'},{deliveryType:'upload'},{version:2},{bytes:200}]){
    const f=fixture({assetProof});await denied(f.service.grant(40,f.request(2)),'ASSET_UNVERIFIED');assert.equal(f.grants(),0);
  }
  const f=fixture({verifyAsset:async()=>false});await denied(f.service.grant(40,f.request(2)),'ASSET_UNVERIFIED');
});
test('ordinary signatures, missing expiration/cache/privacy proof and unsafe URLs are refused',async()=>{
  for(const grantProof of [{expirationEnforced:false},{private:false},{cacheControl:'public'},{disposition:'inline'},{expiresAt:'2026-10-26T00:05:01.000Z'},{expiresAt:'2026-10-26T00:00:00.000Z'},{expiresAt:undefined},{issuedAt:'2026-10-25T23:59:59.000Z'},{url:'http://public.invalid/file'},{url:'https://user:secret@private.invalid/file'},{publicId:'foreign'},{cloudName:'foreign'}]){
    const f=fixture({grantProof});await denied(f.service.grant(40,f.request(2)),'ASSET_UNVERIFIED');
  }
});
test('permissions and attached asset are rechecked after provider grant; revoked grants are never returned',async()=>{
  for(const onGrant of [f=>{f.student.accountState='disabled';},f=>{f.rows.Enrollment.length=0;},f=>{f.rows.Material[0].removedAt=new Date();},f=>{f.rows.Material[0].asset.assetId='changed';}]){
    const f=fixture({onGrant});await assert.rejects(f.service.grant(40,f.request(2)));assert.equal(f.grants(),1);
  }
});
test('expiry during provider work or final ownership check refuses the result and errors redact secrets',async()=>{
  const f=fixture({onGrant:f=>f.advance(300000)});await denied(f.service.grant(40,f.request(2)),'ASSET_UNVERIFIED');
  const g=fixture();let checks=0;g.dependencies.verifyAsset=async()=>{if(++checks===2)g.advance(300000);return true;};
  g.service=require('../services/materialAccess').createService(g.dependencies);await denied(g.service.grant(40,g.request(2)),'ASSET_UNVERIFIED');
  const h=fixture();h.provider.grant=async()=>{throw Error('api_secret hidden');};await denied(h.service.grant(40,h.request(2)),'UNAVAILABLE');
});
test('grant timeout retains bounded slots until an ignoring provider settles and never returns its late URL',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let release,ready,entered=0;const wait=new Promise(r=>{release=r;}),arrived=new Promise(r=>{ready=r;});
  const f=fixture({onGrant:async()=>{if(++entered===2)ready();await wait;}});
  const results=Promise.all([f.service.grant(40,f.request(2)),f.service.grant(40,f.request(3))].map(p=>p.then(()=>null,e=>e.code)));
  await arrived;t.mock.timers.tick(5000);assert.deepEqual(await results,['UNAVAILABLE','UNAVAILABLE']);
  await denied(f.service.grant(40,f.request(1)),'LIMIT_EXCEEDED');
  release();for(let n=0;n<20;n++)await new Promise(r=>setImmediate(r));
  assert.ok(await f.service.grant(40,f.request(1)));
});
