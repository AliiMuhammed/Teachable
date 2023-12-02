const bcrypt = require("bcrypt");
const userServices = require("../services/usersServices");

exports.loginController = async (req, res) => {
  try {
    const user1 = await userServices.getUser(req.body.email);
    if (user1.length == 0) {
      res.status(404).json({
        errors: [
          {
            msg: "email or password not found !",
          },
        ],
      });
    }
    await userServices.updateStatus(1, user1[0].id);
    const user = await userServices.getUserById(user1[0].id);
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
  } catch (error) {
    console.log(error);
    res.status(500).json({ errors: ["internal error"] });
  }
};
