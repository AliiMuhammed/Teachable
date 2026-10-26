'use strict';
const { bindModels } = require('../db/mongoConnection');
const { reserveId, counterSchema } = require('../models/Counter');

const messages = Object.freeze({
  COUNTER_UNVERIFIED: 'Verified counter initialization required', INDEX_UNVERIFIED: 'Required unique indexes unavailable',
  TRUST_REQUIRED: 'Trusted identity is required', DENIED: 'Operation denied',
  INVALID_INPUT: 'Invalid service input', NOT_FOUND: 'Record not found',
  CONFLICT: 'Operation conflicts with current data', WORKFLOW_REQUIRED: 'Separately authorized workflow required',
  LIMIT_EXCEEDED: 'Result exceeds the supported list bound',
  RETENTION_REQUIRED: 'Verified retention clearance required', ASSET_UNVERIFIED: 'Verified asset required',
  UNAVAILABLE: 'Database operation unavailable', RETRY_EXHAUSTED: 'Transaction retry limit reached'
});
class ServiceError extends Error {
  constructor(code) { super(messages[code]); this.name = 'ServiceError'; this.code = code; }
}
const fail = code => { throw new ServiceError(code); };
function id(value) { if (!Number.isSafeInteger(value) || value < 1) fail('INVALID_INPUT'); return value; }
function fields(value, allowed, required = []) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype ||
      Reflect.ownKeys(value).some(k => !allowed.includes(k)) ||
      required.some(k => !Object.hasOwn(value, k))) fail('INVALID_INPUT');
  return value;
}
function text(value, max = Infinity, empty = false) {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) fail('INVALID_INPUT');
  return value;
}
function email(value) {
  text(value, 255); if (!/^[\x21-\x7e]+@[\x21-\x7e]+$/.test(value) || value.split('@').length !== 2) fail('INVALID_INPUT');
  return value.toLowerCase();
}
function asset(value, privateOnly = false) {
  const keys = ['assetId','publicId','environment','displayName','resourceType','deliveryType','classification','format','version','bytes'];
  fields(value, keys, keys);
  for (const key of keys.slice(0, 8)) text(value[key]);
  id(value.version); id(value.bytes);
  const image = ['jpg','png','webp'].includes(value.format);
  if ((!image && !['pdf','docx','pptx'].includes(value.format)) ||
      value.resourceType !== (image ? 'image' : 'raw') ||
      !['private','public'].includes(value.classification) ||
      value.deliveryType !== (value.classification === 'private' ? 'authenticated' : 'upload') ||
      (privateOnly && value.classification !== 'private') ||
      value.bytes > (image ? 10_000_000 : 25_000_000)) fail('INVALID_INPUT');
  return Object.freeze({ ...value });
}
function retainAsset(previous, next) {
  // Replacement needs durable retention/cleanup ownership, which the later file workflow owns.
  if (Object.keys(next).some(key => previous[key] !== next[key])) fail('WORKFLOW_REQUIRED');
}
const userDTO = d => ({ id: d.id, name: d.name, email: d.email, phone: d.phone, role: d.role, accountState: d.accountState });
const courseDTO = d => ({ id: d.id, name: d.name, code: d.code, description: d.description, durations: d.durations, lifecycle: d.lifecycle });
const enrollmentDTO = (d, studentId, courseId) => ({ id: d.id, studentId, courseId, grade: d.grade });
const materialDTO = (d, courseId) => ({ id: d.id, name: d.name, courseId });
const hidden = { User: '+passwordHash +emailKey +publicProfileApprovedAt +integrityVersion', Course: '+integrityVersion', InstructorAssignment: '+integrityVersion', Enrollment: '+gradeUpdatedBy +gradeUpdatedAt', Material: '+removedBy +removedAt' };

function support(dependencies = {}) {
  const { models: supplied, manager, authenticate, verifyAsset, verifyCounter } = dependencies;
  async function run(context, work, publicRead = false) {
    try {
      let identity;
      if (context !== undefined || !publicRead) {
        if (typeof authenticate !== 'function') fail('TRUST_REQUIRED');
        identity = await authenticate(context);
        if (!Number.isSafeInteger(identity) || identity < 1) fail('TRUST_REQUIRED');
      }
      const models = supplied || (manager && bindModels(await manager.acquire()));
      if (!models || (supplied && manager)) fail('UNAVAILABLE');
      const connection = models.User?.db;
      for (const name of ['User','Course','InstructorAssignment','Enrollment','Material','Counter']) {
        const schema = name === 'Counter' ? counterSchema : require(`../models/${name}`);
        if (models[name]?.db !== connection || models[name]?.schema !== schema ||
            models[name]?.collection.name !== schema.options.collection) fail('UNAVAILABLE');
      }
      const allocations = new Map();
      const session = await connection.startSession();
      let attempts = 0;
      try {
        return await session.withTransaction(async () => {
          if (++attempts > 3) fail('RETRY_EXHAUSTED');
          // Let a competing reference transaction commit before spending the remaining bounded attempts.
          if (attempts > 1) await new Promise(resolve => setTimeout(resolve, 1000 * (attempts - 1)));
          const one = (name, filter) => models[name].findOne(filter).select(hidden[name] || '').session(session).maxTimeMS(5000);
          const many = async (name, filter, limit) => {
            const rows = await models[name].find(filter).select(hidden[name] || '').session(session).sort({ id: 1 }).limit(limit ?? 101).maxTimeMS(5000);
            if (limit === undefined && rows.length > 100) fail('LIMIT_EXCEEDED');
            return rows;
          };
          const required = async (name, filter) => { const doc = await one(name, filter); if (!doc) fail('NOT_FOUND'); return doc; };
          const actor = identity === undefined ? null : await one('User', { id: identity });
          if (identity !== undefined && (!actor || actor.accountState !== 'active')) fail('DENIED');
          const role = (...roles) => { if (!actor || !roles.includes(actor.role)) fail('DENIED'); };
          const self = target => { if (!actor || actor.id !== target) fail('DENIED'); };
          const touched = new Set();
          const touch = async doc => {
            const key = `${doc.constructor.modelName}:${doc._id}`;
            if (touched.has(key)) return;
            if (!Number.isSafeInteger(doc.integrityVersion) || doc.integrityVersion >= Number.MAX_SAFE_INTEGER) fail('CONFLICT');
            doc.integrityVersion += 1;
            await doc.save({ session }); touched.add(key);
          };
          const lockActor = async () => { if (!actor) fail('DENIED'); await touch(actor); };
          const assignment = async course => {
            role('instructor'); const a = await one('InstructorAssignment', { course: course._id, instructor: actor._id });
            if (!a) fail('DENIED'); return a;
          };
          const courseAccess = async (course, write = false) => {
            if (!actor) fail('DENIED');
            if (actor.role === 'admin') return null;
            if (actor.role === 'instructor') return assignment(course);
            if (write || !['published','archived'].includes(course.lifecycle)) fail('DENIED');
            const e = await one('Enrollment', { course: course._id, student: actor._id });
            if (!e) fail('DENIED'); return null;
          };
          const allocate = async scope => {
            if (!allocations.has(scope)) {
              if (typeof verifyCounter !== 'function' || await verifyCounter(scope) !== true) fail('COUNTER_UNVERIFIED');
              const entity = Object.values(models).find(model => model.collection.name === scope);
              if (!entity) fail('COUNTER_UNVERIFIED');
              for (const model of [models.Counter, entity]) {
                const installed = await model.listIndexes();
                for (const [key, options] of model.schema.indexes()) {
                  if (options.unique && !installed.some(index => index.unique === true &&
                      JSON.stringify(index.key) === JSON.stringify(key) && !index.sparse &&
                      !index.partialFilterExpression && (!index.collation || index.collation.locale === 'simple'))) fail('INDEX_UNVERIFIED');
                }
              }
              allocations.set(scope, await reserveId(models.Counter, scope));
            }
            return allocations.get(scope);
          };
          const validate = async (name, data) => { const doc = new models[name](data); await doc.validate(); return doc; };
          const verify = async (value, purpose, courseId) => {
            if (typeof verifyAsset !== 'function' || await verifyAsset(value, Object.freeze({ actorId: actor.id, purpose, courseId })) !== true) fail('ASSET_UNVERIFIED');
          };
          return work({ models, session, actor, one, many, required, role, self, touch, lockActor, assignment, courseAccess, allocate, validate, verify });
        }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary', timeoutMS: 15000, maxCommitTimeMS: 5000 });
      } finally { await session.endSession(); }
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      if (error?.code === 11000 || error?.name === 'VersionError') fail('CONFLICT');
      if (['ValidationError','CastError','StrictModeError'].includes(error?.name)) fail('INVALID_INPUT');
      fail('UNAVAILABLE');
    }
  }
  return { run };
}
function expose(createService, names) {
  return Object.freeze({ createService, ...Object.fromEntries(names.map(name => [name, async () => fail('TRUST_REQUIRED')])) });
}
async function profile(s, targetId, expectedRole) {
  id(targetId);
  if (s.actor.role !== 'admin') s.self(targetId);
  return userDTO(await s.required('User', { id: targetId, ...(expectedRole ? { role: expectedRole } : {}) }));
}
async function editProfile(s, data, targetId, expectedRole) {
  id(targetId); s.role(expectedRole); s.self(targetId);
  fields(data, ['name','phone','profileImage']); if (!Object.keys(data).length) fail('INVALID_INPUT');
  if (Object.hasOwn(data,'name')) text(data.name,255);
  if (Object.hasOwn(data,'phone')) text(data.phone);
  const changes = { ...data };
  if (Object.hasOwn(data,'profileImage')) {
    changes.profileImage = asset(data.profileImage, true);
    if (changes.profileImage.resourceType !== 'image' || changes.profileImage.bytes > 5_000_000) fail('INVALID_INPUT');
    retainAsset(s.actor.profileImage, changes.profileImage);
    await s.verify(changes.profileImage, 'profile');
  }
  Object.assign(s.actor, changes); await s.lockActor(); return userDTO(s.actor);
}
module.exports = { support, expose, fail, id, fields, text, email, asset, retainAsset, userDTO, courseDTO, enrollmentDTO, materialDTO, profile, editProfile };
