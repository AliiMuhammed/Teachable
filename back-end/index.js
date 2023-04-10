const express = require("express");
const app = express();
const cors = require("cors");
app.use(express.json());
app.use(cors());

// app.post('/login', (req, res) => {
//     const sql = "SELECT * FROM users WHERE `email` = ? AND `password`=?";
//     db.query(sql, [req.body.email, req.body.password], (err, data) => {
//         if(err) return res.json("Login Failed");
//         if(data.length>0){
//             return res.json("login successfully")
//         }else {
//             return res.json("fail");
//         }
            
//     })
// })

app.listen(4004, ()=>{
    console.log("listening...");
})