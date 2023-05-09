const router = require("express").Router();
const conn = require("../db/dbConnection");
const authorized = require("../middleware/authorize");
const admin = require("../middleware/admin");
const { body, validationResult } = require("express-validator");
const util = require("util");
const fs = require("fs");
const upload = require("../middleware/uploadImages");

router.put(
  "/:id", // params
  upload.single("image"),
  body("name").isString().withMessage("Please enter a valid instarctor name"),
  body("email").isEmail().withMessage("please enter a valid email!"),
  body("phone"),
  async (req, res) => {
    try {
      const query = util.promisify(conn.query).bind(conn);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      // check if instractor Exisit
      const student = await query("select * from users where id =?", [
        req.params.id,
      ]);
      if (!student[0] || student[0].type !== "student") {
        res.status(400).json({ msg: "Student not found" });
      }

      const studentObj = {
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
      };

      if (req.file) {
        studentObj.image_url = req.file.filename;
        fs.unlinkSync("./upload/" + student[0].image_url);
      }

      await query("update users set? where id =?", [studentObj, student[0].id]);
      res.send({
        msg: "Student updated",
      });
    } catch (err) {}
  }
);

router.delete(
  "/delete/:id", // params
  async (req, res) => {
    try {
      // check if course Exisit
      const query = util.promisify(conn.query).bind(conn); // transfer query mysql to --> promise to use (await,async)
      const student = await query("select * from users where id =?", [
        req.params.id,
      ]);

      if (!student[0] || student[0].type !== "student") {
        return res.status(400).json({ errors: ["Student not found"] });
      }

      fs.unlinkSync("./upload/" + student[0].image_url);
      await query("delete from users  where id =?", [student[0].id]);

      res.status(200).json({
        msg: "Student Delete Success",
      });
    } catch (err) {
      // res.status(500).json(err);
    }
  }
);

router.post("/registerCourses/:student_id/:course_id", async (req, res) => {
  try {
    const query = util.promisify(conn.query).bind(conn);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const course = await query("select * from courses where id =?", [
      req.params.course_id,
    ]);
    if (!course[0]) {
      return res.status(400).json({ errors: ["Course not found"] });
    }
    const student = await query("SELECT * FROM users WHERE id =?", [
      req.params.student_id,
    ]);
    if (!student[0] || student[0].type !== "student") {
      return res.status(400).json({ errors: ["Student Not Found"] });
    }

    const students = await query(
      "SELECT * FROM users_courses where student_id =? and course_id =?",
      [student[0].id, course[0].id]
    );
    if (students.length > 0) {
      res
        .status(400)
        .json({
          errors: [{ msg: "You have already registered for that course." }],
        });
    } else {
      const registerObj = {
        student_id: student[0].id,
        course_id: course[0].id,
      };
      await query("insert into users_courses set?", registerObj);
      res.status(200).json({
        msg: "Course registered successfully",
      });
    }
  } catch (err) {
    res.status(500).json(err);
  }
});

router.get("/showGrades/:id", async (req, res) => {
  try {
    const stud_id = req.params.id;
    const courses = [];
    const query = util.promisify(conn.query).bind(conn);
    const student = await query(
      "SELECT * FROM users_courses WHERE student_id = ?",
      [stud_id]
    );

    if (!student[0]) {
      return res.status(400).json({ errors: ["Student not found"] });
    }

    for (let i = 0; i < student.length; i++) {
      const course = await query(
        "SELECT DISTINCT courses.name, courses.image_url, courses.code, courses.durations, courses.id, users_courses.grades FROM courses JOIN users_courses ON courses.id = users_courses.course_id WHERE courses.id = ? AND users_courses.student_id = ?",
        [student[i].course_id, stud_id]
      );
      course[0].image_url =
        "http://" + req.hostname + ":4002/" + course[0].image_url;
      courses.push(course[0]);
    }

    res.status(200).json(courses.flat());
  } catch (err) {
    res.status(500).json(err);
  }
});

router.get("", async (req, res) => {
  const query = util.promisify(conn.query).bind(conn); // transfer query mysql to --> promise to use (await,async)
  let search = "";
  if (req.query.search) {
    search = `where name like '%${req.query.search}%' or id like '%${req.query.id}%'`;
  }
  const students = await query(
    `select * from users ${search} where type='student'`
  );
  students.map((student) => {
    student.image_url = "http://" + req.hostname + ":4002/" + student.image_url;
  });
  res.status(200).json(students);
});
router.get("/:id", async (req, res) => {
  try {
    const query = util.promisify(conn.query).bind(conn); // transfer query mysql to --> promise to use (await,async)
    const student = await query("select * from users where id =?", [
      req.params.id,
    ]);

    if (!student[0] || student[0].type !== "student") {
      return res.status(400).json({ errors: ["Student not found"] });
    }
    student[0].image_url =
      "http://" + req.hostname + ":4002/" + student[0].image_url;

    res.status(200).json(student[0]);
  } catch (err) {}
});

module.exports = router;
