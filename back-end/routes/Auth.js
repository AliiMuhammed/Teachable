const router = require("express").Router();
const conn = require("../db/dbConnection");
const { body, validationResult } = require("express-validator");
const util = require("util");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const bodyparser = require("body-parser");
const upload = require("../middleware/uploadImages");
const fs = require("fs");
const { query } = require("express");

router.post("/login", body("email"), body("password"), async (req, res) => {
  try {
    // 1- VALIDATION REQUEST [manual, express validation]
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // 2- CHECK IF EMAIL EXISTS
    const query = util.promisify(conn.query).bind(conn); // transform query mysql --> promise to use [await/async]
    let user = await query("select * from users where email = ?", [
      req.body.email,
    ]);
    if (user.length == 0) {
      res.status(404).json({
        errors: [
          {
            msg: "email or password not found !",
          },
        ],
      });
    }

    await query("update users set status = 'active' where id = ?", [
      user[0].id,
    ]);

    user = await query("select * from users where id = ?", [user[0].id]);
    // 3- COMPARE HASHED PASSWORD
    const checkPassword = await bcrypt.compare(
      req.body.password,
      user[0].password
    );
    user[0].image_url = "http://" + req.hostname + ":4002/" + user[0].image_url;

    if (checkPassword) {
      delete user[0].password;
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
  } catch (err) {}
});


router.post(
  "/register",
  upload.single("image"),
  body("email").isEmail().withMessage("please Enter a vaild email!"),
  body("name").isString().withMessage("please enter a valid name"),
  body("password")
    .isLength({ min: 8, max: 12 })
    .withMessage("Password should be between (8,12)."),
  body("phone"),
  body("type"),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const query = util.promisify(conn.query).bind(conn); // transfer query mysql to --> promise to use (await,async)
      const checkEmailExists = await query(
        "select * from users where email = ?",
        [req.body.email]
      );
      let img;
      if (checkEmailExists.length > 0) {
        res.status(400).json({ errors: [{ msg: "Email already exists!" }] });
      } else {
        if (!req.file) {
          res.status(400).json({ msg: "Please upload an image" });
        } else {
          img = req.file.filename;
        }
        const userData = {
          name: req.body.name,
          email: req.body.email,
          password: await bcrypt.hash(req.body.password, 10),
          phone: req.body.phone,
          type: req.body.type,
          image_url: img,
        };
        await query("insert into users set ? ", userData);
        delete userData.password;
        res.status(201).json({ msg: "success" });
      }
    } catch (err) {
      // res.status(500).json(err);
    }
  }
);

router.post("/logout/:id", async (req, res) => {
  try {
    const query = util.promisify(conn.query).bind(conn);
    const user = await query(
      "update users set status = 'in-active' where id =?",
      [req.params.id]
    );
    if (user[0] == 0) {
      return res.status(400).json({ errors: ["user not found"] });
    } else {
      res.status(200).json({ msg: "success" });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json(err);
  }
});

module.exports = router;
