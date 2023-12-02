const connection = require("../db/dbConnection");
const util = require("util");

exports.getStudent = async (id) => {
  const query = util.promisify(connection.query).bind(connection);
  console.log(id);
  return await query("SELECT * FROM users WHERE id = ? AND type = 'student'", [
    id,
  ]);
};

exports.viewStudents = async (id) => {
  const query = util.promisify(connection.query).bind(connection);
  return await query(
    "SELECT u.id, u.name, u.email, u.image_url, uc.grades FROM users_courses uc JOIN users u ON uc.student_id = u.id WHERE uc.course_id = ?",
    [id]
  );
};

exports.updateStudent = async (data, id) => {
  const query = util.promisify(connection.query).bind(connection);
  await query("UPDATE users SET ? WHERE id = ?", [data, id]);
};

exports.showStudents = async () => {
  const query = util.promisify(connection.query).bind(connection);
  return await query("select * from users where type = 'student'");
};

exports.deleteStudent = async (id) => {
  const query = util.promisify(connection.query).bind(connection);
  await query("DELETE FROM users WHERE id = ?", [id]);
};

exports.checkEnrollment = async (studentId, courseId) => {
  const query = util.promisify(connection.query).bind(connection);
  return query(
    "SELECT * FROM users_courses where student_id =? and course_id =?",
    [studentId, courseId]
  );
};

exports.enrollment = async (data) => {
  const query = util.promisify(connection.query).bind(connection);
  await query("INSERT INTO users_courses SET ?", [data]);
};

exports.showGrade = async (studentId) => {
  const query = util.promisify(connection.query).bind(connection);
  return await query(
    "SELECT DISTINCT courses.name, courses.image_url, courses.code, courses.durations, courses.id, users_courses.grades FROM courses JOIN users_courses ON courses.id = users_courses.course_id WHERE users_courses.student_id = ?",
    [studentId]
  );
};
