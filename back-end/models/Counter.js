'use strict';

const { text, integer, schemaFor } = require('./validation');

const scopes = ['users', 'courses', 'instructorAssignments', 'enrollments', 'materials'];
const counterSchema = schemaFor('counters', {
  scope: text({ enum: scopes, immutable: true, select: false }),
  lastAllocated: integer(0, { select: false })
}, false);
counterSchema.index({ scope: 1 }, { unique: true });
counterSchema.pre('save', function() {
  if (!this.isNew) throw new Error('Existing counters can only advance through reserveId');
});

async function reserveId(CounterModel, scope) {
  if (!scopes.includes(scope) || CounterModel.schema !== counterSchema ||
      CounterModel.collection.name !== 'counters') {
    throw new TypeError('Invalid counter model or scope');
  }
  // No session: reservation survives an aborted business transaction. Never upsert or recycle.
  const result = await CounterModel.collection.findOneAndUpdate({
    scope,
    $expr: {
      $cond: [
        { $in: [{ $type: '$lastAllocated' }, ['int', 'long', 'double']] },
        { $and: [
          { $gte: ['$lastAllocated', 0] },
          { $lt: ['$lastAllocated', Number.MAX_SAFE_INTEGER] },
          { $eq: [{ $mod: ['$lastAllocated', 1] }, 0] }
        ] },
        false
      ]
    }
  }, { $inc: { lastAllocated: 1 } }, {
    returnDocument: 'after', includeResultMetadata: false, upsert: false,
    writeConcern: { w: 'majority' }
  });
  if (!result || !Number.isSafeInteger(result.lastAllocated) || result.lastAllocated < 1) {
    throw new Error('Counter unavailable, invalid or exhausted');
  }
  return result.lastAllocated;
}

module.exports = { counterSchema, reserveId };
