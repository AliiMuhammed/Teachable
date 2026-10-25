'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { readCloudinaryConfig } = require('../config/cloudinary');

const configuration = () => ({
  CLOUDINARY_ENV: 'development',
  CLOUDINARY_CLOUD_NAME: 'synthetic-cloud',
  CLOUDINARY_API_KEY: 'synthetic-key',
  CLOUDINARY_API_SECRET: 'synthetic-secret'
});
const invalid = (environment, env) => assert.throws(
  () => readCloudinaryConfig(environment, env),
  error => error.code === 'CLOUDINARY_CONFIG' &&
    error.message === 'Invalid Cloudinary configuration' && !Object.hasOwn(error, 'cause')
);

for (const environment of ['development', 'preview', 'production']) {
  test(`reads only explicit ${environment} configuration with HTTPS`, () => {
    const env = { ...configuration(), CLOUDINARY_ENV: environment, secure: false, unrelated: 'ignored' };
    assert.deepEqual(readCloudinaryConfig(environment, env), {
      cloud_name: 'synthetic-cloud', api_key: 'synthetic-key', api_secret: 'synthetic-secret', secure: true
    });
  });
}

test('requires each configured value without defaults or credential fallback', () => {
  for (const key of Object.keys(configuration())) {
    for (const value of [undefined, null, '', ' ', 123, false, {}]) {
      invalid('development', { ...configuration(), [key]: value });
    }
  }
  invalid('development', null);
  invalid('development', {});
});

test('refuses unknown and mismatched environments even with NODE_ENV fallback', () => {
  for (const environment of [undefined, null, '', 'test', 'synthetic-test', 'Production', 'production ', {}]) {
    invalid(environment, { ...configuration(), NODE_ENV: 'production' });
  }
  invalid('production', configuration());
  invalid('preview', { ...configuration(), CLOUDINARY_ENV: 'production' });
});

test('rejects cloud URLs, path injection and noncanonical cloud names', () => {
  for (const name of ['https://example.invalid', '../production', 'cloud/name', 'Cloud', '-cloud',
    'cloud?query', 'cloud#fragment', ' cloud', 'cloud ', 'cloud\n', 'clöud']) {
    invalid('development', { ...configuration(), CLOUDINARY_CLOUD_NAME: name });
  }
});

test('refuses malformed credentials without trimming or exposing their values', () => {
  for (const key of ['CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
    for (const value of [' synthetic-secret', 'synthetic-secret ', 'synthetic\nsecret',
      'synthetic\tsecret', 'synthetic\0secret', 'synthetic\x7fsecret', 'sëcret']) {
      invalid('development', { ...configuration(), [key]: value });
    }
  }
});

test('refuses a competing CLOUDINARY_URL credential source', () => {
  for (const value of ['cloudinary://synthetic-key:synthetic-secret@other-cloud', ' ', null, false, 0]) {
    invalid('development', { ...configuration(), CLOUDINARY_URL: value });
  }
  assert.equal(readCloudinaryConfig('development', { ...configuration(), CLOUDINARY_URL: '' }).secure, true);
});

test('configuration exceptions are redacted without retaining their cause', () => {
  const env = configuration();
  Object.defineProperty(env, 'CLOUDINARY_API_SECRET', { get() { throw Error('synthetic-secret'); } });
  invalid('development', env);
});

test('captures an immutable configuration snapshot without changing the input', () => {
  const env = configuration();
  const before = { ...env };
  const result = readCloudinaryConfig('development', env);
  assert.deepEqual(env, before);
  env.CLOUDINARY_API_SECRET = 'replacement-synthetic-secret';
  assert.equal(result.api_secret, 'synthetic-secret');
  assert.throws(() => { result.secure = false; }, TypeError);
  assert.throws(() => { result.cloud_name = 'other-cloud'; }, TypeError);
});

test('import has no environment, SDK, database or network dependency', () => {
  const source = `
    const assert = require('node:assert/strict');
    const Module = require('node:module');
    const load = Module._load;
    const target = process.argv[1];
    Module._load = function(name, ...args) {
      if (name !== target) throw Error('Unexpected dependency');
      return load.call(this, name, ...args);
    };
    const env = process.env;
    try {
      process.env = new Proxy({}, { get() { throw Error('Import read environment'); } });
      assert.equal(typeof require(target).readCloudinaryConfig, 'function');
    } finally { process.env = env; }
  `;
  const child = spawnSync(process.execPath, ['-e', source, require.resolve('../config/cloudinary')], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout, '');
});
