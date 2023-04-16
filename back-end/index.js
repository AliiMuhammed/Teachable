const express = require("express");
const app = express();
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const bodyparser = require("body-parser");
const auth = require("./routes/Auth");
const courses = require("./routes/courses");
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // TO ACCESS URL FORM ENCODED
app.use(express.static("upload"));
app.use(cors());

app.use("/auth", auth);
app.use("/courses", courses);

app.listen(4004, "localhost",()=>{
    console.log("listening...");
})
