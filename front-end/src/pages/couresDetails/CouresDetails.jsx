import React from "react";
import "./style/couresDetails.css";
import { useParams } from "react-router";
import { SlNotebook } from "react-icons/sl";
import { useState, useEffect } from "react";
import Spinner from "react-bootstrap/Spinner";
import Alert from "react-bootstrap/Alert";
import { getAuthUser } from "../../helper/Storage";
import axios from "axios";
const CouresDetails = () => {
  let { id } = useParams();
  let { code } = useParams();
  const auth = getAuthUser();
  const [course, setCourse] = useState({
    loading: true,
    result: null,
    err: null,
  });

  useEffect(() => {
    setCourse({ ...course, loading: true });
    axios
      .get("http://localhost:4002/courses/" + id + "/" + code)
      .then((resp) => {
        setCourse({
          ...course,
          loading: false,
          result: resp.data,
          err: null,
        });
      })
      .catch((err) => {
        setCourse({
          ...course,
          loading: false,
          err: "Error can't load Course",
        });
      });
  }, []);

  const [registerCourse, setRegisterCourse] = useState({
    loading: false,
    success: null,
    err: null,
  });

  const RegisterCoures = (e) => {
    e.preventDefault();
    setRegisterCourse({ ...registerCourse, loading: true });
    axios
      .post(
        "http://localhost:4002/students/registerCourses/" + auth.id + "/" + id
      )
      .then((resp) => {
        setRegisterCourse({
          ...registerCourse,
          loading: false,
          success: "Course Registered Successfully",
          err: null,
        });
      })
      .catch((error) => {
        setRegisterCourse({
          ...registerCourse,
          loading: false,
          err: error.response.data.errors,
        });
      });
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

      {/* displayCourse */}
      {course.loading === false && course.err === null && (
        <>
          <section className="details-section">
            {registerCourse.err !== null &&
              registerCourse.err.map((error, index) => {
                return (
                  <Alert key={index} variant="danger" className="registerAlert">
                    {error.msg}
                  </Alert>
                );
              })}
            {registerCourse.err === null &&
              registerCourse.success !==
                null&&(
                  <Alert variant="success" className="registerAlert">
                    {registerCourse.success}
                  </Alert>
                )}
            <div className="container course-details_container">
              <div className="course-img">
                <img src={course.result.image_url} alt={course.result.name} />
              </div>
              <div className="course-metaData">
                <h1>{course.result.name}</h1>
                <p>{course.result.description}</p>
                <h5>
                  <SlNotebook />
                  {course.result.durations} lecture
                </h5>
                <div className="btn-container">
                  <span>
                    Course Code:<strong>{course.result.code}</strong>
                  </span>
                  {/* Authenticated Routes */}
                  {auth && auth.type === "student" && (
                    <button
                      className="btn register-btn"
                      onClick={RegisterCoures}
                    >
                      Register course
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* errors handling */}
      {course.loading === false && course.err != null && (
        <div className="alert-container container course-details_alert">
          <Alert variant="danger" className="alret">
            {course.err}
          </Alert>
        </div>
      )}
    </>
  );
};

export default CouresDetails;
