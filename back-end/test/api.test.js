'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const Module = require('node:module');
const load = Module._load;
Module._load = function(name, ...args) {
  if (/dbConnection|^mysql$|uploadImages|controller\/(?!apiController)/.test(name)) throw Error('Unsafe legacy import');
  return load.call(this, name, ...args);
};
const { fixture, course } = require('./helpers/serviceFixture');
const { withHttp } = require('./helpers/http');
const createApp = options => require('../app').createApp(options);
const headers = actor => ({ 'x-test-session': actor });
function setup(overrides = {}) {
  const f = fixture();
  // Test-only opaque identities; no request ID/role is trusted by production code.
  const sessions = new Map([['admin', f.context(1)], ['student', f.context(2)], ['instructor', f.context(3)]]);
  const options = { ...f.dependencies, authorizeRequest: async req => sessions.get(req.headers['x-test-session']),
    resolveAssetUrl: async ({ kind, id }) => `https://assets.example.invalid/${kind}/${id}`, ...overrides };
  return { ...f, app: createApp(options), options };
}
const error = (r, status, code) => { assert.equal(r.status, status); assert.equal(r.body.code, code); assert.equal(typeof r.body.errors, 'string'); };
const routes = [
  ['POST','/auth/register'],['POST','/auth/login'],['POST','/auth/logout/2'],
  ['POST','/courses'],['PATCH','/courses/10/SYN'],['DELETE','/courses/10'],
  ['POST','/assign/assign-instructor'],['PATCH','/instractors/3'],['DELETE','/instractors/3'],
  ['GET','/instractors'],['GET','/instractors/3'],['GET','/instractors/view/3'],
  ['POST','/instractors/setGrades/2/10'],['GET','/instractors/student/10'],
  ['PATCH','/students/2'],['DELETE','/students/delete/2'],['GET','/students'],['GET','/students/2'],
  ['POST','/students/registerCourses/10/2'],['GET','/students/showGrades/2'],['GET','/students/check/2/10'],
  ['POST','/materials/add/10'],['GET','/materials/10'],['PATCH','/materials/update/40'],['DELETE','/materials/40']
];

test('app import cannot load legacy controllers, MySQL, uploads, connect or listen', () => {
  const source = `const M=require('node:module'),old=M._load; M._load=function(n,...a){if(/dbConnection|^mysql$|uploadImages|controller\\/(?!apiController)/.test(n))throw Error('legacy');return old.call(this,n,...a)}; const m=require('mongoose');m.createConnection=()=>{throw Error('connect')};require('node:net').Server.prototype.listen=()=>{throw Error('listen')};const app=require('./back-end/app');require('node:assert/strict').equal(typeof app.createApp,'function');`;
  const child = spawnSync(process.execPath, ['-e', source], { cwd: path.resolve(__dirname, '../..'), env: process.env, encoding:'utf8' });
  assert.equal(child.status, 0, child.stderr);
});
test('all 27 legacy routes exist; default composition denies protected operations and opens no DB', async () => {
  await withHttp(createApp(), async request => {
    for (const [method, url] of routes) error(await request(url, { method, body: method === 'GET' ? undefined : { id:1, role:'admin' }, headers:{ authorization:'Bearer forged', cookie:'role=admin' } }),503,/^\/auth\//.test(url)?'WORKFLOW_REQUIRED':'AUTH_UNAVAILABLE');
    for (const url of ['/courses','/courses/10/SYN']) error(await request(url),503,'UNAVAILABLE');
    error(await request('/unknown'),404,'NOT_FOUND');
  });
});
test('public catalog preserves course wire fields, forward status mapping and literal search', async () => {
  const f = setup(); f.put('Course', { ...course(11), lifecycle:'draft' });
  await withHttp(f.app, async request => {
    const r = await request('/courses'); assert.equal(r.status,200);
    assert.deepEqual(r.body,[{ id:10,name:'Literal [x]',code:'SYN',description:'Description only',durations:'Eight meetings',status:1,image_url:'https://assets.example.invalid/course/10' }]);
    assert.deepEqual((await request('/courses?search=%5Bx%5D')).body,r.body);
    assert.deepEqual((await request('/courses?search=nomatch')).body,[]);
    error(await request('/courses?search[$ne]=x'),400,'INVALID_INPUT');
    error(await request('/courses?search=x&search=y'),400,'INVALID_INPUT');
    error(await request('/courses?description=x'),400,'INVALID_INPUT');
    error(await request('/courses/11/anything'),404,'NOT_FOUND');
    assert.equal((await request('/courses/11/anything',{ headers:headers('admin') })).body.status,0);
  });
});
test('IDs reject unsafe/coercive inputs; code is not an authorization credential', async () => {
  await withHttp(setup().app,async request => {
    for(const id of ['0','-1','1e1','10.0','010','9007199254740992','%20','NaN','%7B%7D']) error(await request(`/courses/${id}/SYN`),400,'INVALID_INPUT');
    assert.equal((await request('/courses/10/wrong-code')).body.id,10);
    error(await request('/courses/%E0%A4%A/SYN'),400,'INVALID_INPUT');
  });
});
test('trusted user DTOs preserve role alias and accountState while omitting deprecated status and secrets', async () => {
  const f = setup();
  await withHttp(f.app,async request => {
    const r=await request('/instractors/3',{headers:headers('instructor')});
    assert.deepEqual(r.body,{id:3,name:'Synthetic 3',email:'Synthetic3@example.invalid',phone:'00123',type:'instractor',accountState:'active',image_url:'https://assets.example.invalid/profile/3'});
    for(const state of ['pending','disabled']) { f.student.accountState=state; const u=(await request('/students',{headers:headers('admin')})).body[0]; assert.equal(u.accountState,state); assert.equal(Object.hasOwn(u,'status'),false); }
    error(await request('/students/2',{headers:headers('instructor')}),403,'DENIED');
    error(await request('/students/2?role=admin&id=1',{headers:{'x-user-id':'1'}}),401,'TRUST_REQUIRED');
    error(await request('/students',{headers:headers('student')}),403,'DENIED');
  });
});
test('profile JSON, URL-encoded and file-free multipart updates retain safe fields only', async () => {
  const f=setup();
  await withHttp(f.app,async request=>{
    const form=new FormData();form.set('name','New Student');form.set('phone','0007');
    assert.deepEqual((await request('/students/2',{method:'PATCH',headers:headers('student'),body:form})).body,{msg:'Student updated'});
    assert.equal(f.student.phone,'0007');
    assert.equal((await request('/instractors/3',{method:'PATCH',headers:{...headers('instructor'),'content-type':'application/x-www-form-urlencoded'},body:'name=Teacher&phone=009'})).status,200);
    for(const body of [{status:1},{role:'admin'},{type:'admin'},{accountState:'active'},{password:'x'},{email:'x@example.invalid'},{image_url:'x'},{}]) error(await request('/students/2',{method:'PATCH',headers:headers('student'),body}),400,'INVALID_INPUT');
    error(await request('/students/2',{method:'PATCH',headers:headers('admin'),body:{name:'changed'}}),403,'DENIED');
  });
});
test('enrollment boolean polarity, roster privacy and grade null/zero wire contracts',async()=>{
  const f=setup();
  await withHttp(f.app,async request=>{
    assert.equal((await request('/students/check/2/10',{headers:headers('student')})).body,false);
    const roster=await request('/instractors/student/10',{headers:headers('instructor')});
    assert.deepEqual(roster.body,[{id:2,name:'Synthetic 2',ide:30,grades:null}]);
    for(const grade of [0,'0',100,null]) {
      const r=await request('/instractors/setGrades/2/10',{method:'POST',headers:headers('instructor'),body:{grades:grade}});assert.deepEqual(r.body,{msg:'Grades Added'});
      const g=(await request('/students/showGrades/2',{headers:headers('student')})).body[0];
      assert.deepEqual(g,{id:10,name:'Literal [x]',code:'SYN',durations:'Eight meetings',image_url:'https://assets.example.invalid/course/10',grades:grade==='0'?0:grade});
    }
    for(const grade of ['',true,{},[],101,-1,' 0','1e2','1.5','null']) error(await request('/instractors/setGrades/2/10',{method:'POST',headers:headers('instructor'),body:{grades:grade}}),400,'INVALID_INPUT');
    error(await request('/instractors/setGrades/2/10',{method:'POST',headers:headers('admin'),body:{grades:60}}),403,'DENIED');
    error(await request('/students/check/1/10',{headers:headers('student')}),403,'DENIED');
    f.rows.Enrollment.length=0;
    assert.equal((await request('/students/check/2/10',{headers:headers('student')})).body,true);
    assert.deepEqual((await request('/students/showGrades/2',{headers:headers('student')})).body,{msg:'not found'});
  });
});
test('canonical assignment IDs, counter attestation and no success before committed writes',async()=>{
  const f=setup();f.rows.InstructorAssignment.length=0;let release,entered;
  const arrived=new Promise(r=>{entered=r;});const gate=new Promise(r=>{release=r;});
  const original=f.models.InstructorAssignment.prototype.save;
  f.models.Counter.collection.findOneAndUpdate=async()=>({lastAllocated:501});
  f.models.InstructorAssignment.prototype.save=async function(...args){entered();await gate;return original.apply(this,args);};
  await withHttp(f.app,async request=>{
    let finished=false;
    const pending=request('/assign/assign-instructor',{method:'POST',headers:headers('admin'),body:{courseId:'10',instructorId:'3'}}).then(r=>{finished=true;return r;});
    try { await Promise.race([arrived,new Promise((_,reject)=>setTimeout(()=>reject(Error('barrier timeout')),2000).unref())]);assert.equal(finished,false); }
    finally { release(); }
    const response=await pending;assert.equal(response.status,200);assert.deepEqual(response.body,{msg:'instructor Assign successfully'});
    assert.ok(f.rows.InstructorAssignment[0].course.equals(f.c._id));assert.ok(f.rows.InstructorAssignment[0].instructor.equals(f.instructor._id));
  });
  const noCounter=setup({verifyCounter:undefined});noCounter.rows.Enrollment.length=0;
  await withHttp(noCounter.app,async request=>error(await request('/students/registerCourses/10/2',{method:'POST',headers:headers('student'),body:{}}),503,'COUNTER_UNVERIFIED'));
});
test('material URL resolution follows service access; edits/remove preserve records and never unlink',async()=>{
  const f=setup();
  await withHttp(f.app,async request=>{
    assert.deepEqual((await request('/materials/10',{headers:headers('student')})).body,[{id:40,name:'Private note',course_id:10,fileName:'https://assets.example.invalid/material/40'}]);
    error(await request('/materials/10',{headers:{}}),401,'TRUST_REQUIRED');
    error(await request('/materials/update/40',{method:'PATCH',headers:headers('student'),body:{name:'X'}}),403,'DENIED');
    assert.equal((await request('/materials/update/40',{method:'PATCH',headers:headers('instructor'),body:{name:'Renamed'}})).status,200);
    assert.deepEqual((await request('/materials/40',{method:'DELETE',headers:headers('instructor')})).body,{msg:'Material Delete Success'});
    assert.equal(f.rows.Material.length,1);assert.ok(f.rows.Material[0].removedAt);
    assert.equal((await request('/materials/10',{headers:headers('student')})).status,404);
  });
});
test('missing or unsafe asset resolver fails closed without partial DTOs or forged host links',async()=>{
  for(const resolver of [undefined,async()=>null,async()=>'http://assets.example.invalid/x',async()=>'javascript:alert(1)',async()=>'https://user:password@assets.example.invalid/x']) {
    const f=setup({resolveAssetUrl:resolver});
    await withHttp(f.app,async request=>{
      error(await request('/courses',{headers:{host:'attacker.invalid'}}),503,'ASSET_UNVERIFIED');
      error(await request('/students/2',{headers:headers('student')}),503,'ASSET_UNVERIFIED');
      error(await request('/materials/10',{headers:headers('student')}),503,'ASSET_UNVERIFIED');
    });
  }
});
test('uploads, status transitions and unsupported workflows are rejected without storage or false success',async()=>{
  const f=setup();
  await withHttp(f.app,async request=>{
    for(const [method,url] of [['POST','/auth/register'],['POST','/auth/login'],['POST','/auth/logout/2'],['POST','/courses'],['POST','/materials/add/10'],['DELETE','/students/delete/2'],['DELETE','/instractors/3']]) error(await request(url,{method,headers:headers('admin'),body:{}}),503,'WORKFLOW_REQUIRED');
    error(await request('/courses/10/SYN',{method:'PATCH',headers:headers('admin'),body:{status:0}}),503,'WORKFLOW_REQUIRED');
    for(const url of ['/students/2','/instractors/3','/courses/10/SYN','/materials/update/40']) {
      const form=new FormData();form.set('name','Changed');form.set('image',new Blob(['synthetic bytes']),'../../should-not-exist.txt');
      error(await request(url,{method:'PATCH',headers:headers(url.includes('students')?'student':url.includes('instractors')?'instructor':'admin'),body:form}),400,'INVALID_INPUT');
    }
    for(const url of ['/upload/synthetic-secret.pdf','/synthetic-secret.pdf','/../back-end/.env','/%2e%2e/back-end/.env']) error(await request(url),404,'NOT_FOUND');
  });
});
test('safe JSON errors redact raw causes, malformed payloads, overflow and unknown routes',async()=>{
  const f=setup();
  await withHttp(f.app,async request=>{
    error(await request('/students/2',{method:'PATCH',headers:{...headers('student'),'content-type':'application/json'},body:'{"secret":'}),400,'INVALID_INPUT');
    error(await request('/students/2',{method:'PATCH',headers:headers('student'),body:{name:'x'.repeat(70000)}}),413,'PAYLOAD_TOO_LARGE');
    const r=await request('/nothing');assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-powered-by'),null);
    f.models.User.db.startSession=async()=>{throw Error('mongodb+srv://private:password@secret.invalid')};
    const failed=await request('/students/2',{headers:headers('student')});error(failed,503,'UNAVAILABLE');assert.doesNotMatch(JSON.stringify(failed.body),/password|secret|mongodb/);
  });
});
test('empty-list and missing-record responses preserve safe historical shapes',async()=>{
  const f=setup();f.rows.User.splice(1);f.rows.InstructorAssignment.length=0;
  await withHttp(f.app,async request=>{
    assert.deepEqual(await request('/students',{headers:headers('admin')}).then(r=>[r.status,r.body]),[404,{msg:'no Students found'}]);
    assert.deepEqual(await request('/instractors',{headers:headers('admin')}).then(r=>[r.status,r.body]),[404,{msg:'no instructors found'}]);
    error(await request('/students/999',{headers:headers('admin')}),404,'NOT_FOUND');
  });
});
test('URL-encoded field overflow reports a client limit rather than a server failure',async()=>{
  await withHttp(setup().app,async request=>{
    error(await request('/students/2',{method:'PATCH',headers:{...headers('student'),'content-type':'application/x-www-form-urlencoded'},body:'a=1&b=2&c=3&d=4&e=5&f=6&g=7&h=8&i=9'}),413,'PAYLOAD_TOO_LARGE');
  });
});
test('malformed multipart input and unsupported preflight return fixed JSON errors',async()=>{
  await withHttp(setup().app,async request=>{
    error(await request('/students/2',{method:'PATCH',headers:{...headers('student'),'content-type':'multipart/form-data'},body:'synthetic-invalid-form'}),400,'INVALID_INPUT');
    error(await request('/students/2',{method:'OPTIONS',headers:{origin:'https://synthetic.example.invalid','access-control-request-method':'PATCH'}}),503,'WORKFLOW_REQUIRED');
  });
});
test('HTTP enrollment allocates once and course metadata/archive retain academic history',async()=>{
  const f=setup();f.rows.Enrollment.length=0;let reserved=700;
  f.models.Counter.collection.findOneAndUpdate=async()=>({lastAllocated:++reserved});
  await withHttp(f.app,async request=>{
    const r=await request('/students/registerCourses/10/2',{method:'POST',headers:headers('student'),body:{}});
    assert.deepEqual([r.status,r.body],[200,{msg:'Course registered successfully'}]);
    assert.equal(f.rows.Enrollment[0].id,701);assert.equal(f.rows.Enrollment[0].grade,null);
    assert.ok(f.rows.Enrollment[0].student.equals(f.student._id));assert.ok(f.rows.Enrollment[0].course.equals(f.c._id));
    error(await request('/students/registerCourses/10/2',{method:'POST',headers:headers('student'),body:{}}),409,'CONFLICT');
    assert.equal(reserved,701);
    assert.equal((await request('/courses/10/SYN',{method:'PATCH',headers:headers('admin'),body:{name:'Updated',description:''}})).status,200);
    assert.equal(f.c.name,'Updated');assert.equal(f.c.description,'');
    assert.equal((await request('/instractors/view/3',{headers:headers('instructor')})).body[0].id,10);
    assert.equal((await request('/courses/10',{method:'DELETE',headers:headers('admin')})).status,200);
    assert.equal(f.c.lifecycle,'archived');assert.equal(f.rows.Enrollment.length,1);assert.equal(f.rows.Material.length,1);
    error(await request('/courses/10/SYN'),404,'NOT_FOUND');
    assert.equal((await request('/students/showGrades/2',{headers:headers('student')})).body[0].id,10);
  });
});
test('service and resolver failures never leak internals or publish partial lists',async()=>{
  for(const [failure,status,code] of [[{code:11000},409,'CONFLICT'],[{name:'VersionError'},409,'CONFLICT'],[{name:'ValidationError'},400,'INVALID_INPUT']]){
    const f=setup();f.models.User.db.startSession=async()=>{throw failure};
    await withHttp(f.app,async request=>error(await request('/students/2',{headers:headers('student')}),status,code));
  }
  let calls=0;
  const f=setup({resolveAssetUrl:async()=>{if(++calls===2)throw Error('private provider credential');return 'https://assets.example.invalid/approved';}});
  f.put('Course',course(11));
  await withHttp(f.app,async request=>{
    const r=await request('/courses');error(r,500,'INTERNAL');assert.doesNotMatch(JSON.stringify(r.body),/credential|approved|Literal/);
  });
});
test('HTTP uploads and removals never invoke filesystem mutation APIs',async()=>{
  const fs=require('node:fs');const f=setup();const attempted=[];
  const names=['unlink','unlinkSync','writeFile','writeFileSync','createWriteStream','rename','renameSync','rm','rmSync','mkdir','mkdirSync'];
  const originals=new Map(names.map(name=>[name,fs[name]]));
  for(const name of names) fs[name]=()=>{attempted.push(name);throw Error('Filesystem mutation forbidden');};
  try {
    await withHttp(f.app,async request=>{
      const form=new FormData();form.set('image',new Blob(['synthetic']),'synthetic.png');
      error(await request('/students/2',{method:'PATCH',headers:headers('student'),body:form}),400,'INVALID_INPUT');
      assert.equal((await request('/materials/40',{method:'DELETE',headers:headers('instructor')})).status,200);
      assert.equal((await request('/courses/10',{method:'DELETE',headers:headers('admin')})).status,200);
      error(await request('/students/delete/2',{method:'DELETE',headers:headers('admin')}),503,'WORKFLOW_REQUIRED');
    });
    assert.deepEqual(attempted,[]);
  } finally { for(const [name,fn] of originals) fs[name]=fn; }
});
