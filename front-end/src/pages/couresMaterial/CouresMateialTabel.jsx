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
    loading: true,
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
  console.log(courseMateial.results);
  return (
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
          <div className="table-header">
            <h3>All Courses</h3>
            <Link to={"add"} className="btn sm-btn Add-btn">
              Add Course <AiOutlinePlusSquare />
            </Link>
          </div>
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
                          src={getFileExtension(courseMateial.file)}
                          alt=""
                        />
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
                          <Link to={""} className="btn btn-sm btn-show">
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

        </div>
      </section>
    </section>
  );
};

export default CouresMateialTabel;
