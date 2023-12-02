import React, { useState, useEffect } from "react";
import "./style/couresM.css";
import PageHeader from "../../shared/PageHeader";
import { Link } from "react-router-dom";
import { useParams } from "react-router";
import { getAuthUser } from "../../helper/Storage";
import axios from "axios";
import SectionHeader from "./../../shared/SectionHeader";
import pdfImg from "../../assests/images/material imgs/pdf.png";
import docxImg from "../../assests/images/material imgs/docx.png";
import pptxImg from "../../assests/images/material imgs/pptx.png";
import zipImg from "../../assests/images/material imgs/zip.png";
import rarImg from "../../assests/images/material imgs/rar.png";
import documentImg from "../../assests/images/material imgs/document.png";
import { MdCloudDownload } from "react-icons/md";

import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";

const CouresMaterial = () => {
  let { id } = useParams();
  let { code } = useParams();
  const auth = getAuthUser();
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
  return (
    <div>
      <PageHeader header={"Course Materials"}>
        <ul className="navigate-links">
          <li>
            <Link to={"/"}>Home</Link>
          </li>
          <li>/</li>
          <li>
            <Link to={"/profile/student"}>My Profile</Link>
          </li>
          <li>/</li>
          {!course.loading && course.result.name && (
            <li>{`${course.result.name} course`}</li>
          )}
        </ul>
      </PageHeader>
      <section className="material-section">
        <div className="container">
          <SectionHeader
            smTilte={"Your Course Materials"}
            title={"Here you can find lecter's"}
          />

          {/* Loader */}
          {courseMateial.loading && (
            <div className="pageSpinner">
              <Spinner animation="border" className="spinner">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
            </div>
          )}
          {/* delete action handeling */}
          {!courseMateial.loading &&
            courseMateial.delErr == null &&
            courseMateial.delSuccess != null && (
              <Alert variant="success" className="AlertAddCoures">
                {courseMateial.delSuccess}
              </Alert>
            )}
          {!courseMateial.loading &&
            courseMateial.delErr != null &&
            courseMateial.delSuccess === null && (
              <Alert variant="danger" className="AlertAddCoures">
                {courseMateial.delErr}
              </Alert>
            )}
            {!courseMateial.loading &&
              courseMateial.err !== null &&
              courseMateial.results.length === 0 && (
                <Alert variant="danger" className="AlertAddCoures">
                {"There is no available matrials"}
              </Alert>
              )}
          <div className="materials">
            {!courseMateial.loading &&
              courseMateial.err === null &&
              courseMateial.results.length !== 0 && (
                <>
                  {courseMateial.results.map((m) => {
                    return (
                      <div className="file-link" key={m.id}>
                        <div className="material-file">
                          <div className="file-img">
                            <img src={getFileExtension(m.fileName)} alt="" />
                          </div>
                          <h3>{m.name}</h3>
                        </div>
                        <a
                          href={m.fileName}
                          download={m.name}
                          className="over-lay"
                        >
                          <MdCloudDownload />
                        </a>
                      </div>
                    );
                  })}
                </>
              )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default CouresMaterial;
