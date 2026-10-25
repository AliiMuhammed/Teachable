'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { resolveSrv } = require('node:dns/promises');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const mongoose = require('mongoose');
const { createMongoConnection, bindModels } = require('../db/mongoConnection');
const { reserveId } = require('../models/Counter');
const { snapshot } = require('./helpers/migrationFixture');
const { planMigration, applyMigration, backupSnapshot, restoreSnapshot } = require('../migrations/migration');

const host = 'teachable-testing.ntguusj.mongodb.net';
const dbName = 'teachable_21b_bc3e0f91742f90ce056b';
const deny = (promise, code) => assert.rejects(promise, e => e.code === code && !e.cause);
const safeFailure = e => new Error(`Synthetic migration verification failed: ${['MONGO_CONFIG', 'MONGO_AUTH', 'MONGO_CONNECT', 'MONGO_CLOSE', 'ERR_ASSERTION'].includes(e?.code) ? e.code : 'database-or-harness'}; details suppressed`);

test('Phase 2.5 synthetic Atlas migration and restore rehearsal', {
  skip: !process.env.MONGODB_TEST_MODE && 'BLOCKED: explicit Atlas fixture opt-in required', timeout: 600000
}, async t => {
  const manager = createMongoConnection('synthetic-test');
  const owned = new Map();
  let connection, models, directory;
  async function ownership() {
    const entries = await connection.db.listCollections().toArray();
    assert.equal(entries.length, owned.size);
    for (const entry of entries) {
      const owner = owned.get(entry.name);
      assert.ok(owner); assert.deepEqual(entry.info.uuid, owner.uuid); assert.deepEqual(entry.options.validator, owner.validator);
    }
    return true;
  }
  async function cleanup() {
    for (const [name, owner] of owned) {
      const entry = await connection.db.listCollections({ name }).next();
      assert.ok(entry?.info?.uuid); assert.deepEqual(entry.info.uuid, owner.uuid); assert.deepEqual(entry.options.validator, owner.validator);
      await connection.db.collection(name).drop(); owned.delete(name);
    }
    assert.deepEqual(await connection.db.listCollections({}, { nameOnly: true }).toArray(), []);
  }
  async function createOwned() {
    assert.deepEqual(await connection.db.listCollections({}, { nameOnly: true }).toArray(), []);
    for (const Model of Object.values(models)) {
      const name = Model.collection.name;
      const validator = { $jsonSchema: { description: `Synthetic Phase 2.5 owner ${randomUUID()}` } };
      await connection.db.createCollection(name, { validator });
      const entry = await connection.db.listCollections({ name }).next();
      assert.ok(entry?.info?.uuid); assert.deepEqual(entry.options.validator, validator);
      owned.set(name, { uuid: entry.info.uuid, validator });
      for (const [key, options] of Model.schema.indexes()) if (options.unique) await Model.collection.createIndex(key, options);
    }
  }
  async function run(name, fn) {
    let failed;
    await t.test(name, async () => { try { await fn(); } catch (e) { failed = safeFailure(e); throw failed; } });
    if (failed) throw failed;
  }
  try {
    const records = await resolveSrv(`_mongodb._tcp.${host}`);
    assert.equal(records.length, 3);
    assert.ok(records.every(r => r.name.endsWith(host.slice(host.indexOf('.'))) && r.port === 27017));
    connection = await manager.acquire();
    assert.equal(connection.name, dbName); assert.equal(connection.getClient().options.tls, true);
    const hello = await connection.db.admin().command({ hello: 1 });
    assert.equal(hello.isWritablePrimary, true); assert.ok(hello.logicalSessionTimeoutMinutes > 0);
    assert.equal(hello.setName, 'atlas-9b57wc-shard-0');
    assert.deepEqual(hello.hosts.slice().sort(), records.map(r => `${r.name}:${r.port}`).sort());
    const auth = await connection.db.admin().command({ connectionStatus: 1 });
    assert.deepEqual(auth.authInfo.authenticatedUserRoles, [{ role: 'readWrite', db: dbName }]);
    models = bindModels(connection); await createOwned();
    const version = await connection.db.admin().command({ buildInfo: 1 });
    t.diagnostic(JSON.stringify({ host, dbName, mongodb: version.version, mongoose: mongoose.version, node: process.version }));
    const input = snapshot(); const approved = await planMigration(input);
    const dependencies = {
      models,
      verifyTarget: async (db, summary) => db === connection && summary.digest === approved.digest && await ownership(),
      verifyHistory: async row => row.evidence === 'synthetic-issued-and-retired-history' && row.lastIssued === 1000,
      verifyAsset: async (value, manifest) => value.environment === 'synthetic' && value.assetId === 'synthetic' && value.bytes === manifest.bytes
    };
    const apply = (options = {}) => applyMigration(input, { ...dependencies, dryRun: false, ...options });

    await run('dry run validates indexes and all trust proofs without writing', async () => {
      const result = await applyMigration(input, dependencies);
      assert.equal(result.dryRun, true); assert.equal(result.pending.User, 3);
      for (const Model of Object.values(models)) assert.equal(await Model.countDocuments(), 0);
      for (const key of ['verifyTarget', 'verifyAsset', 'verifyHistory']) await deny(apply({ [key]: async () => false }), 'MIGRATION_TRUST');
      const owner = owned.get('users');
      owned.set('users', { ...owner, validator: { $jsonSchema: { description: 'different owner' } } });
      try { await deny(apply(), 'MIGRATION_WRITE'); } finally { owned.set('users', owner); }
      await deny(apply({ verifyAsset: async value => { value.publicId = 'altered'; return true; } }), 'MIGRATION_WRITE');
      const sessionId = new mongoose.Types.ObjectId();
      await models.Session.collection.insertOne({ _id: sessionId, tokenDigest: '1'.repeat(64) });
      try { await deny(apply(), 'MIGRATION_CONFLICT'); } finally { await models.Session.collection.deleteOne({ _id: sessionId }); }
      await models.Course.collection.dropIndex('id_1');
      await deny(apply(), 'MIGRATION_TRUST');
      await models.Course.collection.createIndex({ id: 1 }, { unique: true });
      for (const Model of Object.values(models)) assert.equal(await Model.countDocuments(), 0);
    });
    await run('interrupted transaction rolls back its entity and resumes earlier committed checkpoints', async () => {
      const original = models.Course.prototype.save;
      models.Course.prototype.save = async function(options) { await original.call(this, options); throw new Error('synthetic-private-secret'); };
      try { await deny(apply(), 'MIGRATION_WRITE'); } finally { models.Course.prototype.save = original; }
      assert.equal(await models.User.countDocuments(), 3);
      assert.equal(await models.Course.countDocuments(), 0);
      assert.equal(await models.Enrollment.countDocuments(), 0);
      const before = await models.User.collection.find({}).toArray();
      assert.equal((await apply()).reconciled, true);
      assert.deepEqual(await models.User.collection.find({}).toArray(), before);
    });
    let originalRows;
    await run('repeat preserves exact IDs, BSON references, grades, verifiers and private fields', async () => {
      originalRows = {};
      for (const [name, Model] of Object.entries(models)) originalRows[name] = await Model.collection.find({}).sort({ _id: 1 }).toArray();
      assert.equal((await apply()).reconciled, true);
      for (const [name, Model] of Object.entries(models)) assert.deepEqual(await Model.collection.find({}).sort({ _id: 1 }).toArray(), originalRows[name]);
      const enrollments = originalRows.Enrollment.sort((a, b) => a.id - b.id);
      assert.deepEqual(enrollments.map(r => [r.id, r.grade]), [[30, 0], [31, null]]);
      assert.ok(enrollments[0].student instanceof mongoose.Types.ObjectId);
      assert.equal(enrollments[0].gradeUpdatedBy, null); assert.equal(enrollments[0].gradeUpdatedAt, null);
      const teacher = originalRows.User.find(r => r.id === 1);
      assert.equal(teacher.passwordHash, input.source.users[0].password);
      assert.equal(teacher.role, 'instructor'); assert.equal(teacher.accountState, 'active'); assert.ok(!('status' in teacher));
      assert.equal(originalRows.Session.length, 0);
    });
    await run('changed snapshot, changed target, extra rows and wrong BSON references are refused without overwrite', async () => {
      const changed = snapshot(); changed.source.users[0].name = 'Changed snapshot';
      await deny(applyMigration(changed, { ...dependencies, dryRun: false }), 'MIGRATION_TRUST');
      const original = await models.User.collection.findOne({ id: 2 });
      await models.User.collection.updateOne({ id: 2 }, { $set: { name: 'Newer operational edit' } });
      await deny(apply(), 'MIGRATION_CONFLICT');
      assert.equal((await models.User.collection.findOne({ id: 2 })).name, 'Newer operational edit');
      await models.User.collection.replaceOne({ id: 2 }, original);
      await models.Course.collection.insertOne({ _id: new mongoose.Types.ObjectId(), id: 999 });
      await deny(apply(), 'MIGRATION_CONFLICT');
      await models.Course.collection.deleteOne({ id: 999 });
      const enrollment = await models.Enrollment.collection.findOne({ id: 30 });
      await models.Enrollment.collection.updateOne({ id: 30 }, { $set: { student: enrollment.student.toHexString() } });
      await deny(apply(), 'MIGRATION_CONFLICT');
      await models.Enrollment.collection.replaceOne({ id: 30 }, enrollment);
      await models.Enrollment.collection.updateOne({ id: 30 }, { $set: { student: { $oid: enrollment.student.toHexString() } } });
      await deny(apply(), 'MIGRATION_CONFLICT');
      await models.Enrollment.collection.replaceOne({ id: 30 }, enrollment);
    });
    await run('paired synthetic snapshot and asset backup restores into a fresh owned namespace', async () => {
      directory = await fs.mkdtemp(path.join(os.tmpdir(), 'teachable-25-restore-'));
      const filename = path.join(directory, 'snapshot.json');
      const digest = await backupSnapshot(input, filename);
      const restored = await restoreSnapshot(filename, digest);
      await cleanup(); await createOwned();
      assert.equal((await applyMigration(restored, { ...dependencies, dryRun: false })).reconciled, true);
      for (const [name, Model] of Object.entries(models)) assert.deepEqual(await Model.collection.find({}).sort({ _id: 1 }).toArray(), originalRows[name].sort((a, b) => a._id.toHexString().localeCompare(b._id.toHexString())));
      assert.equal(await models.Session.countDocuments(), 0);
    });
    await run('session disposal errors are redacted even after committed import', async () => {
      const original = connection.startSession;
      connection.startSession = async function() {
        const session = await original.call(this);
        const end = session.endSession.bind(session);
        session.endSession = async () => { await end(); throw new Error('synthetic-private-secret'); };
        return session;
      };
      try { await deny(apply(), 'MIGRATION_WRITE'); } finally { connection.startSession = original; }
      assert.equal((await apply()).reconciled, true);
    });
    await run('advanced counter survives replay refusal; allocator continues above issued and retired high water', async () => {
      assert.equal(await reserveId(models.Counter, 'users'), 1001);
      await deny(apply(), 'MIGRATION_CONFLICT');
      assert.equal(await reserveId(models.Counter, 'users'), 1002);
      assert.equal(await models.User.countDocuments(), 3);
    });
    await run('Phase 2.6 migrated relationships support service CRUD and replay preserves subsequent writes', async () => {
      const contexts = new WeakMap();
      const context = id => { const token = Object.freeze({}); contexts.set(token, id); return token; };
      const options = {
        models, authenticate: async token => contexts.get(token),
        verifyCounter: async scope => scope === 'materials' && await ownership(),
        verifyAsset: async value => value.environment === 'synthetic' && value.assetId === 'synthetic'
      };
      const student = require('../services/studentServices').createService(options);
      const instructor = require('../services/instructorServices').createService(options);
      const materials = require('../services/materialsServices').createService(options);
      const learner = context(2), teacher = context(1);
      assert.deepEqual(await student.checkEnrollment(2, 10, learner), { id: 30, studentId: 2, courseId: 10, grade: 0 });
      assert.equal((await student.checkEnrollment(3, 10, context(3))).grade, null);
      assert.equal((await instructor.showRelatedCourses(1, teacher))[0].id, 10);
      await student.updateStudent({ name: 'Post-migration edit', phone: '000456' }, 2, learner);
      for (const grade of [null, 0]) {
        assert.equal((await instructor.setGrades(grade, 2, 10, teacher)).grade, grade);
        assert.equal((await student.showGrade(2, learner))[0].grade, grade);
      }
      const stored = await models.Enrollment.collection.findOne({ id: 30 });
      assert.ok(stored.gradeUpdatedBy.equals((await models.User.findOne({ id: 1 }))._id));
      assert.ok(stored.gradeUpdatedAt instanceof Date);
      const created = await materials.addmaterials({ name: 'After migration', courseId: 10, asset: input.resolutions.materials[0].asset }, teacher);
      assert.equal(created.id, 1001);
      await materials.updateMaterials({ name: 'Edited material' }, created.id, teacher);
      assert.equal((await materials.getMaterial(created.id, learner)).name, 'Edited material');
      await materials.deleteMaterials(created.id, teacher);
      await deny(materials.getMaterial(created.id, learner), 'NOT_FOUND');
      assert.equal((await materials.getMaterials(10, learner))[0].id, 40);
      const removed = await models.Material.collection.findOne({ id: created.id });
      assert.ok(removed.removedAt instanceof Date);assert.ok(removed.removedBy.equals(stored.gradeUpdatedBy));
      assert.deepEqual(removed.asset, input.resolutions.materials[0].asset);
      for (const [name, rows] of Object.entries(originalRows)) {
        for (const row of rows) {
          const current = await models[name].collection.findOne({ _id: row._id });
          assert.ok(current);assert.equal(current.id, row.id);
          for (const key of ['student', 'course', 'instructor']) if (row[key]) assert.ok(current[key].equals(row[key]));
        }
      }
      const before = {};
      for (const [name, Model] of Object.entries(models)) before[name] = await Model.collection.find({}).sort({ _id: 1 }).toArray();
      assert.equal(before.Session.length, 0);
      assert.equal(before.User.find(row => row.id === 2).name, 'Post-migration edit');
      assert.equal(before.User.find(row => row.id === 2).phone, '000456');
      await deny(apply(), 'MIGRATION_CONFLICT');
      for (const [name, Model] of Object.entries(models)) assert.deepEqual(await Model.collection.find({}).sort({ _id: 1 }).toArray(), before[name]);
    });
  } catch (e) { throw safeFailure(e); }
  finally {
    try {
      if (connection && owned.size) { await cleanup(); t.diagnostic('Cleanup: 0 owned collections pending; namespace empty=true'); }
    } finally { await manager.close(); if (directory) await fs.rm(directory, { recursive: true }); }
  }
});
