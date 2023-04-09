const router = require("express").Router();
const conn = require("../db/dbConnection")
const authorized = require("../middleware/authoriz")

router.post("", (req, res) => {
    res.status(200).json({
        msg:"course created",
    });
});

router.put("", (req, res) => {
    res.status(200).json({
        msg:"course UPDATED",
    });
});

router.delete("", (req, res) => {
    res.status(200).json({
        msg:"course DELETED",
    });
});

router.get("", (req, res) => {
    res.status(200).json({
        courses: [],
    });
});

// router.post("", (req, res) => {
//     res.status(200).json({
//         msg:"course created",
//     });
// });

module.exports = router;