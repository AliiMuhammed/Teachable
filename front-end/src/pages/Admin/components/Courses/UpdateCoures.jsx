import FloatingLabel from "react-bootstrap/FloatingLabel";
import Form from "react-bootstrap/Form";
import Alert from "react-bootstrap/Alert";

const UpdateCoures = () => {
  return (
    <>
      <section className="addCourse-section">
        <div className="container addCourse-container">
          <h1>Update Course</h1>

          <Alert variant="danger" className="AlertAddCoures">
            This is a alert—check it out!
          </Alert>
          <Alert variant="success" className="AlertAddCoures">
            This is a alert—check it out!
          </Alert>
          <Form className="AddCourse-form ">
            <FloatingLabel label="Course Name" className="mb-3 input-addCourse">
              <Form.Control type="text" placeholder="Coures Name" required />
            </FloatingLabel>
            <FloatingLabel label="Course Code" className="mb-3 input-addCourse">
              <Form.Control type="text" placeholder="Coures Code" required />
            </FloatingLabel>
            <FloatingLabel
              label="Course Status"
              className="mb-3 input-addCourse"
            >
              <Form.Control type="text" placeholder="Coures Status" required />
            </FloatingLabel>

            <Form.Group className="mb-3 input-addCourse">
              <Form.Control type="file" required />
              <Form.Text className="text-muted">
                Upload course image in .png, or .jpg.
              </Form.Text>
            </Form.Group>
            <FloatingLabel
              label="Course Durations"
              className="mb-3 input-addCourse"
            >
              <Form.Control
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
