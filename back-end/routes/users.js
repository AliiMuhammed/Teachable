'use strict';
const express = require('express');
module.exports = function createRouter(controller) {
  const router = express.Router();
  router.post('/register', controller.authUnavailable);
  router.post('/login', controller.authUnavailable);
  router.post('/logout/:id', controller.authUnavailable);
  return router;
};
