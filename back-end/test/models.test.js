'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const names = ['User', 'Course', 'InstructorAssignment', 'Enrollment', 'Material', 'Session', 'Counter'];
const connection = mongoose.createConnection();
const models = Object.fromEntries(names.map(name => {
  const exported = require(`../models/${name}`);
  const schema = name === 'Counter' ? exported.counterSchema : exported;
  return [name, connection.model(name, schema)];
}));
const oid = () => new mongoose.Types.ObjectId();
const asset = (overrides = {}) => ({
  assetId: 'synthetic-asset', publicId: 'synthetic/image', environment: 'synthetic',
  displayName: 'Synthetic image', resourceType: 'image', deliveryType: 'authenticated',
  classification: 'private', format: 'png', version: 1, bytes: 100, ...overrides
});
const fixtures = {
  User: () => ({
    id: 1, name: 'Synthetic User', email: 'Student@Example.invalid', phone: '00123',
    passwordHash: `$2b$12$${'a'.repeat(53)}`, role: 'student', accountState: 'active',
    profileImage: asset()
  }),
  Course: () => ({
    id: 1, name: 'Synthetic Course', code: 'SYN', description: '', durations: 'Eight meetings',
    coverImage: asset()
  }),
  InstructorAssignment: () => ({ id: 1, course: oid(), instructor: oid() }),
  Enrollment: () => ({ id: 1, student: oid(), course: oid() }),
  Material: () => ({ id: 1, name: 'Synthetic Material', course: oid(), asset: asset() }),
  Session: () => ({
    user: oid(), tokenDigest: 'a'.repeat(64), createdAt: new Date('2026-01-01T00:00:00Z'),
    lastSeenAt: new Date('2026-01-01T00:00:00Z'),
    absoluteExpiresAt: new Date('2026-01-02T00:00:00Z'),
    idleExpiresAt: new Date('2026-01-01T08:00:00Z'), expiresAt: new Date('2026-01-01T08:00:00Z')
  }),
  Counter: () => ({ scope: 'users', lastAllocated: 0 })
};
function document(name, changes = {}) {
  const doc = new models[name]({ ...fixtures[name](), ...changes });
  if (name === 'Session') doc.$locals.sessionRole = 'student';
  return doc;
}
async function invalid(name, changes) {
  await assert.rejects(async () => document(name, changes).validate());
}

test('schemas import without connecting, registering singleton models or loading MySQL', () => {
  const result = spawnSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const mongoose = require('mongoose');
    mongoose.connect = mongoose.createConnection = () => { throw Error('connection side effect'); };
    for (const name of ${JSON.stringify(names)}) require('./models/' + name);
    assert.deepEqual(mongoose.modelNames(), []);
    assert.equal(mongoose.connection.readyState, 0);
    assert.equal(Object.keys(require.cache).some(p => /dbConnection|node_modules\\/mysql\\//.test(p)), false);
  `], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('all seven contracts validate synthetic documents and use explicit safe schema options', async () => {
  const collections = ['users', 'courses', 'instructorAssignments', 'enrollments', 'materials', 'sessions', 'counters'];
  for (const [index, name] of names.entries()) {
    await document(name).validate();
    assert.equal(models[name].schema.options.collection, collections[index]);
    assert.equal(models[name].schema.options.autoIndex, false);
    assert.equal(models[name].schema.options.autoCreate, false);
    assert.equal(models[name].schema.options.strict, 'throw');
    assert.equal(models[name].schema.options.id, false);
    await invalid(name, { unexpected: true });
  }
});

test('required fields reject missing and null; new defaults are explicit', async () => {
  const required = {
    User: ['id', 'name', 'email', 'passwordHash', 'phone', 'role', 'accountState', 'profileImage'],
    Course: ['id', 'name', 'code', 'description', 'durations', 'coverImage'],
    InstructorAssignment: ['id', 'course', 'instructor'],
    Enrollment: ['id', 'student', 'course'],
    Material: ['id', 'name', 'course', 'asset'],
    Session: ['user', 'tokenDigest', 'createdAt', 'lastSeenAt', 'absoluteExpiresAt', 'idleExpiresAt', 'expiresAt'],
    Counter: ['scope', 'lastAllocated']
  };
  for (const [name, fields] of Object.entries(required)) {
    for (const field of fields) for (const value of [undefined, null]) await invalid(name, { [field]: value });
  }
  assert.equal(document('Course').lifecycle, 'draft');
  assert.equal(document('Enrollment').grade, null);
  assert.equal(document('User').publicProfileApprovedAt, null);
  const enrollment = document('Enrollment');
  enrollment.grade = undefined;
  await assert.rejects(enrollment.validate());
});

test('numeric IDs and counter values reject coercion, unsafe integers and invalid bounds', async () => {
  const bad = ['1', true, false, [], [1], {}, NaN, Infinity, -Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1];
  for (const name of names.slice(0, 5)) {
    for (const id of [...bad, 0, -1]) await invalid(name, { id });
    await document(name, { id: Number.MAX_SAFE_INTEGER }).validate();
  }
  for (const lastAllocated of [...bad, -1]) await invalid('Counter', { lastAllocated });
  for (const name of ['User', 'Course', 'InstructorAssignment']) {
    for (const integrityVersion of [...bad, -1, null]) await invalid(name, { integrityVersion });
  }
});

test('strict strings, approved enums, duration text and empty descriptions', async () => {
  for (const name of ['User', 'Course', 'Material']) {
    for (const value of [1, false, {}, [], '   ', 'x'.repeat(256)]) await invalid(name, { name: value });
  }
  for (const durations of [1, true, {}, [], '', '  ', 'x'.repeat(256)]) await invalid('Course', { durations });
  const course = document('Course', { durations: '  eight meetings  ' });
  await course.validate();
  assert.equal(course.durations, '  eight meetings  ');
  for (const description of [1, false, {}, []]) await invalid('Course', { description });
  for (const code of ['', ' ', 1, 'x'.repeat(256)]) await invalid('Course', { code });
  for (const role of ['student', 'instructor', 'admin']) await document('User', { role }).validate();
  for (const role of ['instractor', 'root', 1]) await invalid('User', { role });
  for (const accountState of ['pending', 'active', 'disabled']) await document('User', { accountState }).validate();
  for (const accountState of [0, 1, 'online']) await invalid('User', { accountState });
  for (const lifecycle of ['draft', 'published', 'archived']) await document('Course', { lifecycle }).validate();
  for (const lifecycle of [0, 1, 'unknown']) await invalid('Course', { lifecycle });
  await invalid('User', { phone: 123 });
});

test('email is ASCII, preserved and server-keyed, never silently trimmed', async () => {
  const user = document('User', { emailKey: 'attacker-controlled' });
  await user.validate();
  assert.equal(user.email, 'Student@Example.invalid');
  assert.equal(user.emailKey, 'student@example.invalid');
  user.email = 'Other+Tag@Example.invalid';
  await user.validate();
  assert.equal(user.emailKey, 'other+tag@example.invalid');
  for (const email of [' user@example.invalid', 'user@example.invalid ', 'user@example.invalid\n', 'é@example.invalid',
    'a b@example.invalid', 'a\n@example.invalid', 'missing-at', '@example.invalid', 'x'.repeat(256), 5]) {
    await invalid('User', { email });
  }
  for (const passwordHash of ['plaintext password', '$2b$99$' + 'a'.repeat(53), `$2b$12$${'a'.repeat(53)}\n`, 1]) {
    await invalid('User', { passwordHash });
  }
  await document('User', { passwordHash: '$argon2id$v=19$m=65536,t=3,p=1$c3ludGhldGljc2FsdA$c3ludGhldGljaGFzaA' }).validate();
});

test('relationship boundaries require actual ObjectIds, never numeric or string casts', async () => {
  const refs = { InstructorAssignment: ['course', 'instructor'], Enrollment: ['student', 'course'],
    Material: ['course'], Session: ['user'] };
  for (const [name, fields] of Object.entries(refs)) {
    for (const field of fields) for (const value of [1, true, oid().toHexString(), { _id: oid() }, []]) {
      await invalid(name, { [field]: value });
    }
  }
});

test('hydration cannot silently cast stored numeric, text, date or relationship values', async () => {
  for (const [name, changes] of [
    ['Enrollment', { grade: '90' }], ['Course', { id: '1' }],
    ['Course', { durations: 8 }], ['User', { phone: 123 }],
    ['Enrollment', { student: oid().toHexString() }],
    ['Session', { createdAt: '2026-01-01' }]
  ]) {
    const doc = models[name].hydrate({ ...fixtures[name](), _id: oid(), ...changes });
    if (name === 'Session') doc.$locals.sessionRole = 'student';
    await assert.rejects(doc.validate(), `${name} must preserve the invalid stored type as an error`);
  }
});

test('grades preserve null/zero and reject every coercible or invalid value', async () => {
  for (const grade of [null, 0, 100]) await document('Enrollment', { grade }).validate();
  for (const grade of [-1, 101, 0.5, '90', '', true, false, NaN, Infinity, [], [90], {}]) {
    await invalid('Enrollment', { grade });
  }
});

test('grade and reversible-removal audit fields must be paired; new grade edits need provenance', async () => {
  for (const [name, by, at] of [['Enrollment', 'gradeUpdatedBy', 'gradeUpdatedAt'], ['Material', 'removedBy', 'removedAt']]) {
    await invalid(name, { [by]: oid() });
    await invalid(name, { [at]: new Date() });
    await invalid(name, { [by]: oid(), [at]: '2026-01-01' });
    const doc = document(name, { [by]: oid(), [at]: new Date() });
    await doc.validate();
    doc[by] = null;
    doc[at] = null;
    await doc.validate();
  }
  const doc = models.Enrollment.hydrate({ ...fixtures.Enrollment(), _id: oid(), grade: null, gradeUpdatedBy: null, gradeUpdatedAt: null });
  doc.grade = 42;
  await assert.rejects(doc.validate());
  doc.gradeUpdatedBy = oid();
  doc.gradeUpdatedAt = new Date();
  await doc.validate();
});

test('the same instructor can make a subsequent grade edit with a fresh timestamp', async () => {
  const editor = oid();
  const doc = models.Enrollment.hydrate({
    ...fixtures.Enrollment(), _id: oid(), grade: 30,
    gradeUpdatedBy: editor, gradeUpdatedAt: new Date('2026-01-01')
  });
  doc.grade = 40;
  doc.gradeUpdatedBy = editor;
  doc.gradeUpdatedAt = new Date('2026-01-02');
  await doc.validate();
  doc.grade = null;
  doc.gradeUpdatedAt = new Date('2026-01-03');
  await doc.validate();
});

test('clearing nullable approval metadata to undefined is rejected', async () => {
  const doc = document('User');
  doc.publicProfileApprovedAt = undefined;
  await assert.rejects(doc.validate());
});

test('assets require all metadata and reject extra properties, unsupported formats and unsafe numbers', async () => {
  for (const key of Object.keys(asset())) {
    for (const value of [null, undefined]) await invalid('Material', { asset: asset({ [key]: value }) });
  }
  for (const changes of [{ format: 'exe' }, { url: 'https://example.invalid/file' },
    { signedUrl: 'secret' }, { bytes: '10' }, { bytes: 0 }, { bytes: 1.5 },
    { version: true }, { version: Number.MAX_SAFE_INTEGER + 1 }, { displayName: ' ' },
    { resourceType: 'raw' }, { classification: 'public', deliveryType: 'upload' },
    { deliveryType: 'upload' }]) await invalid('Material', { asset: asset(changes) });
  assert.equal(document('Material').asset._id, undefined);
});

test('decimal MB asset limits, format/resource combinations and publication constraints', async () => {
  for (const [name, field] of [['User', 'profileImage'], ['Course', 'coverImage']]) {
    await document(name, { [field]: asset({ bytes: 5_000_000 }) }).validate();
    await invalid(name, { [field]: asset({ bytes: 5_000_001 }) });
    await invalid(name, { [field]: asset({ format: 'pdf', resourceType: 'raw' }) });
  }
  for (const format of ['jpg', 'png', 'webp', 'pdf', 'docx', 'pptx']) {
    const image = ['jpg', 'png', 'webp'].includes(format);
    const bytes = image ? 10_000_000 : 25_000_000;
    const data = asset({ format, resourceType: image ? 'image' : 'raw', bytes });
    await document('Material', { asset: data }).validate();
    await invalid('Material', { asset: { ...data, bytes: bytes + 1 } });
  }
  const publicImage = asset({ classification: 'public', deliveryType: 'upload' });
  await invalid('Course', { coverImage: publicImage });
  await document('Course', { coverImage: publicImage, lifecycle: 'published' }).validate();
  await invalid('User', { profileImage: publicImage });
  await document('User', { profileImage: publicImage, publicProfileApprovedAt: new Date() }).validate();
});

test('sessions enforce digest, strict dates, ordering, expiry minimum and role lifetimes', async () => {
  for (const tokenDigest of ['A'.repeat(64), 'a'.repeat(63), 'g'.repeat(64), 'a'.repeat(64) + '\n', 12]) await invalid('Session', { tokenDigest });
  for (const createdAt of ['2026-01-01', 0, new Date(NaN)]) await invalid('Session', { createdAt });
  await invalid('Session', { lastSeenAt: new Date('2025-12-31') });
  await invalid('Session', { idleExpiresAt: new Date('2025-12-31') });
  await invalid('Session', { expiresAt: new Date('2026-01-01T09:00:00Z') });
  await invalid('Session', { absoluteExpiresAt: new Date('2026-01-03') });
  await invalid('Session', { revokedAt: new Date('2025-12-31') });
  const missingContext = document('Session');
  delete missingContext.$locals.sessionRole;
  await assert.rejects(missingContext.validate());
  const admin = document('Session');
  admin.$locals.sessionRole = 'admin';
  await assert.rejects(admin.validate());
  admin.absoluteExpiresAt = new Date('2026-01-01T08:00:00Z');
  admin.idleExpiresAt = admin.expiresAt = new Date('2026-01-01T00:30:00Z');
  await admin.validate();
  admin.$locals.sessionRole = 'unknown';
  await assert.rejects(admin.validate());
});

test('test-local session policy rejects expired/revoked/disabled sessions before any TTL cleanup', async () => {
  async function authorize(session, principal, now) {
    session.$locals.sessionRole = principal.role;
    await session.validate();
    if (!session.user.equals(principal._id) || principal.accountState !== 'active' ||
        session.revokedAt || now >= session.idleExpiresAt || now >= session.absoluteExpiresAt) {
      throw new Error('Synthetic session denied');
    }
  }
  const session = document('Session');
  const principal = { _id: session.user, role: 'student', accountState: 'active' };
  const beforeExpiry = new Date('2026-01-01T01:00:00Z');
  await authorize(session, principal, beforeExpiry);
  await assert.rejects(authorize(session, principal, new Date('2026-01-01T08:00:00Z')), /denied/);
  await assert.rejects(authorize(session, principal, new Date('2026-01-02T00:00:00Z')), /denied/);
  await assert.rejects(authorize(session, { ...principal, accountState: 'disabled' }, beforeExpiry), /denied/);
  await assert.rejects(authorize(session, { ...principal, _id: oid() }, beforeExpiry), /denied/);
  await assert.rejects(authorize(session, { ...principal, role: 'admin' }, beforeExpiry));
  session.revokedAt = new Date('2026-01-01T00:30:00Z');
  await assert.rejects(authorize(session, principal, beforeExpiry), /denied/);
  assert.ok(session._id, 'Policy rejects the retained document without deleting it');
});

test('public serialization is deny-by-default; private paths have select:false', async () => {
  for (const name of names) {
    const doc = document(name);
    await doc.validate();
    const expected = names.indexOf(name) < 5 ? { id: 1 } : {};
    assert.deepEqual(doc.toJSON(), expected);
    assert.deepEqual(doc.toObject(), expected);
  }
  for (const [name, fields] of [['User', ['passwordHash', 'emailKey', 'publicProfileApprovedAt']],
    ['Session', ['tokenDigest']], ['Counter', ['scope', 'lastAllocated']]]) {
    for (const field of fields) assert.equal(models[name].schema.path(field).options.select, false);
  }
});

test('immutable IDs and refs do not change on hydrated documents', async () => {
  for (const [name, fields] of Object.entries({
    User: ['id'], Course: ['id'], InstructorAssignment: ['id', 'course', 'instructor'],
    Enrollment: ['id', 'student', 'course'], Material: ['id', 'course'],
    Session: ['user', 'tokenDigest', 'createdAt', 'absoluteExpiresAt'], Counter: ['scope']
  })) {
    const doc = models[name].hydrate({ ...fixtures[name](), _id: oid() });
    for (const field of fields) {
      const old = doc[field];
      doc[field] = field === 'id' ? 2 : field === 'scope' ? 'courses'
        : field === 'tokenDigest' ? 'b'.repeat(64) : old instanceof Date ? new Date() : oid();
      assert.deepEqual(doc[field], old, `${name}.${field}`);
    }
  }
});

test('generic query, pipeline, replacement and bulk mutations fail before database access', async () => {
  for (const name of names) {
    const Model = models[name];
    for (const operation of [
      () => Model.updateOne({}, { $set: { id: 2 } }),
      () => Model.updateMany({}, { $inc: { grade: 0.5 } }),
      () => Model.findOneAndUpdate({}, { $set: { role: 'admin' } }, { runValidators: false }),
      () => Model.updateOne({}, [{ $set: { id: 2 } }], { updatePipeline: true }),
      () => Model.replaceOne({}, fixtures[name]()),
      () => Model.findOneAndReplace({}, fixtures[name]()),
      () => Model.bulkWrite([{ updateOne: { filter: {}, update: { $set: { id: 2 } } } }])
    ]) await assert.rejects(async () => operation(), /controlled document writes|reserveId/);
  }
});

test('only mandatory indexes are declared: no code uniqueness, candidate indexes or TTL', () => {
  const keys = {
    User: [{ id: 1 }, { emailKey: 1 }], Course: [{ id: 1 }],
    InstructorAssignment: [{ id: 1 }, { course: 1, instructor: 1 }],
    Enrollment: [{ id: 1 }, { student: 1, course: 1 }],
    Material: [{ id: 1 }], Session: [{ tokenDigest: 1 }], Counter: [{ scope: 1 }]
  };
  for (const name of names) {
    const indexes = models[name].schema.indexes();
    assert.deepEqual(indexes.map(([key]) => key), keys[name]);
    for (const [, options] of indexes) {
      assert.equal(options.unique, true);
      assert.notEqual(options.sparse, true);
      assert.equal(options.expireAfterSeconds, undefined);
    }
  }
  assert.deepEqual(models.User.schema.indexes()[1][1].collation, { locale: 'simple' });
});

test('unresolved legacy shapes fail rather than inventing mappings', async () => {
  for (const [name, changes] of [
    ['Enrollment', { grades: '90', ide: 1 }], ['Course', { status: 1 }],
    ['User', { status: 1 }], ['Material', { fileName: '../legacy.pdf' }],
    ['Course', { durations: 8 }], ['User', { id: -1 }],
    ['Material', { asset: { fileName: 'legacy.pdf' } }]
  ]) await invalid(name, changes);
});
