var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var cors = require("cors");

var auth = require("./routes/users");
var course = require("./routes/courses");
var assgin = require("./routes/assign");
var instarctor = require("./routes/instractors");
var students = require("./routes/students");
var materials = require("./routes/materials");

var app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static("upload"));
app.use(cors());

app.use("/auth", auth);
app.use("/courses", course);
app.use("/assign", assgin);
app.use("/instractors", instarctor);
app.use("/students", students);
app.use("/materials", materials);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
