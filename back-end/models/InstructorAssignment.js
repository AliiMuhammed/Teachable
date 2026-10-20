'use strict';

const { reference, integer, schemaFor } = require('./validation');

const instructorAssignmentSchema = schemaFor('instructorAssignments', {
  course: reference('Course'),
  instructor: reference('User'),
  integrityVersion: integer(0, { default: 0, select: false })
});
instructorAssignmentSchema.index({ course: 1, instructor: 1 }, { unique: true });

module.exports = instructorAssignmentSchema;
