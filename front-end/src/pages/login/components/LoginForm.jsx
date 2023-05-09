import { Link } from "react-router-dom";
import React, { useState } from "react";
import axios from "axios";
import Alert from "react-bootstrap/Alert";
import { setAuthUser } from "../../../helper/Storage";
import { useNavigate } from "react-router-dom";

const LoginForm = () => {
  const navigate = useNavigate();
  const [login, setLogin] = useState({
    email: "",
    password: "",
    type: "",
    loading: false,
    err: [],
  });

  function LoginFun(e) {
    e.preventDefault(); //to prevent default behavior refreshing when user submitted
    setLogin({ ...login, loading: true, err: [] });
    axios
      .post("http://localhost:4002/auth/login", {
        email: login.email,
        password: login.password,
        type: login.type,
      })
      .then((resp) => {
        setLogin({ ...login, loading: false, err: [] });
        setAuthUser(resp.data);
        navigate("/");
      })
      .catch((errors) => {
        setLogin({
          ...login,
          loading: false,
          err: errors.response.data.errors,
        });
      });
  }
  return (
    <div className="login-form">
      {login.err.map((error, index) => (
        <Alert key={index} variant="danger">
          {error.msg}
        </Alert>
      ))}
      <form onSubmit={LoginFun} method="post">
        <div className="form-group">
          <label htmlFor="email">Email address</label>
          <input
            type="email"
            id="email"
            name="email"
            required
            value={login.email}
            onChange={(e) => setLogin({ ...login, email: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            autoComplete="off"
            required
            value={login.password}
            onChange={(e) => setLogin({ ...login, password: e.target.value })}
          />
        </div>
        <button
          className={"btn btn-dark w-100"}
          type="submit"
          variant="primary"
          disabled={login.loading === true}
        >
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
};

export default LoginForm;
