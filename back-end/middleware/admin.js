const conn = require("../db/dbConnection");
const util = require("util");

const admin = async (req, res, next) => {
    const query = util.promisify(conn.query).bind(conn);// transfer query mysql to --> promise to use (await,async)
    const {type} = req.headers;
    const admin = await query("select * from users where type = ?");
    if(admin[0] && admin[0].type == "admin"){
        next();
    }else{
        res.status(401).send("Unauthorized");
    }
}

module.exports = admin;
