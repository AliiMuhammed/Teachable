'use strict';
const express = require('express');
module.exports = function createRouter(controller) {
  const router = express.Router();
  router.post('/', controller.addCourse);
  router.patch('/:id/:code', controller.updateCourse);
  router.delete('/:id', controller.deleteCourse);
  router.get('/', controller.getCourses);
  router.get('/:id/:code', controller.getCourse);
  return router;
};
