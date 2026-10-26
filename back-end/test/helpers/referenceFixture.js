'use strict';
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {model}=require('../../assets/referenceFence');
// Existing fixture seeds now use actual transactions; application writes already supply their own session.
function transactionalSeeds(models){
  for(const [name,M] of Object.entries(models))if(['User','Course','Material','UploadIntent'].includes(name)&&!Object.hasOwn(M.prototype,'fixtureTransactionalSave')){
    const save=M.prototype.save;
    M.prototype.fixtureTransactionalSave=true;
    M.prototype.save=async function(options={}){
      if(options.session||this.$session()?.inTransaction())return save.call(this,options);
      const session=await M.db.startSession(),wasNew=this.isNew;
      try{return await session.withTransaction(()=>{if(wasNew)this.$isNew=true;return save.call(this,{...options,session});},{readConcern:{level:'snapshot'},writeConcern:{w:'majority'}});}
      finally{this.$session(null);await session.endSession();}
    };
    M.prototype.$save=M.prototype.save;
  }
}
async function createReferenceFixture(connection,owned){
  const M=model(connection),name=M.collection.name;
  const validator={$jsonSchema:{description:`Synthetic Phase 3.4 reference owner ${randomUUID()}`}};
  await connection.db.createCollection(name,{validator});const entry=await connection.db.listCollections({name}).next();
  assert.ok(entry?.info?.uuid);assert.deepEqual(entry.options.validator,validator);owned.set(name,{uuid:entry.info.uuid,validator});
  await M.createIndexes();await new M({key:'reference-fence',kind:'guard',revision:0}).save();
  return M;
}
module.exports={createReferenceFixture,transactionalSeeds};
