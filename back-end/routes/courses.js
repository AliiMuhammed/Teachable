const router = require("express").Router();
const conn = require("../db/dbConnection")
const authorized = require("../middleware/authoriz")
const admin = require("../middleware/admin");
const { body, validationResult } = require("express-validator");
const { query } = require("express");
const util = require("util");
const fs = require("fs");

// CREATE  COURSE
router.post("",
 admin,
 upload.single("image"),
  body("name")
  .isString()
  .withMessage("Please enter a valid course name"),
  body("description")
  .isString()
  .withMessage("Please enter a valid description")
  .isLength({ min: 20 })
  .withMessage("Description must be at least 20 characters"),
   async (req, res) => {
    try{
    const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({errors: errors.array()});
        }
    if(!req.file){
        return res.status(400).json({errors: ["Please upload an image"]});
    }
    const course = {
        name: req.body.name,
        description: req.body.description,
        image_url: req.file.filename,
    };
    const query = util.promisify(conn.query).bind(conn);// transfer query mysql to --> promise to use (await,async)
    await query ("insert into courses set ?",course)
    res.status(200).json({
        msg:"Course created",
    });
} catch(err){
    res.status(500).json(err);
}
});

// UPDATE Course
router.put("/:id",// params
 admin,
 upload.single("image"),
  body("name")
  .isString()
  .withMessage("Please enter a valid course name"),
  body("description")
  .isString()
  .withMessage("Please enter a valid description")
  .isLength({ min: 20 })
  .withMessage("Description must be at least 20 characters"),
   async (req, res) => {
    try{
    const query = util.promisify(conn.query).bind(conn);// transfer query mysql to --> promise to use (await,async)
    const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({errors: errors.array()});
        }
    // check if course Exisit
    const course = await query ("select * from courses where id =?",[req.params.id])
    if(!course[0]){
        return res.status(400).json({errors: ["Course not found"]});
    }

    const courseObj = {
        name: req.body.name,
        description: req.body.description,
    };

    if(req.file){
        courseObj.image_url = req.file.filename;
        fs.unlinkSync('./upload' + course[0].image_url)
    }


    await query ("update courses set? where id =?",[courseObj, course[0].id])
    res.status(200).json({
        msg:"Course updated",
    });


} catch(err){
    res.status(500).json(err);
}
});

// DELETE COURSE
router.delete("/:id",// params
 admin,
   async (req, res) => {
    try{
    // check if course Exisit
    const query = util.promisify(conn.query).bind(conn);// transfer query mysql to --> promise to use (await,async)
    const course = await query ("select * from courses where id =?",[req.params.id])
    if(!course[0]){
        return res.status(400).json({errors: ["Course not found"]});
    }


    fs.unlinkSync('./upload' + course[0].image_url)

    await query ("delete from courses  where id =?",[course[0].id])
    res.status(200).json({
        msg:"Course Delete Success",
    });


} catch(err){
    res.status(500).json(err);
}
});


// LIST & SEARCH
router.get("", async (req, res) => { 
    const query = util.promisify(conn.query).bind(conn);// transfer query mysql to --> promise to use (await,async)
    let search = "";
    if(req.query.search){
        search = `where name like '%${req.query.search}%' or description like '%${req.query.description}%'`
    }
    const courses = await query(`select * from courses ${search}`)
    courses.map(course => {
        course.image_url = "http://" + req.hostname + ':4004/' + course.image_url;
    })
    res.status(200).json({
        courses,
    });
});

// SHOW COURSE  
router.get("/:id", async (req, res) => {
    const query = util.promisify(conn.query).bind(conn);// transfer query mysql to --> promise to use (await,async)
    const course = await query ("select * from courses where id =?",[req.params.id])
    if(!course[0]){
        return res.status(400).json({errors: ["Course not found"]});
    }
    course[0].image_url = "http://" + req.hostname + ':4004/' + course[0].image_url;

    res.status(200).json(course[0]);
});

module.exports = router;