import "../../style/dashBoard.css";
import FloatingLabel from "react-bootstrap/FloatingLabel";
import Form from "react-bootstrap/Form";
import { getAuthUser } from "../../../../helper/Storage";
import Alert from "react-bootstrap/Alert";
import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

const UpdateInstructor = () => {
  let { id } = useParams();
  const image = useRef(null);
  const admin = getAuthUser();
  const [user, setUser] = useState({
    name: "",
    email: "",
    phone: "",
    image_url: null,
    loading: false,
    err: null,
    success: null,
    reload: 0,
  });

  const UpdateInstructor = (e) => {
    e.preventDefault();
    setUser({ ...user, loading: true });
    const formData = new FormData();
    formData.append("name", user.name);
    formData.append("email", user.email);
    formData.append("phone", user.phone);
    if (image.current.files && image.current.files[0]) {
      formData.append("image", image.current.files[0]);
    }
    axios
      .put("http://localhost:4002/instractors/" + id, formData, {
        headers: {
          token: admin.token,
          "Content-Type": "multipart/form-data",
        },
      })
      .then((resp) => {
        setUser({
          ...user,
          success: "Instructor Updated Successfully !",
          loading: false,
          reload:user.reload+1
        });
      })
      .catch((err) => {
        setUser({
          ...user,
          loading: false,
          success: null,
          err: err.response.data.errors,
        });
      });
  };
  useEffect(() => {
    axios
      .get("http://localhost:4002/instractors/" + id)
      .then((resp) => {
        setUser({
          ...user,
          name: resp.data.name,
          email: resp.data.email,
          image_url: resp.data.image_url,
          phone: resp.data.phone,
        });
      })
      .catch((error) => {
        setUser({
          ...user,
          loading: false,
          success: null,
          err: error.response.data.errors,
        });
      });
  }, [user.reload]);

  console.log(user.err);

  return (
    <>
      <section className="addUser-section">
        <div className="container addUser-container">
          <h1>Update Instructor</h1>

          {/* add action handeling */}
          {user.err == null && user.success != null && (
            <Alert variant="success" className="AlertAddCoures">
              {user.success}
            </Alert>
          )}
          {user.err != null && user.success === null && (
            <>
              {user.err.map((error, index) => (
                <Alert key={index} variant="danger" className="AlertAddCoures">
                  {error.msg}
                </Alert>
              ))}
            </>
          )}

          <Form className="AddUser-form " onSubmit={UpdateInstructor}>
            <img src={user.image_url} className="imgCourse-update" alt="" />
            <FloatingLabel label="User Name" className="mb-3 input-addUser">
              <Form.Control
                value={user.name}
                onChange={(e) => setUser({ ...user, name: e.target.value })}
                type="text"
                placeholder="User Name"
                required
              />
            </FloatingLabel>
            <FloatingLabel label="Email" className="mb-3 input-addUser">
              <Form.Control
                value={user.email}
                onChange={(e) => setUser({ ...user, email: e.target.value })}
                type="email"
                placeholder="Email"
                required
              />
            </FloatingLabel>

            <Form.Group className="mb-3 input-addUser">
              <Form.Control ref={image} type="file" />
              <Form.Text className="text-muted">
                Upload user image in .png, or .jpg.
              </Form.Text>
            </Form.Group>
            <FloatingLabel label="Phone" className="mb-3 input-addUser">
              <Form.Control
                value={user.phone}
                onChange={(e) => setUser({ ...user, phone: e.target.value })}
                type="text"
                placeholder="Coures Phone"
                required
              />
            </FloatingLabel>
            <button className="btn sm-btn admin-btn">Update Instructor</button>
          </Form>
        </div>
      </section>
    </>
  );
};

export default UpdateInstructor;
