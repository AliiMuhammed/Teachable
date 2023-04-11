import { Link } from "react-router-dom"
import React, {useState} from "react"
import axios from 'axios'

const LoginForm = () => {
    //   const displayText = () => {
    //     return<div className="error-Text"> <p className="error-content">Email or Password Wrong!</p></div>;
    // };
    // let x=true
    const [values, setValues] = useState({
      email: '',
      password: ''
  })
const handlrInput = (event) =>{
    setValues(prev => ({...prev, [event.target.name]: [event.target.value]}))
}

function handleSumbit(event){
  event.preventDefault();
  axios.post('http://localhost:4004/login',values)
  .then(res => {
      if(res.data === "Login Success"){
          alert('Login Success')
      }else{
          alert('login failed')
      }
      
  })
  .catch(err => console.log(err))
  
  
}
  return (
    <div className="login-form">
          <form onSubmit={handleSumbit} method="post">
        <div className="form-group">
          <label htmlFor="email">Email address</label>
          <input type="email" id="email" name="email" 
          onChange={handlrInput}/>
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input type="password" id="password" name="password" 
          onChange={handlrInput}/>
        </div>
        <button type="submit" className="btn btn-login">
          Login
        </button>
        <div className="form-remember">
          <input
            type="checkbox"
            id="remember"
            value={"RememberMe"}
            name="remember"
          />
          <label htmlFor="remember">Remember Me</label>
        </div>

        <Link to="/support">Lost your password? </Link>
      </form>
    </div>
  );
}


export default LoginForm