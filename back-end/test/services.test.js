'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const inventory = {
  users: ['getUserById', 'insertUser', 'getUser', 'updateStatus'],
  courses: ['addCourse', 'getCourse', 'updateCourse', 'showcourses', 'searchCourses', 'deleteCourse'],
  instructor: ['getInstructor', 'checkAssign', 'assgin', 'updateInstructor', 'showInstructors', 'deleteInstructor', 'showRelatedCourses', 'setGrades'],
  student: ['getStudent', 'viewStudents', 'updateStudent', 'showStudents', 'deleteStudent', 'checkEnrollment', 'enrollment', 'showGrade'],
  materials: ['addmaterials', 'getMaterials', 'getMaterial', 'updateMaterials', 'deleteMaterials']
};
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function(name, ...args) {
  if (/dbConnection|^mysql$/.test(name)) throw new Error('Legacy database import forbidden');
  return originalLoad.call(this, name, ...args);
};
const modules = () => Object.fromEntries(Object.keys(inventory).map(n => [n, require(`../services/${n}Services`)]));
const rejects = (promise, code) => assert.rejects(promise, e => e.code === code && !e.cause);
const asset = () => ({ assetId: 'synthetic', publicId: 'synthetic/image', environment: 'synthetic', displayName: 'Synthetic', resourceType: 'image', deliveryType: 'authenticated', classification: 'private', format: 'png', version: 1, bytes: 100 });
const user = (id, role) => ({ id, name: `Synthetic ${id}`, email: `Synthetic${id}@example.invalid`, phone: '00123', passwordHash: `$2b$12$${'a'.repeat(53)}`, role, accountState: 'active', profileImage: asset() });
const course = id => ({ id, name: 'Literal [x]', code: 'SYN', description: 'Description only', durations: 'Eight meetings', lifecycle: 'published', coverImage: asset() });

// Offline adapter uses real schemas/async validation; it is not MongoDB or atomicity proof.
function fixture() {
  const connection = mongoose.createConnection();
  const schemas = { User: require('../models/User'), Course: require('../models/Course'), InstructorAssignment: require('../models/InstructorAssignment'), Enrollment: require('../models/Enrollment'), Material: require('../models/Material'), Counter: require('../models/Counter').counterSchema, Session: require('../models/Session') };
  const models = Object.fromEntries(Object.entries(schemas).map(([n,s]) => [n, connection.model(n,s)]));
  const rows = Object.fromEntries(Object.keys(models).map(n => [n, []]));
  const matches = (d,f) => Object.entries(f).every(([k,v]) => k === '$or' ? v.some(x => matches(d,x)) : v instanceof RegExp ? v.test(d[k]) : v && v.$regex ? new RegExp(v.$regex,v.$options).test(d[k]) : String(d[k]) === String(v));
  for (const [n,M] of Object.entries(models)) {
    M.listIndexes=async()=>M.schema.indexes().filter(([,o])=>o.unique).map(([key,options])=>({key,...options}));
    const query = (f,one) => {
      let limit = 100, sort = null;
      const q = { select:()=>q, session:()=>q, maxTimeMS:()=>q, sort:v=>(sort=v,q), limit:v=>(limit=v,q), then:(yes,no)=>Promise.resolve().then(()=> { let found=rows[n].filter(d=>matches(d,f)); if(sort) found.sort((a,b)=>a.id-b.id); return one ? found[0] || null : found.slice(0,limit); }).then(yes,no) }; return q;
    };
    M.findOne=f=>query(f,true); M.find=f=>query(f,false); M.exists=f=>query(f,true);
    M.prototype.save=async function() { await this.validate(); if (!rows[n].includes(this)) rows[n].push(this); return this; };
  }
  connection.startSession=async()=>({ withTransaction:async fn=>fn(), endSession:async()=>{} });
  const contexts = new WeakMap();
  const context = id => { const token = Object.freeze({}); contexts.set(token,id); return token; };
  const dependencies = { models, authenticate:async ctx=>contexts.get(ctx), verifyAsset:async()=>true, verifyCounter:async()=>true };
  const services=Object.fromEntries(Object.entries(modules()).map(([n,m])=>[n,m.createService(dependencies)]));
  const put = (n,data) => { const d=new models[n](data); rows[n].push(d); return d; };
  const admin=put('User',user(1,'admin')); const student=put('User',user(2,'student')); const instructor=put('User',user(3,'instructor'));
  const c=put('Course',course(10)); put('InstructorAssignment',{id:20,course:c._id,instructor:instructor._id});
  put('Enrollment',{id:30,course:c._id,student:student._id,grade:null});
  put('Material',{id:40,name:'Private note',course:c._id,asset:asset()});
  return { models, rows, services, context, put, admin, student, instructor, c, dependencies };
}

for (const [n,names] of Object.entries(inventory)) {
  test(`${n}: exact historical method names and legacy calls fail closed`, async()=>{
    const m=modules()[n]; assert.equal(typeof m.createService,'function');
    assert.deepEqual(Object.keys(m).sort(),[...names,'createService'].sort());
    for (const method of names) await rejects(m[method]({role:'admin',id:1},1,1), 'TRUST_REQUIRED');
  });
}
test('import never loads mysql/connection/HTTP or opens MongoDB',()=>{
  const source=`const M=require('node:module'); const old=M._load; M._load=function(n,...a){if(/mysql|dbConnection|express/.test(n)) throw Error('forbidden import'); return old.call(this,n,...a)}; const m=require('mongoose'); m.createConnection=()=>{throw Error('connection')}; for(const n of ${JSON.stringify(Object.keys(inventory))}) require('./back-end/services/'+n+'Services');`;
  const child=spawnSync(process.execPath,['-e',source],{cwd:path.resolve(__dirname,'../..'),env:process.env,encoding:'utf8'});
  assert.equal(child.status,0,child.stderr);
});
test('no SQL, filesystem effects, raw updates or lean DTO spreads in services',()=>{
  for(const n of [...Object.keys(inventory).map(n=>`${n}Services.js`),'serviceSupport.js']) {
    const text=fs.readFileSync(path.join(__dirname,'../services',n),'utf8');
    assert.doesNotMatch(text,/dbConnection|promisify|unlink|require\(['"](?:node:)?fs|\.collection\.[A-Za-z]+\(|\.update(?:One|Many)\(|\.lean\(/);
  }
});
test('all privileged factory methods reject missing/forged trust before DB work',async()=>{
  const {services}=fixture();
  for(const [n,names] of Object.entries(inventory)) for(const method of names) {
    if(n==='courses' && ['getCourse','showcourses','searchCourses'].includes(method)) continue;
    await rejects(services[n][method](), method==='updateStatus' || method==='deleteStudent' || method==='deleteInstructor' ? 'WORKFLOW_REQUIRED' : 'TRUST_REQUIRED');
  }
  await rejects(servicesPlaceholder(), 'TRUST_REQUIRED');
  function servicesPlaceholder() {return services.users.getUserById(1,{id:1,role:'admin'});}
});
test('strict IDs reject casting and operator inputs',async()=>{
  const f=fixture(); for(const id of ['10',true,null,{},[],0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]) await rejects(f.services.courses.getCourse(id),'INVALID_INPUT');
});
test('private user reads use explicit projections and case-insensitive email key',async()=>{
  const f=fixture(); await f.admin.validate(); await f.student.validate();
  const dto=await f.services.users.getUser('sYNTHETIC2@example.invalid',f.context(1));
  assert.deepEqual(Object.keys(dto).sort(),['id','name','email','phone','role','accountState'].sort()); assert.equal(dto.id,2);
  assert.equal((await f.services.student.getStudent(2,f.context(2))).id,2);
  assert.equal((await f.services.instructor.getInstructor(3,f.context(3))).role,'instructor');
  await rejects(f.services.users.getUserById(1,f.context(2)),'DENIED');
  await rejects(f.services.instructor.getInstructor(2,f.context(1)),'NOT_FOUND');
  for(const email of [' x@y.z','x@y.z ',42,{},'ü@example.invalid']) await rejects(f.services.users.getUser(email,f.context(1)),'INVALID_INPUT');
});
test('admin-only directories and self-only profile allowlists',async()=>{
  const f=fixture(); assert.equal((await f.services.student.showStudents(f.context(1))).length,1); assert.equal((await f.services.instructor.showInstructors(f.context(1))).length,1);
  await rejects(f.services.student.showStudents(f.context(2)),'DENIED');
  assert.equal((await f.services.student.updateStudent({name:'Changed',phone:'007'},2,f.context(2))).name,'Changed');
  assert.equal((await f.services.instructor.updateInstructor({name:'Teacher'},3,f.context(3))).name,'Teacher');
  await rejects(f.services.student.updateStudent({name:'Other'},2,f.context(1)),'DENIED');
  for(const change of [{role:'admin'},{accountState:'active'},{passwordHash:'x'},{email:'new@example.invalid'},{id:7},{phone:123},{name:null},{$set:{name:'x'}},{}]) await rejects(f.services.student.updateStudent(change,2,f.context(2)),'INVALID_INPUT');
});
test('account provisioning rejects admin, implicit state and mass assignment before allocation',async()=>{
  const f=fixture(); const {id,...data}=user(8,'student');
  for(const change of [{role:'admin'},{role:'instractor'},{accountState:undefined},{status:1},{emailKey:'x'},{phone:42},{passwordHash:'plain'}]) await rejects(f.services.users.insertUser({...data,...change},f.context(1)),'INVALID_INPUT');
  await rejects(f.services.users.insertUser(data,f.context(2)),'DENIED');
});
test('structured course search is literal, bounded and published-only',async()=>{
  const f=fixture(); f.put('Course',{...course(11),lifecycle:'draft'});
  assert.equal((await f.services.courses.showcourses()).length,1);
  assert.equal((await f.services.courses.searchCourses({text:'[x]',limit:10})).length,1);
  assert.equal((await f.services.courses.searchCourses({text:'description'})).length,1);
  assert.equal((await f.services.courses.searchCourses({text:'.*'})).length,0);
  for(const search of ['WHERE name LIKE x',{$where:'x'},{text:{}},{text:'a'.repeat(201)},{limit:0},{limit:101},{limit:'2'}]) await rejects(f.services.courses.searchCourses(search),'INVALID_INPUT');
  await rejects(f.services.courses.getCourse(11),'NOT_FOUND');
  assert.equal((await f.services.courses.getCourse(11,f.context(1))).lifecycle,'draft');
  assert.deepEqual(Object.keys(await f.services.courses.getCourse(10)).sort(),['id','name','code','description','durations','lifecycle'].sort());
});
test('course updates authorize admins and retain lifecycle/history',async()=>{
  const f=fixture(); await rejects(f.services.courses.updateCourse({name:'x'},10,f.context(3)),'DENIED');
  for(const d of [{id:99},{status:1},{durations:8},{coverImage:{...asset(),bytes:'100'}}]) await rejects(f.services.courses.updateCourse(d,10,f.context(1)),'INVALID_INPUT');
  assert.equal((await f.services.courses.updateCourse({name:'Edited'},10,f.context(1))).name,'Edited');
  assert.equal((await f.services.courses.deleteCourse(10,f.context(1))).lifecycle,'archived');
  assert.equal(f.rows.Enrollment.length,1); assert.equal(f.rows.Material.length,1);
  f.put('Course',{...course(12),lifecycle:'draft'});
  await rejects(f.services.courses.deleteCourse(12,f.context(1)),'RETENTION_REQUIRED');
});
test('canonical assignment ordering, ObjectId resolution, duplicate conflict and roles',async()=>{
  const f=fixture(); const a=await f.services.instructor.checkAssign(10,3,f.context(1)); assert.deepEqual(a,{id:20,courseId:10,instructorId:3});
  await rejects(f.services.instructor.checkAssign(3,10,f.context(1)),'NOT_FOUND');
  await rejects(f.services.instructor.assgin({courseId:10,instructorId:3},f.context(1)),'CONFLICT');
  await rejects(f.services.instructor.assgin({courseId:10,instructorId:2},f.context(1)),'NOT_FOUND');
  assert.equal((await f.services.instructor.showRelatedCourses(3,f.context(3)))[0].id,10);
  await rejects(f.services.instructor.showRelatedCourses(3,f.context(2)),'DENIED');
});
test('self enrollment, private rosters and grades preserve null versus zero',async()=>{
  const f=fixture(); await rejects(f.services.student.enrollment({courseId:10,studentId:2},f.context(2)),'CONFLICT');
  await rejects(f.services.student.enrollment({courseId:10,studentId:2},f.context(1)),'DENIED');
  assert.deepEqual(await f.services.student.checkEnrollment(2,10,f.context(2)),{id:30,studentId:2,courseId:10,grade:null});
  await rejects(f.services.student.checkEnrollment(2,10,f.context(3)),'DENIED');
  const roster=await f.services.student.viewStudents(10,f.context(3)); assert.deepEqual(roster,[{id:2,name:'Synthetic 2',enrollmentId:30,grade:null}]);
  const grades=await f.services.student.showGrade(2,f.context(2)); assert.equal(grades[0].grade,null); assert.equal(grades[0].course.id,10);
});
test('grade changes require current assignment, enrollment, integer/null and paired audit',async()=>{
  const f=fixture(); for(const grade of ['0',-1,101,0.5,NaN,undefined,{}]) await rejects(f.services.instructor.setGrades(grade,2,10,f.context(3)),'INVALID_INPUT');
  for(const grade of [0,0,100,null]) { const result=await f.services.instructor.setGrades(grade,2,10,f.context(3)); assert.equal(result.grade,grade); const row=f.rows.Enrollment[0]; assert.ok(row.gradeUpdatedBy.equals(f.instructor._id)); assert.ok(row.gradeUpdatedAt instanceof Date); }
  await rejects(f.services.instructor.setGrades(70,2,10,f.context(1)),'DENIED');
  f.rows.InstructorAssignment.length=0; await rejects(f.services.instructor.setGrades(70,2,10,f.context(3)),'DENIED');
});
test('disabled principals, missing relationships and archived grade writes fail closed',async()=>{
  const f=fixture(); f.instructor.accountState='disabled'; await rejects(f.services.instructor.setGrades(1,2,10,f.context(3)),'DENIED');
  f.instructor.accountState='active'; f.c.lifecycle='archived'; await rejects(f.services.instructor.setGrades(1,2,10,f.context(3)),'WORKFLOW_REQUIRED');
  f.c.lifecycle='published'; f.rows.Enrollment.length=0; await rejects(f.services.instructor.setGrades(1,2,10,f.context(3)),'NOT_FOUND');
});
test('private materials use scoped DTOs and paired reversible removal',async()=>{
  const f=fixture(); const dto=await f.services.materials.getMaterial(40,f.context(2)); assert.deepEqual(dto,{id:40,name:'Private note',courseId:10});
  assert.equal((await f.services.materials.getMaterials(10,f.context(2))).length,1);
  await rejects(f.services.materials.updateMaterials({name:'x'},40,f.context(2)),'DENIED');
  assert.equal((await f.services.materials.updateMaterials({name:'Edited'},40,f.context(3))).name,'Edited');
  assert.deepEqual(await f.services.materials.deleteMaterials(40,f.context(3)),{id:40,removed:true});
  assert.ok(f.rows.Material[0].removedAt instanceof Date); assert.ok(f.rows.Material[0].removedBy.equals(f.instructor._id));
  assert.equal(f.rows.Material.length,1); assert.deepEqual(await f.services.materials.getMaterials(10,f.context(2)),[]);
  await rejects(f.services.materials.getMaterial(40,f.context(2)),'NOT_FOUND');
});
test('asset verification fails closed and invalid private metadata never attaches',async()=>{
  const f=fixture(); const noProof=modules().materials.createService({...f.dependencies,verifyAsset:undefined});
  await rejects(noProof.updateMaterials({asset:asset()},40,f.context(3)),'ASSET_UNVERIFIED');
  for(const a of [{...asset(),classification:'public',deliveryType:'upload'},{...asset(),bytes:'100'},{...asset(),version:true},{...asset(),fileName:'../../x'}]) await rejects(f.services.materials.addmaterials({name:'x',courseId:10,asset:a},f.context(3)),'INVALID_INPUT');
});
test('obsolete and destructive methods have explicit workflow-required errors',async()=>{
  const f=fixture(); await rejects(f.services.users.updateStatus(1,2,f.context(1)),'WORKFLOW_REQUIRED'); await rejects(f.services.student.deleteStudent(2,f.context(1)),'WORKFLOW_REQUIRED'); await rejects(f.services.instructor.deleteInstructor(3,f.context(1)),'WORKFLOW_REQUIRED');
});
test('bound manager is reused; factories do not create or close connections',async()=>{
  const f=fixture();f.models.User.db.readyState=1;let acquisitions=0;
  const service=modules().courses.createService({manager:{acquire:async()=>{acquisitions++;return f.models.User.db;},close:()=>assert.fail('caller owns close')}});
  assert.equal(acquisitions,0);assert.equal((await service.getCourse(10)).id,10);assert.equal((await service.getCourse(10)).id,10);assert.equal(acquisitions,2);
});
test('transaction callback retry cap and safe error categories',async()=>{
  const f=fixture();let callbacks=0;
  f.models.User.db.startSession=async()=>({withTransaction:async fn=>{for(let n=0;n<4;n++){callbacks++;await fn();}},endSession:async()=>{}});
  await rejects(f.services.users.getUserById(1,f.context(1)),'RETRY_EXHAUSTED');assert.equal(callbacks,4);
  for(const [error,code]of [[Object.assign(new Error('secret URI'),{code:11000}),'CONFLICT'],[new Error('secret URI'),'UNAVAILABLE']]){
    f.models.User.db.startSession=async()=>{throw error;};await assert.rejects(f.services.users.getUserById(1,f.context(1)),e=>e.code===code&&!e.message.includes('secret')&&!e.cause);
  }
});
test('successful creates reserve IDs from the approved allocator and save explicit references',async()=>{
  const f=fixture();const allocated={users:100,courses:200,instructorAssignments:300,enrollments:400,materials:500};
  f.models.Counter.collection.findOneAndUpdate=async filter=>({lastAllocated:++allocated[filter.scope]});
  const {id:ignored,...data}=user(8,'student');const newUser=await f.services.users.insertUser(data,f.context(1));assert.equal(newUser.id,101);
  const {id:ignoredCourse,lifecycle,...newCourse}=course(8);const created=await f.services.courses.addCourse(newCourse,f.context(1));assert.equal(created.id,201);assert.equal(created.lifecycle,'draft');
  await f.services.courses.updateCourse({lifecycle:'published'},created.id,f.context(1));
  const a=await f.services.instructor.assgin({courseId:201,instructorId:3},f.context(1));assert.equal(a.id,301);
  const e=await f.services.student.enrollment({courseId:201,studentId:101},f.context(101));assert.equal(e.id,401);assert.equal(e.grade,null);
  const m=await f.services.materials.addmaterials({courseId:201,name:'Private',asset:asset()},f.context(3));assert.equal(m.id,501);
  assert.ok(f.rows.Enrollment.at(-1).course.equals(f.rows.Course.at(-1)._id));
});
test('lists cannot silently hide records beyond the service bound',async()=>{
  const f=fixture();for(let n=11;n<=110;n++) f.put('Course',course(n));
  await rejects(f.services.courses.showcourses(),'LIMIT_EXCEEDED');
  assert.equal((await f.services.courses.searchCourses({limit:5})).length,5);
});
test('asset replacement cannot erase the previous asset provenance',async()=>{
  const f=fixture();const replacement={...asset(),assetId:'different'};
  await rejects(f.services.materials.updateMaterials({asset:replacement},40,f.context(3)),'WORKFLOW_REQUIRED');
  await rejects(f.services.student.updateStudent({profileImage:replacement},2,f.context(2)),'WORKFLOW_REQUIRED');
  await rejects(f.services.courses.updateCourse({coverImage:replacement},10,f.context(1)),'WORKFLOW_REQUIRED');
});
test('allocation requires trusted counter initialization and actual unique indexes',async()=>{
  const f=fixture();const {support}=require('../services/serviceSupport');let allocations=0;
  f.models.Counter.collection.findOneAndUpdate=async()=>{allocations++;return {lastAllocated:10};};
  const invoke=deps=>support(deps).run(f.context(1),s=>s.allocate('users'));
  await rejects(invoke({...f.dependencies,verifyCounter:undefined}),'COUNTER_UNVERIFIED');
  assert.equal(allocations,0);
  f.models.User.listIndexes=async()=>[];
  await rejects(invoke(f.dependencies),'INDEX_UNVERIFIED');assert.equal(allocations,0);
});
test('one allocation survives callback retries; unknown commit is never replayed by the service',async()=>{
  const f=fixture();const {support}=require('../services/serviceSupport');let increments=0,ended=0;
  f.models.Counter.collection.findOneAndUpdate=async()=>({lastAllocated:100+(++increments)});
  f.models.User.db.startSession=async()=>({withTransaction:async fn=>{const first=await fn();const second=await fn();assert.equal(first,second);return second;},endSession:async()=>{ended++;}});
  assert.equal(await support(f.dependencies).run(f.context(1),s=>s.allocate('users')),101);assert.equal(increments,1);assert.equal(ended,1);
  let executions=0;
  f.models.User.db.startSession=async()=>({withTransaction:async fn=>{executions++;await fn();throw Object.assign(new Error('uncertain secret'),{errorLabels:['UnknownTransactionCommitResult']});},endSession:async()=>{ended++;}});
  await rejects(support(f.dependencies).run(f.context(1),s=>s.allocate('users')),'UNAVAILABLE');assert.equal(executions,1);assert.equal(increments,2);assert.equal(ended,2);
});
