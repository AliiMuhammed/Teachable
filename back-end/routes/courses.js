const router = require("express").Router();
const conn = require("../db/dbConnection");
const authorized = require("../middleware/authorize");
const admin = require("../middleware/admin");
const { body, validationResult } = require("express-validator");
const upload = require("../middleware/uploadImages");
const util = require("util");
const fs = require("fs");
const { type } = require("os");

// CREATE  COURSE
router.post(
  "",
  upload.single("image"),
  body("name").isString().withMessage("please enter a valid course name"),

  body("description")
    .isString()
    .withMessage("please enter a valid description ")
    .isLength({ min: 20 })
    .withMessage("description name should be at lease 20 characters"),

  body("code"),
  body("status"),
  body("durations"),
  async (req, res) => {
    try {
      // 1- VALIDATION REQUEST [manual, express validation]
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // 2- VALIDATE THE IMAGE
      let course;
      if (
        typeof req.body.name === "string" &&
        typeof req.body.description === "string"
      ) {
        if (!req.file) {
          return res.status(400).json({
            errors: [
              {
                msg: "Image is Required",
              },
            ],
          });
        }

        course = {
          name: req.body.name,
          description: req.body.description,
          code: req.body.code,
          status: req.body.status,
          image_url: req.file.filename,
          durations: req.body.durations,
        };
      } else {
        res.status(500).json("error test");
      }

      const query = util.promisify(conn.query).bind(conn);
      await query("insert into courses set ? ", course);
      res.status(200).json({
        msg: "course created successfully !",
      });
    } catch (err) {
      // res.status(500).json(err);
    }
  }
);

// UPDATE Course
router.put(
  "/:id/:code", // params
  upload.single("image"),
  body("name").isString().withMessage("Please enter a valid course name"),
  body("description")
    .isString()
    .withMessage("Please enter a valid description")
    .isLength({ min: 20 })
    .withMessage("Description must be at least 20 characters"),
  body("code"),
  body("status"),
  async (req, res) => {
    try {
      const query = util.promisify(conn.query).bind(conn); // transfer query mysql to --> promise to use (await,async)
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      // check if course Exisit
      const course = await query("select * from courses where id =?", [
        req.params.id,
      ]);
      if (!course[0]) {
        return res.status(400).json({ errors: ["Course not found"] });
      }

      const courseObj = {
        name: req.body.name,
        description: req.body.description,
        code: req.body.code,
        status: req.body.status,
        durations: req.body.durations,
      };

      if (req.file) {
        courseObj.image_url = req.file.filename;
        fs.unlinkSync("./upload/" + course[0].image_url);
      }

      await query("update courses set? where id =?", [courseObj, course[0].id]);
      res.status(200).json({
        msg: "Course updated",
      });
    } catch (err) {
      // res.status(500).json(err);
    }
  }
);

// DELETE COURSE
router.delete(
  "/:id", // params
  async (req, res) => {
    try {
      // check if course Exisit
      const query = util.promisify(conn.query).bind(conn); // transfer query mysql to --> promise to use (await,async)
      const course = await query("select * from courses where id =?", [
        req.params.id,
      ]);
      if (!course[0]) {
        return res.status(400).json({ errors: ["Course not found"] });
      }

      fs.unlinkSync("./upload/" + course[0].image_url);

      await query("delete from courses  where id =?", [course[0].id]);
      res.status(200).json({
        msg: "Course Delete Success",
      });
    } catch (err) {
      // res.status(500).json(err);
    }
  }
);

// LIST & SEARCH
router.get("", async (req, res) => {
  const query = util.promisify(conn.query).bind(conn); // transfer query mysql to --> promise to use (await,async)
  let search = "";
  if (req.query.search) {
    search = `where name like '%${req.query.search}%' or description like '%${req.query.description}%'`;
  }
  const courses = await query(`select * from courses ${search}`);
  courses.map((course) => {
    course.image_url = "http://" + req.hostname + ":4002/" + course.image_url;
  });
  res.status(200).json(courses);
});

// SHOW COURSE
router.get("/:id/:code", async (req, res) => {
  const query = util.promisify(conn.query).bind(conn); // transfer query mysql to --> promise to use (await,async)
  const course = await query("select * from courses where id =? and code=?", [
    req.params.id,
    req.params.code,
  ]);
  if (!course[0]) {
    return res.status(400).json({ errors: ["Course not found"] });
  }
  course[0].image_url =
    "http://" + req.hostname + ":4002/" + course[0].image_url;

  res.status(200).json(course[0]);
});

router.post(
  "/assign",
  upload.single(),
  body("course_id").isNumeric().withMessage("please enter a valid course id"),
  body("instractor_id")
    .isNumeric()
    .withMessage("please enter a valid Instractor id"),
  async (req, res) => {
    try {
      const query = util.promisify(conn.query).bind(conn);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const course = await query("select * from courses where id =?", [
        req.body.course_id,
      ]);
      if (!course[0]) {
        return res.status(400).json({ errors: ["Course not found"] });
      }
      const instractor = await query("SELECT * FROM users WHERE id =?", [
        req.body.instractor_id,
      ]);
      if (!instractor[0] || instractor[0].type != "instractor") {
        return res.status(400).json({ errors: ["Instractor Not Found"] });
      }
      const assignObj = {
        instractor_id: instractor[0].id,
        course_id: course[0].id,
      };
      const instarctors = await query(
        "SELECT * FROM instractors_courses where instractor_id =? and course_id =?",
        [instractor[0].id, course[0].id]
      );
      if (instarctors.length > 0) {
        res.status(400).json({
          errors: [
            {
              msg: "Instarctor already assigned",
            },
          ],
        });
      } else {
        await query("insert into instractors_courses set?", assignObj);
        res.status(200).json({
          msg: "instractor Assign successfully",
        });
      }
    } catch (err) {}
  }
);

module.exports = router;
