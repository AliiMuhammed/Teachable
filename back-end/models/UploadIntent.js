'use strict';
const { text, integer, date, schemaFor } = require('./validation');
const assetSchema = require('./assetSchema');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const schema = schemaFor('uploadIntents', {
  id: text({ immutable: true, validate: value => uuid.test(value) }),
  actorId: integer(1, { immutable: true }),
  purpose: text({ enum: ['profile', 'course'], immutable: true }),
  targetId: integer(1, { immutable: true }),
  environment: text({ enum: ['development', 'preview', 'production'], immutable: true }),
  cloudName: text({ immutable: true, maxlength: 128 }),
  publicId: text({ immutable: true, maxlength: 200 }),
  createdAt: date({ immutable: true }), expiresAt: date({ immutable: true }),
  state: text({ enum: ['issued','inspecting','uploading','staged','recovery','attached','rejected','expired'] }),
  outstanding: { type: Boolean, required: true },
  sha256: text({ required: false, validate: value => /^[a-f0-9]{64}$/.test(value) }),
  format: text({ required: false, enum: ['jpg','png','webp'] }),
  bytes: integer(1, { required: false, max: 5_000_000 }),
  previousAsset: { type: assetSchema, required: true },
  asset: { type: assetSchema, required: false }
}, false);
schema.pre('validate', function() {
  if (this.expiresAt - this.createdAt !== 600000) this.invalidate('expiresAt', 'Ten-minute window required');
  if (this.outstanding !== !['attached','rejected','expired'].includes(this.state)) this.invalidate('outstanding', 'Lifecycle mismatch');
  if (['uploading','staged','recovery','attached'].includes(this.state) && (!this.sha256 || !this.format || !this.bytes)) this.invalidate('sha256', 'Inspected content required');
  if (this.state === 'attached' && !this.asset) this.invalidate('asset', 'Verified attachment required');
  if (this.asset && (this.asset.classification !== 'private' || this.asset.publicId !== this.publicId || this.asset.environment !== this.environment)) this.invalidate('asset', 'Reserved private identity required');
});
schema.index({ id: 1 }, { unique: true });
schema.index({ environment: 1, cloudName: 1, publicId: 1 }, { unique: true });
schema.index({ purpose: 1, targetId: 1 }, { unique: true, partialFilterExpression: { outstanding: true } });
schema.index({ actorId: 1, createdAt: 1 });
schema.index({ actorId: 1, outstanding: 1 });
module.exports = schema;
