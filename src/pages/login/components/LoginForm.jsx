
import { Link } from "react-router-dom"


const LoginForm = () => {
      const displayText = () => {
        return<div className="error-Text"> <p className="error-content">Email or Password Wrong!</p></div>;
    };
    let x=true
  return (
    <div className="login-form">
          <form>
              {
          x===true ?displayText():console.log("sssss")
            }
        <div className="form-group">
          <label htmlFor="email">Email address</label>
          <input type="email" id="email" name="email" />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input type="password" id="password" name="password" />
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