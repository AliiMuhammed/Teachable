'use strict';

const { text, integer, date, schemaFor } = require('./validation');
const assetSchema = require('./assetSchema');

const emailPattern = /^[\x21-\x7e]+@[\x21-\x7e]+$/;
const bcrypt = /^\$2[aby]\$(0[4-9]|[12]\d|3[01])\$[./A-Za-z0-9]{53}$/;
const argon2id = /^\$argon2id\$v=19\$m=[1-9]\d*,t=[1-9]\d*,p=[1-9]\d*\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/;

const userSchema = schemaFor('users', {
  name: text({ maxlength: 255 }),
  email: text({ maxlength: 255, validate: value => emailPattern.test(value) && value.split('@').length === 2 }),
  emailKey: text({ select: false }),
  passwordHash: text({ select: false, validate: value => bcrypt.test(value) || argon2id.test(value) }),
  phone: text(),
  role: text({ enum: ['student', 'instructor', 'admin'] }),
  accountState: text({ enum: ['pending', 'active', 'disabled'] }),
  profileImage: { type: assetSchema, required: true },
  publicProfileApprovedAt: date({ required: false, default: null, select: false }),
  integrityVersion: integer(0, { default: 0, select: false })
});

userSchema.pre('validate', function() {
  if (this.publicProfileApprovedAt === undefined) {
    this.invalidate('publicProfileApprovedAt', 'Publication approval must be a date or null');
  }
  if (typeof this.email === 'string' && emailPattern.test(this.email)) {
    this.emailKey = this.email.toLowerCase();
  }
  if (this.profileImage) {
    if (this.profileImage.resourceType !== 'image' || this.profileImage.bytes > 5_000_000) {
      this.invalidate('profileImage', 'Profile requires an image of at most 5 MB');
    }
    if (this.profileImage.classification === 'public' && !this.publicProfileApprovedAt) {
      this.invalidate('profileImage', 'Public profile image requires publication approval');
    }
  }
});
userSchema.index({ emailKey: 1 }, { unique: true, collation: { locale: 'simple' } });

module.exports = userSchema;
