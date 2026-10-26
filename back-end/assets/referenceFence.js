'use strict';
const schema=require('../models/AssetLifecycle');
const fail=()=>{throw Object.assign(new Error('Asset lifecycle requires verified authority and reference safety'),{code:'ASSET_LIFECYCLE'});};
function model(connection){
  const M=connection.models.AssetLifecycle||connection.model('AssetLifecycle',schema);
  if(M.db!==connection||M.schema!==schema||M.collection.name!=='assetLifecycles')fail();
  return M;
}
async function lock(connection,session,owner){
  if(!session||!session.inTransaction()||session.client!==connection.getClient())fail();
  const M=model(connection),indexes=await M.listIndexes();
  if(indexes.some(i=>i.expireAfterSeconds!==undefined))fail();
  if(!indexes.some(i=>i.unique===true&&JSON.stringify(i.key)==='{"key":1}'&&!i.sparse&&!i.partialFilterExpression&&(!i.collation||i.collation.locale==='simple')))fail();
  const guard=await M.findOne({key:'reference-fence'}).session(session).maxTimeMS(5000);
  if(!guard||guard.kind!=='guard'||!Number.isSafeInteger(guard.revision)||guard.revision>=Number.MAX_SAFE_INTEGER||(guard.pendingCase&&guard.pendingCase!==owner))fail();
  // This real write creates a conflict with every competing claim/reference transaction.
  guard.revision++;await guard.save({session});return guard;
}
function aliases(value,prefix='asset.'){
  const out=[];
  if(value.assetId)out.push({[prefix+'assetId']:value.assetId});
  if(value.publicId)out.push({[prefix+'publicId']:value.publicId,[prefix+'environment']:value.environment});
  if(!out.length)fail();return out;
}
async function fenceDocument(doc,paths){
  if(!doc.isNew&&!paths.some(p=>doc.isModified(p)))return;
  const connection=doc.constructor.db,session=doc.$session();await lock(connection,session);
  const values=paths.filter(p=>['asset','previousAsset','profileImage','coverImage'].includes(p)).map(p=>doc[p]).filter(Boolean);
  if(paths.includes('publicId'))values.push({publicId:doc.publicId,environment:doc.environment});
  const M=model(connection);
  for(const value of values){
    // Pending/uncertain attempts and confirmed tombstones prohibit identity reuse; assessment alone does not.
    if(await M.findOne({kind:'case',state:{$in:['deletion-pending','uncertain','deletion-verified']},$or:aliases(value)}).session(session).maxTimeMS(5000))fail();
  }
}
function protect(schema,paths){
  schema.pre('save',async function(){await fenceDocument(this,paths);});
  schema.pre('insertMany',function(){fail();});
}
module.exports={fail,model,lock,aliases,fenceDocument,protect};
