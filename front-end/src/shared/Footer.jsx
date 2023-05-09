import Logo from "../assests/images/h-logo-white.png";
import { Link } from "react-router-dom";
import { AiFillFacebook } from "react-icons/ai";
import { AiFillTwitterSquare } from "react-icons/ai";
import { AiFillLinkedin } from "react-icons/ai";
import { GiEarthAfricaEurope } from "react-icons/gi";
import axios from "axios";
import Spinner from "react-bootstrap/Spinner";
import Alert from "react-bootstrap/Alert";
import { useState, useEffect } from "react";
import "../style/footer.css";
const Footer = () => {
  const [course, setCourses] = useState({
    loading: true,
    results: [],
    err: null,
    reload: 0,
  });

  useEffect(() => {
    setCourses({ ...course, loading: true });
    axios
      .get("http://localhost:4002/courses")
      .then((resp) => {
        setCourses({
          ...course,
          results: resp.data,
          loading: false,
          err: null,
        });
      })
      .catch((err) => {
        setCourses({
          ...course,
          loading: false,
          err: "Error can't load Courses",
        });
      });
  }, [setCourses]);

  const activeCourses = [];
  course.results.map((course) => {
    if (course.status === 1) {
      activeCourses.push(course);
    }
  });

  return (
    <footer>
      <div className="container footer-container">
        <article>
          <Link to={"/"}>
            <img src={Logo} alt="logo" className="logo" />
          </Link>
          <p>
            Teachable is a website that offers an easy-to-use platform for
            instructors to create and sell their courses, and for students to
            access them from anywhere.
          </p>
          <div className="footer-socials">
            <a
              href="https://www.facebook.com/FCIH12"
              target="_blank"
              rel="noreferrer noopener"
            >
              <AiFillFacebook />
            </a>
            <a
              href="https://www.facebook.com/FCIH12"
              target="_blank"
              rel="noreferrer noopener"
            >
              <AiFillTwitterSquare />
            </a>
            <a href="/" target="_blank" rel="noreferrer noopener">
              <AiFillLinkedin />
            </a>
            <a
              href="http://safcai.helwan.edu.eg/index.php/en/"
              target="_blank"
              rel="noreferrer noopener"
            >
              <GiEarthAfricaEurope />
            </a>
          </div>
        </article>
        <article>
          <h3>Explore</h3>
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
          <Link to="/contactUs">Contact</Link>
        </article>
        <article>
          <h3>Courses</h3>
          {activeCourses.slice(0, 4).map((course) => {
            return (
              <Link
                key={course.id}
                to={"/courses/" + course.id + "/" + course.code}
              >
                {course.name.split(" ").slice(0, 2).join(" ") + "..."}
              </Link>
            );
          })}
        </article>
        <article>
          <h3>Get In Touch</h3>
          <Link to="/contactUs">Contact Us</Link>
          <Link to="/Support">Support</Link>
        </article>
      </div>
      <div className="footer-copyRight">
        <small>2023 Teachable &copy; All Copyrights Reserved</small>
      </div>
    </footer>
  );
};

export default Footer;
