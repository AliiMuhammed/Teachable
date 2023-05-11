import "../style/studentEnrolled.css";
import CouresDetails from "../../couresDetails/CouresDetails";
import { useParams } from "react-router";
import Spinner from "react-bootstrap/Spinner";
import Alert from "react-bootstrap/Alert";
import { useState, useEffect } from "react";
import axios from "axios";
import Table from "react-bootstrap/Table";
import { getAuthUser } from "../../../helper/Storage";
import { Link } from "react-router-dom";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
const StudentsEnrolled = () => {
  const [selectedStudent, setSelectedStudent] = useState({
    name: "",
    img: null,
    id: null,
    grade: null,
    show: false,
  });
  const [grades, setGrade] = useState({
    grade: 0,
    loading: false,
    reload: 0,
    err: null,
    succsse: null,
  });
  const [student, setstudents] = useState({
    loading: true,
    results: [],
    err: null,
    reload: 0,
  });

  let { id } = useParams();
  let { code } = useParams();
  const auth = getAuthUser();

  const handleClose = () => {
    setSelectedStudent({ show: false });
    setGrade({...grades,succsse:null ,err:null})
  };

  useEffect(() => {
    setstudents({ ...student, loading: true });
    axios
      .get("http://localhost:4002/instractors/student/" + id)
      .then((resp) => {
        setstudents({
          ...student,
          results: resp.data,
          loading: false,
          err: null,
        });
      })
      .catch((err) => {
        setstudents({
          ...student,
          loading: false,
          err: "Error can't load students",
        });
      });
  }, [grades.reload]);

  const UpdateGrade = (e) => {
    console.log(grades.grade);
    e.preventDefault();
    setGrade({ ...grades, loading: true });
    const formData = new FormData();
    formData.append("grades", grades.grade);

    axios
      .post(
        "http://localhost:4002/instractors/setGrades/" +
          selectedStudent.id +
          "/" +
          id,
        formData,
        {
          headers: {
            token: auth.token,
            "Content-Type": "multipart/form-data",
          },
        }
      )
      .then((resp) => {
        setGrade({
          ...grades,
          err: null,
          succsse: "Grade set succssefully !",
          reload: grades.reload + 1,
        });
      })
      .catch((error) => {
        setGrade({ ...grades, loading: false, err: "Someting went wrong!" });
      });
  };

  const displaystudents = () => {
    return (
      <>
        <div className="studentTable">
          <Table bordered striped hover>
            <thead>
              <tr>
                <th>Id</th>
                <th>Name</th>
                <th>Email</th>
                <th>Grades</th>
                <th>Image</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {student.results.map((student) => { 
                return (
                  <tr key={student.id}>
                    <td>{student.id}</td>
                    <td>{student.name}</td>
                    <td>{student.email}</td>
                    <td>{student.grades}</td>
                    <td className="table-img">
                      <img src={student.image_url} alt="" />
                    </td>
                    <td>
                      <div className="table-btns">
                        <button
                          className="btn btn-sm  setGrade-btn"
                          onClick={() =>
                            setSelectedStudent({
                              ...selectedStudent,
                              name: student.name,
                              id: student.id,
                              img: student.image_url,
                              grade: student.grades,
                              show: true,
                            })
                          }
                        >
                          Set Grade
                        </button>
                      </div>

                      <Modal
                        show={selectedStudent.show}
                        onHide={handleClose}
                        backdrop="static"
                        centered
                        keyboard={false}
                      >
                        <Modal.Header closeButton>
                          <Modal.Title>Modal title</Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                          {grades.err === null && grades.succsse !== null && (
                            <Alert variant="success">{grades.succsse}</Alert>
                          )}

                          {grades.err !== null && grades.succsse === null && (
                            <Alert variant="danger">{grades.err}</Alert>
                          )}
                          <div className="studentImg">
                            <img src={selectedStudent.img} alt="" />
                          </div>

                          <Form className="setGrade-form">
                            <fieldset disabled className="mb-3 grades-input">
                              <Form.Group>
                                <Form.Label>Student garde</Form.Label>
                                <Form.Control
                                  type="text"
                                  value={selectedStudent.grade}
                                />
                              </Form.Group>
                            </fieldset>

                            <Form.Group className="mb-3 grades-input">
                              <Form.Label>new grade</Form.Label>
                              <Form.Control
                                type="text"
                                placeholder="Set his new grade"
                                onChange={(e) =>
                                  setGrade({
                                    ...grades,
                                    grade: e.target.value,
                                  })
                                }
                              />
                            </Form.Group>
                          </Form>
                        </Modal.Body>
                        <Modal.Footer>
                          <button
                            className="btn-delete btn close-btn"
                            onClick={handleClose}
                          >
                            Close
                          </button>
                          <button
                            className="btn setGrade-btn"
                            onClick={UpdateGrade}
                          >
                            set Grade
                          </button>
                        </Modal.Footer>
                      </Modal>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      </>
    );
  };

  return (
    <>
      <CouresDetails />
      <section>
        <div className="container enrolledTable-container">
          {/* Loader */}
          {student.loading === true && (
            <div className="pageSpinner">
              <Spinner animation="border" role="status" className="spinner">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
            </div>
          )}
          {/* displaystudents */}
          {student.loading === false &&
            student.err === null &&
            student.results.length != 0 && <>{displaystudents()}</>}

          {/* no students handling */}
          {student.loading === false && student.results.length === 0 && (
            <div className="alert-container container">
              <Alert variant="info" className="alret">
                No Enrolled Students in this Course.
              </Alert>
            </div>
          )}
          {/* errors handling */}
          {student.loading === false && student.err != null && (
            <div className="alert-container container">
              <Alert variant="danger" className="alret">
                {student.err}
              </Alert>
            </div>
          )}
        </div>
      </section>
    </>
  );
};

export default StudentsEnrolled;
