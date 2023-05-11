import FloatingLabel from "react-bootstrap/FloatingLabel";
import Form from "react-bootstrap/Form";
import Alert from "react-bootstrap/Alert";
import axios from "axios";
import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { getAuthUser } from "../../../../helper/Storage";

const UpdateCoures = () => {
  let { id } = useParams();
  let { code } = useParams();
  const image = useRef(null);
  const admin = getAuthUser();
  const [course, setCourse] = useState({
    name: "",
    code: 0,
    status: 0,
    durations: 0,
    image_url: null,
    description: "",
    loading: false,
    err: null,
    success: null,
    reload: 0,
  });

  const UpdateCourse = (e) => {
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
      .put("http://localhost:4002/courses/" + id + "/" + code, formData, {
        headers: {
          token: admin.token,
          "Content-Type": "multipart/form-data",
        },
      })
      .then((resp) => {
        setCourse({
          ...course,
          success: "Course Updated Successfully !",
          loading: false,
          reload: course.reload + 1,
        });
      })
      .catch((err) => {
        setCourse({
          ...course,
          loading: false,
          success: null,
          err: "Something went wrong, please try again later ! ",
          
        });
      });
  };

  useEffect(() => {
    axios
      .get("http://localhost:4002/courses/" + id + "/" + code)
      .then((resp) => {
        setCourse({
          ...course,
          name: resp.data.name,
          description: resp.data.description,
          code: resp.data.code,
          image_url: resp.data.image_url,
          durations: resp.data.durations,
          status: resp.data.status,
        });
      })
      .catch((err) => {
        setCourse({
          ...course,
          loading: false,
          success: null,
          err: "Something went wrong, please try again later ! ",
        });
      });
  }, [course.reload]);

  return (
    <>
      <section className="addCourse-section">
        <div className="container addCourse-container">
          <h1>Update Course</h1>

          {/* add action handeling */}
          {course.err == null && course.success != null && (
            <Alert variant="success" className="AlertAddCoures">
              {course.success}
            </Alert>
          )}
          {course.err != null && course.success === null && (
            <Alert variant="danger" className="AlertAddCoures">
              {course.err}
            </Alert>
          )}

          <Form className="AddCourse-form " onSubmit={UpdateCourse}>
            <img src={course.image_url} className="imgCourse-update" alt="" />
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
              <Form.Control ref={image} type="file" />
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
            <button className="btn sm-btn admin-btn">Update Course</button>
          </Form>
        </div>
      </section>
    </>
  );
};

export default UpdateCoures;
