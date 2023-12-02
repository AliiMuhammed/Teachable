const fs = require("fs");
const studentService = require("../services/studentServices");
const coursesServices = require("../services/coursesServices");

exports.updateStudent = async (req, res) => {
  try {
    const student = await studentService.getStudent(req.params.id);
    if (!student[0]) {
      res.status(400).json({ msg: "student not found" });
    }

    if (req.file) {
      req.body.image_url = req.file.filename;
      fs.unlinkSync("./upload/" + student[0].image_url);
    }
    await studentService.updateStudent(req.body, req.params.id);
    res.status(200).json({
      msg: "Student updated",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errors: "Internal Server Error" });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const student = await studentService.getStudent(req.params.id);
    if (!student[0]) {
      return res.status(400).json({ errors: ["Student not found"] });
    }
    fs.unlinkSync("./upload/" + student[0].image_url);
    await studentService.deleteStudent(req.params.id);
    res.status(200).json({
      msg: "Student Delete Success",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errors: "Internal Server Error" });
  }
};

exports.getStudents = async (req, res) => {
  try {
    const students = await studentService.showStudents();
    if (students.length > 0) {
      students.map((student) => {
        student.image_url =
          "http://" + req.hostname + ":3000/" + student.image_url;
      });
      return res.status(200).json(students);
    }
    return res.status(404).json({ msg: "no Students found" });
  } catch (error) {
    res.status(500).json({ errors: "Internal Server Error" });
  }
};

exports.getStudent = async (req, res) => {
  try {
    const student = await studentService.getStudent(req.params.id);

    if (!student[0]) {
      return res.status(400).json({ errors: ["Student not found"] });
    }
    student[0].image_url =
      "http://" + req.hostname + ":3000/" + student[0].image_url;

    res.status(200).json(student[0]);
  } catch (err) {
    res.status(500).json({ errors: "Internal Server Error" });
  }
};

exports.enrollment = async (req, res) => {
  try {
    const course = await coursesServices.getCourse(req.params.course_id);
    if (!course[0]) {
      return res.status(400).json({ errors: ["Course not found"] });
    }

    const student = await studentService.getStudent(req.params.student_id);
    if (!student[0]) {
      return res.status(400).json({ errors: ["Student Not Found"] });
    }

    await studentService.enrollment(req.params);

    res.status(200).json({
      msg: "Course registered successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errors: "Internal Server Error" });
  }
};

exports.checkEnrollment = async (req, res) => {
  try {
    const check = await studentService.checkEnrollment(
      req.params.studentId,
      req.params.courseId
    );

    if (check.length > 0) {
      return res.status(409).json(false);
    }
    return res.status(200).json(true);
  } catch (error) {
    console.log(error);
    res.status(500).json({ errors: "Internal Server Error" });
  }
};

exports.showGrade = async (req, res) => {
  try {
    const grades = await studentService.showGrade(req.params.id);
    if (grades.length > 0) {
      grades.map((grade) => {
        grade.image_url = "http://" + req.hostname + ":3000/" + grade.image_url;
      });
      return res.status(200).json(grades);
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ errors: "Internal Server Error" });
  }
};
