'use strict';
const { support, fail, id, asset } = require('./serviceSupport');
const { readCloudinaryConfig } = require('../config/cloudinary');
const keys = ['assetId','publicId','environment','displayName','resourceType','deliveryType','classification','format','version','bytes'];
let active = 0;

function createService(dependencies = {}) {
  const { run } = support(dependencies);
  const { authorizeRequest, createProvider, verifyAsset, environment, env, clock = () => new Date() } = dependencies;
  function now() {
    const time = clock();
    if (!(time instanceof Date) || !Number.isFinite(time.getTime())) fail('UNAVAILABLE');
    return time.getTime();
  }
  async function context(request) {
    if (typeof authorizeRequest !== 'function') fail('TRUST_REQUIRED');
    try { const ctx = await authorizeRequest(request); if (ctx == null) fail('TRUST_REQUIRED'); return ctx; }
    catch { fail('TRUST_REQUIRED'); }
  }
  async function resolve(s, materialId) {
    const m = await s.required('Material', { id:materialId, removedAt:null });
    const c = await s.required('Course', { _id:m.course });
    const assignment = await s.courseAccess(c);
    const value = asset(Object.fromEntries(keys.map(k => [k,m.asset[k]])), true);
    if (value.environment !== environment) fail('ASSET_UNVERIFIED');
    await s.verify(value, 'material', c.id);
    return { m, c, assignment, value };
  }
  return Object.freeze({ grant: async (materialId, request) => {
    id(materialId);
    if (active >= 2) fail('LIMIT_EXCEEDED');
    active++;
    const controller = new AbortController(); let timer;
    const alive = () => { if (controller.signal.aborted) fail('UNAVAILABLE'); };
    const pending = (async () => {
      try {
        const ctx = await context(request); alive();
        if (typeof createProvider !== 'function' || typeof verifyAsset !== 'function') fail('WORKFLOW_REQUIRED');
        let provider, config;
        try {
          config = readCloudinaryConfig(environment, env); provider = createProvider(config);
          if (['verify','grant','verifyGrant'].some(k => typeof provider?.[k] !== 'function')) throw 0;
        } catch { fail('WORKFLOW_REQUIRED'); }
        const snapshot = await run(ctx, async s => {
          const { m,c,value } = await resolve(s,materialId);
          return { value, course:String(c._id), courseId:c.id, materialId:m.id };
        }); alive();
        const identity = Object.freeze({ ...snapshot.value, cloudName:config.cloud_name });
        const verified = await provider.verify(identity, controller.signal); alive();
        if (!verified || Object.keys(identity).some(k => verified[k] !== identity[k])) fail('ASSET_UNVERIFIED');
        const started = now();
        const binding = Object.freeze({ ...identity, materialId, courseId:snapshot.courseId,
          issuedAt:new Date(started).toISOString(), expiresAt:new Date(started+300000).toISOString() });
        const candidate = await provider.grant(binding, controller.signal); alive();
        const proof = await provider.verifyGrant(candidate, binding, controller.signal); alive();
        function checkGrant() {
          if (!candidate || !proof || Object.keys(binding).some(k => k !== 'expiresAt' && proof[k] !== binding[k]) ||
              proof.expirationEnforced !== true || proof.private !== true || proof.cacheControl !== 'no-store' ||
              proof.disposition !== 'attachment' || proof.url !== candidate.url || proof.expiresAt !== candidate.expiresAt ||
              typeof proof.url !== 'string' || proof.url.length > 8192 || /\s/.test(proof.url) || typeof proof.expiresAt !== 'string') fail('ASSET_UNVERIFIED');
          const expiry = Date.parse(proof.expiresAt);
          if (!Number.isFinite(expiry) || new Date(expiry).toISOString() !== proof.expiresAt || expiry <= now() || expiry > started+300000) fail('ASSET_UNVERIFIED');
          let url; try { url = new URL(proof.url); } catch { fail('ASSET_UNVERIFIED'); }
          if (url.protocol !== 'https:' || url.username || url.password || url.hash) fail('ASSET_UNVERIFIED');
        }
        checkGrant();
        // The provider may have awaited I/O: reload permission and attachment before disclosing its bearer URL.
        await run(await context(request), async s => {
          const { m,c,assignment,value } = await resolve(s,materialId); alive(); checkGrant();
          if (String(c._id) !== snapshot.course || keys.some(k => value[k] !== snapshot.value[k])) fail('ASSET_UNVERIFIED');
          await s.lockActor(); await s.touch(c); if (assignment) await s.touch(assignment);
          m.increment(); await m.save({ session:s.session });
          if (s.actor.role === 'student') {
            const enrollment = await s.required('Enrollment', { course:c._id, student:s.actor._id });
            enrollment.increment(); await enrollment.save({ session:s.session });
          }
          alive(); checkGrant();
        }); alive(); checkGrant();
        return Object.freeze({ url:proof.url, expiresAt:proof.expiresAt });
      } catch (error) { if (error?.name === 'ServiceError') throw error; fail('UNAVAILABLE'); }
    })().finally(() => { active--; clearTimeout(timer); });
    const timeout = new Promise((_,reject) => { timer=setTimeout(() => { controller.abort(); try { fail('UNAVAILABLE'); } catch (e) { reject(e); } },5000); });
    return Promise.race([pending,timeout]);
  } });
}
module.exports = { createService };
