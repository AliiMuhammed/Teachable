'use strict';
const express = require('express');
module.exports = function createRouter(controller) {
  const router = express.Router();
  router.patch('/:id', controller.updateStudent);
  router.delete('/delete/:id', controller.deleteStudent);
  router.get('/', controller.getStudents);
  router.get('/:id', controller.getStudent);
  router.post('/registerCourses/:course_id/:student_id', controller.enrollment);
  router.get('/showGrades/:id', controller.showGrade);
  router.get('/check/:studentId/:courseId', controller.checkEnrollment);
  return router;
};
