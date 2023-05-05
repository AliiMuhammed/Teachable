import { Link, NavLink } from "react-router-dom";
import { useState } from "react";

import React from "react";
import "../style/NavBar.css";
import Logo from "../assests/images/h-logo.png";
import { FaBars } from "react-icons/fa";
import { AiFillCloseSquare } from "react-icons/ai";
import { getAuthUser, removeAuthUser } from "../helper/Storage";
import { useNavigate } from "react-router-dom";

const NavBar = () => {
  const [isNavShowing, setIsNavShowing] = useState(false);
  const navigate = useNavigate();
  const auth = getAuthUser();
  const LogOut = () => {
    removeAuthUser();
    navigate("/");
  };
  const links = [
    {
      id: 1,
      name: "Home",
      path: "/",
    },
    {
      id: 2,
      name: "Courses",
      path: "/courses",
    },
    {
      id: 3,
      name: "About Us",
      path: "/about",
    },
    {
      id: 4,
      name: "Contact Us",
      path: "/contactUs",
    },
  ];

  return (
    <nav>
      <div className="container nav-container">
        <Link to="/" className="logo" onClick={() => setIsNavShowing(false)}>
          <img src={Logo} alt="logo" />
        </Link>
        <ul className={`nav-links ${isNavShowing ? "show-nav" : "hide-nav"}`}>
          {links.map((link) => {
            return (
              <li key={link.id}>
                <NavLink
                  to={link.path}
                  className={({ isActive }) => (isActive ? "active-nav" : "")}
                  onClick={() => setIsNavShowing((prev) => !prev)}
                >
                  {link.name}
                </NavLink>
              </li>
            );
          })}

          <li>
            {/* Authenticated Routes */}
            {auth && (
              <NavLink
                to="/profile"
                className={({ isActive }) => (isActive ? "active-nav" : "")}
                onClick={() => setIsNavShowing((prev) => !prev)}
              >
                My Profile
              </NavLink>
            )}
          </li>
          <li>
            {/* Authenticated Routes */}
            {auth && (
              <NavLink
                className="login-btn bordered-btn"
                onClick={(() => setIsNavShowing((prev) => !prev), LogOut)}
                to={"/"}
              >
                log out
              </NavLink>
            )}
            {/* unAuthenticated Routes */}
            {!auth && (
              <NavLink
                className="login-btn bordered-btn"
                to="/login"
                onClick={() => setIsNavShowing((prev) => !prev)}
              >
                log in
              </NavLink>
            )}
          </li>
        </ul>
        <button
          className="nav-toggle-btn"
          onClick={() => setIsNavShowing((prev) => !prev)}
        >
          {isNavShowing ? <AiFillCloseSquare /> : <FaBars />}
        </button>
      </div>
    </nav>
  );
};

export default NavBar;
