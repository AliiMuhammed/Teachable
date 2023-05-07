import React from 'react'
import './style/dashBoard.css'
import NavBarAdmin from './components/NavBarAdmin'
import Adminfooter from "./components/Adminfooter";
import { Outlet } from 'react-router';
import ScrollToTop from "react-scroll-to-top";
import ScrollTop from "../../shared/ScrollTop";
const DashBoard = () => {
  return (
    <>
      <NavBarAdmin />
      <Outlet />
      <Adminfooter />
      <ScrollToTop smooth className="scrollToTop-btn" color="white" />
      <ScrollTop />
    </>
  );
}

export default DashBoard