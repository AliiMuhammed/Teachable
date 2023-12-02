var express = require("express");
var router = express.Router();
const upload = require("../middleware/uploadImages");
const materials = require("../controller/materialsController");

router.post("/add/:course_id", upload.single("file"), materials.addMaterial);

router.get("/:course_id", materials.getMaterials);
module.exports = router;
