'use strict';

const { Schema } = require('mongoose');
const { text, integer } = require('./validation');

const assetSchema = new Schema({
  assetId: text(),
  publicId: text(),
  environment: text(),
  displayName: text(),
  resourceType: text({ enum: ['image', 'raw'] }),
  deliveryType: text({ enum: ['upload', 'authenticated'] }),
  classification: text({ enum: ['public', 'private'] }),
  format: text({ enum: ['jpg', 'png', 'webp', 'pdf', 'docx', 'pptx'] }),
  version: integer(1),
  bytes: integer(1)
}, { _id: false, id: false, strict: 'throw' });

assetSchema.pre('validate', function() {
  const image = ['jpg', 'png', 'webp'].includes(this.format);
  if (this.resourceType !== (image ? 'image' : 'raw')) {
    this.invalidate('resourceType', 'Resource type must match the declared format');
  }
  if (this.deliveryType !== (this.classification === 'private' ? 'authenticated' : 'upload')) {
    this.invalidate('deliveryType', 'Delivery type must match classification');
  }
  if (this.bytes > (image ? 10_000_000 : 25_000_000)) {
    this.invalidate('bytes', 'Asset exceeds its decimal-MB limit');
  }
});

module.exports = assetSchema;
