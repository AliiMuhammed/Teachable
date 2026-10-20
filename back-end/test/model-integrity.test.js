'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { counterSchema, reserveId } = require('../models/Counter');

const schemas = {
  User: require('../models/User'), Course: require('../models/Course'),
  InstructorAssignment: require('../models/InstructorAssignment'),
  Enrollment: require('../models/Enrollment'), Material: require('../models/Material'),
  Session: require('../models/Session'), Counter: counterSchema
};
const scopes = ['users', 'courses', 'instructorAssignments', 'enrollments', 'materials'];
const oid = () => new mongoose.Types.ObjectId();
const asset = () => ({
  assetId: 'synthetic', publicId: 'synthetic/image', environment: 'synthetic', displayName: 'Synthetic',
  resourceType: 'image', deliveryType: 'authenticated', classification: 'private',
  format: 'png', version: 1, bytes: 100
});
const user = (id, role = 'student') => ({
  id, name: `Synthetic ${id}`, email: `synthetic${id}@example.invalid`, phone: '00123',
  passwordHash: `$2b$12$${'a'.repeat(53)}`, role, accountState: 'active', profileImage: asset()
});
const course = id => ({
  id, name: 'Synthetic', code: 'SYN', description: '', durations: 'Eight meetings',
  coverImage: asset(), lifecycle: 'published'
});
const bind = connection => Object.fromEntries(Object.entries(schemas).map(([name, schema]) =>
  [name, connection.model(name, schema)]));

test('allocator rejects invalid scope/model before any database operation (not atomicity evidence)', async () => {
  await assert.rejects(reserveId({}, 'users'), /Invalid counter/);
  const connection = mongoose.createConnection();
  const Counter = connection.model('Counter', counterSchema);
  await assert.rejects(reserveId(Counter, 'unknown'), /Invalid counter/);
});

test('Atlas opt-in rejects unsafe targets without connecting; local safeguards remain intact', () => {
  const env = {
    MONGODB_TEST_MODE: 'atlas', MONGODB_TEST_URI: 'mongodb+srv://test:synthetic@fixture.example.mongodb.net/?retryWrites=true&w=majority',
    MONGODB_TEST_APPROVED_HOST: 'fixture.example.mongodb.net',
    MONGODB_TEST_DB: 'teachable_21b_bc3e0f91742f90ce056b',
    MONGODB_TEST_CONFIRM_DB: 'teachable_21b_bc3e0f91742f90ce056b',
    MONGODB_TEST_ATLAS_PREFLIGHT: 'confirmed-m0-trusted-ip-exact-db-role'
  };
  assert.equal(fixtureConfig({ MONGODB_TEST_URI: env.MONGODB_TEST_URI }), null);
  const config = fixtureConfig(env);
  assert.equal(config.dbName, 'teachable_21b_bc3e0f91742f90ce056b');
  assert.equal(config.atlas, true);
  for (const change of [
    { MONGODB_TEST_MODE: 'production' }, { MONGODB_TEST_URI: '' },
    { MONGODB_TEST_APPROVED_HOST: 'other.example.mongodb.net' },
    { MONGODB_TEST_APPROVED_HOST: '' }, { MONGODB_TEST_CONFIRM_DB: 'production' },
    { MONGODB_TEST_DB: 'production', MONGODB_TEST_CONFIRM_DB: 'production' },
    { MONGODB_TEST_DB: `teachable_21b_${'a'.repeat(32)}` },
    { MONGODB_TEST_ATLAS_PREFLIGHT: '' },
    { MONGODB_TEST_URI: env.MONGODB_TEST_URI.replace('/?', '/production?') },
    { MONGODB_TEST_URI: `${env.MONGODB_TEST_URI}&tls=false` },
    { MONGODB_TEST_URI: `${env.MONGODB_TEST_URI}&tlsAllowInvalidCertificates=true` },
    { MONGODB_TEST_URI: `${env.MONGODB_TEST_URI}&w=0` },
    { MONGODB_TEST_URI: env.MONGODB_TEST_URI.replace('mongodb+srv:', 'mongodb:') },
    { MONGODB_TEST_URI: 'not a URI with synthetic password' },
    { TEACHABLE_SYNTHETIC_MONGO_URI: 'mongodb://localhost/other' }
  ]) {
    assert.throws(() => fixtureConfig({ ...env, ...change }), error =>
      error.message === 'Unsafe or unconfirmed synthetic fixture configuration');
  }
  const local = {
    TEACHABLE_SYNTHETIC_MONGO_URI: `mongodb://127.0.0.1/teachable_21b_${'a'.repeat(32)}?replicaSet=rs0&directConnection=true`,
    TEACHABLE_SYNTHETIC_REPLICA_SET: 'rs0',
    TEACHABLE_SYNTHETIC_CONFIRM: `create-and-drop:teachable_21b_${'a'.repeat(32)}:rs0`
  };
  assert.equal(fixtureConfig(local).atlas, false);
  assert.throws(() => fixtureConfig({ ...local,
    TEACHABLE_SYNTHETIC_MONGO_URI: local.TEACHABLE_SYNTHETIC_MONGO_URI.replace('127.0.0.1', 'example.com') }));
  assert.throws(() => fixtureConfig({ ...local, TEACHABLE_SYNTHETIC_CONFIRM: '' }));
});

test('integration diagnostics omit raw error messages, credentials and nested causes', () => {
  const error = new Error('mongodb+srv://synthetic:secret@fixture.example.mongodb.net');
  error.cause = new Error('secret');
  error.code = 16500;
  const safe = redactedFailure(error);
  assert.match(safe.message, /throttling.*16500/);
  assert.ok(!safe.stack.includes('secret'));
  assert.equal(safe.cause, undefined);
});

function fixtureConfig(env) {
  const atlas = env.MONGODB_TEST_MODE === 'atlas';
  try {
    assert.ok(!env.MONGODB_TEST_MODE || atlas);
    if (!atlas && !env.TEACHABLE_SYNTHETIC_MONGO_URI) return null;
    const uri = atlas ? env.MONGODB_TEST_URI : env.TEACHABLE_SYNTHETIC_MONGO_URI;
    const parsed = new URL(uri);
    const replicaSet = env.TEACHABLE_SYNTHETIC_REPLICA_SET;
    let dbName;
    if (atlas) {
      assert.ok(!env.TEACHABLE_SYNTHETIC_MONGO_URI, 'No mixed targets');
      assert.equal(parsed.protocol, 'mongodb+srv:');
      assert.match(env.MONGODB_TEST_APPROVED_HOST || '', /^[a-z0-9-]+\.[a-z0-9]+\.mongodb\.net$/);
      assert.equal(parsed.hostname, env.MONGODB_TEST_APPROVED_HOST);
      assert.equal(parsed.port, '');
      assert.ok(parsed.username && parsed.password);
      dbName = env.MONGODB_TEST_DB;
      assert.match(dbName || '', /^teachable_21b_[a-f0-9]{20}$/);
      assert.equal(env.MONGODB_TEST_CONFIRM_DB, dbName);
      assert.equal(env.MONGODB_TEST_ATLAS_PREFLIGHT, 'confirmed-m0-trusted-ip-exact-db-role');
      assert.ok(['', '/', `/${dbName}`].includes(parsed.pathname));
      const allowed = { retryWrites: 'true', w: 'majority', authSource: 'admin', tls: 'true' };
      const keys = [...parsed.searchParams.keys()];
      assert.equal(new Set(keys).size, keys.length);
      for (const [key, value] of parsed.searchParams) {
        if (key === 'appName') assert.match(value, /^[A-Za-z0-9_-]{1,64}$/);
        else assert.equal(value, allowed[key]);
      }
    } else {
      dbName = parsed.pathname.slice(1);
      assert.equal(parsed.protocol, 'mongodb:');
      assert.ok(['127.0.0.1', '[::1]', 'localhost'].includes(parsed.hostname));
      assert.equal(parsed.username, '');
      assert.equal(parsed.password, '');
      assert.match(dbName, /^teachable_21b_[a-f0-9]{32}$/);
      assert.match(replicaSet || '', /^[A-Za-z0-9_-]+$/);
      assert.equal(parsed.searchParams.get('replicaSet'), replicaSet);
      assert.equal(parsed.searchParams.get('directConnection'), 'true');
      assert.deepEqual([...parsed.searchParams.keys()].sort(), ['directConnection', 'replicaSet']);
      assert.equal(env.TEACHABLE_SYNTHETIC_CONFIRM, `create-and-drop:${dbName}:${replicaSet}`);
    }
    assert.equal(parsed.hash, '');
    return { uri, dbName, replicaSet, atlas, hostname: parsed.hostname };
  } catch {
    // Parser/assertion errors may embed the URI or credentials; never propagate them.
    throw new Error('Unsafe or unconfirmed synthetic fixture configuration');
  }
}

function redactedFailure(error) {
  const code = Number.isInteger(error?.code) ? error.code : 'unavailable';
  const category = error?.code === 'ERR_ASSERTION' ? 'assertion' :
    error?.code === 16500 ? 'throttling' : 'database-or-harness';
  return new Error(`Synthetic integration ${category} failure; code=${code}; details suppressed`);
}

const requested = process.env.MONGODB_TEST_MODE || process.env.TEACHABLE_SYNTHETIC_MONGO_URI;
test('B2/B3 actual MongoDB indexes, allocator concurrency and transaction integrity', {
  skip: !requested && 'BLOCKED: no explicitly authorized disposable MongoDB fixture selected',
  timeout: 600_000
}, async t => {
  const config = fixtureConfig(process.env);
  const { uri, dbName, atlas, hostname } = config;
  let replicaSet = config.replicaSet;
  const connections = [];
  const ownedCollections = new Map();
  let first;
  let approvedServers;
  const run = async (name, work) => {
    let failure;
    await t.test(name, async () => {
      try { await work(); } catch (error) {
        failure = redactedFailure(error);
        throw failure;
      }
    });
    if (failure) throw failure;
  };
  async function connect() {
    const connection = mongoose.createConnection(uri, {
      dbName, autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000,
      maxPoolSize: 8, ...(atlas ? { tls: true, retryWrites: true, w: 'majority' } : {})
    });
    connections.push(connection);
    await connection.asPromise();
    assert.equal(connection.name, dbName);
    const hello = await connection.db.admin().command({ hello: 1 });
    if (atlas) {
      assert.match(hello.setName || '', /^[A-Za-z0-9_-]+$/);
      const members = [...(hello.hosts || [])].sort();
      assert.deepEqual(members, approvedServers);
      if (!replicaSet) replicaSet = hello.setName;
      const auth = await connection.db.admin().command({ connectionStatus: 1 });
      const roles = auth.authInfo?.authenticatedUserRoles;
      assert.ok(Array.isArray(roles) && roles.length === 1);
      assert.equal(roles[0].role, 'readWrite');
      assert.equal(roles[0].db, dbName);
    }
    assert.equal(hello.setName, replicaSet);
    assert.equal(hello.isWritablePrimary, true);
    assert.ok(hello.logicalSessionTimeoutMinutes > 0);
    return connection;
  }
  async function createOwned(name) {
    // A unique, nonrestrictive option prevents create from silently adopting an existing collection.
    const validator = { $jsonSchema: { description: `Synthetic owner ${require('node:crypto').randomUUID()}` } };
    await first.db.createCollection(name, { validator });
    const entry = await first.db.listCollections({ name }).next();
    assert.ok(entry?.info?.uuid, 'Collection ownership UUID unavailable');
    assert.deepEqual(entry.options.validator, validator);
    ownedCollections.set(name, { uuid: entry.info.uuid, validator });
    return first.db.collection(name);
  }
  async function dropOwned(name) {
    const entry = await first.db.listCollections({ name }).next();
    assert.ok(entry?.info?.uuid && ownedCollections.has(name), 'Collection ownership unavailable');
    assert.deepEqual(entry.info.uuid, ownedCollections.get(name).uuid, 'Collection identity changed; refuse cleanup');
    assert.deepEqual(entry.options.validator, ownedCollections.get(name).validator, 'Collection ownership changed');
    await first.db.collection(name).drop();
    ownedCollections.delete(name);
    t.diagnostic(`Dropped verified test-owned collection: ${name}`);
  }
  try {
    if (atlas) {
      const records = await require('node:dns/promises').resolveSrv(`_mongodb._tcp.${hostname}`);
      const suffix = hostname.slice(hostname.indexOf('.'));
      assert.equal(records.length, 3);
      assert.ok(records.every(record => record.name.endsWith(suffix) && record.port === 27017));
      approvedServers = records.map(record => `${record.name}:${record.port}`).sort();
    }
    first = await connect();
    assert.deepEqual(await first.db.listCollections({}, { nameOnly: true }).toArray(), [],
      'Refuse an existing/nonempty database');
    const second = await connect();
    const A = bind(first);
    const B = bind(second);
    const version = await first.db.admin().command({ buildInfo: 1 });
    t.diagnostic(JSON.stringify({
      fixture: dbName, hostname: atlas ? hostname : 'loopback', replicaSet, node: process.version, mongoose: mongoose.version,
      mongodb: version.version, source: 'synthetic-only'
    }));
    async function clearFixtures() {
      for (const Model of Object.values(A)) await Model.collection.deleteMany({});
    }
    await run('install and inspect every mandatory index, with no candidate TTL', async () => {
      for (const Model of Object.values(A)) {
        await createOwned(Model.collection.name);
        await Model.createIndexes();
        const installed = await Model.collection.indexes();
        t.diagnostic(JSON.stringify({ collection: Model.collection.name, installed }));
        assert.equal(installed.length, Model.schema.indexes().length + 1);
        for (const [key, options] of Model.schema.indexes()) {
          const index = installed.find(entry => JSON.stringify(entry.key) === JSON.stringify(key));
          assert.ok(index);
          assert.equal(index.unique, true);
          assert.notEqual(index.sparse, true);
          assert.equal(index.expireAfterSeconds, undefined);
          if (options.collation) assert.equal(index.collation?.locale || 'simple', 'simple');
        }
      }
      const session = await first.startSession();
      try {
        await session.withTransaction(async () => {
          await A.Counter.collection.insertOne({ scope: 'users', lastAllocated: 0 }, { session });
          await A.Counter.collection.deleteOne({ scope: 'users' }, { session });
        });
      } finally { await session.endSession(); }
    });

    await run('every unique constraint rejects duplicate writes; pairs race with distinct IDs', async () => {
      await clearFixtures();
      const sessionData = {
        user: oid(), tokenDigest: 'a'.repeat(64), createdAt: new Date('2026-01-01'),
        lastSeenAt: new Date('2026-01-01'), absoluteExpiresAt: new Date('2026-01-02'),
        idleExpiresAt: new Date('2026-01-01T08:00:00Z'), expiresAt: new Date('2026-01-01T08:00:00Z')
      };
      const records = {
        User: user(1), Course: course(1), InstructorAssignment: { id: 1, course: oid(), instructor: oid() },
        Enrollment: { id: 1, course: oid(), student: oid() },
        Material: { id: 1, course: oid(), name: 'Synthetic', asset: asset() },
        Session: sessionData, Counter: { scope: 'users', lastAllocated: 0 }
      };
      for (const [name, data] of Object.entries(records)) {
        const doc = new A[name](data);
        if (name === 'Session') doc.$locals.sessionRole = 'student';
        await doc.save();
        const raw = doc.toObject({ transform: false });
        delete raw._id;
        for (const [key] of A[name].schema.indexes()) {
          const duplicate = { ...raw, _id: oid() };
          // Vary other unique fields so this exact index must be the conflicting one.
          if (!('id' in key) && 'id' in duplicate) duplicate.id = 2;
          if (name === 'User' && !('emailKey' in key)) duplicate.emailKey = 'different@example.invalid';
          if (name === 'InstructorAssignment' && 'id' in key) duplicate.instructor = oid();
          if (name === 'Enrollment' && 'id' in key) duplicate.student = oid();
          await assert.rejects(A[name].collection.insertOne(duplicate),
            error => error.code === 11000 && JSON.stringify(error.keyPattern) === JSON.stringify(key));
        }
      }
      for (const name of ['InstructorAssignment', 'Enrollment']) {
        const field = name === 'Enrollment' ? 'student' : 'instructor';
        const pair = { course: oid(), [field]: oid() };
        const results = await Promise.allSettled([
          A[name].create({ id: 100, ...pair }), B[name].create({ id: 101, ...pair })
        ]);
        assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
        assert.equal(results.find(r => r.status === 'rejected').reason.code, 11000);
      }
      await assert.rejects(A.User.create({ ...user(2), email: 'SYNTHETIC1@EXAMPLE.INVALID' }),
        error => error.code === 11000 && error.keyPattern.emailKey === 1);
    });

    await run('duplicate data prevents unique index build in a separate synthetic collection', async () => {
      const collection = await createOwned('synthetic_duplicate_index');
      await assert.rejects(createOwned('synthetic_duplicate_index'), error => error.code === 48);
      await collection.insertMany([{ id: 1 }, { id: 1 }]);
      await assert.rejects(collection.createIndex({ id: 1 }, { unique: true }), error => error.code === 11000);
      await dropOwned('synthetic_duplicate_index');
    });

    await run('100 reservations per scope in bounded parallel batches across independent connections, gaps and restart continuity', async () => {
      await clearFixtures();
      for (const scope of scopes) await A.Counter.create({ scope, lastAllocated: 1000 });
      for (const scope of scopes) {
        const values = [];
        for (let offset = 0; offset < 100; offset += 5) {
          const batch = await Promise.allSettled(Array.from({ length: 5 }, (_, i) =>
            reserveId((offset + i) % 2 ? A.Counter : B.Counter, scope)));
          const failure = batch.find(result => result.status === 'rejected');
          if (failure) throw failure.reason;
          values.push(...batch.map(result => result.value));
        }
        assert.deepEqual(values.sort((a, b) => a - b), Array.from({ length: 100 }, (_, i) => 1001 + i));
      }
      for (const scope of scopes) {
        assert.equal((await A.Counter.collection.findOne({ scope })).lastAllocated, 1100);
      }
      const consumed = await reserveId(A.Counter, 'users');
      await assert.rejects(A.User.create({ id: consumed }));
      assert.equal(await reserveId(B.Counter, 'users'), consumed + 1);
      const session = await first.startSession();
      let abortedId;
      try {
        await assert.rejects(session.withTransaction(async () => {
          abortedId = await reserveId(A.Counter, 'courses');
          await A.Course.create([course(abortedId)], { session });
          throw new Error('Synthetic business failure');
        }), /Synthetic business failure/);
      } finally { await session.endSession(); }
      assert.equal(await A.Course.countDocuments({ id: abortedId }), 0);
      assert.equal(await reserveId(B.Counter, 'courses'), abortedId + 1);
      // Inject acknowledgement loss after a real DB reservation, never a mocked increment.
      const original = A.Counter.collection.findOneAndUpdate;
      A.Counter.collection.findOneAndUpdate = async function(...args) {
        await original.apply(this, args);
        throw new Error('Synthetic acknowledgement lost after write');
      };
      try {
        await assert.rejects(reserveId(A.Counter, 'enrollments'), /acknowledgement lost/);
      } finally { A.Counter.collection.findOneAndUpdate = original; }
      assert.equal(await reserveId(B.Counter, 'enrollments'), 1102);
      const temporary = await connect();
      assert.equal(await reserveId(bind(temporary).Counter, 'users'), consumed + 2);
      await temporary.close();
      const restarted = await connect();
      const C = bind(restarted);
      assert.equal(await reserveId(C.Counter, 'users'), consumed + 3);
      assert.equal(await reserveId(C.Counter, 'materials'), 1101);
    });

    await run('missing, malformed and exhausted counters fail closed without upsert or mutation', async () => {
      await clearFixtures();
      await assert.rejects(reserveId(A.Counter, 'users'), /unavailable/);
      assert.equal(await A.Counter.countDocuments({}), 0);
      for (const value of [null, '4', true, -1, 0.5, NaN, Infinity,
        Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, mongoose.mongo.Decimal128.fromString('2')]) {
        await A.Counter.collection.deleteMany({});
        await A.Counter.collection.insertOne({ scope: 'users', lastAllocated: value });
        await assert.rejects(reserveId(A.Counter, 'users'), /unavailable/);
        const after = await A.Counter.collection.findOne({ scope: 'users' });
        assert.deepEqual(after.lastAllocated, value);
      }
      await A.Counter.collection.deleteMany({});
      await A.Counter.create({ scope: 'users', lastAllocated: Number.MAX_SAFE_INTEGER - 1 });
      assert.equal(await reserveId(A.Counter, 'users'), Number.MAX_SAFE_INTEGER);
      await assert.rejects(reserveId(A.Counter, 'users'), /exhausted/);
      await assert.rejects(A.Counter.create({ scope: 'users', lastAllocated: 0 }), error => error.code === 11000);
    });

    // This raw-driver harness tests the proposed service protocol; it is not a production service.
    async function transaction(connection, work) {
      const session = await connection.startSession();
      try {
        return await session.withTransaction(() => work(session), {
          readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, maxCommitTimeMS: 5000
        });
      } finally { await session.endSession(); }
    }
    async function touch(Model, filter, session) {
      const result = await Model.collection.updateOne(filter, { $inc: { integrityVersion: 1 } }, { session });
      if (result.matchedCount !== 1) throw new Error('Synthetic eligibility denied');
    }
    async function seed() {
      await clearFixtures();
      const student = await A.User.create(user(1));
      const instructor = await A.User.create(user(2, 'instructor'));
      const parent = await A.Course.create(course(1));
      const assignment = await A.InstructorAssignment.create({ id: 1, course: parent._id, instructor: instructor._id });
      return { student, instructor, parent, assignment };
    }
    async function enroll(fixture, id, pause = async () => {}) {
      return transaction(first, async session => {
        await A.Course.collection.findOne({ _id: fixture.parent._id }, { session });
        await A.User.collection.findOne({ _id: fixture.student._id }, { session });
        await pause();
        await touch(A.Course, { _id: fixture.parent._id, lifecycle: 'published' }, session);
        await touch(A.User, { _id: fixture.student._id, role: 'student', accountState: 'active' }, session);
        await A.Enrollment.create([{ id, student: fixture.student._id, course: fixture.parent._id }], { session });
      });
    }
    async function assign(fixture, id) {
      return transaction(first, async session => {
        await touch(A.Course, { _id: fixture.parent._id, lifecycle: 'published' }, session);
        // Active is a test-fixture precondition, not a new pending-instructor policy.
        await touch(A.User, { _id: fixture.instructor._id, role: 'instructor', accountState: 'active' }, session);
        await A.InstructorAssignment.create([{ id, instructor: fixture.instructor._id, course: fixture.parent._id }], { session });
      });
    }
    async function grade(fixture, enrollment, value, pause = async () => {}) {
      return transaction(first, async session => {
        await A.Course.collection.findOne({ _id: fixture.parent._id }, { session });
        await A.User.collection.findOne({ _id: fixture.instructor._id }, { session });
        await A.InstructorAssignment.collection.findOne({ _id: fixture.assignment._id }, { session });
        await pause();
        await touch(A.Course, { _id: fixture.parent._id, lifecycle: 'published' }, session);
        await touch(A.User, { _id: fixture.instructor._id, role: 'instructor', accountState: 'active' }, session);
        await touch(A.InstructorAssignment, {
          _id: fixture.assignment._id, instructor: fixture.instructor._id, course: fixture.parent._id
        }, session);
        const current = await A.Enrollment.findOne({
          _id: enrollment._id, course: fixture.parent._id
        }).select('+gradeUpdatedBy +gradeUpdatedAt').session(session);
        if (!current) throw new Error('Synthetic eligibility denied');
        current.grade = value;
        current.gradeUpdatedBy = fixture.instructor._id;
        current.gradeUpdatedAt = new Date();
        await current.save({ session });
      });
    }
    async function staleReadRace(operation, mutation) {
      let ready;
      let resume;
      const read = new Promise(resolve => { ready = resolve; });
      const proceed = new Promise(resolve => { resume = resolve; });
      let calls = 0;
      const pending = operation(async () => { if (++calls === 1) { ready(); await proceed; } });
      // Attach the rejection handler before allowing the other transaction to commit.
      const denied = assert.rejects(pending, /Synthetic eligibility denied/);
      await Promise.race([read, pending.then(() => { throw new Error('Race completed before its barrier'); })]);
      try { await transaction(second, mutation); } finally { resume(); }
      await denied;
      assert.ok(calls >= 2, 'The stale transaction must retry and re-evaluate eligibility');
    }

    await run('test-local transactions reject missing/wrong-role parents and duplicate pair races', async () => {
      let fixture = await seed();
      await assert.rejects(enroll({ ...fixture, student: { _id: oid() } }, 1), /eligibility/);
      await assert.rejects(enroll({ ...fixture, student: fixture.instructor }, 1), /eligibility/);
      await assert.rejects(assign({ ...fixture, instructor: fixture.student }, 2), /eligibility/);
      for (const operation of [
        id => enroll(fixture, id),
        id => assign(fixture, id)
      ]) {
        if (await A.InstructorAssignment.countDocuments({})) await A.InstructorAssignment.collection.deleteMany({});
        const results = await Promise.allSettled([operation(10), operation(11)]);
        assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
        assert.equal(results.find(r => r.status === 'rejected').reason.code, 11000);
      }
    });

    await run('parent deletion, archival, disable and role change defeat stale enrollment creation', async () => {
      for (const kind of ['delete', 'archive', 'disable', 'role']) {
        const fixture = await seed();
        await staleReadRace(pause => enroll(fixture, 1, pause), async session => {
          if (kind === 'delete') await B.Course.collection.deleteOne({ _id: fixture.parent._id }, { session });
          if (kind === 'archive') await B.Course.collection.updateOne({ _id: fixture.parent._id },
            { $set: { lifecycle: 'archived' }, $inc: { integrityVersion: 1 } }, { session });
          if (kind === 'disable' || kind === 'role') await B.User.collection.updateOne({ _id: fixture.student._id },
            { $set: kind === 'disable' ? { accountState: 'disabled' } : { role: 'instructor' },
              $inc: { integrityVersion: 1 } }, { session });
        });
        assert.equal(await A.Enrollment.countDocuments({}), 0);
        // No cascade is installed: this fixture's existing assignment remains even after raw deletion.
        assert.equal(await A.InstructorAssignment.countDocuments({}), 1);
      }
    });

    await run('revocation/disable defeat stale grade writes; concurrent authorized grades retain paired audit data', async () => {
      for (const kind of ['revoke', 'disable']) {
        const fixture = await seed();
        const enrollment = await A.Enrollment.create({ id: 1, student: fixture.student._id, course: fixture.parent._id });
        await staleReadRace(pause => grade(fixture, enrollment, 90, pause), async session => {
          if (kind === 'revoke') await B.InstructorAssignment.collection.deleteOne({ _id: fixture.assignment._id }, { session });
          else await B.User.collection.updateOne({ _id: fixture.instructor._id },
            { $set: { accountState: 'disabled' }, $inc: { integrityVersion: 1 } }, { session });
        });
        assert.equal((await A.Enrollment.findById(enrollment._id)).grade, null);
      }
      const fixture = await seed();
      const enrollment = await A.Enrollment.create({ id: 1, student: fixture.student._id, course: fixture.parent._id });
      const otherCourse = await A.Course.create(course(2));
      const otherEnrollment = await A.Enrollment.create({ id: 2, student: fixture.student._id, course: otherCourse._id });
      await assert.rejects(grade(fixture, otherEnrollment, 90), /eligibility/);
      assert.equal((await A.Enrollment.findById(otherEnrollment._id)).grade, null);
      const grades = await Promise.allSettled([grade(fixture, enrollment, 70), grade(fixture, enrollment, 80)]);
      for (const result of grades) if (result.status === 'rejected') throw result.reason;
      const final = await A.Enrollment.collection.findOne({ _id: enrollment._id });
      assert.ok([70, 80].includes(final.grade));
      assert.ok(final.gradeUpdatedBy.equals(fixture.instructor._id));
      assert.ok(final.gradeUpdatedAt instanceof Date);
      await grade(fixture, enrollment, final.grade);
      assert.equal((await A.Enrollment.findById(enrollment._id)).grade, final.grade);
    });
  } catch (error) {
    throw redactedFailure(error);
  } finally {
    try {
      for (const name of [...ownedCollections.keys()]) await dropOwned(name);
      if (first?.readyState === 1) {
        const remaining = await first.db.listCollections({}, { nameOnly: true }).toArray();
        t.diagnostic(`Cleanup: ${ownedCollections.size} owned collections pending; namespace empty=${remaining.length === 0}`);
        assert.equal(remaining.length, 0, 'Unexpected collections preserved; cleanup incomplete');
      }
    } catch (error) {
      throw redactedFailure(error);
    } finally {
      const closed = await Promise.allSettled(connections.map(connection => connection.close()));
      if (closed.some(result => result.status === 'rejected')) throw new Error('Connection cleanup failed; details suppressed');
    }
  }
});
