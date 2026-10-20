'use strict';

const { text, reference, date, schemaFor } = require('./validation');

const sessionSchema = schemaFor('sessions', {
  user: reference('User'),
  tokenDigest: text({ immutable: true, select: false, match: /^[a-f0-9]{64}$/ }),
  createdAt: date({ immutable: true }),
  lastSeenAt: date(),
  absoluteExpiresAt: date({ immutable: true }),
  idleExpiresAt: date(),
  expiresAt: date(),
  revokedAt: date({ required: false, default: null })
}, false);
sessionSchema.pre('validate', function() {
  // The current role is server context, not a stale role persisted in the session.
  const role = this.$locals.sessionRole;
  if (!['student', 'instructor', 'admin'].includes(role)) {
    this.invalidate('user', 'Validation requires the current server-resolved sessionRole');
    return;
  }
  const idleLimit = role === 'admin' ? 30 * 60_000 : 8 * 60 * 60_000;
  const absoluteLimit = role === 'admin' ? 8 * 60 * 60_000 : 24 * 60 * 60_000;
  if (!(this.createdAt <= this.lastSeenAt && this.lastSeenAt <= this.absoluteExpiresAt &&
        this.idleExpiresAt >= this.lastSeenAt &&
        this.absoluteExpiresAt - this.createdAt <= absoluteLimit &&
        this.idleExpiresAt - this.lastSeenAt <= idleLimit &&
        +this.expiresAt === Math.min(+this.idleExpiresAt, +this.absoluteExpiresAt))) {
    this.invalidate('expiresAt', 'Session dates violate ordering, lifetime or minimum-expiry rules');
  }
  if (this.revokedAt && this.revokedAt < this.createdAt) {
    this.invalidate('revokedAt', 'Revocation cannot precede creation');
  }
});
sessionSchema.index({ tokenDigest: 1 }, { unique: true });

module.exports = sessionSchema;
