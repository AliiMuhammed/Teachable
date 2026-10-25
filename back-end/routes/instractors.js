'use strict';
const express = require('express');
module.exports = function createRouter(controller) {
  const router = express.Router();
  router.patch('/:id', controller.updateInstructor);
  router.delete('/:id', controller.deleteInstructor);
  router.get('/', controller.getInstructors);
  router.get('/:id', controller.getInstructor);
  router.get('/view/:id', controller.getRelatedCourses);
  router.post('/setGrades/:studentId/:courseId', controller.setGrades);
  router.get('/student/:id', controller.viewStudents);
  return router;
};
