var express = require("express");
var router = express.Router();
const upload = require("../middleware/uploadImages");
const user = require("../controller/signUpController")
const login = require("../controller/loginController")
const logout = require("../controller/logoutController")

router.post("/register", upload.single("image"), user.signupController);
router.post("/login", login.loginController)
router.post("/logout/:id", logout.logout)
module.exports = router;
