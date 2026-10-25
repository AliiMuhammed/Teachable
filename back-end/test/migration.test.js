'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { snapshot } = require('./helpers/migrationFixture');
const migration = require('../migrations/migration');

test('plans exact source coverage without exposing rows or credentials; deterministic across input order', async () => {
  const input = snapshot(); const before = JSON.stringify(input);
  const result = await migration.planMigration(input);
  assert.deepEqual(result.counts, { users: 3, courses: 1, instructorAssignments: 1, enrollments: 2, materials: 1, counters: 5 });
  assert.equal(JSON.stringify(input), before);
  assert.match(result.digest, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(result).includes(input.source.users[0].password));
  assert.ok(!JSON.stringify(result).includes('@'));
  input.source.users.reverse();
  assert.equal((await migration.planMigration(input)).digest, result.digest);
  assert.equal((await migration.planMigration(snapshot())).digest, result.digest);
});

const invalid = [
  ['missing state resolution', x => delete x.resolutions.users[0].accountState],
  ['no account state inferred from login status', x => x.resolutions.users[0].accountState = 1],
  ['missing lifecycle', x => delete x.resolutions.courses[0].lifecycle],
  ['undefined lifecycle must not become a new-course default', x => x.resolutions.courses[0].lifecycle = undefined],
  ['missing duration', x => delete x.resolutions.courses[0].durations],
  ['missing material identity', x => delete x.source.materials[0].id],
  ['missing asset mapping', x => x.resolutions.materials = []],
  ['duplicate source ID', x => x.source.users.push({ ...x.source.users[0] })],
  ['duplicate email', x => x.source.users[1].email = x.source.users[0].email.toUpperCase()],
  ['conflicting duplicate grades', x => x.source.users_courses.push({ ...x.source.users_courses[0], ide: 32, grades: 90 })],
  ['duplicate assignment pair', x => x.source.instractors_courses.push({ ...x.source.instractors_courses[0], id: 21 })],
  ['orphan course', x => x.source.users_courses[0].course_id = 11],
  ['wrong role', x => x.source.instractors_courses[0].instractor_id = 2],
  ['unknown role', x => x.source.users[0].type = 'root'],
  ['unsafe ID', x => x.source.users[0].id = Number.MAX_SAFE_INTEGER + 1],
  ['nonpositive ID', x => x.source.users[0].id = 0],
  ['string grade', x => x.source.users_courses[0].grades = '0'],
  ['missing grade', x => delete x.source.users_courses[0].grades],
  ['out of range grade', x => x.source.users_courses[0].grades = 101],
  ['missing issued history', x => x.resolutions.issued.pop()],
  ['issued high water below source', x => x.resolutions.issued[0].lastIssued = 2],
  ['unsupported verifier', x => x.source.users[0].password = 'synthetic-private-secret'],
  ['phone conversion not reconciled', x => x.resolutions.users[0].phone = '00123'],
  ['unknown source field', x => x.source.users[0].extra = 'no silent discard'],
  ['undefined legacy status cannot disappear from backup', x => x.source.users[0].status = undefined],
  ['nonfinite legacy status cannot change on restore', x => x.source.courses[0].status = NaN],
  ['unknown source table', x => x.source.extra = []],
  ['extra resolution', x => x.resolutions.users.push({ ...x.resolutions.users[0], id: 999 })],
  ['asset checksum mismatch', x => x.assets[0].sha256 = '0'.repeat(64)],
  ['missing legacy asset reference', x => x.assets[0].legacyReferences = []],
  ['missing asset bytes', x => delete x.assets[0].content],
  ['invalid snapshot identity', x => x.sourceId = '../unsafe'],
  ['too many records', x => x.source.users = Array.from({ length: 1001 }, () => x.source.users[0])]
];
for (const [name, change] of invalid) test(`refuses ${name} with fixed diagnostics`, async () => {
  const input = snapshot(); change(input);
  await assert.rejects(migration.planMigration(input), e => e.code === 'MIGRATION_INPUT' && e.message === 'Migration snapshot requires reconciliation' && !e.cause);
});

test('apply fails closed without trusted target, asset and history dependencies', async () => {
  await assert.rejects(migration.applyMigration(snapshot()), e => e.code === 'MIGRATION_TRUST');
});

test('planning captures its input before asynchronous validation', async () => {
  const expected = await migration.planMigration(snapshot());
  const input = snapshot();
  const pending = migration.planMigration(input);
  input.source.users[1].email = 'changed-after-validation@example.invalid';
  assert.equal((await pending).digest, expected.digest);
});

test('correct schema bound to a different collection is refused before target attestation', async () => {
  const { fixture } = require('./helpers/serviceFixture');
  const f = fixture();
  const connection = f.models.User.db;
  f.models.User = connection.model('MisboundUser', require('../models/User'), 'unrelated');
  let attestations = 0;
  try {
    await assert.rejects(migration.applyMigration(snapshot(), {
      models: f.models, verifyTarget: async () => { attestations++; return true; },
      verifyHistory: async () => true, verifyAsset: async () => true
    }), e => e.code === 'MIGRATION_TRUST');
    assert.equal(attestations, 0);
  } finally { await connection.destroy(); }
});

test('session cleanup failures cannot expose driver details (offline error boundary only)', async () => {
  const { fixture } = require('./helpers/serviceFixture');
  const f = fixture(); const connection = f.models.User.db;
  for (const Model of Object.values(f.models)) {
    Model.collection.listIndexes = () => ({ toArray: async () => Model.schema.indexes().map(([key, options]) => ({ key, ...options })) });
    Model.collection.find = () => ({ limit: () => ({ toArray: async () => [] }) });
  }
  f.models.Session.collection.findOne = async () => null;
  connection.startSession = async () => ({ withTransaction: async fn => fn(), endSession: async () => { throw new Error('synthetic-private-secret'); } });
  try {
    await assert.rejects(migration.applyMigration(snapshot(), {
      models: f.models, dryRun: false, verifyTarget: async () => true,
      verifyAsset: async () => true, verifyHistory: async () => true
    }), e => e.code === 'MIGRATION_WRITE' && !e.message.includes('synthetic-private-secret') && !e.cause);
  } finally { await connection.destroy(); }
});

test('snapshot backup is exclusive and private; restore verifies bytes and rejects tampering', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'teachable-migration-'));
  const file = path.join(dir, 'snapshot.json');
  try {
    const digest = await migration.backupSnapshot(snapshot(), file);
    assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
    const restored = await migration.restoreSnapshot(file, digest);
    assert.deepEqual(restored, snapshot());
    await assert.rejects(migration.backupSnapshot(snapshot(), file), e => e.code === 'MIGRATION_BACKUP');
    assert.equal((await migration.planMigration(restored)).digest, (await migration.planMigration(snapshot())).digest);
    await fs.appendFile(file, ' ');
    await assert.rejects(migration.restoreSnapshot(file, digest), e => e.code === 'MIGRATION_BACKUP');
  } finally { await fs.rm(dir, { recursive: true }); }
});
