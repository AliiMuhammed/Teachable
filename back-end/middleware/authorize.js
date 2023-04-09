// const conn = require("../db/dbConnection");
// const util = require("util");

// const authorized = async (req, res, next) => {
//     const query = util.promisify(conn.query).bind(conn);// transfer query mysql to --> promise to use (await,async)
//     const {type} = req.headers;
//     const user = await query("select * from users where type = ?", {type: type});
//     if(user[0]){
//         next();
//     }else{
//         res.status(401).send("Unauthorized");
//     }
// }

// module.exports = authorized;
