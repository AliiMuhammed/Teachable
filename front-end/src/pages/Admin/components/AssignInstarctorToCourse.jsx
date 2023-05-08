import "../style/assgin.css";
import { getAuthUser } from "../../../helper/Storage";
import Form from "react-bootstrap/Form";
import Alert from "react-bootstrap/Alert";
import { useState, useRef, useEffect } from "react";
import axios from "axios";
const AssignInstarctorToCourse = () => {
  const admin = getAuthUser();
  const [instractor, setInstractor] = useState({
    id: null,
    loading: false,
    results: [],
    err: [],
    success: [],
  });

  const [course, setCourse] = useState({
    id: null,
    loading: false,
    results: [],
    err: [],
    success: [],
  });

  useEffect(() => {
    setInstractor({ ...instractor, loading: true });
    axios
      .get("http://localhost:4002/instractors")
      .then((resp) => {
        setInstractor({
          ...instractor,
          results: resp.data,
          loading: false,
          err: [],
        });
      })
      .catch((err) => {
        setInstractor({
          ...instractor,
          loading: false,
          err: "Error can't load instractors",
        });
      });
  }, []);

  useEffect(() => {
    setCourse({ ...course, loading: true });
    axios
      .get("http://localhost:4002/courses")
      .then((resp) => {
        setCourse({
          ...course,
          results: resp.data,
          loading: false,
          err: [],
        });
      })
      .catch((err) => {
        setCourse({
          ...course,
          loading: false,
          err: "Error can't load Courses",
        });
      });
  }, []);

  const activeCourses = [];
  course.results.map((course) => {
    if (course.status === 1) {
      activeCourses.push(course);
    }
  });

  const Assgin = (e) => {
    e.preventDefault();
    setCourse({ ...course, loading: true });
    setInstractor({ ...instractor, loading: true });
    const formData = new FormData();
    formData.append("course_id", course.id);
    formData.append("instractor_id", instractor.id);
    axios
      .post("http://localhost:4002/courses/assign", formData, {
        headers: {
          token: admin.token,
          "Content-Type": "multipart/form-data",
        },
      })
      .then((resp) => {
        setCourse({
          ...course,
          id: "",
          loading: false,
          err: [],
          success: "Instractor Assigned Successfully",
        });
        setInstractor({
          ...instractor,
          id: "",
          loading: false,
          err: [],
        });
      })
      .catch((err) => {
        setCourse({
          ...course,
          loading: false,
          success: [],
          err: err.response.data.errors,
        });
        setInstractor({
          ...instractor,
          loading: false,
          success: [],
          err: err.response.data.errors,
        });
      });
  };

  console.log(course.err === null);

  return (
    <>
      <section className="assign-section">
        <div className="container assgin-container">
          <h1>Assgin instractors to courses</h1>

          {/* add action handeling */}
          {course.err.length === 0 &&
            instractor.err.length === 0 &&
            course.success.length !== 0 && (
              <Alert variant="success" className="AlertAssign">
                {course.success}
              </Alert>
            )}
          {course.err.length !== 0 &&
            instractor.err.length !== 0 &&
            course.success.length === 0 && (
              <>
                {instractor.err.map((error, index) => (
                  <Alert key={index} variant="danger" className="AlertAssign">
                    {error.msg}
                  </Alert>
                ))}
              </>
            )}

          <Form className="assign-form" onSubmit={Assgin}>
            <Form.Label className="mb-2">Instractors</Form.Label>

            <Form.Select
              className="mb-3"
              onChange={(e) =>
                setInstractor({ ...instractor, id: parseInt(e.target.value) })
              }
            >
              <option defaultChecked>Select Instractor</option>
              {instractor.results.map((Instractor) => {
                return (
                  <option key={Instractor.id} value={Instractor.id}>
                    {Instractor.name}
                  </option>
                );
              })}
            </Form.Select>
            <Form.Label className="mb-2 ">Courses</Form.Label>
            <Form.Select
              className="mb-3"
              onChange={(e) =>
                setCourse({ ...course, id: parseInt(e.target.value) })
              }
            >
              <option>Select Course</option>
              {activeCourses.map((activeCourses) => {
                return (
                  <option key={activeCourses.id} value={activeCourses.id}>
                    {activeCourses.name}
                  </option>
                );
              })}
            </Form.Select>
            <button className="btn sm-btn admin-btn">Assign</button>
          </Form>
        </div>
      </section>
    </>
  );
};

export default AssignInstarctorToCourse;
