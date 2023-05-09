import { useState } from "react";
import { FaBars } from "react-icons/fa";
import "../style/sideMenu.css";
import Offcanvas from "react-bootstrap/Offcanvas";
import { Link, NavLink } from "react-router-dom";
import { getAuthUser, removeAuthUser } from "../../../helper/Storage";
import { useNavigate } from "react-router-dom";
import { ImBooks } from "react-icons/im";
import { IoIosPeople } from "react-icons/io";
import { MdSchool } from "react-icons/md";
import { RiDashboardFill } from "react-icons/ri";
import { AiFillHome } from "react-icons/ai";
import axios from "axios";
function SideMenu({ name, ...props }) {
  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  const navigate = useNavigate();
  const auth = getAuthUser();
  const LogOut = () => {
    axios
      .post("http://localhost:4002/auth/logout/" + auth.id)
      .then((resp) => {})
      .catch((err) => {});
    removeAuthUser();
    navigate("/");
  };

  const admin = getAuthUser();

  return (
    <>
      <Link onClick={handleShow} className="sideMenu-icon">
        <FaBars />
      </Link>
      <Offcanvas show={show} onHide={handleClose} {...props}>
        <Offcanvas.Header closeButton>
          <Offcanvas.Title className="sideMenu-header">
            Teachable DashBoard
          </Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <div className="links-sideMenu">
            <div className="admin-data sideMenu-adminData">
              <div className="admin-img">
                <img src={admin.image_url} alt="" />
              </div>
              <div className="admin-name">
                <span>{admin.name}</span>
              </div>
            </div>
            <Link to={"/admin"} onClick={handleClose}>
              <div className="icon">
                <RiDashboardFill />
              </div>
              Statistics
            </Link>
            <Link to={"/admin/courses"} onClick={handleClose}>
              <div className="icon">
                <ImBooks />
              </div>
              Courses
            </Link>
            <Link to={"/admin/instructors"} onClick={handleClose}>
              <div className="icon">
                <IoIosPeople />
              </div>
              Instructors
            </Link>
            <Link to={"/admin/students"} onClick={handleClose}>
              <div className="icon">
                <MdSchool />
              </div>
              Students
            </Link>
            <Link to={"/"} onClick={handleClose}>
              <div className="icon">
                <AiFillHome />
              </div>
              Home
            </Link>
          </div>

          {/* Authenticated Routes */}
          {auth && (
            <NavLink
              className="login-btn bordered-btn admin-LogoutBtn"
              onClick={LogOut}
              to={"/"}
            >
              log out
            </NavLink>
          )}
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}

export default SideMenu;
