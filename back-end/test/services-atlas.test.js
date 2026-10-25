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
    await run('archive preserves enrollment/assignment/material history and private historical access',async()=>{
      const retained=await services.materials.addmaterials({name:'Retained',courseId:c.id,asset:asset()},adminCtx);
      await services.courses.deleteCourse(c.id,adminCtx);await denied(services.courses.getCourse(c.id),'NOT_FOUND');
      assert.equal((await services.student.showGrade(student.id,context(student.id)))[0].course.lifecycle,'archived');
      assert.equal((await services.materials.getMaterial(retained.id,context(student.id))).id,retained.id);
      assert.ok(await models.Material.findOne({id:material.id}));assert.ok(await services.instructor.checkAssign(c.id,instructor.id,adminCtx));
      await denied(services.instructor.setGrades(90,student.id,c.id,context(instructor.id)),'WORKFLOW_REQUIRED');
      const draft=await services.courses.addCourse(catalog(),adminCtx);await denied(services.courses.deleteCourse(draft.id,adminCtx),'RETENTION_REQUIRED');
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
