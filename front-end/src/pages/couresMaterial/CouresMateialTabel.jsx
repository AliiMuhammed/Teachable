import React, { useState, useEffect, useRef } from "react";
import { getAuthUser } from "../../helper/Storage";
import "./style/couresMTable.css";
import PageHeader from "./../../shared/PageHeader";
import { Link } from "react-router-dom";
import axios from "axios";
import { useParams } from "react-router";
import Table from "react-bootstrap/Table";
import pdfImg from "../../assests/images/material imgs/pdf.png";
import docxImg from "../../assests/images/material imgs/docx.png";
import pptxImg from "../../assests/images/material imgs/pptx.png";
import zipImg from "../../assests/images/material imgs/zip.png";
import rarImg from "../../assests/images/material imgs/rar.png";
import documentImg from "../../assests/images/material imgs/document.png";
import { AiOutlinePlusSquare } from "react-icons/ai";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
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
  const [newMaterial, setNewMaterial] = useState({
    name: "",
    file: null,
    show: false,
    reload: 0,
  });
  useEffect(() => {
    setCourse({ ...course, loading: true });
    setCourseMateial({ ...courseMateial, loading: true });
    axios
      .get("http://localhost:3000/courses/" + id + "/" + code)
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

    axios
      .get("http://localhost:3000/materials/" + id)
      .then((resp) => {
        setCourseMateial({
          ...courseMateial,
          loading: false,
          results: resp.data,
          err: null,
        });
      })
      .catch((err) => {
        setCourseMateial({
          ...courseMateial,
          loading: false,
          err: "Error can't load Course",
        });
      });
  }, [newMaterial.reload]);

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
                    <img
                      src={getFileExtension(courseMateial.fileName)}
                      alt=""
                    />
                  </td>
                  <td>
                    <div className="table-btns">
                      <button
                        to={"delete"}
                        className="btn btn-sm btn-delete"
                        onClick={() => {
                          deleteMaterial(courseMateial.id);
                        }}
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => {
                          handleUpdateShow(courseMateial);
                        }}
                        className="btn btn-sm btn-Update"
                      >
                        Update
                      </button>
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

  const deleteMaterial = (id) => {
    axios
      .delete(`http://localhost:3000/materials/${id}`)
      .then((res) => {
        setErr(null);
        setSuccsse("Material deleted succssfully");
        setNewMaterial({
          ...newMaterial,
          reload: newMaterial.reload + 1,
        });
      })
      .catch((err) => {
        setErr("can't deleted material");
        setSuccsse(null);
      });
  };

  const [succsse, setSuccsse] = useState(null);
  const [err, setErr] = useState(null);
  const [updatedName, setUpdatedName] = useState("");
  const [updatedFile, setUpdatedFile] = useState(null);
  const fileInputRef = useRef(null);
  const updateInputRef = useRef(null);
  const handleAddMaterial = (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("name", newMaterial.name);
    formData.append("file", newMaterial.file);

    axios
      .post(`http://localhost:3000/materials/add/${id}`, formData)
      .then((resp) => {
        setNewMaterial({
          ...newMaterial,
          reload: newMaterial.reload + 1,
          show: false,
        });
        setSuccsse("Matrials added succssfully ");
        setErr(null);
      })
      .catch((error) => {
        setNewMaterial({
          ...newMaterial,
          show: false,
        });
        setErr("can't add the materials");
        setSuccsse(null);
      });
  };
  const handleAddShow = () => {
    console.log("Open modal or perform actions before opening modal");

    setNewMaterial({ ...newMaterial, show: true });
  };
  const handleClose = () => {
    setNewMaterial({ ...newMaterial, show: false });
  };

  const [selectedMaterial, setSelectedMaterial] = useState(null);

  const handleUpdateShow = (material) => {
    setSelectedMaterial(material);
  };

  const handleUpdateClose = () => {
    setSelectedMaterial(null);
  };

  const handleUpdateMaterial = (e) => {
    e.preventDefault();

    const formData = new FormData();

    if (updatedName && !updatedFile) {
      formData.append("name", updatedName);
    }

    if (updatedFile && !updatedName) {
      formData.append("file", updatedFile);
    }

    if (updatedName && updatedFile) {
      formData.append("name", updatedName);
      formData.append("file", updatedFile);
    }

    axios
      .patch(
        `http://localhost:3000/materials/update/${selectedMaterial.id}`,
        formData
      )
      .then((resp) => {
        setSuccsse("Material updated successfully");
        setErr(null);
        handleUpdateClose();
        setNewMaterial({
          ...newMaterial,
          reload: newMaterial.reload + 1,
        });
      })
      .catch((error) => {
        setSuccsse(null);
        setErr("can't update material ");
        handleUpdateClose();
      });
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
            {!courseMateial.loading &&
              courseMateial.delErr != null &&
              courseMateial.delSuccess === null && (
                <Alert variant="danger" className="AlertAddCoures">
                  {courseMateial.delErr}
                </Alert>
              )}
            {!courseMateial.loading &&
              courseMateial.delErr != null &&
              courseMateial.delSuccess === null && (
                <Alert variant="danger" className="AlertAddCoures">
                  {courseMateial.delErr}
                </Alert>
              )}
            {err === null && succsse !== null && (
              <Alert variant="success">{succsse}</Alert>
            )}

            {err !== null && succsse === null && (
              <Alert variant="danger">{err}</Alert>
            )}
            <div className="table-header">
              <h3>All Materials</h3>
              <button onClick={handleAddShow} className="btn sm-btn Add-btn">
                Add Material <AiOutlinePlusSquare />
              </button>
            </div>
            {/* Loader */}
            {courseMateial.loading && (
              <div className="pageSpinner">
                <Spinner animation="border" className="spinner">
                  <span className="visually-hidden">Loading...</span>
                </Spinner>
              </div>
            )}
            {!courseMateial.loading &&
              courseMateial.results.length === 0 &&
              courseMateial.err !== null && (
                <Alert variant="danger" className="AlertAddCoures">
                  {"There is no materials for this course"}
                </Alert>
              )}
            {/* displayCourses */}
            {!courseMateial.loading &&
              courseMateial.err === null &&
              courseMateial.results.length !== 0 && <>{displayCourses()}</>}
          </div>
        </section>
      </section>
      {/* add modal */}
      <Modal show={newMaterial.show} centered size="lg">
        <Modal.Header>
          <Modal.Title>Add Material</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="w-100" controlId="formMaterialName">
              <Form.Label>Material Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter material name"
                value={newMaterial.name}
                required
                onChange={(e) =>
                  setNewMaterial({ ...newMaterial, name: e.target.value })
                }
              />
            </Form.Group>
            <Form.Group className="w-100 mt-3" controlId="formMaterialFile">
              <Form.Label>Upload File</Form.Label>
              <Form.Control
                type="file"
                ref={fileInputRef}
                required
                onChange={(e) =>
                  setNewMaterial({ ...newMaterial, file: e.target.files[0] })
                }
              />
            </Form.Group>
            <div className="modal-add-footer">
              <button
                className="btn-delete btn close-btn"
                onClick={handleClose}
              >
                Close
              </button>
              <button className="btn setGrade-btn" onClick={handleAddMaterial}>
                Add
              </button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Update Material Modal */}
      <Modal
        show={selectedMaterial !== null}
        onHide={handleUpdateClose}
        centered
        size="lg"
      >
        <Modal.Header>
          <Modal.Title>Update Material</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="w-100" controlId="formMaterialName">
              <Form.Label>Material Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter material name"
                value={
                  updatedName !== ""
                    ? updatedName
                    : selectedMaterial
                    ? selectedMaterial.name
                    : ""
                }
                required
                onChange={(e) =>
                  setUpdatedName(e.target.value !== "" ? e.target.value : null)
                }
              />
            </Form.Group>
            <Form.Group className="w-100 mt-3" controlId="formMaterialFile">
              <Form.Label>Upload File</Form.Label>
              <Form.Control
                type="file"
                ref={updateInputRef}
                required
                onChange={(e) => setUpdatedFile(e.target.files[0])}
              />
            </Form.Group>
            <div className="modal-update-footer">
              <div className="modal-add-footer">
                <button
                  className="btn-delete btn close-btn"
                  onClick={handleUpdateClose}
                >
                  Close
                </button>
                <button
                  className="btn setGrade-btn"
                  onClick={handleUpdateMaterial}
                >
                  Update
                </button>
              </div>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default CouresMateialTabel;
