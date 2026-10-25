'use strict';
const { support, expose, fail, fields, text, id, asset, retainAsset, courseDTO } = require('./serviceSupport');
function courseFields(data, creating) {
  const allowed=['name','code','description','durations','lifecycle','coverImage'];
  fields(data,allowed,creating?['name','code','description','durations','coverImage']:[]);
  if (!Object.keys(data).length) fail('INVALID_INPUT');
  for (const k of ['name','code','durations']) if (Object.hasOwn(data,k)) text(data[k],255);
  if (Object.hasOwn(data,'description')) text(data.description,Infinity,true);
  if (Object.hasOwn(data,'lifecycle') && !['draft','published','archived'].includes(data.lifecycle)) fail('INVALID_INPUT');
  const result={...data}; if (Object.hasOwn(data,'coverImage')) result.coverImage=asset(data.coverImage);
  return result;
}
function createService(dependencies) {
  const { run }=support(dependencies);
  return Object.freeze({
    addCourse:(data,ctx)=>run(ctx,async s=>{
      s.role('admin'); const values=courseFields(data,true);
      if (values.lifecycle && values.lifecycle!=='draft') fail('INVALID_INPUT');
      const doc=await s.validate('Course',{...values,id:1}); await s.verify(values.coverImage,'course');
      await s.lockActor(); doc.id=await s.allocate('courses'); await doc.save({session:s.session}); return courseDTO(doc);
    }),
    getCourse:(courseId,ctx)=>run(ctx,async s=>{
      id(courseId); const c=await s.required('Course',{id:courseId});
      if (c.lifecycle!=='published' && s.actor?.role!=='admin') {
        if (s.actor?.role==='instructor') await s.assignment(c);
        else if (c.lifecycle==='archived' && s.actor) await s.courseAccess(c);
        else fail('NOT_FOUND');
      }
      return courseDTO(c);
    },true),
    showcourses:ctx=>run(ctx,async s=>(await s.many('Course',{lifecycle:'published'})).map(courseDTO),true),
    searchCourses:(search={},ctx)=>run(ctx,async s=>{
      fields(search,['text','limit']); const term=Object.hasOwn(search,'text')?text(search.text,200,true):'';
      const limit=Object.hasOwn(search,'limit')?id(search.limit):100; if(limit>100) fail('INVALID_INPUT');
      const literal=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const filter={lifecycle:'published'};
      if(term) filter.$or=[{name:{$regex:literal,$options:'i'}},{description:{$regex:literal,$options:'i'}}];
      return (await s.many('Course',filter,limit)).map(courseDTO);
    },true),
    updateCourse:(data,courseId,ctx)=>run(ctx,async s=>{
      s.role('admin'); id(courseId); const values=courseFields(data,false); const c=await s.required('Course',{id:courseId});
      if(c.lifecycle==='archived' && values.lifecycle && values.lifecycle!=='archived') fail('WORKFLOW_REQUIRED');
      if(values.lifecycle==='draft' && c.lifecycle!=='draft') fail('WORKFLOW_REQUIRED');
      if(values.coverImage) { retainAsset(c.coverImage,values.coverImage); await s.verify(values.coverImage,'course',courseId); }
      Object.assign(c,values); await c.validate(); await s.lockActor(); await s.touch(c); return courseDTO(c);
    }),
    deleteCourse:(courseId,ctx)=>run(ctx,async s=>{
      s.role('admin'); id(courseId); const c=await s.required('Course',{id:courseId});
      const enrollment=await s.one('Enrollment',{course:c._id}); const assignment=await s.one('InstructorAssignment',{course:c._id}); const material=await s.one('Material',{course:c._id});
      if(c.lifecycle==='draft' && !enrollment && !assignment && !material) fail('RETENTION_REQUIRED');
      if(c.coverImage.classification==='public') fail('ASSET_UNVERIFIED');
      c.lifecycle='archived'; await s.lockActor(); await s.touch(c); return courseDTO(c);
    })
  });
}
module.exports=expose(createService,['addCourse','getCourse','updateCourse','showcourses','searchCourses','deleteCourse']);
