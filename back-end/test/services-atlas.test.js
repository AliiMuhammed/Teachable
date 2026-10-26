'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { resolveSrv } = require('node:dns/promises');
const { createMongoConnection, bindModels } = require('../db/mongoConnection');
const mongoose = require('mongoose');
const names=['users','courses','instructor','student','materials'];
const host='teachable-testing.ntguusj.mongodb.net';
const dbName='teachable_21b_bc3e0f91742f90ce056b';
const asset=()=>({assetId:'synthetic',publicId:'synthetic/image',environment:'synthetic',displayName:'Synthetic',resourceType:'image',deliveryType:'authenticated',classification:'private',format:'png',version:1,bytes:100});
const account=(email,role='student')=>({name:'Synthetic',email,phone:'00123',passwordHash:`$2b$12$${'a'.repeat(53)}`,role,accountState:'active',profileImage:asset()});
const catalog=()=>({name:'Synthetic [literal]',code:'SYN',description:'Only synthetic records',durations:'Eight meetings',coverImage:asset()});
const denied=(p,code)=>assert.rejects(p,e=>e.code===code && !e.cause);
const hidden='+passwordHash +emailKey +publicProfileApprovedAt +integrityVersion';

function safeFailure(e) {
  const category=e?.code==='ERR_ASSERTION'?'assertion':e?.name==='ServiceError'?e.code:'database-or-harness';
  return new Error(`Synthetic service test failure: ${category}; details suppressed`);
}

test('Phase 2.3 actual Atlas service operations and authorization races',{
  skip:!process.env.MONGODB_TEST_MODE && 'BLOCKED: explicit Atlas fixture opt-in required',timeout:600000
},async t=>{
  // Validate the exact approved environment before any DNS/network operation.
  const manager=createMongoConnection('synthetic-test');
  const owned=new Map(); let connection,models,services;
  const contexts=new WeakMap(); const context=id=>{const token=Object.freeze({});contexts.set(token,id);return token;};
  const authenticate=async token=>contexts.get(token);
  // Only this test file supplies synthetic asset attestation; production has no default verifier.
  const verifyAsset=async value=>value.environment==='synthetic' && value.assetId==='synthetic';
  const initializedScopes=new Set();
  const verifyCounter=async scope=>{
    if(!initializedScopes.has(scope))return false;
    const entry=await connection.db.listCollections({name:'counters'}).next();const owner=owned.get('counters');
    assert.ok(owner && entry?.info?.uuid);assert.deepEqual(entry.info.uuid,owner.uuid);assert.deepEqual(entry.options.validator,owner.validator);
    return true;
  };
  const adminCtx=context(1); let student,instructor,c,enrollment,material;
  async function run(name,fn) {
    let failure;await t.test(name,async()=>{try{await fn();}catch(e){failure=safeFailure(e);throw failure;}});if(failure)throw failure;
  }
  async function makeCourse(){const d=await services.courses.addCourse(catalog(),adminCtx);return services.courses.updateCourse({lifecycle:'published'},d.id,adminCtx);}
  async function makeUser(role='student'){return services.users.insertUser(account(`${randomUUID()}@example.invalid`,role),adminCtx);}
  async function currentUser(id){return models.User.findOne({id}).select(hidden);}
  async function changeUser(id,changes){const u=await currentUser(id);Object.assign(u,changes);u.integrityVersion++;await u.save();}
  async function race(Model,predicate,operation,mutation,code){
    const original=Model.findOne;let release,entered,reads=0;
    const arrived=new Promise(r=>{entered=r;});const resume=new Promise(r=>{release=r;});
    Model.findOne=function(filter,...args){const q=original.call(this,filter,...args);const execute=q.exec.bind(q);q.exec=async function(...a){const doc=await execute(...a);if(predicate(filter)){reads++;if(reads===1){entered();await resume;}}return doc;};return q;};
    let settled,pending;
    try {
      pending=operation().then(value=>({value}),error=>({error}));
      // A bounded barrier prevents a broken service from hanging the test indefinitely.
      const timer=setTimeout(()=>entered('timeout'),10000);
      const signal=await arrived;clearTimeout(timer);assert.notEqual(signal,'timeout');
      await mutation();release();settled=await pending;
      assert.equal(settled.error?.code,code);assert.ok(reads>=1);
    }finally{release();if(pending)await pending;Model.findOne=original;}
    return reads;
  }
  try{
    const records=await resolveSrv(`_mongodb._tcp.${host}`);assert.equal(records.length,3);
    const suffix=host.slice(host.indexOf('.'));assert.ok(records.every(r=>r.name.endsWith(suffix)&&r.port===27017));
    connection=await manager.acquire();assert.equal(connection.name,dbName);assert.equal(connection.getClient().options.tls,true);
    const hello=await connection.db.admin().command({hello:1});assert.equal(hello.isWritablePrimary,true);assert.ok(hello.logicalSessionTimeoutMinutes>0);
    assert.deepEqual(hello.hosts.slice().sort(),records.map(r=>`${r.name}:${r.port}`).sort());assert.equal(hello.setName,'atlas-9b57wc-shard-0');
    const auth=await connection.db.admin().command({connectionStatus:1});assert.deepEqual(auth.authInfo.authenticatedUserRoles,[{role:'readWrite',db:dbName}]);
    assert.deepEqual(await connection.db.listCollections({},{nameOnly:true}).toArray(),[],'Refuse existing namespace');
    models=bindModels(connection);
    const version=await connection.db.admin().command({buildInfo:1});t.diagnostic(JSON.stringify({host,dbName,replicaSet:hello.setName,mongodb:version.version,node:process.version,mongoose:mongoose.version}));
    for(const M of Object.values(models)){
      const name=M.collection.name;const validator={$jsonSchema:{description:`Synthetic Phase 2.3 owner ${randomUUID()}`}};
      await connection.db.createCollection(name,{validator});const entry=await connection.db.listCollections({name}).next();
      assert.ok(entry?.info?.uuid);assert.deepEqual(entry.options.validator,validator);owned.set(name,{uuid:entry.info.uuid,validator});
      for(const [keys,options] of M.schema.indexes())if(options.unique)await M.collection.createIndex(keys,options);
      const indexes=await M.collection.listIndexes().toArray();for(const [keys,options] of M.schema.indexes())if(options.unique)assert.ok(indexes.some(i=>i.unique&&JSON.stringify(i.key)===JSON.stringify(keys)));
    }
    await require('./helpers/referenceFixture').createReferenceFixture(connection,owned);
    require('./helpers/referenceFixture').transactionalSeeds({...models,...(connection.models.UploadIntent?{UploadIntent:connection.models.UploadIntent}:{})});
    for(const scope of ['users','courses','instructorAssignments','enrollments','materials']){await new models.Counter({scope,lastAllocated:1000}).save();initializedScopes.add(scope);}
    await new models.User({id:1,...account('synthetic-owner@example.invalid','admin')}).save();
    services=Object.fromEntries(names.map(n=>[n,require(`../services/${n}Services`).createService({manager,authenticate,verifyAsset,verifyCounter})]));

    await run('authorized provisioning, draft catalog, ID scopes and safe email lookup',async()=>{
      student=await makeUser();instructor=await makeUser('instructor');assert.equal(student.id,1001);assert.equal(instructor.id,1002);
      c=await services.courses.addCourse(catalog(),adminCtx);assert.equal(c.id,1001);assert.equal(c.lifecycle,'draft');
      assert.deepEqual(await services.courses.showcourses(),[]);await denied(services.courses.getCourse(c.id),'NOT_FOUND');
      c=await services.courses.updateCourse({lifecycle:'published'},c.id,adminCtx);
      const found=await services.users.getUser(student.email.toUpperCase(),adminCtx);assert.equal(found.id,student.id);
      assert.deepEqual(Object.keys(found).sort(),['id','name','email','phone','role','accountState'].sort());
      await denied(services.users.insertUser(account(student.email.toUpperCase()),adminCtx),'CONFLICT');
      assert.equal((await makeUser()).id,1004,'failed duplicate consumes reserved ID');
      const raw=await currentUser(student.id);assert.ok(raw._id instanceof mongoose.Types.ObjectId);assert.equal(raw.emailKey,student.email.toLowerCase());
    });
    await run('concurrent canonical assignments produce one pair and distinct numeric identities',async()=>{
      const results=await Promise.allSettled([1,2].map(()=>services.instructor.assgin({courseId:c.id,instructorId:instructor.id},adminCtx)));
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'CONFLICT');
      const a=await services.instructor.checkAssign(c.id,instructor.id,adminCtx);assert.ok(Number.isSafeInteger(a.id));
      const raw=await models.InstructorAssignment.findOne({id:a.id});const u=await currentUser(instructor.id);const course=await models.Course.findOne({id:c.id});assert.ok(raw.course.equals(course._id));assert.ok(raw.instructor.equals(u._id));
      await denied(services.instructor.assgin({courseId:c.id,instructorId:student.id},adminCtx),'NOT_FOUND');
      assert.equal((await services.instructor.showRelatedCourses(instructor.id,context(instructor.id)))[0].id,c.id);
    });
    await run('concurrent self enrollment, null default and private scoped projections',async()=>{
      const ctx=context(student.id);const results=await Promise.allSettled([1,2].map(()=>services.student.enrollment({studentId:student.id,courseId:c.id},ctx)));
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'CONFLICT');
      enrollment=await services.student.checkEnrollment(student.id,c.id,ctx);assert.equal(enrollment.grade,null);
      const roster=await services.student.viewStudents(c.id,context(instructor.id));assert.deepEqual(Object.keys(roster[0]).sort(),['id','name','enrollmentId','grade'].sort());
      await denied(services.student.checkEnrollment(student.id,c.id,context(instructor.id)),'DENIED');
      await denied(services.student.enrollment({studentId:student.id,courseId:c.id},adminCtx),'DENIED');
    });
    await run('ordinary grade null/zero/same-value writes and audit; no admin override',async()=>{
      for(const grade of [0,0,100,null]){const r=await services.instructor.setGrades(grade,student.id,c.id,context(instructor.id));assert.equal(r.grade,grade);const raw=await models.Enrollment.findOne({id:enrollment.id}).select('+gradeUpdatedBy +gradeUpdatedAt');assert.ok(raw.gradeUpdatedAt instanceof Date);assert.ok(raw.gradeUpdatedBy.equals((await currentUser(instructor.id))._id));}
      for(const grade of [-1,101,0.1,'0'])await denied(services.instructor.setGrades(grade,student.id,c.id,context(instructor.id)),'INVALID_INPUT');
      await denied(services.instructor.setGrades(70,student.id,c.id,adminCtx),'DENIED');
      const other=await makeCourse();await denied(services.instructor.setGrades(70,student.id,other.id,context(instructor.id)),'DENIED');
      const grades=await services.student.showGrade(student.id,context(student.id));assert.equal(grades[0].course.id,c.id);assert.equal(grades[0].grade,null);
    });
    await run('stale enrollment loses to course archive and student disable/role change',async()=>{
      for(const mode of ['archive','disable','role']){
        const target=await makeCourse();const u=await makeUser();const ctx=context(u.id);let authChecks=0;
        const service=require('../services/studentServices').createService({models,verifyCounter,authenticate:async token=>{authChecks++;return authenticate(token);}});
        await race(models.Course,f=>f.id===target.id,()=>service.enrollment({studentId:u.id,courseId:target.id},ctx),async()=>{
          if(mode==='archive')await services.courses.deleteCourse(target.id,adminCtx);else await changeUser(u.id,mode==='disable'?{accountState:'disabled'}:{role:'instructor'});
        },'DENIED');
        const ur=await currentUser(u.id);const cr=await models.Course.findOne({id:target.id});assert.equal(await models.Enrollment.countDocuments({student:ur._id,course:cr._id}),0);
        assert.equal(authChecks,1,'identity token resolved once; DB predicates reloaded inside retry');
      }
    });
    await run('stale grade loses to assignment revocation and instructor disabling',async()=>{
      for(const mode of ['revoke','disable']){
        const teacher=await makeUser('instructor');const target=await makeCourse();const learner=await makeUser();
        const assigned=await services.instructor.assgin({courseId:target.id,instructorId:teacher.id},adminCtx);
        const enrolled=await services.student.enrollment({studentId:learner.id,courseId:target.id},context(learner.id));
        await race(models.Enrollment,f=>Boolean(f.student&&f.course),()=>services.instructor.setGrades(70,learner.id,target.id,context(teacher.id)),async()=>{
          if(mode==='disable')await changeUser(teacher.id,{accountState:'disabled'});
          else {
            const session=await connection.startSession();try{await session.withTransaction(async()=>{
              const u=await models.User.findOne({id:teacher.id}).select(hidden).session(session);u.integrityVersion++;await u.save({session});
              const cr=await models.Course.findOne({id:target.id}).select('+integrityVersion').session(session);cr.integrityVersion++;await cr.save({session});
              const a=await models.InstructorAssignment.findOne({id:assigned.id}).select('+integrityVersion').session(session);a.integrityVersion++;await a.save({session});await a.deleteOne({session});
            });}finally{await session.endSession();}
          }
        },'DENIED');
        const raw=await models.Enrollment.findOne({id:enrolled.id}).select('+gradeUpdatedBy +gradeUpdatedAt');assert.equal(raw.grade,null);assert.equal(raw.gradeUpdatedBy,null);assert.equal(raw.gradeUpdatedAt,null);
      }
    });
    await run('concurrent authorized grades retain a valid paired editor and timestamp',async()=>{
      const results=await Promise.all([70,80].map(grade=>services.instructor.setGrades(grade,student.id,c.id,context(instructor.id))));assert.equal(results.length,2);
      const e=await models.Enrollment.findOne({id:enrollment.id}).select('+gradeUpdatedAt +gradeUpdatedBy');assert.ok([70,80].includes(e.grade));assert.ok(e.gradeUpdatedAt instanceof Date);assert.ok(e.gradeUpdatedBy.equals((await currentUser(instructor.id))._id));
    });
    await run('private material metadata verification, edits and reversible removal',async()=>{
      material=await services.materials.addmaterials({name:'Synthetic private',courseId:c.id,asset:asset()},context(instructor.id));
      assert.deepEqual(Object.keys(material).sort(),['id','name','courseId'].sort());assert.equal((await services.materials.getMaterial(material.id,context(student.id))).name,'Synthetic private');
      const stranger=await makeUser();await denied(services.materials.getMaterial(material.id,context(stranger.id)),'DENIED');
      await denied(services.materials.updateMaterials({name:'x'},material.id,context(student.id)),'DENIED');
      await services.materials.updateMaterials({name:'Renamed',asset:asset()},material.id,context(instructor.id));
      const noVerifier=require('../services/materialsServices').createService({models,authenticate});await denied(noVerifier.addmaterials({name:'x',courseId:c.id,asset:asset()},adminCtx),'ASSET_UNVERIFIED');
      await services.materials.deleteMaterials(material.id,context(instructor.id));const raw=await models.Material.findOne({id:material.id}).select('+removedAt +removedBy');assert.ok(raw.removedAt instanceof Date);assert.ok(raw.removedBy.equals((await currentUser(instructor.id))._id));assert.equal(raw.asset.classification,'private');
      await denied(services.materials.getMaterial(material.id,context(student.id)),'NOT_FOUND');
    });
    await run('Phase 2.4 HTTP user contracts, real authorization and persisted self edits',async()=>{
      const {createApp}=require('../app');const {withHttp}=require('./helpers/http');
      const tokens=new Map([['synthetic-admin',adminCtx],['synthetic-student',context(student.id)],['synthetic-instructor',context(instructor.id)]]);
      const options={manager,authenticate,verifyAsset,verifyCounter,
        authorizeRequest:async req=>tokens.get(req.headers['x-synthetic-session']),
        resolveAssetUrl:async ({kind,id})=>`https://assets.example.invalid/${kind}/${id}`};
      await withHttp(createApp(options),async request=>{
        const sh={'x-synthetic-session':'synthetic-student'},ah={'x-synthetic-session':'synthetic-admin'};
        const list=await request('/students',{headers:ah});assert.equal(list.status,200);
        const u=list.body.find(x=>x.id===student.id);assert.equal(u.accountState,'active');assert.equal(u.type,'student');
        assert.deepEqual(Object.keys(u).sort(),['id','name','email','phone','type','accountState','image_url'].sort());
        assert.equal((await request('/students',{headers:sh})).status,403);
        assert.equal((await request(`/students/${student.id}`,{headers:{'x-user-id':'1',authorization:'Bearer forged'}})).status,401);
        const form=new FormData();form.set('name','HTTP Synthetic');form.set('phone','0009');
        assert.equal((await request(`/students/${student.id}`,{method:'PATCH',headers:sh,body:form})).status,200);
        const saved=await currentUser(student.id);assert.equal(saved.name,'HTTP Synthetic');assert.equal(saved.phone,'0009');
        const bad=await request(`/students/${student.id}`,{method:'PATCH',headers:sh,body:{role:'admin'}});assert.equal(bad.status,400);assert.equal((await currentUser(student.id)).role,'student');
        const catalog=await request(`/courses/${c.id}/wrong-code`);assert.equal(catalog.status,200);assert.equal(catalog.body.status,1);assert.equal(catalog.body.id,c.id);
        const invalid=await request('/courses/9007199254740992/SYN');assert.equal(invalid.status,400);
      });
      await withHttp(createApp({manager,authenticate}),async request=>{
        assert.equal((await request('/students')).body.code,'AUTH_UNAVAILABLE');
        assert.equal((await request('/courses')).body.code,'ASSET_UNVERIFIED');
      });
    });
    await run('Phase 2.4 HTTP assignment, enrollment, grades and denial preserve real integrity',async()=>{
      const {createApp}=require('../app');const {withHttp}=require('./helpers/http');
      const target=await makeCourse(),learner=await makeUser(),teacher=await makeUser('instructor');
      const tokens=new Map([['a',adminCtx],['s',context(learner.id)],['i',context(teacher.id)]]);
      const options={manager,authenticate,verifyCounter,authorizeRequest:async req=>tokens.get(req.headers['x-synthetic-session']),resolveAssetUrl:async({kind,id})=>`https://assets.example.invalid/${kind}/${id}`};
      await withHttp(createApp(options),async request=>{
        const ah={'x-synthetic-session':'a'},sh={'x-synthetic-session':'s'},ih={'x-synthetic-session':'i'};
        const assignment=await request('/assign/assign-instructor',{method:'POST',headers:ah,body:{courseId:String(target.id),instructorId:String(teacher.id)}});assert.equal(assignment.status,200);
        assert.ok(await services.instructor.checkAssign(target.id,teacher.id,adminCtx));
        assert.equal((await request(`/students/check/${learner.id}/${target.id}`,{headers:sh})).body,true);
        const results=await Promise.all([1,2].map(()=>request(`/students/registerCourses/${target.id}/${learner.id}`,{method:'POST',headers:sh,body:{}})));
        assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
        assert.equal((await request(`/students/check/${learner.id}/${target.id}`,{headers:sh})).body,false);
        for(const grade of [0,null]){
          assert.equal((await request(`/instractors/setGrades/${learner.id}/${target.id}`,{method:'POST',headers:ih,body:{grades:grade}})).status,200);
          const response=await request(`/students/showGrades/${learner.id}`,{headers:sh});assert.equal(response.body[0].id,target.id);assert.equal(response.body[0].grades,grade);
          const stored=await services.student.checkEnrollment(learner.id,target.id,context(learner.id));assert.equal(stored.grade,grade);
        }
        const roster=await request(`/instractors/student/${target.id}`,{headers:ih});assert.deepEqual(Object.keys(roster.body[0]).sort(),['id','name','ide','grades'].sort());
        assert.equal((await request(`/instractors/setGrades/${learner.id}/${target.id}`,{method:'POST',headers:ah,body:{grades:90}})).status,403);
        await changeUser(teacher.id,{accountState:'disabled'});
        assert.equal((await request(`/instractors/setGrades/${learner.id}/${target.id}`,{method:'POST',headers:ih,body:{grades:90}})).status,403);
        assert.equal((await services.student.checkEnrollment(learner.id,target.id,context(learner.id))).grade,null);
      });
      const other=await makeCourse();
      await withHttp(createApp({...options,verifyCounter:undefined}),async request=>{
        const r=await request(`/students/registerCourses/${other.id}/${learner.id}`,{method:'POST',headers:{'x-synthetic-session':'s'},body:{}});assert.equal(r.body.code,'COUNTER_UNVERIFIED');
        assert.equal(await services.student.checkEnrollment(learner.id,other.id,context(learner.id)),null);
      });
    });
    await run('Phase 2.4 HTTP material access, reversible removal and course archival',async()=>{
      const {createApp}=require('../app');const {withHttp}=require('./helpers/http');
      const target=await makeCourse(),learner=await makeUser();await services.student.enrollment({studentId:learner.id,courseId:target.id},context(learner.id));
      const item=await services.materials.addmaterials({name:'HTTP private fixture',courseId:target.id,asset:asset()},adminCtx);
      const tokens=new Map([['a',adminCtx],['s',context(learner.id)]]);
      await withHttp(createApp({manager,authenticate,verifyCounter,authorizeRequest:async req=>tokens.get(req.headers['x-synthetic-session']),resolveAssetUrl:async({kind,id})=>`https://assets.example.invalid/${kind}/${id}`}),async request=>{
        const ah={'x-synthetic-session':'a'},sh={'x-synthetic-session':'s'};
        const r=await request(`/materials/${target.id}`,{headers:sh});assert.equal(r.status,200);assert.deepEqual(r.body,[{id:item.id,name:'HTTP private fixture',course_id:target.id,fileName:`https://assets.example.invalid/material/${item.id}`}]);
        assert.equal((await request(`/materials/${item.id}`,{method:'DELETE',headers:sh})).status,403);
        assert.equal((await request(`/materials/update/${item.id}`,{method:'PATCH',headers:ah,body:{name:'HTTP renamed'}})).status,200);
        assert.equal((await request(`/materials/${item.id}`,{method:'DELETE',headers:ah})).status,200);
        const raw=await models.Material.findOne({id:item.id}).select('+removedAt +removedBy');assert.ok(raw.removedAt);assert.equal(raw.name,'HTTP renamed');assert.ok(raw.asset);
        assert.equal((await request(`/courses/${target.id}`,{method:'DELETE',headers:ah})).status,200);
        assert.equal((await models.Course.findOne({id:target.id})).lifecycle,'archived');
        assert.ok(await services.student.checkEnrollment(learner.id,target.id,context(learner.id)));
        assert.equal((await request(`/courses/${target.id}/SYN`)).status,404);
      });
    });
    await run('archive preserves enrollment/assignment/material history and private historical access',async()=>{
      const retained=await services.materials.addmaterials({name:'Retained',courseId:c.id,asset:asset()},adminCtx);
      await services.courses.deleteCourse(c.id,adminCtx);await denied(services.courses.getCourse(c.id),'NOT_FOUND');
      assert.equal((await services.student.showGrade(student.id,context(student.id)))[0].course.lifecycle,'archived');
      assert.equal((await services.materials.getMaterial(retained.id,context(student.id))).id,retained.id);
      assert.ok(await models.Material.findOne({id:material.id}));assert.ok(await services.instructor.checkAssign(c.id,instructor.id,adminCtx));
      await denied(services.instructor.setGrades(90,student.id,c.id,context(instructor.id)),'WORKFLOW_REQUIRED');
      const draft=await services.courses.addCourse(catalog(),adminCtx);await denied(services.courses.deleteCourse(draft.id,adminCtx),'RETENTION_REQUIRED');
    });
    await run('Phase 2.6 persisted self profiles reject privileged edits and ineligible actors',async()=>{
      for(const role of ['student','instructor']){
        const user=await makeUser(role),ctx=context(user.id);
        const service=role==='student'?services.student:services.instructor;
        const update=role==='student'?service.updateStudent:service.updateInstructor;
        const read=role==='student'?service.getStudent:service.getInstructor;
        const before=await models.User.collection.findOne({id:user.id});
        await update({name:'Edited synthetic profile',phone:'00042'},user.id,ctx);
        assert.deepEqual(await read(user.id,ctx),{...user,name:'Edited synthetic profile',phone:'00042'});
        const saved=await models.User.collection.findOne({id:user.id});
        assert.deepEqual(saved,{...before,name:'Edited synthetic profile',phone:'00042',integrityVersion:before.integrityVersion+1,__v:before.__v+1});
        for(const data of [{role:'admin'},{accountState:'disabled'},{email:'other@example.invalid'},{id:1},{passwordHash:'replacement'}]){
          await denied(update(data,user.id,ctx),'INVALID_INPUT');
          assert.deepEqual(await models.User.collection.findOne({id:user.id}),saved);
        }
        await denied(update({name:'Cross-user edit'},user.id,context(role==='student'?student.id:instructor.id)),'DENIED');
        assert.deepEqual(await models.User.collection.findOne({id:user.id}),saved);
        for(const accountState of ['pending','disabled']){
          await changeUser(user.id,{accountState});
          const inactive=await models.User.collection.findOne({id:user.id});
          await denied(update({name:'Forbidden edit'},user.id,ctx),'DENIED');
          await denied(read(user.id,ctx),'DENIED');
          assert.deepEqual(await models.User.collection.findOne({id:user.id}),inactive);
        }
      }
    });
    await run('Phase 2.6 live catalog search treats metacharacters literally and excludes drafts',async()=>{
      const marker=`${randomUUID()} [a.*]`;
      const published=await services.courses.addCourse({...catalog(),name:marker},adminCtx);
      const draft=await services.courses.addCourse({...catalog(),name:marker},adminCtx);
      const decoy=await services.courses.addCourse({...catalog(),name:marker.replace('[a.*]','aaa')},adminCtx);
      await services.courses.updateCourse({lifecycle:'published'},published.id,adminCtx);
      await services.courses.updateCourse({lifecycle:'published'},decoy.id,adminCtx);
      assert.deepEqual((await services.courses.searchCourses({text:marker})).map(row=>row.id),[published.id]);
      assert.equal((await services.courses.getCourse(draft.id,adminCtx)).lifecycle,'draft');
      await denied(services.courses.getCourse(draft.id),'NOT_FOUND');
      await services.courses.deleteCourse(published.id,adminCtx);
      assert.deepEqual(await services.courses.searchCourses({text:marker}),[]);
    });
    await run('Phase 2.6 missing and ineligible relationship parents leave the database unchanged',async()=>{
      const target=await makeCourse(),learner=await makeUser(),teacher=await makeUser('instructor');
      const pending=await services.users.insertUser({...account(`${randomUUID()}@example.invalid`,'instructor'),accountState:'pending'},adminCtx);
      const before={};
      for(const [name,Model] of Object.entries(models))before[name]=await Model.collection.find({}).sort({_id:1}).toArray();
      const missing=900000;
      await denied(services.instructor.assgin({courseId:missing,instructorId:teacher.id},adminCtx),'NOT_FOUND');
      await denied(services.instructor.assgin({courseId:target.id,instructorId:missing},adminCtx),'NOT_FOUND');
      await denied(services.instructor.assgin({courseId:target.id,instructorId:learner.id},adminCtx),'NOT_FOUND');
      await denied(services.instructor.assgin({courseId:target.id,instructorId:pending.id},adminCtx),'DENIED');
      await denied(services.student.enrollment({studentId:learner.id,courseId:missing},context(learner.id)),'NOT_FOUND');
      await denied(services.student.enrollment({studentId:missing,courseId:target.id},context(missing)),'DENIED');
      await denied(services.materials.addmaterials({name:'Missing parent',courseId:missing,asset:asset()},adminCtx),'NOT_FOUND');
      for(const [name,Model] of Object.entries(models))assert.deepEqual(await Model.collection.find({}).sort({_id:1}).toArray(),before[name]);
    });
    await run('Phase 2.6 failed enrollment insert rolls back parents and record but never reuses its ID',async()=>{
      const target=await makeCourse(),learner=await makeUser(),ctx=context(learner.id);
      const userBefore=await models.User.collection.findOne({id:learner.id});
      const courseBefore=await models.Course.collection.findOne({id:target.id});
      const counterBefore=await models.Counter.collection.findOne({scope:'enrollments'});
      const original=models.Enrollment.prototype.save;
      let inserted=false;
      models.Enrollment.prototype.save=async function(options){
        await original.call(this,options);inserted=true;throw new Error('synthetic-private-secret');
      };
      try{
        await assert.rejects(services.student.enrollment({studentId:learner.id,courseId:target.id},ctx),error=>
          error.code==='UNAVAILABLE' && error.message==='Database operation unavailable' && !error.cause);
      }finally{models.Enrollment.prototype.save=original;}
      assert.equal(inserted,true,'fault must follow an actual transactional insert');
      assert.equal(await models.Enrollment.countDocuments({student:userBefore._id,course:courseBefore._id}),0);
      assert.deepEqual(await models.User.collection.findOne({id:learner.id}),userBefore);
      assert.deepEqual(await models.Course.collection.findOne({id:target.id}),courseBefore);
      assert.equal((await models.Counter.collection.findOne({scope:'enrollments'})).lastAllocated,counterBefore.lastAllocated+1);
      const created=await services.student.enrollment({studentId:learner.id,courseId:target.id},ctx);
      assert.equal(created.id,counterBefore.lastAllocated+2);assert.equal(created.grade,null);
      assert.equal(await models.Enrollment.countDocuments({student:userBefore._id,course:courseBefore._id}),1);
    });
    await run('Phase 2.6 forbidden lifecycle and deletion paths preserve academic records and assets',async()=>{
      const target=await makeCourse(),learner=await makeUser(),teacher=await makeUser('instructor');
      const assigned=await services.instructor.assgin({courseId:target.id,instructorId:teacher.id},adminCtx);
      const enrolled=await services.student.enrollment({studentId:learner.id,courseId:target.id},context(learner.id));
      await services.instructor.setGrades(0,learner.id,target.id,context(teacher.id));
      const item=await services.materials.addmaterials({name:'Retained fixture',courseId:target.id,asset:asset()},adminCtx);
      const relations=[['InstructorAssignment',assigned.id],['Enrollment',enrolled.id],['Material',item.id]];
      const before=await Promise.all(relations.map(([name,id])=>models[name].collection.findOne({id})));
      await services.courses.deleteCourse(target.id,adminCtx);
      const archived=await models.Course.collection.findOne({id:target.id});
      await denied(services.courses.updateCourse({lifecycle:'published'},target.id,adminCtx),'WORKFLOW_REQUIRED');
      await denied(services.courses.updateCourse({lifecycle:'draft'},target.id,adminCtx),'WORKFLOW_REQUIRED');
      await denied(services.student.deleteStudent(learner.id,adminCtx),'WORKFLOW_REQUIRED');
      await denied(services.instructor.deleteInstructor(teacher.id,adminCtx),'WORKFLOW_REQUIRED');
      await denied(services.materials.updateMaterials({name:'Forbidden'},item.id,adminCtx),'WORKFLOW_REQUIRED');
      assert.deepEqual(await models.Course.collection.findOne({id:target.id}),archived);
      assert.deepEqual(await Promise.all(relations.map(([name,id])=>models[name].collection.findOne({id}))),before);
      assert.ok(await currentUser(learner.id));assert.ok(await currentUser(teacher.id));
      assert.equal((await services.student.showGrade(learner.id,context(learner.id)))[0].grade,0);
      assert.equal((await services.materials.getMaterials(target.id,context(learner.id)))[0].id,item.id);
    });
    await run('missing trusted identity, wrong role, missing counters and legacy exports fail safely',async()=>{
      await denied(services.users.getUserById(1,{id:1,role:'admin'}),'TRUST_REQUIRED');
      for(const n of names)for(const [method,fn]of Object.entries(require(`../services/${n}Services`)))if(method!=='createService')await denied(fn(),'TRUST_REQUIRED');
      await denied(services.users.updateStatus(1,student.id,adminCtx),'WORKFLOW_REQUIRED');await denied(services.student.deleteStudent(student.id,adminCtx),'WORKFLOW_REQUIRED');await denied(services.instructor.deleteInstructor(instructor.id,adminCtx),'WORKFLOW_REQUIRED');
      // Delete only this test-owned counter as a negative fixture; never recreate/lower it.
      const counter=await models.Counter.findOne({scope:'materials'});await counter.deleteOne();
      const target=await makeCourse();await denied(services.materials.addmaterials({name:'Missing counter',courseId:target.id,asset:asset()},adminCtx),'UNAVAILABLE');
      assert.equal(await models.Counter.countDocuments({scope:'materials'}),0);
    });
  }catch(e){throw safeFailure(e);}finally{
    let cleanupFailure;
    try { if(connection){
      for(const [name,owner]of owned){try{const entry=await connection.db.listCollections({name}).next();assert.ok(entry?.info?.uuid);assert.deepEqual(entry.info.uuid,owner.uuid);assert.deepEqual(entry.options.validator,owner.validator);await connection.db.collection(name).drop();owned.delete(name);t.diagnostic(`Dropped ownership-verified collection: ${name}`);}catch(e){cleanupFailure=safeFailure(e);}}
      if(!cleanupFailure){const remaining=await connection.db.listCollections({},{nameOnly:true}).toArray();assert.deepEqual(remaining,[]);t.diagnostic('Cleanup: 0 owned collections pending; namespace empty=true');}
    }
    } finally { await manager.close(); }
    if(cleanupFailure)throw cleanupFailure;
  }
});
