import {Link,NavLink} from 'react-router-dom'
import { useState } from 'react'

import React from 'react'
import '../style/NavBar.css'
import Logo from '../assests/images/h-logo.png'
import {links} from '../core/data/data'

import {FaBars} from 'react-icons/fa'
import {AiFillCloseSquare} from 'react-icons/ai'



const NavBar = () => {
  const [ isNavShowing,setIsNavShowing]=useState(false)


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
            <NavLink
              className="login-btn bordered-btn"
              to="/login"
              onClick={() => setIsNavShowing((prev) => !prev)}
            >
              log in
            </NavLink>
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
}

export default NavBar