const router = require("express").Router();
const conn = require("../db/dbConnection");
const {body, validationResult} = require("express-validator");
const util = require("util");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
router.post(
    "/login",
     body("email").isEmail().withMessage("please Enter a vaild email!"),
     body("password").islength({min:8, max:12}).withMessage("Password should be between (8,12)."),
    async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({errors: errors.array()});
        }
        const query = util.promisify(conn.query).bind(conn);// transfer query mysql to --> promise to use (await,async)
        const users = await query("select * from users where email = ?", [req.body.email]);
        if (users.length == 0) {
             res.status(404).json({
                errors: [
                    {msg: "Email or Password not found!"}]});
        }
          const checkPassword = await bcrypt.compare(req.body.password, users[0].password);
          if(checkPassword){
            if(users[0].status === 1){
            delete users[0].password;
            res.status(200).json({
                msg:"Login Success"
            });
        }else{
            res.status(400).json({
                msg:"Email not active"
            })
        }
          }else{
            res.status(404).json({errors: [{
                msg: 'Email or Password not found!'
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
     body("email").isEmail().withMessage("please Enter a vaild email!"),
     body("password").islength({min:8, max:12}).withMessage("Password should be between (8,12)."),
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
        const userData = {
            email:req.body.email,
            password: await bcrypt.hash(req.body.password,10),
            phone:req.body.phone,
            status:req.body.status,
            type: req.body.type
        }
        await query("insert into users set ? ",userData);
        delete userData.password;
        res.status(201).json(userData)
        
    } catch (err) {
        console.log(err);
        res.status(500).json({err: err});
    }
})

module.exports = "/login"