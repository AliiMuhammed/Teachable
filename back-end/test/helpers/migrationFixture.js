'use strict';

const { createHash } = require('node:crypto');
const { asset: baseAsset } = require('./serviceFixture');

function snapshot() {
  const bytes = Buffer.from('Synthetic asset bytes; no provider attestation');
  const asset = () => ({ ...baseAsset(), bytes: bytes.length });
  return {
    version: 1,
    sourceId: '067a9e20-b931-47ad-942c-52e2c80c0c21',
    source: {
      users: [
        { id: 1, name: 'Synthetic instructor', email: 'Teacher@example.invalid', password: `$2b$12$${'a'.repeat(53)}`, phone: 123, type: 'instractor', status: 0, image_url: 'legacy-image' },
        { id: 2, name: 'Synthetic student', email: 'Student@example.invalid', password: `$2b$12$${'b'.repeat(53)}`, phone: 456, type: 'student', status: 1, image_url: 'legacy-image' },
        { id: 3, name: 'Synthetic student two', email: 'Student2@example.invalid', password: `$2b$12$${'c'.repeat(53)}`, phone: 789, type: 'student', status: 0, image_url: 'legacy-image' }
      ],
      courses: [{ id: 10, name: 'Synthetic course', code: 'SYN', description: '', status: 0, image_url: 'legacy-image' }],
      instractors_courses: [{ id: 20, course_id: 10, instractor_id: 1 }],
      users_courses: [{ ide: 30, student_id: 2, course_id: 10, grades: 0 }, { ide: 31, student_id: 3, course_id: 10, grades: null }],
      materials: [{ id: 40, name: 'Synthetic material', course_id: 10, fileName: 'legacy-document' }]
    },
    resolutions: {
      users: [1, 2, 3].map((id, i) => ({ id, accountState: 'active', phone: String([123, 456, 789][i]), profileImage: asset() })),
      courses: [{ id: 10, lifecycle: 'published', durations: 'Eight meetings', coverImage: asset() }],
      materials: [{ id: 40, asset: asset() }],
      issued: ['users', 'courses', 'instructorAssignments', 'enrollments', 'materials'].map(scope => ({ scope, lastIssued: 1000, evidence: 'synthetic-issued-and-retired-history' }))
    },
    assets: [{ assetId: 'synthetic', legacyReferences: ['legacy-image', 'legacy-document'], content: bytes.toString('base64'), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }]
  };
}

module.exports = { snapshot };
