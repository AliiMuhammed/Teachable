import React from "react";
import Spinner from "react-bootstrap/Spinner";
import { useState, useEffect } from "react";
import NewCourses from "../../shared/NewCourses";
import PageHeader from "../../shared/PageHeader";
import { Link } from "react-router-dom";
import axios from "axios";
import "./style/courses.css";

const Courses = () => {
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
        setCourses({ ...course, loading: false, err: "error ya 3rss" });
      });
  }, [setCourses]);

  return (
    <>
      {/* Loader */}

      {course.loading === true && (
        <div className="pageSpinner">
          <Spinner animation="border" role="status" className="spinner">
          <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      )}
      {course.loading === false && (
        <>
          <PageHeader header={"Our Courses"}>
            <ul className="navigate-links">
              <li>
                <Link to={"/"}>Home</Link>
              </li>
              <li>/</li>
              <li>Courses</li>
            </ul>
          </PageHeader>

          <NewCourses coursesArray={course.results} className={"courses-NewCourses"} />
        </>
      )}
    </>
  );
};

export default Courses;
