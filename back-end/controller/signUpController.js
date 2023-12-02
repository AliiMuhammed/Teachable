const bcrypt = require("bcrypt");
const userServices = require("../services/usersServices");

exports.signupController = async (req, res) => {
  try {
    const getEmail = await userServices.getUser(req.body.email)
    if (getEmail.length > 0) {
      res.status(400).json({ errors: [{ msg: "Email already exists!" }] });
    }
    if (!req.file) {
      res.status(400).json({ msg: "Please upload an image" });
    }
    const user = {
      name: req.body.name,
      email: req.body.email,
      password: await bcrypt.hash(req.body.password, 10),
      phone: req.body.phone,
      type: req.body.type,
      image_url: req.file.filename,
    };
    await userServices.insertUser(user);
    res.status(201).json({ msg: "success" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ msg: "INTERNAL SERVER ERROR" });
  }
};
