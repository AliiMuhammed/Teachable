import "../../style/courses.css";
import FloatingLabel from "react-bootstrap/FloatingLabel";
import Form from "react-bootstrap/Form";
import { getAuthUser } from "../../../../helper/Storage";
import Alert from "react-bootstrap/Alert";
import { useState, useRef } from "react";
import axios from "axios";

const AddCourses = () => {
  const admin = getAuthUser();
  const [course, setCourse] = useState({
    name: "",
    code: 0,
    status: 0,
    durations: 0,
    description: "",
    loading: false,
    addErr: null,
    addSuccess: null,
  });

  const image = useRef(null);

  const AddCoures = (e) => {
    e.preventDefault();
    setCourse({ ...course, loading: true });
    const formData = new FormData();
    formData.append("name", course.name);
    formData.append("description", course.description);
    formData.append("durations", course.durations);
    formData.append("status", course.status);
    formData.append("code", course.code);
    if (image.current.files && image.current.files[0]) {
      formData.append("image", image.current.files[0]);
    }
    axios
      .post("http://localhost:4002/courses", formData, {
        headers: {
          token: admin.token,
          "Content-Type": "multipart/form-data",
        },
      })
      .then((resp) => {
        setCourse({
          ...course,
          name: "",
          code: 0,
          status: 0,
          durations: 0,
          description: "",
          loading: false,
          addErr: null,
          addSuccess: "Course Added Successfully",
        });
        image.current.value = null;
      })
      .catch((err) => {
        setCourse({
          ...course,
          loading: false,
          addSuccess: null,
          addErr: "Something went wrong, please try again later ! ",
        });
      });
  };
  return (
    <>
      <section className="addCourse-section">
        <div className="container addCourse-container">
          <h1>Add New Course</h1>

          {/* add action handeling */}
          {course.addErr == null && course.addSuccess != null && (
            <Alert variant="success" className="AlertAddCoures">
              {course.addSuccess}
            </Alert>
          )}
          {course.addErr != null && course.addSuccess === null && (
            <Alert variant="danger" className="AlertAddCoures">
              {course.addErr}
            </Alert>
          )}

          <Form className="AddCourse-form " onSubmit={AddCoures}>
            <FloatingLabel label="Course Name" className="mb-3 input-addCourse">
              <Form.Control
                value={course.name}
                onChange={(e) => setCourse({ ...course, name: e.target.value })}
                type="text"
                placeholder="Coures Name"
                required
              />
            </FloatingLabel>
            <FloatingLabel label="Course Code" className="mb-3 input-addCourse">
              <Form.Control
                value={course.code}
                onChange={(e) => setCourse({ ...course, code: e.target.value })}
                type="text"
                placeholder="Coures Code"
                required
              />
            </FloatingLabel>
            <FloatingLabel
              label="Course Status"
              className="mb-3 input-addCourse"
            >
              <Form.Control
                value={course.status}
                onChange={(e) =>
                  setCourse({ ...course, status: e.target.value })
                }
                type="text"
                placeholder="Coures Status"
                required
              />
            </FloatingLabel>

            <Form.Group className="mb-3 input-addCourse">
              <Form.Control ref={image} type="file" required />
              <Form.Text className="text-muted">
                Upload course image in .png, or .jpg.
              </Form.Text>
            </Form.Group>
            <FloatingLabel
              label="Course Durations"
              className="mb-3 input-addCourse"
            >
              <Form.Control
                value={course.durations}
                onChange={(e) =>
                  setCourse({ ...course, durations: e.target.value })
                }
                type="text"
                placeholder="Coures Durations"
                required
              />
            </FloatingLabel>
            <FloatingLabel
              label="Course Description"
              className="mb-3 input-addCourse"
            >
              <Form.Control
                as="textarea"
                style={{ height: "100px" }}
                placeholder="Course Description"
                required
                value={course.description}
                onChange={(e) =>
                  setCourse({ ...course, description: e.target.value })
                }
              />
            </FloatingLabel>
            <button className="btn sm-btn admin-btn">Add Course</button>
          </Form>
        </div>
      </section>
    </>
  );
};

export default AddCourses;
