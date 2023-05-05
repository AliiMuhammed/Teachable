import React from "react";
import "./style/couresDetails.css";
import { useParams } from "react-router";
import { SlNotebook } from "react-icons/sl";
import { useState, useEffect } from "react";
import Spinner from "react-bootstrap/Spinner";
import Alert from "react-bootstrap/Alert";

import axios from "axios";
const CouresDetails = () => {
  let { id } = useParams();
  let { code } = useParams();

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
                <span>
                  Course Code:<strong>{course.result.code}</strong>
                </span>
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
