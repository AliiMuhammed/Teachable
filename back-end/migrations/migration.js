'use strict';

const { createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const mongoose = require('mongoose');

const schemas = {
  User: require('../models/User'), Course: require('../models/Course'),
  InstructorAssignment: require('../models/InstructorAssignment'),
  Enrollment: require('../models/Enrollment'), Material: require('../models/Material'),
  Counter: require('../models/Counter').counterSchema
};
const tables = ['users', 'courses', 'instractors_courses', 'users_courses', 'materials'];
const scopes = ['users', 'courses', 'instructorAssignments', 'enrollments', 'materials'];
const modelNames = Object.keys(schemas);
const sessionSchema = require('../models/Session');
const MAX_BYTES = 1024 * 1024;
const messages = {
  MIGRATION_INPUT: 'Migration snapshot requires reconciliation',
  MIGRATION_TRUST: 'Migration requires trusted isolated target, asset and issued-ID evidence',
  MIGRATION_CONFLICT: 'Migration target differs; preserve evidence and reconcile before resuming',
  MIGRATION_WRITE: 'Migration outcome requires reconciliation before resuming',
  MIGRATION_BACKUP: 'Migration backup unavailable or integrity verification failed'
};
function failure(code) { return Object.assign(new Error(messages[code]), { code }); }
function requireValue(value) { if (!value) throw failure('MIGRATION_INPUT'); }
function keys(value, names) {
  requireValue(value && Object.getPrototypeOf(value) === Object.prototype);
  requireValue(Object.keys(value).sort().join('|') === [...names].sort().join('|'));
  requireValue(Object.values(value).every(v => v !== undefined));
}
function id(value) { requireValue(Number.isSafeInteger(value) && value > 0); return value; }
function hash(value) { return createHash('sha256').update(value).digest('hex'); }
function canonical(value) {
  if (value instanceof mongoose.Types.ObjectId) return ['oid', value.toHexString()];
  if (value instanceof Date) return ['date', value.toISOString()];
  if (Array.isArray(value)) return ['array', value.map(canonical).sort((a, b) => {
    const left = JSON.stringify(a), right = JSON.stringify(b); return left < right ? -1 : left > right ? 1 : 0;
  })];
  if (value && typeof value === 'object') return ['object', Object.keys(value).sort().map(k => [k, canonical(value[k])])];
  return [value === null ? 'null' : typeof value, value];
}
const encode = value => JSON.stringify(canonical(value));
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function unique(rows, getKey) {
  const seen = new Set();
  for (const row of rows) { const key = getKey(row); requireValue(!seen.has(key)); seen.add(key); }
}

async function prepare(input) {
  let connection;
  try {
    input = freeze(structuredClone(input));
    requireValue(Buffer.byteLength(JSON.stringify(input)) <= MAX_BYTES);
    keys(input, ['version', 'sourceId', 'source', 'resolutions', 'assets']);
    requireValue(input.version === 1 && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(input.sourceId));
    keys(input.source, tables);
    keys(input.resolutions, ['users', 'courses', 'materials', 'issued']);
    const source = input.source, resolutions = input.resolutions;
    for (const table of tables) {
      requireValue(Array.isArray(source[table]) && source[table].length <= 1000);
      unique(source[table], row => id(row[table === 'users_courses' ? 'ide' : 'id']));
    }
    for (const table of ['users', 'courses', 'materials']) {
      requireValue(Array.isArray(resolutions[table]));
      unique(resolutions[table], row => id(row.id));
      requireValue(encode(resolutions[table].map(r => r.id)) === encode(source[table].map(r => r.id)));
    }
    requireValue(Array.isArray(resolutions.issued) && resolutions.issued.length === 5);
    unique(resolutions.issued, row => row.scope);
    for (const row of resolutions.issued) {
      keys(row, ['scope', 'lastIssued', 'evidence']);
      requireValue(scopes.includes(row.scope) && Number.isSafeInteger(row.lastIssued) && row.lastIssued >= 0 && row.lastIssued < Number.MAX_SAFE_INTEGER);
      requireValue(typeof row.evidence === 'string' && row.evidence.trim().length > 0 && row.evidence.length <= 255);
      const table = tables[scopes.indexOf(row.scope)];
      requireValue(source[table].every(r => (r.id ?? r.ide) <= row.lastIssued));
    }
    requireValue(Array.isArray(input.assets));
    unique(input.assets, row => row.assetId);
    for (const item of input.assets) {
      keys(item, ['assetId', 'legacyReferences', 'content', 'bytes', 'sha256']);
      requireValue(typeof item.assetId === 'string' && item.assetId.length > 0 && typeof item.content === 'string');
      const bytes = Buffer.from(item.content, 'base64');
      requireValue(bytes.toString('base64') === item.content && bytes.length === item.bytes && bytes.length > 0 && hash(bytes) === item.sha256);
      requireValue(Array.isArray(item.legacyReferences) && item.legacyReferences.length > 0 && item.legacyReferences.every(r => typeof r === 'string' && r.length > 0));
    }
    const oid = (table, key) => new mongoose.Types.ObjectId(hash(`${input.sourceId}:${table}:${key}`).slice(0, 24));
    const resolve = (table, key) => resolutions[table].find(r => r.id === key);
    const reference = (table, key, role) => {
      id(key); const row = source[table].find(r => r.id === key);
      requireValue(row && (!role || row.type === role)); return oid(table, key);
    };
    const usedAssets = new Set();
    const asset = (value, legacy) => {
      requireValue(value && typeof legacy === 'string' && legacy.length > 0);
      const manifest = input.assets.find(a => a.assetId === value.assetId);
      requireValue(manifest && manifest.legacyReferences.includes(legacy) && manifest.bytes === value.bytes);
      usedAssets.add(value.assetId); return value;
    };
    const rows = {
      User: source.users.map(r => {
        keys(r, ['id', 'name', 'email', 'password', 'phone', 'type', 'status', 'image_url']);
        requireValue(Number.isSafeInteger(r.status));
        const resolved = resolve('users', r.id);
        keys(resolved, ['id', 'accountState', 'phone', 'profileImage']);
        requireValue(Number.isSafeInteger(r.phone) && resolved.phone === String(r.phone));
        requireValue(['student', 'instractor', 'admin'].includes(r.type));
        return { _id: oid('users', r.id), id: r.id, name: r.name, email: r.email, passwordHash: r.password,
          phone: resolved.phone, role: r.type === 'instractor' ? 'instructor' : r.type, accountState: resolved.accountState,
          profileImage: asset(resolved.profileImage, r.image_url), publicProfileApprovedAt: null, integrityVersion: 0 };
      }),
      Course: source.courses.map(r => {
        keys(r, ['id', 'name', 'code', 'description', 'status', 'image_url']);
        requireValue(Number.isSafeInteger(r.status));
        const resolved = resolve('courses', r.id); keys(resolved, ['id', 'lifecycle', 'durations', 'coverImage']);
        return { _id: oid('courses', r.id), id: r.id, name: r.name, code: r.code, description: r.description,
          lifecycle: resolved.lifecycle, durations: resolved.durations, coverImage: asset(resolved.coverImage, r.image_url), integrityVersion: 0 };
      }),
      InstructorAssignment: source.instractors_courses.map(r => {
        keys(r, ['id', 'course_id', 'instractor_id']);
        return { _id: oid('instractors_courses', r.id), id: r.id, course: reference('courses', r.course_id),
          instructor: reference('users', r.instractor_id, 'instractor'), integrityVersion: 0 };
      }),
      Enrollment: source.users_courses.map(r => {
        keys(r, ['ide', 'student_id', 'course_id', 'grades']);
        requireValue(r.grades === null || (Number.isInteger(r.grades) && r.grades >= 0 && r.grades <= 100));
        return { _id: oid('users_courses', r.ide), id: r.ide, student: reference('users', r.student_id, 'student'),
          course: reference('courses', r.course_id), grade: r.grades, gradeUpdatedBy: null, gradeUpdatedAt: null };
      }),
      Material: source.materials.map(r => {
        keys(r, ['id', 'name', 'course_id', 'fileName']);
        const resolved = resolve('materials', r.id); keys(resolved, ['id', 'asset']);
        return { _id: oid('materials', r.id), id: r.id, name: r.name, course: reference('courses', r.course_id),
          asset: asset(resolved.asset, r.fileName), removedAt: null, removedBy: null };
      }),
      Counter: resolutions.issued.map(r => ({ _id: oid('counters', r.scope), scope: r.scope, lastAllocated: r.lastIssued }))
    };
    requireValue(usedAssets.size === input.assets.length);
    unique(rows.InstructorAssignment, r => `${r.course}:${r.instructor}`);
    unique(rows.Enrollment, r => `${r.student}:${r.course}`);
    unique(Object.values(rows).flat(), r => r._id.toHexString());
    connection = mongoose.createConnection();
    for (const name of modelNames) {
      const Model = connection.model(name, schemas[name]);
      rows[name].sort((a, b) => (a.id ?? scopes.indexOf(a.scope)) - (b.id ?? scopes.indexOf(b.scope)));
      for (let i = 0; i < rows[name].length; i++) {
        const doc = new Model(rows[name][i]); await doc.validate();
        rows[name][i] = { ...doc.toObject({ transform: false }), __v: 0 };
      }
    }
    unique(rows.User, r => r.emailKey);
    const counts = Object.fromEntries(modelNames.map((name, i) => [i === 5 ? 'counters' : scopes[i], rows[name].length]));
    return { input, rows, summary: freeze({ sourceId: input.sourceId, digest: hash(encode(input)), counts }) };
  } catch { throw failure('MIGRATION_INPUT'); }
  finally { if (connection) await connection.destroy(); }
}

async function planMigration(input) { return (await prepare(input)).summary; }

async function backupSnapshot(input, filename) {
  try {
    const prepared = await prepare(input);
    const bytes = JSON.stringify(prepared.input);
    const file = await fs.open(filename, 'wx', 0o600);
    try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
    return hash(bytes);
  } catch { throw failure('MIGRATION_BACKUP'); }
}

async function restoreSnapshot(filename, digest) {
  try {
    const file = await fs.open(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    let bytes;
    try {
      const stat = await file.stat();
      if (!stat.isFile() || (stat.mode & 0o077) || stat.size > MAX_BYTES) throw 0;
      bytes = await file.readFile();
    } finally { await file.close(); }
    if (hash(bytes) !== digest) throw 0;
    const input = JSON.parse(bytes); await planMigration(input); return input;
  } catch { throw failure('MIGRATION_BACKUP'); }
}

async function applyMigration(input, dependencies = {}) {
  const { models, verifyTarget, verifyAsset, verifyHistory, dryRun = true } = dependencies;
  if (!models || typeof verifyTarget !== 'function' || typeof verifyAsset !== 'function' || typeof verifyHistory !== 'function' || typeof dryRun !== 'boolean') throw failure('MIGRATION_TRUST');
  const prepared = await prepare(input);
  const { rows, summary } = prepared;
  input = prepared.input;
  let session;
  try {
    const connection = models.User?.db;
    for (const name of [...modelNames, 'Session']) {
      const schema = schemas[name] || sessionSchema;
      if (models[name]?.schema !== schema || models[name].db !== connection || models[name].collection.name !== schema.options.collection) throw failure('MIGRATION_TRUST');
    }
    // The caller must attest isolation, write freeze, ownership UUIDs and this exact snapshot on every invocation.
    if (await verifyTarget(connection, summary) !== true) throw failure('MIGRATION_TRUST');
    if (await models.Session.collection.findOne({}, { projection: { _id: 1 } })) throw failure('MIGRATION_CONFLICT');
    for (const row of input.resolutions.issued) if (await verifyHistory(row, summary) !== true) throw failure('MIGRATION_TRUST');
    for (const name of ['User', 'Course', 'Material']) for (const row of rows[name]) {
      const value = row.profileImage || row.coverImage || row.asset;
      if (await verifyAsset(freeze(structuredClone(value)), input.assets.find(a => a.assetId === value.assetId), summary) !== true) throw failure('MIGRATION_TRUST');
    }
    for (const name of modelNames) {
      const indexes = await models[name].collection.listIndexes().toArray();
      for (const [key, options] of schemas[name].indexes()) if (options.unique && !indexes.some(i => i.unique && encode(i.key) === encode(key) && !i.sparse && !i.partialFilterExpression && (!i.collation || i.collation.locale === 'simple'))) throw failure('MIGRATION_TRUST');
    }
    const compare = async (name, session) => {
      const expected = rows[name];
      const found = await models[name].collection.find({}, { session }).limit(expected.length + 1).toArray();
      if (found.length > expected.length) throw failure('MIGRATION_CONFLICT');
      for (const value of found) {
        const match = expected.find(r => r._id.equals(value._id));
        if (!match || encode(match) !== encode(value)) throw failure('MIGRATION_CONFLICT');
      }
      return new Set(found.map(r => r._id.toHexString()));
    };
    // Preflight every collection before the first write, including later batches.
    const existing = {};
    for (const name of modelNames) existing[name] = await compare(name);
    if (dryRun) return { ...summary, dryRun: true, pending: Object.fromEntries(modelNames.map(n => [n, rows[n].length - existing[n].size])) };
    session = await connection.startSession();
    // One entity per transaction bounds work; exact committed rows are durable restart checkpoints.
    for (const name of modelNames) {
      await session.withTransaction(async () => {
        if (await verifyTarget(connection, summary) !== true) throw failure('MIGRATION_TRUST');
        const present = await compare(name, session);
        for (const row of rows[name]) if (!present.has(row._id.toHexString())) await new models[name](row).save({ session });
      }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, maxCommitTimeMS: 10000, timeoutMS: 15000 });
    }
    for (const name of modelNames) if ((await compare(name)).size !== rows[name].length) throw failure('MIGRATION_CONFLICT');
    return { ...summary, dryRun: false, reconciled: true };
  } catch (error) {
    if (Object.hasOwn(messages, error?.code)) throw failure(error.code);
    throw failure('MIGRATION_WRITE');
  } finally {
    if (session) try { await session.endSession(); } catch { throw failure('MIGRATION_WRITE'); }
  }
}

module.exports = { planMigration, applyMigration, backupSnapshot, restoreSnapshot };
