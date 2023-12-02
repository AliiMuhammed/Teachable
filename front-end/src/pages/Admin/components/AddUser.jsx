import "../style/dashBoard.css";
import FloatingLabel from "react-bootstrap/FloatingLabel";
import Form from "react-bootstrap/Form";
import { getAuthUser } from "../../../helper/Storage";
import Alert from "react-bootstrap/Alert";
import { useState, useRef } from "react";
import axios from "axios";
const AddUser = () => {
  const admin = getAuthUser();
  const [user, setUser] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    type: "",
    loading: false,
    addErr: [],
    addSuccess: null,
  });
  const image = useRef(null);

  const AddUser = (e) => {
    e.preventDefault();
    setUser({ ...user, loading: true });
    const formData = new FormData();
    formData.append("name", user.name);
    formData.append("email", user.email);
    formData.append("password", user.password);
    formData.append("type", user.type);
    formData.append("phone", user.phone);
    if (image.current.files && image.current.files[0]) {
      formData.append("image", image.current.files[0]);
    }
    axios
      .post("http://localhost:3000/auth/register", formData, {
        headers: {
          token: admin.token,
          "Content-Type": "multipart/form-data",
        },
      })
      .then((resp) => {
        setUser({
          ...user,
          name: "",
          email: "",
          password: "",
          type: "",
          phone: "",
          loading: false,
          addErr: null,
          addSuccess: "User Added Successfully",
        });
        image.current.value = null;
      })
      .catch((err) => {
        setUser({
          ...user,
          loading: false,
          addSuccess: null,
          addErr: err.response.data.errors,
        });
      });
  };

  return (
    <>
      <section className="addUser-section">
        <div className="container addUser-container">
          <h1>Add New User</h1>

          {/* add action handeling */}
          {user.addErr == null && user.addSuccess != null && (
            <Alert variant="success" className="AlertAddCoures">
              {user.addSuccess}
            </Alert>
          )}
          {user.addErr != null && user.addSuccess === null && (
            <>
              {user.addErr.map((error, index) => (
                <Alert key={index} variant="danger" className="AlertAddCoures">
                  {error.msg}
                </Alert>
              ))}
            </>
          )}

          <Form className="AddUser-form " onSubmit={AddUser}>
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
            <FloatingLabel label="Password" className="mb-3 input-addUser">
              <Form.Control
                value={user.password}
                onChange={(e) => setUser({ ...user, password: e.target.value })}
                type="password"
                placeholder="Password"
                required
              />
            </FloatingLabel>

            <Form.Group className="mb-3 input-addUser">
              <Form.Control ref={image} type="file" required />
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
            <Form.Select
              className="mb-3 input-addUser"
              required
              value={user.type}
              onChange={(e) => setUser({ ...user, type: e.target.value })}
            >
              <option defaultChecked>Select Type</option>
              <option>student</option>
              <option>instractor</option>
            </Form.Select>
            <button className="btn sm-btn admin-btn">Add User</button>
          </Form>
        </div>
      </section>
    </>
  );
};

export default AddUser;
