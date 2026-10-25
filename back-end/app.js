'use strict';
const express = require('express');
const { createController, errorHandler, respondError } = require('./controller/apiController');

function createApp(dependencies = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('query parser', 'simple');
  app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use(express.json({ limit: '64kb' }));
  app.use(express.urlencoded({ extended: false, limit: '64kb', parameterLimit: 8 }));
  // Cross-origin credentials/CSRF policy belongs to the approved authentication integration.
  app.options('*', (req, res) => respondError(res, 'WORKFLOW_REQUIRED'));
  const controller = createController(dependencies);
  for (const [mount, module] of [['auth', 'users'], ['courses', 'courses'], ['assign', 'assign'],
    ['instractors', 'instractors'], ['students', 'students'], ['materials', 'materials']]) {
    app.use(`/${mount}`, require(`./routes/${module}`)(controller));
  }
  app.use((req, res) => respondError(res, 'NOT_FOUND'));
  app.use(errorHandler);
  return app;
}

// Explicit trusted composition is required; importing the default app never acquires a database.
module.exports = createApp();
module.exports.createApp = createApp;
