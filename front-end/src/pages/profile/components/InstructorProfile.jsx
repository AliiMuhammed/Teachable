import "../style/instructorProfile.css";
import Table from "react-bootstrap/Table";
import { Link } from "react-router-dom";
import React, { useState, useEffect } from "react";
import axios from "axios";
import { getAuthUser } from "../../../helper/Storage";
import Spinner from "react-bootstrap/Spinner";

import Alert from "react-bootstrap/Alert";

const key = "Compact Table";

const InstructorProfile = () => {
  //   const [grades, setGrades] = useState({
  //     loading: true,
  //     results: [],
  //     err: null,
  //     reload: 0
  // })

  // useEffect(() => {
  //   setGrades({...grades, loading: true})
  //   axios.get("http://localhost:4002/students/18")
  //   .then((resp) =>  {
  //     console.log(resp);
  //     setGrades({...grades, results: resp.data, loading: false, err: null})
  //   })
  //   .catch((err) => {
  //     setGrades({...grades, loading: false, err:"Something failed"})

  //   });
  // }, [])
  const user = getAuthUser();

  const [course, setCourses] = useState({
    loading: true,
    results: [],
    id: null,
    err: null,
    err: null,
    reload: 0,
  });

  useEffect(() => {
    setCourses({ ...course, loading: true });
    axios
      .get("http://localhost:4002/instractors/view/" + user.id)
      .then((resp) => {
        setCourses({
          ...course,
          results: resp.data,
          loading: false,
          err: null,
        });
      })
      .catch((errors) => {
        setCourses({
          ...course,
          loading: false,
          err: errors.response.data.errors,
        });
      });
  }, []);

  const displayCourses = () => {
    return (
      <div className="container table-container">
        <div className="instructor-table">
          <Table bordered striped hover>
            <thead>
              <tr>
                <th>Id</th>
                <th>Name</th>
                <th>Description</th>
                <th>Durations</th>
                <th>Code</th>
                <th>Image</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {course.results.map((course) => {
                return (
                  <tr key={course.id}>
                    <td>{course.id}</td>
                    <td>{course.name}</td>
                    <td>{course.description}</td>
                    <td>{course.code}</td>
                    <td>{course.durations}</td>
                    <td className="table-img">
                      <img src={course.image_url} alt="" />
                    </td>
                    <td>
                      <div className="table-btns">
                        <Link
                          to={
                            "/profile/instractor/studentEnrolled/" + course.id+"/"+course.code
                          }
                          className="btn btn-sm instructorShow-btn"
                        >
                          Show
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          {course.results.length === 0 && (
            <Alert variant="info">
              You haven't been assigned to any courses.
            </Alert>
          )}
        </div>
      </div>
    );
  };

  return (
    <article className="gradeTable">
      <h2>Assigned Courses</h2>
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
    </article>
  );
};

export default InstructorProfile;
