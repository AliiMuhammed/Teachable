import React from "react";
import CourseCard from "../../../shared/CourseCard";

import "../style/studentProfile.css";

import { useState, useEffect } from "react";
import Spinner from "react-bootstrap/Spinner";
import Alert from "react-bootstrap/Alert";
import { getAuthUser } from "../../../helper/Storage";
import axios from "axios";

const StudentProfile = () => {
  const user = getAuthUser();

  const [registerCourse, setRegisterCourse] = useState({
    loading: false,
    result: [],
    err: null,
  });

  useEffect(() => {
    setRegisterCourse({ ...registerCourse, loading: true });
    axios
      .get("http://localhost:4002/students/showGrades/" + user.id)
      .then((resp) => {
        setRegisterCourse({
          ...registerCourse,
          loading: false,
          result: resp.data,
          err: null,
        });
      })
      .catch((error) => {
        setRegisterCourse({
          ...registerCourse,
          loading: false,
          result: [],
          err: "You haven't registered for any courses.",
        });
      });
  }, []);

  console.log(registerCourse.result);
  const displayCourses = () => {
    return registerCourse.result.map((course, id) => {
      return (
        <CourseCard
          key={id}
          id={course.id}
          title={course.name}
          courseImage={course.image_url}
          durations={course.durations}
          code={course.code}
          grad={course.grades}
          className={"myCourses-card"}
        />
      );
    });
  };

  return (
    <article>
      {/* errors handling */}
      {registerCourse.loading === false && registerCourse.err != null && (
        <div className="alert-container">
          <Alert variant="danger" className="alret">
            {registerCourse.err}
          </Alert>
        </div>
      )}
      <div className="container myCourses-container">
        {/* Loader */}
        {registerCourse.loading === true && (
          <div className="pageSpinner">
            <Spinner animation="border" role="status" className="spinner">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
          </div>
        )}
        {/* displayCourses */}
        {registerCourse.loading === false &&
          registerCourse.err === null &&
          displayCourses()}
      </div>
    </article>
  );
};

export default StudentProfile;
