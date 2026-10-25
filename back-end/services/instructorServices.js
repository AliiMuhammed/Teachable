'use strict';
const { support, expose, fail, fields, id, userDTO, courseDTO, enrollmentDTO, profile, editProfile }=require('./serviceSupport');
function createService(dependencies) {
  const { run }=support(dependencies);
  return Object.freeze({
    getInstructor:(target,ctx)=>run(ctx,s=>profile(s,target,'instructor')),
    updateInstructor:(data,target,ctx)=>run(ctx,s=>editProfile(s,data,target,'instructor')),
    showInstructors:ctx=>run(ctx,async s=>{s.role('admin'); return (await s.many('User',{role:'instructor'})).map(userDTO);}),
    deleteInstructor:async()=>fail('WORKFLOW_REQUIRED'),
    checkAssign:(courseId,instructorId,ctx)=>run(ctx,async s=>{
      s.role('admin'); id(courseId); id(instructorId);
      const c=await s.required('Course',{id:courseId}); const u=await s.required('User',{id:instructorId,role:'instructor'});
      const a=await s.one('InstructorAssignment',{course:c._id,instructor:u._id}); return a?{id:a.id,courseId,instructorId}:null;
    }),
    assgin:(data,ctx)=>run(ctx,async s=>{
      s.role('admin'); fields(data,['courseId','instructorId'],['courseId','instructorId']); id(data.courseId); id(data.instructorId);
      const c=await s.required('Course',{id:data.courseId}); const u=await s.required('User',{id:data.instructorId,role:'instructor'});
      if(u.accountState!=='active' || c.lifecycle==='archived') fail('DENIED');
      if(await s.one('InstructorAssignment',{course:c._id,instructor:u._id})) fail('CONFLICT');
      await s.lockActor(); await s.touch(c); await s.touch(u);
      const a=await s.validate('InstructorAssignment',{id:await s.allocate('instructorAssignments'),course:c._id,instructor:u._id});
      await a.save({session:s.session}); return {id:a.id,courseId:c.id,instructorId:u.id};
    }),
    showRelatedCourses:(instructorId,ctx)=>run(ctx,async s=>{
      id(instructorId); if(s.actor.role!=='admin') {s.role('instructor');s.self(instructorId);}
      const u=await s.required('User',{id:instructorId,role:'instructor'}); const result=[];
      for(const a of await s.many('InstructorAssignment',{instructor:u._id})) result.push(courseDTO(await s.required('Course',{_id:a.course})));
      return result;
    }),
    setGrades:(grade,studentId,courseId,ctx)=>run(ctx,async s=>{
      s.role('instructor'); id(studentId); id(courseId);
      if(grade!==null && (!Number.isInteger(grade)||grade<0||grade>100)) fail('INVALID_INPUT');
      const c=await s.required('Course',{id:courseId}); if(c.lifecycle!=='published') fail('WORKFLOW_REQUIRED');
      const a=await s.assignment(c); const u=await s.required('User',{id:studentId,role:'student'});
      const e=await s.required('Enrollment',{course:c._id,student:u._id});
      await s.lockActor(); await s.touch(c); await s.touch(a); await s.touch(u);
      e.grade=grade; e.gradeUpdatedBy=s.actor._id; e.gradeUpdatedAt=new Date(); e.markModified('gradeUpdatedAt');
      await e.save({session:s.session}); return enrollmentDTO(e,u.id,c.id);
    })
  });
}
module.exports=expose(createService,['getInstructor','checkAssign','assgin','updateInstructor','showInstructors','deleteInstructor','showRelatedCourses','setGrades']);
