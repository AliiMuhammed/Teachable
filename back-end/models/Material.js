'use strict';

const { text, reference, date, paired, schemaFor } = require('./validation');
const assetSchema = require('./assetSchema');

const materialSchema = schemaFor('materials', {
  name: text({ maxlength: 255 }),
  course: reference('Course'),
  asset: { type: assetSchema, required: true },
  removedAt: date({ required: false, default: null, select: false }),
  removedBy: reference('User', { required: false, immutable: false, default: null, select: false })
});
paired(materialSchema, 'removedBy', 'removedAt');
materialSchema.pre('validate', function() {
  if (this.asset && this.asset.classification !== 'private') {
    this.invalidate('asset', 'Course materials must remain private');
  }
});

module.exports = materialSchema;
