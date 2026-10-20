'use strict';

const { Schema, Types } = require('mongoose');

function strictValue(check) {
  return value => {
    if (value != null && !check(value)) throw new TypeError('Invalid model input type or range');
    return value;
  };
}

function text(options = {}) {
  return {
    type: String, required: true,
    set: strictValue(value => typeof value === 'string'),
    cast: strictValue(value => typeof value === 'string'),
    validate: value => typeof value === 'string' && value.trim().length > 0,
    ...options
  };
}

function integer(min = 0, options = {}) {
  return {
    type: Number, required: true,
    set: strictValue(value => Number.isSafeInteger(value) && value >= min),
    cast: strictValue(value => Number.isSafeInteger(value) && value >= min),
    validate: value => Number.isSafeInteger(value) && value >= min,
    ...options
  };
}

function reference(ref, options = {}) {
  return {
    type: Schema.Types.ObjectId, ref, required: true, immutable: true,
    set: strictValue(value => value instanceof Types.ObjectId),
    cast: strictValue(value => value instanceof Types.ObjectId),
    ...options
  };
}

function date(options = {}) {
  return {
    type: Date, required: true,
    set: strictValue(value => value instanceof Date && Number.isFinite(value.getTime())),
    cast: strictValue(value => value instanceof Date && Number.isFinite(value.getTime())),
    ...options
  };
}

function paired(schema, first, second) {
  schema.pre('validate', function() {
    if (this[first] === undefined || this[second] === undefined ||
        (this[first] === null) !== (this[second] === null)) {
      this.invalidate(first, 'Both audit fields must be present and set or cleared together');
    }
  });
}

function schemaFor(collection, fields, business = true) {
  const schema = new Schema({
    ...(business ? { id: integer(1, { immutable: true }) } : {}),
    ...fields
  }, {
    collection, strict: 'throw', strictQuery: 'throw', id: false,
    autoIndex: false, autoCreate: false, bufferCommands: false,
    optimisticConcurrency: true,
    // Default serialization is deliberately not a role/resource DTO.
    toJSON: { transform: (_doc, result) => business ? { id: result.id } : {} },
    toObject: { transform: (_doc, result) => business ? { id: result.id } : {} }
  });
  if (business) schema.index({ id: 1 }, { unique: true });
  // Cross-field validation needs a full document; query validators cannot provide it.
  for (const operation of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'bulkWrite']) {
    schema.pre(operation, function() {
      throw new Error('Use controlled document writes; counters must use reserveId');
    });
  }
  return schema;
}

module.exports = { text, integer, reference, date, paired, schemaFor };
