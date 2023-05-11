import SectionHeader from "../../../../shared/SectionHeader";
import "../../style/courses.css";
import Table from "react-bootstrap/Table";
import { getAuthUser } from "../../../../helper/Storage";
import { Link } from "react-router-dom";
import { AiOutlinePlusSquare } from "react-icons/ai";
import Spinner from "react-bootstrap/Spinner";
import Alert from "react-bootstrap/Alert";
import { useState, useEffect } from "react";
import axios from "axios";
const CoursesTable = () => {
  const admin = getAuthUser();
  const [course, setCourses] = useState({
    loading: true,
    results: [],
    err: null,
    delErr: null,
    delSuccess: null,
    reload: 0,
  });

  useEffect(() => {
    setCourses({ ...course, loading: true });
    axios
      .get("http://localhost:4002/courses")
      .then((resp) => {
        setCourses({
          ...course,
          results: resp.data,
          loading: false,
          err: null,
        });
      })
      .catch((err) => {
        setCourses({
          ...course,
          loading: false,
          err: "Error can't load Courses",
        });
      });
  }, [course.reload]);

  const displayCourses = () => {
    return (
      <>
        <div className="courseTable">
          <Table bordered striped hover>
            <thead>
              <tr>
                <th>Id</th>
                <th>Name</th>
                <th>Description</th>
                <th>Code</th>
                <th>Durations</th>
                <th>Status</th>
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
                    <td>{course.status}</td>
                    <td className="table-img">
                      <img src={course.image_url} alt="" />
                    </td>
                    <td>
                      <div className="table-btns">
                        <button
                          to={"delete"}
                          className="btn btn-sm btn-delete"
                          onClick={(e) => {
                            deleteCourse(course.id);
                          }}
                        >
                          Delete
                        </button>
                        <Link
                          to={"update/" + course.id + "/" + course.code}
                          className="btn btn-sm btn-Update"
                        >
                          Update
                        </Link>
                        <Link
                          to={"/courses/" + course.id + "/" + course.code}
                          className="btn btn-sm btn-show"
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
        </div>
          <Link to={"/admin/courses/assgin"} className="btn sm-btn assgin-btn">
            Assgin to instructors
          </Link>
      </>
    );
  };

  const deleteCourse = (id) => {
    axios
      .delete("http://localhost:4002/courses/" + id, {
        headers: {
          token: admin.token,
        },
      })
      .then((resp) => {
        setCourses({
          ...course,
          reload: course.reload + 1,
          delSuccess: "Course deleted Successfully",
        });
      })
      .catch((err) => {
        setCourses({
          ...course,
          loading: false,
          delErr: "Error can't Delete Courses",
        });
      });
  };

  return (
    <>
      <section className="courses-dataSection">
        <SectionHeader
          title={"Courses Section"}
          smTilte={`Hi ${admin.name}`}
          description={"Here you can add, update, and delete courses"}
          className={"adminCourse-header"}
        />
        <div className="container courses-table-container">
          {/* delete action handeling */}
          {course.loading === false &&
            course.delErr == null &&
            course.delSuccess != null && (
              <Alert variant="success" className="AlertAddCoures">
                {course.delSuccess}
              </Alert>
            )}
          {course.loading === false &&
            course.delErr != null &&
            course.delSuccess === null && (
              <Alert variant="danger" className="AlertAddCoures">
                {course.delErr}
              </Alert>
            )}

          {/* Loader */}
          {course.loading === true && (
            <div className="pageSpinner">
              <Spinner animation="border" role="status" className="spinner">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
            </div>
          )}
          <div className="table-header">
            <h3>All Courses</h3>
            <Link to={"add"} className="btn sm-btn Add-btn">
              Add Course <AiOutlinePlusSquare />
            </Link>
          </div>
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
        </div>
      </section>
    </>
  );
};

export default CoursesTable;
