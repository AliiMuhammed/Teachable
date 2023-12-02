var express = require("express");
var router = express.Router();
const upload = require("../middleware/uploadImages");
const assginController = require("../controller/assignController");

router.post(
  "/assign-instructor",
  upload.single(),
  assginController.assignCourse
);

module.exports = router;
