import React from 'react'
import './style/dashBoard.css'
import NavBarAdmin from './components/NavBarAdmin'
import MainAdmin from './components/MainAdmin'
import Adminfooter from "./components/Adminfooter";
import { Outlet } from 'react-router';
const DashBoard = () => {
  return (
    <>
      <NavBarAdmin />
      <Outlet/>
      <Adminfooter />
    </>
  );
}

export default DashBoard