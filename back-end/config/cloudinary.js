'use strict';

function readCloudinaryConfig(environment, env = process.env) {
  try {
    if (!['development', 'preview', 'production'].includes(environment) ||
        env.CLOUDINARY_ENV !== environment ||
        (env.CLOUDINARY_URL !== undefined && env.CLOUDINARY_URL !== '')) throw 0;
    const cloud_name = env.CLOUDINARY_CLOUD_NAME;
    const api_key = env.CLOUDINARY_API_KEY;
    const api_secret = env.CLOUDINARY_API_SECRET;
    if (typeof cloud_name !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/.test(cloud_name) ||
        ![api_key, api_secret].every(value => typeof value === 'string' && /^[\x21-\x7e]+$/.test(value))) throw 0;
    return Object.freeze({ cloud_name, api_key, api_secret, secure: true });
  } catch {
    // Configuration errors may contain credentials; discard their message and cause.
    const error = new Error('Invalid Cloudinary configuration');
    error.code = 'CLOUDINARY_CONFIG';
    throw error;
  }
}

module.exports = { readCloudinaryConfig };
