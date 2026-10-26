'use strict';
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const { join } = require('node:path');
const { fail } = require('../services/serviceSupport');
let active = 0;
async function inspectImage(bytes, signal) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > 5_000_000) fail('INVALID_INPUT');
  if (signal?.aborted) fail('UNAVAILABLE');
  if (active >= 2) fail('LIMIT_EXCEEDED');
  active++;
  try {
    // No application secrets or NODE_OPTIONS enter the decoder process.
    const env = { NODE_PATH: process.env.NODE_PATH || '', SHARP_IGNORE_GLOBAL_LIBVIPS: '1' };
    const format = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['--max-old-space-size=128', join(__dirname, 'imageInspectorWorker.js')], { env, stdio: ['pipe','pipe','ignore'] });
      let output = '', cancelled = false;
      const abort = () => { cancelled = true; child.kill('SIGKILL'); };
      const timer = setTimeout(abort, 5000);
      signal?.addEventListener('abort', abort, { once: true });
      child.stdout.on('data', chunk => { output += chunk; if (output.length > 32) abort(); });
      child.stdin.on('error', () => {});
      child.on('error', () => { clearTimeout(timer); signal?.removeEventListener('abort',abort); reject(Error('unavailable')); });
      child.on('close', code => {
        clearTimeout(timer); signal?.removeEventListener('abort',abort);
        if (!cancelled && code === 0 && ['jpg','png','webp'].includes(output)) resolve(output);
        else reject(Error(cancelled || code === 2 ? 'unavailable' : 'invalid'));
      });
      child.stdin.end(bytes);
    }).catch(error => fail(error.message === 'invalid' ? 'INVALID_INPUT' : 'UNAVAILABLE'));
    return Object.freeze({ format, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  } finally { active--; }
}
module.exports = { inspectImage };
