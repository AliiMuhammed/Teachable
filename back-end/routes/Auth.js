const router = require("express").Router();
const conn = require("../db/dbConnection");
const {body, validationResult} = require("express-validator");
const util = require("util");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const bodyparser = require("body-parser");
const upload = require("../middleware/uploadImages");
const fs = require("fs");


router.post(
    "/login",
    body("email").isEmail().withMessage("please enter a valid email!"),
    body("password")
      .isLength({ min: 8, max: 12 })
      .withMessage("password should be between (8-12) character"),
    async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({errors: errors.array()});
        }
        const query = util.promisify(conn.query).bind(conn);// transfer query mysql to --> promise to use (await,async)
        const user = await query("select * from users where email = ?", [req.body.email]);
        if (user.length == 0) {
             res.status(404).json({
                errors: [
                    {msg: "Email or Password not found!"}]});
        }
          const checkPassword = await bcrypt.compare(req.body.password, user[0].password);
          if (checkPassword) {
            // delete user[0].password;
            res.status(200).json(user[0]);
          } else {
            res.status(404).json({
              errors: [
                {
                  msg: "email or password not found !",
                },
              ],
            });
          }
    } catch (err) {
        console.log(err);
        res.status(500).json({err: err});
    }
})



router.post(
    "/register",
    upload.single("image"),
     body("email").isEmail().withMessage("please Enter a vaild email!"),
     body("password").isLength({min:8, max:12}).withMessage("Password should be between (8,12)."),
    async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({errors: errors.array()});
        }
        const query = util.promisify(conn.query).bind(conn);// transfer query mysql to --> promise to use (await,async)
        const checkEmailExists = await query("select * from users where email = ?", [req.body.email]);
        if (checkEmailExists.length > 0) {
            return res.status(400).json({errors: [{msg: "Email already exists!"}]});
        }
        if(!req.file){
          return res.status(400).json({errors: ["Please upload an image"]});
      }
        const userData = {
            name:req.body.name,
            email:req.body.email,
            password: await bcrypt.hash(req.body.password,10),
            phone:req.body.phone,
            status:req.body.status,
            type: req.body.type,
            image_url: req.file.filename,
        }
        await query("insert into users set ? ",userData);
        delete userData.password;
        res.status(201).json(userData)
        
    } catch (err) {
        console.log(err);
        res.status(500).json({err: err});
    }
})

module.exports = router;