import SectionHeader from "../../../../shared/SectionHeader";
import "../../style/instractors.css";
import Table from "react-bootstrap/Table";
import { getAuthUser } from "../../../../helper/Storage";
import { Link } from "react-router-dom";
import { AiOutlinePlusSquare } from "react-icons/ai";
import Spinner from "react-bootstrap/Spinner";
import Alert from "react-bootstrap/Alert";
import { useState, useEffect } from "react";
import axios from "axios";

const InstractorTable = () => {
  const admin = getAuthUser();
  const [instractor, setinstractors] = useState({
    loading: true,
    results: [],
    err: null,
    delErr: null,
    delSuccess: null,
    reload: 0,
  });

  useEffect(() => {
    setinstractors({ ...instractor, loading: true });
    axios
      .get("http://localhost:4002/instractors")
      .then((resp) => {
        setinstractors({
          ...instractor,
          results: resp.data,
          loading: false,
          err: null,
        });
      })
      .catch((err) => {
        setinstractors({
          ...instractor,
          loading: false,
          err: "Error can't load instractors",
        });
      });
  }, [instractor.reload]);

  const displayinstractors = () => {
    return (
      <>
        <div className="instractorTable">
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
              {instractor.results.map((instractor) => {
                return (
                  <tr key={instractor.id}>
                    <td>{instractor.id}</td>
                    <td>{instractor.name}</td>
                    <td>{instractor.email}</td>
                    <td>{instractor.phone}</td>
                    <td>{instractor.status}</td>
                    <td className="table-img">
                      <img src={instractor.image_url} alt="" />
                    </td>
                    <td>
                      <div className="table-btns">
                        <button
                          to={"delete"}
                          className="btn btn-sm btn-delete"
                          onClick={(e) => {
                            deleteinstractor(instractor.id);
                          }}
                        >
                          Delete
                        </button>
                        <Link
                          to={"update/" + instractor.id}
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
            to={"/admin/instractors/assgin"}
            className="btn sm-btn assgin-btn"
          >
            Assgin to courses
          </Link>
        </div>
      </>
    );
  };
  const deleteinstractor = (id) => {
    axios
      .delete("http://localhost:4002/instractors/" + id, {
        headers: {
          token: admin.token,
        },
      })
      .then((resp) => {
        setinstractors({
          ...instractor,
          reload: instractor.reload + 1,
          delSuccess: "instractor deleted Successfully",
        });
      })
      .catch((err) => {
        setinstractors({
          ...instractor,
          loading: false,
          delErr: "Error can't Delete instractors",
        });
      });
  };

  return (
    <>
      <section className="instractors-dataSection">
        <SectionHeader
          title={"Instructors Section"}
          smTilte={`Hi ${admin.name}`}
          description={"Here you can add, update, and delete instractors"}
          className={"adminInstructor-header"}
        />
        <div className="container instractors-table-container">
          {/* delete action handeling */}
          {instractor.loading === false &&
            instractor.delErr == null &&
            instractor.delSuccess != null && (
              <Alert variant="success" className="AlertAddCoures">
                {instractor.delSuccess}
              </Alert>
            )}
          {instractor.loading === false &&
            instractor.delErr != null &&
            instractor.delSuccess === null && (
              <Alert variant="danger" className="AlertAddCoures">
                {instractor.delErr}
              </Alert>
            )}

          {/* Loader */}
          {instractor.loading === true && (
            <div className="pageSpinner">
              <Spinner animation="border" role="status" className="spinner">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
            </div>
          )}
          <div className="table-header">
            <h3>All instractors</h3>
            <Link to={"add"} className="btn sm-btn Add-btn">
              Add instractor <AiOutlinePlusSquare />
            </Link>
          </div>
          {/* displayinstractors */}
          {instractor.loading === false &&
            instractor.err === null &&
            instractor.results.length != 0 && <>{displayinstractors()}</>}

          {/* errors handling */}
          {instractor.loading === false && instractor.err != null && (
            <div className="alert-container container">
              <Alert variant="danger" className="alret">
                {instractor.err}
              </Alert>
            </div>
          )}
        </div>
      </section>
    </>
  );
};

export default InstractorTable;
