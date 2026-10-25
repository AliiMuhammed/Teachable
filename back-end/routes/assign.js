'use strict';
const express = require('express');
module.exports = function createRouter(controller) {
  const router = express.Router();
  router.post('/assign-instructor', controller.assignCourse);
  return router;
};
