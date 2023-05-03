const router = require("express").Router();
const conn = require("../db/dbConnection")
const authorized = require("../middleware/authorize")
const admin = require("../middleware/admin");
const { body, validationResult } = require("express-validator");
const util = require("util");
const fs = require("fs");


router.post(
    "/registerCourses",
    body("course_id").isNumeric().withMessage("please enter a valid course id"),
    body("student_id").isNumeric().withMessage("please enter a valid student id"),
    async (req, res) => {
      try{
      const query = util.promisify(conn.query).bind(conn);
      const errors = validationResult(req);
          if (!errors.isEmpty()) {
              return res.status(400).json({errors: errors.array()});
          }
      const course = await query ("select * from courses where id =?",[req.body.course_id])
      if(!course[0]){
          return res.status(400).json({errors: ["Course not found"]});
      }
      const student = await query ("SELECT * FROM users WHERE id =?",[req.body.student_id])
      if(!student[0]){
          return res.status(400).json({errors: ["Student Not Found"]});
      }
      else if(student[0].type != "student"){
        return res.status(400).json({errors: ["User is not Student"]});
      }
      const registerObj = {
        student_id: student[0].id,
        course_id: course[0].id,
      }
      await query("insert into users_courses set?", registerObj)
      res.status(200).json({
        msg: "Course registered successfully"
      })
    }catch(err){
      res.status(500).json(err)
    }
    }
  )


router.get("/:id", async (req, res) => {
  try{
  const stud_id = req.params.id;  
  let courses=[];
  const query = util.promisify(conn.query).bind(conn);// transfer query mysql to --> promise to use (await,async)
    const student = await query ("select * from users_courses where student_id =?",[stud_id])
    
    if(!student[0]){
        return res.status(400).json({errors: ["Student not found"]});
    }
    for(let i = 0; i < student.length; i++){
        courses[i] = await query("SELECT DISTINCT name, grades from courses, users_courses where id =? and student_id  = ?", [student[i].course_id, stud_id])
      //   courses.map(course => {
      //     course[0].image_url = "http://" + req.hostname + ":4002/" + course[0].image_url;
      // })
      }

    res.status(200).json(courses)
  }catch(err){
        res.status(500).json(err);
  }
});

  module.exports = router;