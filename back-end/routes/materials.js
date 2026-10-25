'use strict';
const express = require('express');
module.exports = function createRouter(controller) {
  const router = express.Router();
  router.post('/add/:course_id', controller.addMaterial);
  router.get('/:course_id', controller.getMaterials);
  router.patch('/update/:id', controller.updateMaterial);
  router.delete('/:id', controller.deleteMaterials);
  return router;
};
