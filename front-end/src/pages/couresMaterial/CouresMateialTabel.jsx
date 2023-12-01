import React, { useState, useEffect } from "react";
import { getAuthUser } from "../../helper/Storage";
import "./style/couresMTable.css";
import PageHeader from "./../../shared/PageHeader";
import { Link } from "react-router-dom";
import axios from "axios";
import { useParams } from "react-router";
import Table from "react-bootstrap/Table";
import { materials } from "./../../core/data/data";
import pdfImg from "../../assests/images/material imgs/pdf.png";
import docxImg from "../../assests/images/material imgs/docx.png";
import pptxImg from "../../assests/images/material imgs/pptx.png";
import zipImg from "../../assests/images/material imgs/zip.png";
import rarImg from "../../assests/images/material imgs/rar.png";
import documentImg from "../../assests/images/material imgs/document.png";
import { AiOutlinePlusSquare } from "react-icons/ai";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";

const CouresMateialTabel = () => {
  const user = getAuthUser();
  let { id } = useParams();
  let { code } = useParams();
  const [course, setCourse] = useState({
    loading: true,
    result: null,
    err: null,
  });

  const [courseMateial, setCourseMateial] = useState({
    loading: false,
    results: [],
    err: null,
    delErr: null,
    delSuccess: null,
    reload: 0,
  });

  useEffect(() => {
    setCourse({ ...course, loading: true });
    setCourseMateial({ ...courseMateial, results: materials });
    axios
      .get("http://localhost:4002/courses/" + id + "/" + code)
      .then((resp) => {
        setCourse({
          ...course,
          loading: false,
          result: resp.data,
          err: null,
        });
      })
      .catch((err) => {
        setCourse({
          ...course,
          loading: false,
          err: "Error can't load Course",
        });
      });
  }, []);

  const getFileExtension = (fileUrl) => {
    const extension = fileUrl.split(".").pop().toLowerCase();
    switch (extension) {
      case "pdf":
        return pdfImg;
      case "docx":
        return docxImg;
      case "pptx":
        return pptxImg;
      case "zip":
        return zipImg;
      case "rar":
        return rarImg;
      default:
        return documentImg;
    }
  };
  const displayCourses = () => {
    return (
      <div className="courseTable">
        <Table bordered striped hover>
          <thead>
            <tr>
              <th>Id</th>
              <th>Name</th>
              <th>Image</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {courseMateial.results.map((courseMateial) => {
              return (
                <tr key={courseMateial.id}>
                  <td>{courseMateial.id}</td>
                  <td>{courseMateial.name}</td>

                  <td className="table-img">
                    <img src={getFileExtension(courseMateial.file)} alt="" />
                  </td>
                  <td>
                    <div className="table-btns">
                      <button
                        to={"delete"}
                        className="btn btn-sm btn-delete"
                        onClick={""}
                      >
                        Delete
                      </button>
                      <Link to={""} className="btn btn-sm btn-Update">
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
    );
  };

  return (
    <div>
      <section className="CouresMateial-section">
        <PageHeader header={"Course Materials"}>
          <ul className="navigate-links">
            <li>
              <Link to={"/"}>Home</Link>
            </li>
            <li>/</li>
            <li>
              <Link to={"/profile/instractor"}>My Profile</Link>
            </li>
            <li>/</li>
            {!course.loading && course.result.name && (
              <li>{`${course.result.name} course`}</li>
            )}
          </ul>
        </PageHeader>

        <section className="CouresMateialTabel-section">
          <div className="container">
            {/* delete action handeling */}
            {courseMateial.loading === false &&
              courseMateial.delErr == null &&
              courseMateial.delSuccess != null && (
                <Alert variant="success" className="AlertAddCoures">
                  {courseMateial.delSuccess}
                </Alert>
              )}
            {courseMateial.loading === false &&
              courseMateial.delErr != null &&
              courseMateial.delSuccess === null && (
                <Alert variant="danger" className="AlertAddCoures">
                  {courseMateial.delErr}
                </Alert>
              )}

            <div className="table-header">
              <h3>All Materials</h3>
              <Link to={"add"} className="btn sm-btn Add-btn">
                Add Material <AiOutlinePlusSquare />
              </Link>
            </div>
            {/* Loader */}
            {courseMateial.loading === true && (
              <div className="pageSpinner">
                <Spinner animation="border" className="spinner">
                  <span className="visually-hidden">Loading...</span>
                </Spinner>
              </div>
            )}
            {/* displayCourses */}
            {courseMateial.loading === false &&
              courseMateial.err === null &&
              courseMateial.results.length !== 0 && <>{displayCourses()}</>}
          </div>
        </section>
      </section>
      {/* add modal */}
      {/* <Modal
        show={selectedStudent.show}
        onHide={handleClose}
        backdrop="static"
        centered
        keyboard={false}
      >
         <Modal.Header closeButton>
          <Modal.Title>Set Student Grade</Modal.Title>
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
                <Form.Control type="text" value={selectedStudent.grade} />
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
          <button className="btn-delete btn close-btn" onClick={handleClose}>
            Close
          </button>
          <button className="btn setGrade-btn" onClick={""}>
            set Grade
          </button>
        </Modal.Footer>
      </Modal> */}
    </div>
  );
};

export default CouresMateialTabel;
