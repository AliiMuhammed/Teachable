const router = require("express").Router();
const conn = require("../db/dbConnection")
const authorized = require("../middleware/authorize")
const admin = require("../middleware/admin");
const { body, validationResult } = require("express-validator");
const upload = require("../middleware/uploadImages");
const util = require("util");
const fs = require("fs");

// UPDATE instarctor    
router.put(
"/:id",// params
 upload.single("image"),
  body("name")
  .isString()
  .withMessage("Please enter a valid instarctor name"),
  body("email").isEmail().withMessage("please enter a valid email!"),
  body("phone"),
   async (req, res, ) => {
    try{
        const query = util.promisify(conn.query).bind(conn);
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
    // check if instractor Exisit
    const instractor = await query ("select * from users where id =?", [
        req.params.id
    ]);
    if(!instractor[0] || instractor[0].type !== "instractor"){
      res.status(400).json({msg: "Instractor not found"});
    }

    const instractorObj = {
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
    };

    if(req.file){
        instractorObj.image_url = req.file.filename;
        fs.unlinkSync("./upload/" + instractor[0].image_url);
    }

    await query ("update users set? where id =?",[instractorObj, instractor[0].id])
        res.send({
            msg:"Instractor updated",
        });



} catch(err){

}
});

// DELETE COURSE
router.delete("/:id",// params
   async (req, res, ) => {
    try{
    // check if course Exisit
    const query = util.promisify(conn.query).bind(conn);// transfer query mysql to --> promise to use (await,async)
    const instractor = await query ("select * from users where id =?",[req.params.id])

    if(!instractor[0] || instractor[0].type !== "instractor"){
        return  res.status(400).json({errors: ["Instractor not found"]});
    }


    fs.unlinkSync("./upload/" + instractor[0].image_url);
    await query ("delete from users  where id =?",[instractor[0].id]);

    res.status(200).json({
        msg:"Instractor Delete Success",
    });


} catch(err){
// res.status(500).json(err);
}

});


// LIST & SEARCH
router.get("", async (req, res, ) => { 
    const query = util.promisify(conn.query).bind(conn);// transfer query mysql to --> promise to use (await,async)
    let search = "";
    if(req.query.search){
        search = `where name like '%${req.query.search}%' or id like '%${req.query.id}%'`
    }
    const instractors = await query(`select * from users ${search} where type='instractor'`)
    instractors.map(instractor => {
        instractor.image_url = "http://" + req.hostname + ":4002/" + instractor.image_url;
    })
    res.status(200).json(
        instractors,
    );
});

// SHOW instractor  

router.get("/:id", async (req, res, ) => {
    try{
     const query = util.promisify(conn.query).bind(conn);// transfer query mysql to --> promise to use (await,async)
    const instractor = await query ("select * from users where id =?",[req.params.id])
    
    if(!instractor[0] || instractor[0].type !== "instractor"){
        return res.status(400).json({errors: ["Instractor not found"]});
    }
    instractor[0].image_url = "http://" + req.hostname + ":4002/" + instractor[0].image_url;

    res.status(200).json(instractor[0]);
}
catch(err){

}
});

router.get('/view/:id', async(req, res) => {
    try{
        let students = [];
    const query = util.promisify(conn.query).bind(conn);// transfer query mysql to --> promise to use (await,async)
    const instractor = await query ("select course_id from instractors_courses where instractor_id =?",[req.params.id])

    if(!instractor[0] || instractor[0].type !== "instractor"){
        return res.status(400).json({errors: ["Instractor not found"]});
    }

    for(let i = 0; i < instractor.length; i++){
        students[i] = await query("SELECT name, student_id from courses, users_courses where id =? and course_id  = ?", [instractor[i].course_id, instractor[i].course_id])
    }

    res.status(200).json(students)
}catch(err){
          res.status(500).json(err);
}
   
  });

  router.post(
    "/setGrades",
    body("course_id").isNumeric().withMessage("please enter a valid course id"),
    body("student_id").isNumeric().withMessage("please enter a valid student id"),
    body("grades").isNumeric().withMessage("please enter a valid Grade"),
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
      const gradesObj = {
        student_id: student[0].id,
        course_id: course[0].id,
        grades: req.body.grades,
      }
      await query("update users_courses set grades =? where student_id =? and course_id = ?", [req.body.grades, student[0].id, course[0].id])
      res.status(200).json({
        msg: "Grades Added"
      })
    }catch(err){
      
      res.status(500).json(err)
    }
    }
  )
module.exports = router;