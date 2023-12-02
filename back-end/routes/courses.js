var express = require("express");
var router = express.Router();
const upload = require("../middleware/uploadImages");
const course = require("../controller/coursesController");

router.post("/", upload.single("image"), course.addCourse);

router.patch("/:id/:code", upload.single("image"), course.updateCourse);

router.delete("/:id", course.deleteCourse);

router.get("", course.getCourses);

router.get("/:id/:code", course.getCourse);

module.exports = router;
