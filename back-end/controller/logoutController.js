const userServices = require("../services/usersServices");

exports.logout = async (req, res) => {
  try {
    const user = await userServices.getUserById(req.params.id);
    if (user.length > 0) {
      userServices.updateStatus(0, req.params.id);
      return res.status(200).json({ msg: "success" });
    }
    return res.status(400).json({ errors: ["user not found"] });
  } catch (error) {
    res.status(500).json({ errors: "internal error" });
  }
};
