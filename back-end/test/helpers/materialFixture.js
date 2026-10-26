'use strict';
const { createHash } = require('node:crypto');
const { fixture: uploadFixture } = require('./uploadFixture');
function fixture(overrides = {}) {
  const f = uploadFixture(); let allocated = 100;
  f.models.Counter.collection.findOneAndUpdate = async () => ({ lastAllocated: ++allocated });
  const provider = {
    upload: async (bytes, options) => {
      f.events.push('upload'); f.options = options;
      f.remote.set(options.public_id, { assetId: 'verified-material', publicId: options.public_id,
        environment: 'development', cloudName: 'synthetic-cloud', resourceType: options.resource_type,
        deliveryType: 'authenticated', format: options.format, bytes: bytes.length, version: 1,
        sha256: createHash('sha256').update(bytes).digest('hex') });
      if (overrides.lostResponse) throw Error('synthetic response loss');
    },
    verify: async binding => { f.events.push('verify'); if (overrides.beforeVerify) await overrides.beforeVerify(f); return { ...f.remote.get(binding.publicId), ...overrides.verifiedOverride }; }
  };
  const dependencies = { ...f.dependencies,
    inspectMaterial: async bytes => { f.events.push('inspect'); return { format: overrides.format || 'pdf', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }; },
    scanMaterial: async (bytes, inspected) => { f.events.push('scan'); return { clean: true, sha256: inspected.sha256 }; },
    createProvider: () => provider, ...overrides };
  return Object.assign(f, { dependencies, provider, allocated: () => allocated,
    material: require('../../services/imageUploads').createMaterialService(dependencies) });
}
module.exports = { fixture };
