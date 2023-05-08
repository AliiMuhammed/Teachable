import SectionHeader from "../../../../shared/SectionHeader";
import "../../style/instructors.css";
import Table from "react-bootstrap/Table";
import { getAuthUser } from "../../../../helper/Storage";
import { Link } from "react-router-dom";
import { AiOutlinePlusSquare } from "react-icons/ai";
import Spinner from "react-bootstrap/Spinner";
import Alert from "react-bootstrap/Alert";
import { useState, useEffect } from "react";
import axios from "axios";

const InstructorTable = () => {
  const admin = getAuthUser();
  const [instructor, setinstructors] = useState({
    loading: true,
    results: [],
    err: null,
    delErr: null,
    delSuccess: null,
    reload: 0,
  });

  useEffect(() => {
    setinstructors({ ...instructor, loading: true });
    axios
      .get("http://localhost:4002/instractors")
      .then((resp) => {
        setinstructors({
          ...instructor,
          results: resp.data,
          loading: false,
          err: null,
        });
      })
      .catch((err) => {
        setinstructors({
          ...instructor,
          loading: false,
          err: "Error can't load instructors",
        });
      });
  }, [instructor.reload]);

  const displayinstructors = () => {
    return (
      <>
        <div className="instructorTable">
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
              {instructor.results.map((instructor) => {
                return (
                  <tr key={instructor.id}>
                    <td>{instructor.id}</td>
                    <td>{instructor.name}</td>
                    <td>{instructor.email}</td>
                    <td>{instructor.phone}</td>
                    <td>{instructor.status}</td>
                    <td className="table-img">
                      <img src={instructor.image_url} alt="" />
                    </td>
                    <td>
                      <div className="table-btns">
                        <button
                          to={"delete"}
                          className="btn btn-sm btn-delete"
                          onClick={(e) => {
                            deleteinstructor(instructor.id);
                          }}
                        >
                          Delete
                        </button>
                        <Link
                          to={"update/" + instructor.id}
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
          <Link
            to={"/admin/instructors/assgin"}
            className="btn sm-btn assgin-btn"
          >
            Assgin to courses
          </Link>
        </div>
      </>
    );
  };
  const deleteinstructor = (id) => {
    axios
      .delete("http://localhost:4002/instractors/" + id, {
        headers: {
          token: admin.token,
        },
      })
      .then((resp) => {
        setinstructors({
          ...instructor,
          reload: instructor.reload + 1,
          delSuccess: "instructor deleted Successfully",
        });
      })
      .catch((err) => {
        setinstructors({
          ...instructor,
          loading: false,
          delErr: "Error can't Delete instructors",
        });
      });
  };

  return (
    <>
      <section className="instructors-dataSection">
        <SectionHeader
          title={"Instructors Section"}
          smTilte={`Hi ${admin.name}`}
          description={"Here you can add, update, and delete instructors"}
          className={"adminInstructor-header"}
        />
        <div className="container instructors-table-container">
          {/* delete action handeling */}
          {instructor.loading === false &&
            instructor.delErr == null &&
            instructor.delSuccess != null && (
              <Alert variant="success" className="AlertAddCoures">
                {instructor.delSuccess}
              </Alert>
            )}
          {instructor.loading === false &&
            instructor.delErr != null &&
            instructor.delSuccess === null && (
              <Alert variant="danger" className="AlertAddCoures">
                {instructor.delErr}
              </Alert>
            )}

          {/* Loader */}
          {instructor.loading === true && (
            <div className="pageSpinner">
              <Spinner animation="border" role="status" className="spinner">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
            </div>
          )}
          <div className="table-header">
            <h3>All instructors</h3>
            <Link to={"add"} className="btn sm-btn Add-btn">
              Add instructor <AiOutlinePlusSquare />
            </Link>
          </div>
          {/* displayinstructors */}
          {instructor.loading === false &&
            instructor.err === null &&
            instructor.results.length != 0 && <>{displayinstructors()}</>}

          {/* errors handling */}
          {instructor.loading === false && instructor.err != null && (
            <div className="alert-container container">
              <Alert variant="danger" className="alret">
                {instructor.err}
              </Alert>
            </div>
          )}
        </div>
      </section>
    </>
  );
};

export default InstructorTable;
