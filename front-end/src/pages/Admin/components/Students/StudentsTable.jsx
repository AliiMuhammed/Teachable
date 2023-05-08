import SectionHeader from "../../../../shared/SectionHeader";
import "../../style/students.css";
import Table from "react-bootstrap/Table";
import { getAuthUser } from "../../../../helper/Storage";
import { Link } from "react-router-dom";
import { AiOutlinePlusSquare } from "react-icons/ai";
import Spinner from "react-bootstrap/Spinner";
import Alert from "react-bootstrap/Alert";
import { useState, useEffect } from "react";
import axios from "axios";

const StudentsTable = () => {
  const admin = getAuthUser();
  const [student, setstudents] = useState({
    loading: true,
    results: [],
    err: null,
    delErr: null,
    delSuccess: null,
    reload: 0,
  });

  useEffect(() => {
    setstudents({ ...student, loading: true });
    axios
      .get("http://localhost:4002/students")
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
  }, [student.reload]);

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
                <th>Phone</th>
                <th>Status</th>
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
                    <td>{student.phone}</td>
                    <td>{student.status}</td>
                    <td className="table-img">
                      <img src={student.image_url} alt="" />
                    </td>
                    <td>
                      <div className="table-btns">
                        <button
                          to={"delete"}
                          className="btn btn-sm btn-delete"
                          onClick={(e) => {
                            deletestudent(student.id);
                          }}
                        >
                          Delete
                        </button>
                        <Link
                          to={"update/" + student.id}
                          className="btn btn-sm btn-Update"
                        >
                          Update
                        </Link>
                      </div>
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
  const deletestudent = (id) => {
    axios
      .delete("http://localhost:4002/students/delete/" + id, {
        headers: {
          token: admin.token,
        },
      })
      .then((resp) => {
        setstudents({
          ...student,
          reload: student.reload + 1,
          delSuccess: "Student deleted Successfully",
        });
      })
      .catch((err) => {
        setstudents({
          ...student,
          loading: false,
          delErr: "Error can't Delete Student",
        });
      });
  };

  return (
    <>
      <section className="students-dataSection">
        <SectionHeader
          title={"Students Section"}
          smTilte={`Hi ${admin.name}`}
          description={"Here you can add, update, and delete students"}
          className={"adminstudent-header"}
        />
        <div className="container students-table-container">
          {/* delete action handeling */}
          {student.loading === false &&
            student.delErr === null &&
            student.delSuccess != null && (
              <Alert variant="success" className="AlertAddCoures">
                {student.delSuccess}
              </Alert>
            )}
          {student.loading === false &&
            student.delErr != null &&
            student.delSuccess === null && (
              <Alert variant="danger" className="AlertAddCoures">
                {student.delErr}
              </Alert>
            )}

          {/* Loader */}
          {student.loading === true && (
            <div className="pageSpinner">
              <Spinner animation="border" role="status" className="spinner">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
            </div>
          )}
          <div className="table-header">
            <h3>All students</h3>
            <Link to={"add"} className="btn sm-btn Add-btn">
              Add student <AiOutlinePlusSquare />
            </Link>
          </div>
          {/* displaystudents */}
          {student.loading === false &&
            student.err === null &&
            student.results.length != 0 && <>{displaystudents()}</>}

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

export default StudentsTable;
