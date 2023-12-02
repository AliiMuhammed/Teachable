const connection = require("../db/dbConnection");
const util = require("util");

exports.getUserById = async (id) => {
  try {
    const query = util.promisify(connection.query).bind(connection);
    const idd = await query("select * from users where id = ?", [id]);
    return idd;
  } catch (error) {
    console.log(error);
  }
};

exports.insertUser = async (data) => {
  try {
    query = util.promisify(connection.query).bind(connection);
    const user = await query("INSERT INTO users SET ?", [data]);
    if (!user) return { msg: "INTERNAL SERVER ERROR", status: 500 };
  } catch (error) {
    console.log(error);
  }
};

exports.getUser = async (email) => {
  try {
    const query = util.promisify(connection.query).bind(connection);
    const getEmail = await query("select * from users where email = ?", [
      email,
    ]);
    return getEmail;
  } catch (error) {
    console.log(error);
  }
};

exports.updateStatus = async (status, id) => {
  const query = util.promisify(connection.query).bind(connection);
  await query("UPDATE users SET status = ? WHERE id = ?", [status, id]);
};
