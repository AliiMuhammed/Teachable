const connection = require("../db/dbConnection");
const util = require("util");

exports.addCourse = async (data) => {
  const query = util.promisify(connection.query).bind(connection);
  await query("INSERT INTO courses SET?", [data]);
};

exports.getCourse = async (id) => {
  const query = util.promisify(connection.query).bind(connection);
  return await query("SELECT * FROM courses WHERE id = ?", [id]);
};

exports.updateCourse = async (data, id) => {
  const query = util.promisify(connection.query).bind(connection);
  await query("UPDATE courses SET ? WHERE id = ?", [data, id]);
};

exports.showcourses = async () => {
  const query = util.promisify(connection.query).bind(connection);
  return await query("select * from courses");
};

exports.searchCourses = async (search) => {
  const query = util.promisify(connection.query).bind(connection);
  return await query(`select * from courses ${search}`);
};

exports.deleteCourse = async (id) => {
  const query = util.promisify(connection.query).bind(connection);
  await query("DELETE FROM courses WHERE id = ?", [id]);
};
