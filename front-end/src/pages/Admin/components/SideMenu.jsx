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

function SideMenu({ name, ...props }) {
  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  const navigate = useNavigate();
  const auth = getAuthUser();
  const LogOut = () => {
    removeAuthUser();
    navigate("/");
  };

  const admin = getAuthUser();
  console.log(admin);

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
            <Link to={"/admin/instractors"} onClick={handleClose}>
              <div className="icon">
                <IoIosPeople />
              </div>
              Instractors
            </Link>
            <Link to={"/admin/students"} onClick={handleClose}>
              <div className="icon">
                <MdSchool />
              </div>
              Students
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
