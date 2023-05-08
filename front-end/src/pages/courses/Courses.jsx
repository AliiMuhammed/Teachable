import React from "react";
import Spinner from "react-bootstrap/Spinner";
import Alert from "react-bootstrap/Alert";
import Form from "react-bootstrap/Form";
import { ImSearch } from "react-icons/im";
import { useState, useEffect } from "react";
import CoursesSection_V from "../../shared/CoursesSection_V";
import PageHeader from "../../shared/PageHeader";
import CourseCard from "../../shared/CourseCard";
import { Link } from "react-router-dom";
import axios from "axios";
import "./style/courses.css";

const Courses = () => {
  const [search, setSearch] = useState("");

  const [course, setCourses] = useState({
    loading: true,
    results: [],
    err: null,
    reload: 0,
  });

  useEffect(() => {
    setCourses({ ...course, loading: true });
    axios
      .get("http://localhost:4002/courses", {
        params: {
          search: search,
        },
      })
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
  }, [course.reload]);

  const handleButtonClick = () => {
    window.location.reload();
  };
  const displayCourses = () => {
    return (
      <>
        <CoursesSection_V
          className={"courses-NewCourses"}
          sectionTilte="Discover New Opportunities for Learning and Growth with Our Latest Courses!"
          smSectionTitle="NEW COURSES"
          sectionDes="We are excited to offer a range of new courses that cater to various interests and skill levels."
        >
          {course.results.map((course) => {
            if (course.status === 1) {
              return (
                <CourseCard
                  key={course.id}
                  id={course.id}
                  title={course.name}
                  code={course.code}
                  courseImage={course.image_url}
                  durations={course.durations}
                  description={course.description}
                  className={"v-card"}
                />
              );
            }
          })}
        </CoursesSection_V>
        <div className="allCourses-btn">
          <button className="btn all-courses" onClick={handleButtonClick}>
            All Courses
          </button>
        </div>
      </>
    );
  };

  const searchCourses = (e) => {
    e.preventDefault();
    setCourses({
      ...course,
      reload: course.reload + 1,
    });
  };
  return (
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
      {/* filter */}
      <Form className="filter-search " onSubmit={searchCourses}>
        <Form.Group className="mb-3 " />
        <Form.Control
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          required
          placeholder="Search Course..."
        />
        <button className="btn search-btn ">
          <ImSearch />
        </button>
      </Form>

      {/* Loader */}
      {course.loading === true && (
        <div className="pageSpinner">
          <Spinner animation="border" role="status" className="spinner">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      )}

      {/* displayCourses */}
      {course.loading === false &&
        course.err === null &&
        course.results.length != 0 && <>{displayCourses()}</>}

      {/* errors handling */}
      {course.loading === false && course.err != null && (
        <div className="alert-container container">
          <Alert variant="danger" className="alret">
            {course.err}
          </Alert>
        </div>
      )}

      {course.loading === false &&
        course.err == null &&
        course.results.length === 0 && (
          <div className="alert-container container">
            <Alert variant="success" className="alret">
              There is no Course in this name "{search}"
            </Alert>
            <div className="allCourses-btn">
              <button className="btn all-courses" onClick={handleButtonClick}>
                All Courses
              </button>
            </div>
          </div>
        )}
    </>
  );
};

export default Courses;
