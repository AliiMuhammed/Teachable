const conn = require("../db/dbConnection");
const util = require("util");

const instractor = async (req, res, next) => {
    const query = util.promisify(conn.query).bind(conn);// transfer query mysql to --> promise to use (await,async)
    const {type} = req.headers;
    const instractor = await query("select * from users where type = ?");
    if(instractor[0] && instractor[0].type == "instractor"){
        next();
    }else{
        res.status(401).send("Unauthorized");
    }
}

module.exports = instractor;