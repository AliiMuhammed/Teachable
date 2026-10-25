'use strict';
const mongoose = require('mongoose');
const asset = () => ({ assetId: 'synthetic', publicId: 'synthetic/image', environment: 'synthetic', displayName: 'Synthetic', resourceType: 'image', deliveryType: 'authenticated', classification: 'private', format: 'png', version: 1, bytes: 100 });
const user = (id, role) => ({ id, name: `Synthetic ${id}`, email: `Synthetic${id}@example.invalid`, phone: '00123', passwordHash: `$2b$12$${'a'.repeat(53)}`, role, accountState: 'active', profileImage: asset() });
const course = id => ({ id, name: 'Literal [x]', code: 'SYN', description: 'Description only', durations: 'Eight meetings', lifecycle: 'published', coverImage: asset() });

// Offline adapter uses real schemas/async validation; it is not MongoDB or atomicity proof.
function fixture() {
  const connection = mongoose.createConnection();
  const schemas = { User: require('../../models/User'), Course: require('../../models/Course'), InstructorAssignment: require('../../models/InstructorAssignment'), Enrollment: require('../../models/Enrollment'), Material: require('../../models/Material'), Counter: require('../../models/Counter').counterSchema, Session: require('../../models/Session') };
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
  const services=Object.fromEntries(['users','courses','instructor','student','materials'].map(n=>[n,require(`../../services/${n}Services`).createService(dependencies)]));
  const put = (n,data) => { const d=new models[n](data); rows[n].push(d); return d; };
  const admin=put('User',user(1,'admin')); const student=put('User',user(2,'student')); const instructor=put('User',user(3,'instructor'));
  const c=put('Course',course(10)); put('InstructorAssignment',{id:20,course:c._id,instructor:instructor._id});
  put('Enrollment',{id:30,course:c._id,student:student._id,grade:null});
  put('Material',{id:40,name:'Private note',course:c._id,asset:asset()});
  return { models, rows, services, context, put, admin, student, instructor, c, dependencies };
}

module.exports = { fixture, asset, user, course };
