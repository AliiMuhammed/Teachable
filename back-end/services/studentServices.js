'use strict';
const { support, expose, fail, fields, id, userDTO, courseDTO, enrollmentDTO, profile, editProfile }=require('./serviceSupport');
function createService(dependencies) {
  const {run}=support(dependencies);
  return Object.freeze({
    getStudent:(target,ctx)=>run(ctx,s=>profile(s,target,'student')),
    updateStudent:(data,target,ctx)=>run(ctx,s=>editProfile(s,data,target,'student')),
    showStudents:ctx=>run(ctx,async s=>{s.role('admin');return (await s.many('User',{role:'student'})).map(userDTO);}),
    deleteStudent:async()=>fail('WORKFLOW_REQUIRED'),
    viewStudents:(courseId,ctx)=>run(ctx,async s=>{
      id(courseId); s.role('admin','instructor'); const c=await s.required('Course',{id:courseId}); if(s.actor.role==='instructor') await s.assignment(c);
      const result=[]; for(const e of await s.many('Enrollment',{course:c._id})) {
        const u=await s.required('User',{_id:e.student,role:'student'}); result.push({id:u.id,name:u.name,enrollmentId:e.id,grade:e.grade});
      } return result;
    }),
    checkEnrollment:(studentId,courseId,ctx)=>run(ctx,async s=>{
      id(studentId); id(courseId); s.role('student'); s.self(studentId);
      const c=await s.required('Course',{id:courseId}); const e=await s.one('Enrollment',{student:s.actor._id,course:c._id});
      return e?enrollmentDTO(e,studentId,courseId):null;
    }),
    enrollment:(data,ctx)=>run(ctx,async s=>{
      s.role('student'); fields(data,['studentId','courseId'],['studentId','courseId']); id(data.studentId); id(data.courseId); s.self(data.studentId);
      const c=await s.required('Course',{id:data.courseId}); if(c.lifecycle!=='published') fail('DENIED');
      if(await s.one('Enrollment',{student:s.actor._id,course:c._id})) fail('CONFLICT');
      await s.lockActor(); await s.touch(c);
      const e=await s.validate('Enrollment',{id:await s.allocate('enrollments'),student:s.actor._id,course:c._id,grade:null});
      await e.save({session:s.session}); return enrollmentDTO(e,s.actor.id,c.id);
    }),
    showGrade:(studentId,ctx)=>run(ctx,async s=>{
      id(studentId); s.role('student'); s.self(studentId); const result=[];
      for(const e of await s.many('Enrollment',{student:s.actor._id})) result.push({id:e.id,grade:e.grade,course:courseDTO(await s.required('Course',{_id:e.course}))});
      return result;
    })
  });
}
module.exports=expose(createService,['getStudent','viewStudents','updateStudent','showStudents','deleteStudent','checkEnrollment','enrollment','showGrade']);
