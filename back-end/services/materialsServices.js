const connection = require("../db/dbConnection");
const util = require("util");

exports.addmaterials = async (data) => {
  const query = util.promisify(connection.query).bind(connection);
  await query("INSERT INTO materials SET ?", [data]);
};

exports.getMaterials = async (id) => {
  const query = util.promisify(connection.query).bind(connection);
  return await query("SELECT * FROM materials WHERE course_id = ?", [id]);
};

exports.updateMaterials = async (id) => {
  const query = util.promisify(connection.query).bind(connection);
  await query("UPDATE materials SET? WHERE id = ?", [id]);
};

exports.deleteMaterials = async (id) => {
  const query = util.promisify(connection.query).bind(connection);
  await query("DELETE FROM materials WHERE id = ?", [id]);
};


