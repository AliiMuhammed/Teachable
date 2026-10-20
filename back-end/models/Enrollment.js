'use strict';

const { integer, reference, date, paired, schemaFor } = require('./validation');

const enrollmentSchema = schemaFor('enrollments', {
  student: reference('User'),
  course: reference('Course'),
  grade: integer(0, { default: null, max: 100, validate: value => value === null ||
    (Number.isSafeInteger(value) && value >= 0 && value <= 100) }),
  gradeUpdatedBy: reference('User', { required: false, immutable: false, default: null, select: false }),
  gradeUpdatedAt: date({ required: false, default: null, select: false })
});
enrollmentSchema.path('grade').checkRequired = value => value === null || typeof value === 'number';
paired(enrollmentSchema, 'gradeUpdatedBy', 'gradeUpdatedAt');
enrollmentSchema.pre('validate', function() {
  if (!this.isNew && this.isModified('grade') &&
      (!this.gradeUpdatedBy || !this.gradeUpdatedAt ||
       !this.isModified('gradeUpdatedAt'))) {
    this.invalidate('grade', 'Grade changes require paired editor and timestamp changes');
  }
});
enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });

module.exports = enrollmentSchema;
