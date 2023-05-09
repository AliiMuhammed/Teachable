import React from 'react'
import './style/profile.css'
import Sidebar from './components/Sidebar';
import { Outlet } from 'react-router';
import {getAuthUser} from "../../helper/Storage"
const Profile = () => {
const user =getAuthUser();
  return (
    <div>
      <section className="profile-section">
        <div className="container profile-container">
          <div className="profile-image">
            <img src={user.image_url} alt="profile" />
          </div>
          <div className="profile-info">
            <h2>{user.name}</h2>
            <h3>{user.type}</h3>
            <p>
              <span>ID:</span>{user.id}
            </p>
          </div>
        </div>
      </section>
      <div className="mainBody">
        <Outlet />
      </div>
    </div>
  );
}

export default Profile