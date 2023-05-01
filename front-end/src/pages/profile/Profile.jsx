import React from 'react'
import './style/profile.css'
import Sidebar from './components/Sidebar';
import { Outlet } from 'react-router';
// import arr from '../login/components/LoginForm'
// const arr = require('../login/components/LoginForm')
const Profile = () => {
  return (
    <div>
      <section className="profile-section">
        <div className="container profile-container">
          <div className="profile-image">
            <img src="https://picsum.photos/200" alt="profile" />
          </div>
          <div className="profile-info">
            <h2>Josephine</h2>
            <h3>Software Engineer</h3>
            <p>
              <span>ID:</span>202000571
            </p>
          </div>
        </div>
      </section>
      <div className="mainBody">
        <Sidebar />
        <Outlet />
      </div>
    </div>
  );
}

export default Profile