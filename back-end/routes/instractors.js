var express = require("express");
var router = express.Router();
const upload = require("../middleware/uploadImages");
const insturctor = require("../controller/instructorController");

router.patch("/:id", upload.single("image"), insturctor.updateInstructor);

router.delete("/:id", insturctor.deleteInstructor);

router.get("/", insturctor.getInstructors);

router.get("/:id", insturctor.getInstructor);

router.get("/view/:id", insturctor.getRelatedCourses);

router.post("/setGrades/:studentId/:courseId", insturctor.setGrades);

router.get("/student/:id", insturctor.viewStudents);

module.exports = router;
