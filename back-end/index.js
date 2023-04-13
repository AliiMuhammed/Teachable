const express = require("express");
const app = express();
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const bodyparser = require("body-parser");
const Auth = require("./routes/Auth");
app.use(express.json());
app.use(cors());
app.use(bodyparser.urlencoded({extended: true}));
app.use("/Auth", Auth);
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