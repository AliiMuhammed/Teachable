'use strict';

const TEST_HOST = 'teachable-testing.ntguusj.mongodb.net';
const TEST_DB = 'teachable_21b_bc3e0f91742f90ce056b';

function failure(code) {
  const messages = {
    MONGO_CONFIG: 'Invalid or unconfirmed MongoDB configuration',
    MONGO_AUTH: 'MongoDB authentication failed',
    MONGO_CONNECT: 'MongoDB connection unavailable',
    MONGO_CLOSE: 'MongoDB cleanup failed; connection reuse blocked',
    MONGO_CLOSING: 'MongoDB shutdown in progress; acquire again after close',
    MONGO_NOT_READY: 'MongoDB connection is not ready',
    MONGO_MODELS: 'MongoDB model binding failed'
  };
  const error = new Error(messages[code]);
  error.code = code;
  error.retryable = code === 'MONGO_CONNECT';
  return error;
}

function configuration(environment, env) {
  try {
    const synthetic = environment === 'synthetic-test';
    if (!synthetic && !['development', 'preview', 'production'].includes(environment)) throw 0;
    const uri = synthetic ? env.MONGODB_TEST_URI : env.MONGODB_URI;
    const dbName = synthetic ? env.MONGODB_TEST_DB : env.MONGODB_DB;
    const host = synthetic ? env.MONGODB_TEST_APPROVED_HOST : env.MONGODB_APPROVED_HOST;
    if (typeof uri !== 'string' || uri.trim() !== uri || /[\s\\]/.test(uri)) throw 0;
    if (synthetic) {
      if (env.MONGODB_TEST_MODE !== 'atlas' || host !== TEST_HOST || dbName !== TEST_DB ||
          env.MONGODB_TEST_CONFIRM_DB !== TEST_DB || env.TEACHABLE_SYNTHETIC_MONGO_URI ||
          env.MONGODB_TEST_ATLAS_PREFLIGHT !== 'confirmed-m0-trusted-ip-exact-db-role') throw 0;
    } else {
      if (env.MONGODB_ENV !== environment || host === TEST_HOST ||
          typeof dbName !== 'string' || dbName.length > 63 ||
          !new RegExp(`^teachable_${environment}(?:_[a-z0-9]+)*$`).test(dbName)) throw 0;
    }
    if (typeof host !== 'string' || !/^[a-z0-9-]+\.[a-z0-9]+\.mongodb\.net$/.test(host)) throw 0;
    const parsed = new URL(uri);
    if (parsed.protocol !== 'mongodb+srv:' || parsed.hostname !== host || parsed.port ||
        !parsed.username || !parsed.password || parsed.hash ||
        !['', '/', `/${dbName}`].includes(parsed.pathname)) throw 0;
    // Validate percent encoding here, rather than exposing the driver's parser error.
    decodeURIComponent(parsed.username);
    decodeURIComponent(parsed.password);
    const allowed = new Map([
      ['retryWrites', 'true'], ['w', 'majority'], ['authSource', 'admin'], ['tls', 'true']
    ]);
    const seen = new Set();
    for (const [key, value] of parsed.searchParams) {
      if (seen.has(key)) throw 0;
      seen.add(key);
      if (key === 'appName' ? !/^[A-Za-z0-9_-]{1,64}$/.test(value) : allowed.get(key) !== value) throw 0;
    }
    return { uri, dbName };
  } catch {
    // URI/parser errors can contain credentials; never retain their message or cause.
    throw failure('MONGO_CONFIG');
  }
}

function createMongoConnection(environment, env = process.env,
  connectionFactory = () => require('mongoose').createConnection()) {
  const { uri, dbName } = configuration(environment, env);
  let connection;
  let pending;
  let closing;
  let cleanupRequired = false;
  let cleanupFailed = false;

  async function dispose() {
    if (cleanupFailed) throw failure('MONGO_CLOSE');
    if (!connection) return;
    cleanupRequired = true;
    let timer;
    try {
      // destroy also removes discarded connections from Mongoose's connection registry.
      await Promise.race([
        connection.destroy(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(failure('MONGO_CLOSE')), 10000);
        })
      ]);
      connection = undefined;
      cleanupRequired = false;
    } catch {
      // Retrying Mongoose destroy after rejection can hang or skip unfinished cleanup.
      cleanupFailed = true;
      throw failure('MONGO_CLOSE');
    } finally {
      clearTimeout(timer);
    }
  }

  function acquire() {
    if (closing) return Promise.reject(failure('MONGO_CLOSING'));
    if (cleanupFailed) return Promise.reject(failure('MONGO_CLOSE'));
    if (pending) return pending;
    if (!cleanupRequired && connection?.readyState === 1) return Promise.resolve(connection);
    pending = Promise.resolve().then(async () => {
      await dispose();
      if (closing) throw failure('MONGO_CLOSING');
      try {
        connection = connectionFactory();
        // One quiet listener per connection also absorbs late driver error events.
        connection.on('error', () => {});
        await connection.openUri(uri, {
          dbName, tls: true, autoIndex: false, autoCreate: false, bufferCommands: false,
          serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000,
          socketTimeoutMS: 10000, waitQueueTimeoutMS: 5000,
          maxPoolSize: 5, minPoolSize: 0, maxIdleTimeMS: 60000,
          retryWrites: true, w: 'majority'
        });
      } catch (error) {
        await dispose();
        if (error?.code === 18) throw failure('MONGO_AUTH');
        if (['MongoParseError', 'MongoInvalidArgumentError'].includes(error?.name)) throw failure('MONGO_CONFIG');
        throw failure('MONGO_CONNECT');
      }
      if (closing) throw failure('MONGO_CLOSING');
      if (connection.readyState !== 1) {
        await dispose();
        throw failure('MONGO_CONNECT');
      }
      return connection;
    }).finally(() => { pending = undefined; });
    return pending;
  }

  async function isReady() {
    const current = connection;
    if (closing || pending || cleanupRequired || current?.readyState !== 1) return false;
    try {
      const result = await current.db.command({ ping: 1 }, { timeoutMS: 5000 });
      return result.ok === 1 && !closing && !cleanupRequired &&
        current === connection && current.readyState === 1;
    } catch {
      return false;
    }
  }

  function close() {
    if (closing) return closing;
    closing = Promise.resolve().then(async () => {
      if (pending) await pending.catch(() => {});
      await dispose();
    }).finally(() => { closing = undefined; });
    return closing;
  }

  return Object.freeze({ acquire, isReady, close });
}

function bindModels(connection) {
  if (connection?.readyState !== 1) throw failure('MONGO_NOT_READY');
  try {
    const schemas = {
      User: require('../models/User'), Course: require('../models/Course'),
      InstructorAssignment: require('../models/InstructorAssignment'),
      Enrollment: require('../models/Enrollment'), Material: require('../models/Material'),
      Session: require('../models/Session'), Counter: require('../models/Counter').counterSchema
    };
    return Object.fromEntries(Object.entries(schemas).map(([name, schema]) => {
      const existing = connection.models[name];
      if (existing && existing.schema !== schema) throw 0;
      return [name, existing || connection.model(name, schema)];
    }));
  } catch {
    throw failure('MONGO_MODELS');
  }
}

module.exports = { createMongoConnection, bindModels };
