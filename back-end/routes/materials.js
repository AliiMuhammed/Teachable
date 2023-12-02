var express = require("express");
var router = express.Router();
const upload = require("../middleware/uploadImages");
const materials = require("../controller/materialsController");

router.post("/add/:course_id", upload.single("file"), materials.addMaterial);

router.get("/:course_id", materials.getMaterials);

router.patch("/update/:id", upload.single("file"), materials.updateMaterial);

router.delete("/:id", materials.deleteMaterials);
module.exports = router;
