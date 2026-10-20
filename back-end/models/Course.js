'use strict';

const { text, integer, schemaFor } = require('./validation');
const assetSchema = require('./assetSchema');

const courseSchema = schemaFor('courses', {
  name: text({ maxlength: 255 }),
  code: text({ maxlength: 255 }),
  description: text({ validate: value => typeof value === 'string' }),
  durations: text({ maxlength: 255 }),
  lifecycle: text({ enum: ['draft', 'published', 'archived'], default: 'draft' }),
  coverImage: { type: assetSchema, required: true },
  integrityVersion: integer(0, { default: 0, select: false })
});
courseSchema.path('description').checkRequired = value => typeof value === 'string';
courseSchema.pre('validate', function() {
  if (!this.coverImage) return;
  if (this.coverImage.resourceType !== 'image' || this.coverImage.bytes > 5_000_000) {
    this.invalidate('coverImage', 'Cover requires an image of at most 5 MB');
  }
  if (this.coverImage.classification === 'public' && this.lifecycle !== 'published') {
    this.invalidate('coverImage', 'Public cover requires a published course');
  }
});

module.exports = courseSchema;
