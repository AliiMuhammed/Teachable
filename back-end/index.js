const express = require("express");
const app = express();
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const bodyparser = require("body-parser");
const auth = require("./routes/Auth");
const courses = require("./routes/courses");
const instractors = require("./routes/instractors");
const students = require("./routes/students");
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // TO ACCESS URL FORM ENCODED
app.use(express.static("upload"));
app.use(cors());



app.listen(4002, "localhost",()=>{
    console.log("listening...");
})

app.use("/auth", auth);
app.use("/courses", courses);
app.use("/instractors", instractors);
app.use("/students", students);