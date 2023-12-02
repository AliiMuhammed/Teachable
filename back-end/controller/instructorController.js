const instructorServices = require("../services/instructorServices");
const fs = require("fs");
const coursesServices = require("../services/coursesServices");
const studentService = require("../services/studentServices");

exports.updateInstructor = async (req, res) => {
  try {
    const instructor = await instructorServices.getInstructor(req.params.id);
    if (!instructor[0] || instructor[0].type !== "instractor") {
      res.status(400).json({ msg: "Instructor not found" });
    }

    if (req.file) {
      req.body.image_url = req.file.filename;
      fs.unlinkSync("./upload/" + instructor[0].image_url);
    }
    await instructorServices.updateInstructor(req.body, req.params.id);
    res.status(200).json({
      msg: "Instructor updated",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errors: "Internal Server Error" });
  }
};

exports.deleteInstructor = async (req, res) => {
  try {
    const instructor = await instructorServices.getInstructor(req.params.id);
    if (!instructor[0] || instructor[0].type !== "instractor") {
      return res.status(400).json({ errors: ["Instractor not found"] });
    }
    fs.unlinkSync("./upload/" + instructor[0].image_url);
    await instructorServices.deleteInstructor(req.params.id);
    res.status(200).json({
      msg: "Instructor Delete Success",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errors: "Internal Server Error" });
  }
};

exports.getInstructors = async (req, res) => {
  try {
    const instructors = await instructorServices.showInstructors();
    if (instructors.length > 0) {
      instructors.map((instructor) => {
        instructor.image_url =
          "http://" + req.hostname + ":3000/" + instructor.image_url;
      });
      return res.status(200).json(instructors);
    }
    return res.status(404).json({ msg: "no instructors found" });
  } catch (error) {
    res.status(500).json({ errors: "Internal Server Error" });
  }
};

exports.getInstructor = async (req, res) => {
  try {
    const instructor = await instructorServices.getInstructor(req.params.id);

    if (!instructor[0] || instructor[0].type !== "instractor") {
      return res.status(400).json({ errors: ["Instructor not found"] });
    }
    instructor[0].image_url =
      "http://" + req.hostname + ":3000/" + instructor[0].image_url;

    res.status(200).json(instructor[0]);
  } catch (err) {
    res.status(500).json({ errors: "Internal Server Error" });
  }
};

exports.getRelatedCourses = async (req, res) => {
  try {
    const courses = await instructorServices.showRelatedCourses(req.params.id);
    if (courses.length > 0) {
      courses.map((course) => {
        course.image_url =
          "http://" + req.hostname + ":3000/" + course.image_url;
      });
      return res.status(200).json(courses);
    }
    return res
      .status(400)
      .json({ errors: ["You haven't been assigned to any courses."] });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errors: "Internal Server Error" });
  }
};

exports.setGrades = async (req, res) => {
  try {
    const course = await coursesServices.getCourse(req.params.courseId);
    if (!course[0]) {
      return res.status(400).json({ errors: ["Course not found"] });
    }

    const student = await studentService.getStudent(req.params.studentId);
    if (!student[0]) {
      return res.status(400).json({ errors: ["Student Not Found"] });
    }

    await instructorServices.setGrades(
      req.body.grades,
      req.params.studentId,
      req.params.courseId
    );
    res.status(200).json({
      msg: "Grades Added",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errors: "Internal Server Error" });
  }
};

exports.viewStudents = async (req, res) => {
  try {
    const students = await studentService.viewStudents(req.params.id);
    if (students) {
      students.map((student) => {
        student.image_url =
          "http://" + req.hostname + ":3000/" + student.image_url;
      });
    }
    res.status(200).json(students);
  } catch (error) {
    console.log(error);
    res.status(500).json({ errors: "Internal Server Error" });
  }
};
