const connection = require("../db/dbConnection");
const util = require("util");

exports.getInstructor = async (id) => {
  const query = util.promisify(connection.query).bind(connection);
  return await query("SELECT * FROM users WHERE id = ?", [id]);
};

exports.checkAssign = async (courseId, instructorId) => {
  const query = util.promisify(connection.query).bind(connection);
  return query(
    "SELECT * FROM instractors_courses where instractor_id =? and course_id =?",
    [instructorId, courseId]
  );
};

exports.assgin = async (data) => {
  const query = util.promisify(connection.query).bind(connection);
  await query("INSERT INTO instractors_courses SET?", [data]);
};

exports.updateInstructor = async (data, id) => {
  const query = util.promisify(connection.query).bind(connection);
  await query("UPDATE users SET ? WHERE id = ?", [data, id]);
};

exports.showInstructors = async () => {
  const query = util.promisify(connection.query).bind(connection);
  return await query("select * from users where type = 'instractor'");
};

exports.deleteInstructor = async (id) => {
  const query = util.promisify(connection.query).bind(connection);
  await query("DELETE FROM users WHERE id = ?", [id]);
};

exports.showRelatedCourses = async (id) => {
  const query = util.promisify(connection.query).bind(connection);
  return await query(
    "SELECT course_id, courses.id, courses.name, courses.description, courses.code, courses.status, courses.image_url, courses.durations FROM instractors_courses JOIN courses ON courses.id = course_id WHERE instractor_id = ? GROUP BY course_id, courses.id, courses.name, courses.description, courses.code, courses.status, courses.image_url, courses.durations",
    [id]
  );
};

exports.setGrades = async (grades, studentId, courseId) => {
  const query = util.promisify(connection.query).bind(connection);
  await query(
    "UPDATE users_courses SET grades = ? WHERE  student_id =? AND course_id = ?",
    [grades, studentId, courseId]
  );
};
