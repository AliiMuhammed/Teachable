import React from "react";
import { NavLink } from "react-router-dom";
import { BsJournalBookmark } from "react-icons/bs";
import { AiOutlineCheckCircle } from "react-icons/ai";
import { MdOutlineReportProblem } from "react-icons/md";
import "../style/sidebar.css";
const Sidebar = () => {
  return (
    
      <aside className="sideBar">
        <div className="container sidebar-container">
          <div className="sidebar-menu">
            <ul className="">
              <li>
                <NavLink
                  to="/profile/my-courses"
                  className={({ isActive }) =>
                    isActive ? "active-sideBar" : ""
                  }
                >
                  <BsJournalBookmark /> My Course
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/profile/my-grades"
                  className={({ isActive }) =>
                    isActive ? "active-sideBar" : ""
                  }
                >
                  <AiOutlineCheckCircle /> My Grades
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/support"
                  className={({ isActive }) =>
                    isActive ? "active-sideBar" : ""
                  }
                >
                  <MdOutlineReportProblem /> Have Problem
                </NavLink>
              </li>
            </ul>
          </div>
        </div>
      </aside>
  );
};

export default Sidebar;
