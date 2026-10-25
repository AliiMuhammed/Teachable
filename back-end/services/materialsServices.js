'use strict';
const { support, expose, fail, fields, text, id, asset, retainAsset, materialDTO }=require('./serviceSupport');
function createService(dependencies) {
  const {run}=support(dependencies);
  async function access(s,materialId,write) {
    id(materialId); const m=await s.required('Material',{id:materialId,removedAt:null}); const c=await s.required('Course',{_id:m.course});
    const a=await s.courseAccess(c,write); return {m,c,a};
  }
  async function lock(s,c,a) {await s.lockActor();await s.touch(c);if(a) await s.touch(a);}
  return Object.freeze({
    addmaterials:(data,ctx)=>run(ctx,async s=>{
      fields(data,['name','courseId','asset'],['name','courseId','asset']); text(data.name,255); id(data.courseId); const value=asset(data.asset,true);
      const c=await s.required('Course',{id:data.courseId}); const a=await s.courseAccess(c,true);
      if(c.lifecycle==='archived') fail('WORKFLOW_REQUIRED');
      await s.verify(value,'material',c.id); await lock(s,c,a);
      const m=await s.validate('Material',{id:await s.allocate('materials'),name:data.name,course:c._id,asset:value}); await m.save({session:s.session}); return materialDTO(m,c.id);
    }),
    getMaterials:(courseId,ctx)=>run(ctx,async s=>{
      id(courseId);const c=await s.required('Course',{id:courseId});await s.courseAccess(c);
      return (await s.many('Material',{course:c._id,removedAt:null})).map(m=>materialDTO(m,c.id));
    }),
    getMaterial:(materialId,ctx)=>run(ctx,async s=>{const {m,c}=await access(s,materialId,false);return materialDTO(m,c.id);}),
    updateMaterials:(data,materialId,ctx)=>run(ctx,async s=>{
      const {m,c,a}=await access(s,materialId,true); fields(data,['name','asset']); if(!Object.keys(data).length) fail('INVALID_INPUT');
      if(c.lifecycle==='archived') fail('WORKFLOW_REQUIRED');
      if(Object.hasOwn(data,'name')) {text(data.name,255);m.name=data.name;}
      if(Object.hasOwn(data,'asset')) {const value=asset(data.asset,true);retainAsset(m.asset,value);await s.verify(value,'material',c.id);m.asset=value;}
      await m.validate(); await lock(s,c,a);await m.save({session:s.session});return materialDTO(m,c.id);
    }),
    deleteMaterials:(materialId,ctx)=>run(ctx,async s=>{
      const {m,c,a}=await access(s,materialId,true);await lock(s,c,a);m.removedAt=new Date();m.removedBy=s.actor._id;
      await m.save({session:s.session});return {id:m.id,removed:true};
    })
  });
}
module.exports=expose(createService,['addmaterials','getMaterials','getMaterial','updateMaterials','deleteMaterials']);
