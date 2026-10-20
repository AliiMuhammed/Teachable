'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { spawnSync } = require('node:child_process');
const mongoose = require('mongoose');
const managerPath = require.resolve('../db/mongoConnection');
const { createMongoConnection, bindModels } = require(managerPath);

const host = 'teachable-testing.ntguusj.mongodb.net';
const db = 'teachable_21b_bc3e0f91742f90ce056b';
const secret = 'synthetic-only-password';
const testEnv = () => ({
  MONGODB_TEST_MODE: 'atlas',
  MONGODB_TEST_URI: `mongodb+srv://fixture:${secret}@${host}/?retryWrites=true&w=majority`,
  MONGODB_TEST_DB: db, MONGODB_TEST_CONFIRM_DB: db,
  MONGODB_TEST_APPROVED_HOST: host,
  MONGODB_TEST_ATLAS_PREFLIGHT: 'confirmed-m0-trusted-ip-exact-db-role'
});
const appEnv = (environment = 'development') => ({
  MONGODB_ENV: environment, MONGODB_DB: `teachable_${environment}`,
  MONGODB_URI: `mongodb+srv://fixture:${secret}@app.example.mongodb.net/`,
  MONGODB_APPROVED_HOST: 'app.example.mongodb.net'
});
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(open = async () => {}, destroy = async () => {}) {
  const connections = [];
  const factory = () => {
    const connection = new EventEmitter();
    connection.readyState = 0;
    connection.db = { command: async () => ({ ok: 1 }) };
    connection.openUri = async (uri, options) => {
      connection.options = options;
      connection.uri = uri;
      connection.readyState = 2;
      await open(connection);
      connection.readyState = 1;
      return connection;
    };
    connection.destroy = async () => {
      connection.destroys = (connection.destroys || 0) + 1;
      await destroy(connection);
      connection.readyState = 0;
    };
    connections.push(connection);
    return connection;
  };
  return { connections, factory };
}
const make = f => createMongoConnection('synthetic-test', testEnv(), f.factory);
const hasCode = code => error => error.code === code &&
  !error.stack.includes(secret) && !error.stack.includes('mongodb+') && !error.cause;

test('import creates no connection, models, MySQL or Express startup dependencies', () => {
  const result = spawnSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const mongoose = require('mongoose');
    const before = mongoose.connections.length;
    const create = mongoose.createConnection;
    mongoose.createConnection = () => { throw new Error('Import attempted connection'); };
    require(${JSON.stringify(managerPath)});
    assert.equal(mongoose.connections.length, before);
    assert.deepEqual(mongoose.modelNames(), []);
    assert.ok(!Object.keys(require.cache).some(p => /[/\\\\](mysql|express)[/\\\\]|[/\\\\](app|dbConnection)\\.js$/.test(p)));
    mongoose.createConnection = create;
  `], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('missing or invalid configuration fails before the connection factory is called', () => {
  const f = fixture();
  for (const env of [{}, { ...testEnv(), MONGODB_TEST_URI: '' },
    { ...testEnv(), MONGODB_TEST_DB: '' },
    { ...testEnv(), MONGODB_TEST_URI: `invalid ${secret}` }]) {
    assert.throws(() => createMongoConnection('synthetic-test', env, f.factory), hasCode('MONGO_CONFIG'));
  }
  assert.equal(f.connections.length, 0);
});

test('rejects target, opt-in, TLS, parser and URI option bypasses', () => {
  const env = testEnv();
  for (const change of [
    { MONGODB_TEST_MODE: '' }, { MONGODB_TEST_MODE: 'production' },
    { MONGODB_TEST_CONFIRM_DB: 'production' }, { MONGODB_TEST_APPROVED_HOST: 'evil.mongodb.net' },
    { MONGODB_TEST_ATLAS_PREFLIGHT: '' }, { MONGODB_TEST_DB: `teachable_21b_${'a'.repeat(20)}` },
    { TEACHABLE_SYNTHETIC_MONGO_URI: 'mongodb://localhost/other' },
    ...['tls=false', 'tlsAllowInvalidCertificates=true', 'ssl=false', 'authSource=other',
      'w=0', 'retryWrites=false', 'retryWrites=true', 'unknown=true', '__proto__=x',
      'serverSelectionTimeoutMS=999999'].map(query => ({ MONGODB_TEST_URI: `${env.MONGODB_TEST_URI}&${query}` })),
    ...[`mongodb+srv://fixture:${secret}@${host}/other`,
      `mongodb+srv://fixture:${secret}@${host}:27017/`,
      `mongodb+srv://fixture:${secret}@${host}/#secret`,
      `mongodb+srv://fixture:${secret}@${host}/?appName=bad%20name`,
      `mongodb+srv://fixture:%ZZ@${host}/`,
      `mongodb+srv://${host}/`, `mongodb://fixture:${secret}@${host}/`,
      ` ${env.MONGODB_TEST_URI}`].map(uri => ({ MONGODB_TEST_URI: uri }))
  ]) {
    assert.throws(() => createMongoConnection('synthetic-test', { ...env, ...change }), hasCode('MONGO_CONFIG'));
  }
});

test('environment must be explicitly selected; test opt-ins cannot activate an app', () => {
  for (const environment of [undefined, '', 'test', 'staging', 'Production']) {
    assert.throws(() => createMongoConnection(environment, testEnv()), hasCode('MONGO_CONFIG'));
  }
  for (const environment of ['development', 'preview', 'production']) {
    assert.throws(() => createMongoConnection(environment, testEnv()), hasCode('MONGO_CONFIG'));
    for (const change of [
      { MONGODB_ENV: '' }, { MONGODB_ENV: 'other' },
      { MONGODB_DB: db }, { MONGODB_DB: 'teachable_21b_anything' },
      { MONGODB_DB: environment === 'production' ? 'teachable_preview' : 'teachable_production' },
      { MONGODB_URI: testEnv().MONGODB_TEST_URI, MONGODB_APPROVED_HOST: host }
    ]) {
      assert.throws(() => createMongoConnection(environment, { ...appEnv(environment), ...change }), hasCode('MONGO_CONFIG'));
    }
  }
});

test('app configuration snapshots remain independent even when source environment changes', async () => {
  const f = fixture();
  const env = { ...appEnv(), ...testEnv() };
  const development = createMongoConnection('development', env, f.factory);
  Object.assign(env, appEnv('preview'));
  const preview = createMongoConnection('preview', env, f.factory);
  Object.assign(env, testEnv(), { MONGODB_DB: 'production', MONGODB_URI: '' });
  assert.equal(f.connections.length, 0);
  const [a, b] = await Promise.all([development.acquire(), preview.acquire()]);
  assert.equal(a.options.dbName, 'teachable_development');
  assert.equal(b.options.dbName, 'teachable_preview');
  assert.notEqual(a, b);
  await Promise.all([development.close(), preview.close()]);
});

test('concurrent and warm acquisition share initialization and apply bounded safe options', async () => {
  const gate = deferred();
  const f = fixture(() => gate.promise);
  const manager = make(f);
  const first = manager.acquire();
  const second = manager.acquire();
  assert.equal(first, second);
  await tick();
  assert.equal(f.connections.length, 1);
  assert.equal(await manager.isReady(), false);
  gate.resolve();
  const connection = await first;
  assert.equal(await second, connection);
  assert.equal(await manager.acquire(), connection);
  assert.equal(await manager.isReady(), true);
  const options = connection.options;
  assert.equal(options.dbName, db);
  assert.equal(options.tls, true);
  assert.equal(options.autoCreate, false);
  assert.equal(options.autoIndex, false);
  assert.equal(options.bufferCommands, false);
  for (const key of ['connectTimeoutMS', 'serverSelectionTimeoutMS', 'socketTimeoutMS', 'waitQueueTimeoutMS']) {
    assert.ok(options[key] > 0 && options[key] <= 10000);
  }
  assert.ok(options.maxPoolSize > 0 && options.maxPoolSize <= 5);
  assert.equal(options.minPoolSize, 0);
  await manager.close();
});

test('failed single flight is sanitized, disposed and reset for an explicit later retry', async () => {
  let attempts = 0;
  const f = fixture(async () => {
    if (++attempts === 1) throw new Error(`mongodb+srv://user:${secret}@host/`);
  });
  const manager = make(f);
  const a = manager.acquire();
  assert.equal(a, manager.acquire());
  await assert.rejects(a, hasCode('MONGO_CONNECT'));
  assert.equal(f.connections[0].destroys, 1);
  assert.equal(await manager.isReady(), false);
  await tick();
  assert.equal(attempts, 1, 'No automatic retry loop');
  const recovered = await manager.acquire();
  assert.equal(recovered.readyState, 1);
  assert.equal(attempts, 2);
  await manager.close();
});

test('authentication and driver configuration failures are nontransient and credential-safe', async () => {
  for (const [error, code] of [
    [Object.assign(new Error(secret), { code: 18 }), 'MONGO_AUTH'],
    [Object.assign(new Error(secret), { name: 'MongoParseError' }), 'MONGO_CONFIG']
  ]) {
    const manager = make(fixture(async () => { throw error; }));
    await assert.rejects(manager.acquire(), e => hasCode(code)(e) && e.retryable === false);
    await manager.close();
  }
});

test('connection readiness states are checked and stale connections are replaced', async () => {
  const f = fixture();
  const manager = make(f);
  let old = await manager.acquire();
  for (const state of [0, 2, 3]) {
    old.readyState = state;
    assert.equal(await manager.isReady(), false);
    const fresh = await manager.acquire();
    assert.notEqual(fresh, old);
    assert.equal(old.destroys, 1);
    old = fresh;
  }
  await manager.close();
});

test('readiness pings without connecting and suppresses errors and shutdown races', async () => {
  const f = fixture();
  const manager = make(f);
  assert.equal(await manager.isReady(), false);
  assert.equal(f.connections.length, 0);
  const connection = await manager.acquire();
  connection.db.command = async () => { throw new Error(secret); };
  assert.equal(await manager.isReady(), false);
  const gate = deferred();
  connection.db.command = () => gate.promise;
  const health = manager.isReady();
  await manager.close();
  gate.resolve({ ok: 1 });
  assert.equal(await health, false);
});

test('shutdown is idempotent and a later explicit acquire reconnects', async () => {
  const f = fixture();
  const manager = make(f);
  await manager.close();
  const a = await manager.acquire();
  const close = manager.close();
  assert.equal(close, manager.close());
  await close;
  await manager.close();
  assert.equal(a.destroys, 1);
  assert.equal(await manager.isReady(), false);
  assert.notEqual(await manager.acquire(), a);
  await manager.close();
});

test('shutdown during initialization rejects stale acquisition and concurrent acquisition', async () => {
  const gate = deferred();
  const f = fixture(() => gate.promise);
  const manager = make(f);
  const pending = manager.acquire();
  const rejected = assert.rejects(pending, hasCode('MONGO_CLOSING'));
  await tick();
  const closing = manager.close();
  await assert.rejects(manager.acquire(), hasCode('MONGO_CLOSING'));
  gate.resolve();
  await Promise.all([closing, rejected]);
  assert.equal(f.connections[0].readyState, 0);
  assert.equal(f.connections[0].destroys, 1);
  assert.notEqual(await manager.acquire(), f.connections[0]);
  await manager.close();
});

test('immediate acquire/close and failing initialization/close leave no orphan connection', async () => {
  for (const fail of [false, true]) {
    const f = fixture(async () => { if (fail) throw new Error(secret); });
    const manager = make(f);
    const pending = manager.acquire();
    const rejected = assert.rejects(pending, e => ['MONGO_CLOSING', 'MONGO_CONNECT'].includes(e.code));
    await Promise.all([manager.close(), rejected]);
    assert.ok(f.connections.every(c => c.readyState === 0));
    assert.equal(await manager.isReady(), false);
  }
});

test('failed disposal quarantines the manager instead of retrying an uncertain close', async () => {
  const f = fixture(async () => {}, async () => { throw new Error(secret); });
  const manager = make(f);
  const connection = await manager.acquire();
  await assert.rejects(manager.close(), hasCode('MONGO_CLOSE'));
  assert.equal(await manager.isReady(), false);
  await assert.rejects(manager.acquire(), hasCode('MONGO_CLOSE'));
  assert.equal(f.connections.length, 1);
  await assert.rejects(manager.close(), hasCode('MONGO_CLOSE'));
  assert.equal(connection.destroys, 1);
});

test('real Mongoose failed close cannot hang later acquire or close', async () => {
  let connection;
  let destroys = 0;
  const manager = createMongoConnection('synthetic-test', testEnv(), () => {
    connection = mongoose.createConnection();
    connection.openUri = async () => { connection.readyState = 1; };
    connection.doClose = async () => { destroys++; throw new Error(secret); };
    return connection;
  });
  await manager.acquire();
  await assert.rejects(manager.close(), hasCode('MONGO_CLOSE'));
  assert.equal(connection.readyState, 3);
  let timer;
  try {
    await Promise.race([
      Promise.all([
        assert.rejects(manager.acquire(), hasCode('MONGO_CLOSE')),
        assert.rejects(manager.close(), hasCode('MONGO_CLOSE'))
      ]),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Cleanup retry hung')), 500); })
    ]);
    assert.equal(destroys, 1);
  } finally {
    clearTimeout(timer);
    // Restore the offline double's state; no live client exists.
    connection.readyState = 0;
    connection.doClose = async () => {};
    connection.emit('close');
    await connection.destroy();
  }
});

test('real Mongoose disconnected cleanup failure cannot be bypassed by another acquisition', async () => {
  const connections = [];
  const manager = createMongoConnection('synthetic-test', testEnv(), () => {
    const connection = mongoose.createConnection();
    connection.openUri = async () => { connection.readyState = 1; };
    connection.doClose = async () => { throw new Error(secret); };
    connections.push(connection);
    return connection;
  });
  const connection = await manager.acquire();
  connection.readyState = 0;
  await assert.rejects(manager.acquire(), hasCode('MONGO_CLOSE'));
  await assert.rejects(manager.acquire(), hasCode('MONGO_CLOSE'));
  await assert.rejects(manager.close(), hasCode('MONGO_CLOSE'));
  assert.equal(connections.length, 1);
  assert.equal(await manager.isReady(), false);
});

test('shutdown has a bounded wait and never opens a second pool after a hung destroy', { timeout: 2000 }, async t => {
  const f = fixture(async () => {}, () => new Promise(() => {}));
  const manager = make(f);
  await manager.acquire();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const rejected = assert.rejects(manager.close(), hasCode('MONGO_CLOSE'));
  await tick();
  t.mock.timers.tick(10000);
  await rejected;
  await assert.rejects(manager.acquire(), hasCode('MONGO_CLOSE'));
  assert.equal(f.connections.length, 1);
});

test('repeated acquisition never accumulates listeners or global handlers; error events are quiet', async t => {
  const output = [];
  for (const method of ['log', 'warn', 'error']) t.mock.method(console, method, (...args) => output.push(args));
  const before = process.listenerCount('unhandledRejection');
  const f = fixture();
  const manager = make(f);
  const connection = await manager.acquire();
  const count = connection.listenerCount('error');
  for (let i = 0; i < 20; i++) await manager.acquire();
  assert.equal(count, 1);
  assert.equal(connection.listenerCount('error'), count);
  connection.emit('error', new Error(secret));
  assert.equal(process.listenerCount('unhandledRejection'), before);
  await manager.close();
  assert.deepEqual(output, []);
});

test('real Mongoose initialization rejection leaves no registry leak or unhandled late error', async () => {
  const before = mongoose.connections.length;
  const manager = createMongoConnection('synthetic-test', testEnv(), () => {
    const connection = mongoose.createConnection();
    connection.createClient = async () => { throw new Error(secret); };
    return connection;
  });
  for (let i = 0; i < 3; i++) {
    await assert.rejects(manager.acquire(), hasCode('MONGO_CONNECT'));
    await tick();
    assert.equal(mongoose.connections.length, before);
  }
  await manager.close();
});

test('schema binding reuses all seven models without opening a connection or creating collections', async () => {
  const connection = mongoose.createConnection();
  assert.throws(() => bindModels(connection), hasCode('MONGO_NOT_READY'));
  // Exercise actual Mongoose compilation without any network client.
  connection.readyState = 1;
  connection.db = { collection: name => ({ collectionName: name }) };
  const a = bindModels(connection);
  const b = bindModels(connection);
  assert.deepEqual(Object.keys(a).sort(), [
    'Counter', 'Course', 'Enrollment', 'InstructorAssignment', 'Material', 'Session', 'User'
  ]);
  const expected = ['counters', 'courses', 'enrollments', 'instructorAssignments', 'materials', 'sessions', 'users'];
  assert.deepEqual(Object.values(a).map(model => model.collection.name).sort(), expected);
  for (const name of Object.keys(a)) {
    assert.equal(a[name], b[name]);
    assert.equal(a[name].schema.options.autoIndex, false);
    assert.equal(a[name].schema.options.autoCreate, false);
  }
  connection.readyState = 0;
  await connection.destroy();
});

test('Atlas: authenticated lifecycle and explicit model binding leave the exact namespace empty', {
  skip: process.env.MONGODB_TEST_MODE !== 'atlas' && 'BLOCKED: explicit Atlas opt-in not selected',
  timeout: 120000
}, async t => {
  let manager;
  let created = 0;
  try {
    manager = createMongoConnection('synthetic-test', process.env, () => {
      created++;
      const connection = mongoose.createConnection();
      if (created === 1) connection.createClient = async () => { throw new Error('Injected offline failure'); };
      return connection;
    });
    const records = await require('node:dns/promises').resolveSrv(`_mongodb._tcp.${host}`);
    assert.equal(records.length, 3);
    assert.ok(records.every(r => r.port === 27017 && r.name.endsWith('.ntguusj.mongodb.net')));
    await assert.rejects(manager.acquire(), hasCode('MONGO_CONNECT'));
    const acquire = manager.acquire();
    assert.equal(acquire, manager.acquire());
    const connection = await acquire;
    assert.equal(created, 2, 'One injected failure, then one actual initialization');
    assert.equal(connection.name, db);
    assert.equal(connection.getClient().options.tls, true);
    const hello = await connection.db.admin().command({ hello: 1 });
    assert.deepEqual([...hello.hosts].sort(), records.map(r => `${r.name}:${r.port}`).sort());
    assert.equal(hello.setName, 'atlas-9b57wc-shard-0');
    assert.equal(hello.isWritablePrimary, true);
    assert.ok(hello.logicalSessionTimeoutMinutes > 0);
    const auth = await connection.db.admin().command({ connectionStatus: 1 });
    assert.deepEqual(auth.authInfo.authenticatedUserRoles, [{ role: 'readWrite', db }]);
    assert.deepEqual(await connection.db.listCollections().toArray(), []);
    assert.equal(await manager.isReady(), true);
    assert.equal(await manager.acquire(), connection);
    const models = bindModels(connection);
    for (const [name, model] of Object.entries(bindModels(connection))) assert.equal(model, models[name]);
    await Promise.all(Object.values(models).map(model => model.init()));
    assert.deepEqual(await connection.db.listCollections().toArray(), []);
    await manager.close();
    assert.equal(connection.readyState, 0);
    assert.equal(await manager.isReady(), false);
    const reopened = await manager.acquire();
    assert.notEqual(reopened, connection);
    assert.equal(created, 3, 'Only one new initialization after explicit shutdown');
    assert.equal(await manager.isReady(), true);
    assert.deepEqual(await reopened.db.listCollections().toArray(), []);
    t.diagnostic('Atlas PASS: TLS, exact roles/namespace, single-flight reuse, seven schemas, shutdown/reconnect; no collection/index creation or writes.');
  } catch {
    throw new Error('Atlas lifecycle verification failed; sensitive details suppressed');
  } finally {
    if (manager) await manager.close();
  }
});
