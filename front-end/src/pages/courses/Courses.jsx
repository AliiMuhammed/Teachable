import React from "react";
import Spinner from "react-bootstrap/Spinner";
import { useState, useEffect } from "react";
import CoursesSection_V from "../../shared/CoursesSection_V";
import PageHeader from "../../shared/PageHeader";
import CourseCard from "../../shared/CourseCard";
import { Link } from "react-router-dom";
import axios from "axios";
import "./style/courses.css";
import NotAvailable from "../../shared/NotAvailable";
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
        setCourses({ ...course, loading: false, err: "error" });
      });
  }, [setCourses]);

  const displayCourses = () => {
    return (
      <CoursesSection_V
        className={"courses-NewCourses"}
        sectionTilte="Discover New Opportunities for Learning and Growth with Our Latest Courses!"
        smSectionTitle="NEW COURSES"
        sectionDes="We are excited to offer a range of new courses that cater to various interests and skill levels."
      >
        {course.results.map((course) => {
          return (
            <CourseCard
              key={course.id}
              title={course.name}
              code={course.code}
              courseImage={course.image_url}
              durations={course.durations}
              description={course.description}
              className={"v-card"}
            />
          );
        })}
      </CoursesSection_V>
    );
  };
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
          {course.results.length!=0?displayCourses():<NotAvailable title={"Courses"}/>}
        </>
      )}
    </>
  );
};

export default Courses;
