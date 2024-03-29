var express = require("express");
var router = express.Router();
const upload = require("../middleware/uploadImages");
const student = require("../controller/studentsController");

router.patch("/:id", upload.single("image"), student.updateStudent);

router.delete("/delete/:id", student.deleteStudent);

router.get("/", student.getStudents);

router.get("/:id", student.getStudent);

router.post("/registerCourses/:course_id/:student_id", student.enrollment);

router.get("/showGrades/:id", student.showGrade);

router.get("/check/:studentId/:courseId", student.checkEnrollment);

module.exports = router;
