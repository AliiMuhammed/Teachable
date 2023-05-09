import Form from "react-bootstrap/Form";
import Alert from "react-bootstrap/Alert";
import axios from "axios";
import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { getAuthUser } from "../../../helper/Storage";
const SetGrade = () => {
  let { student_id } = useParams();
  let { coures_id } = useParams();

  return (
    <>
      {/* <section>
        <div className="container formSetGrade-contianer">
          <Form onSubmit={Updategrade}>
            <Form.Group className="mb-3" controlId="formBasicEmail">
              <Form.Label>Student garde</Form.Label>
              <Form.Control type="text" value={grade.grade}  />
            </Form.Group>

            <Form.Group className="mb-3" controlId="formBasicPassword">
              <Form.Label>Password</Form.Label>
              <Form.Control type="password" placeholder="Password" />
            </Form.Group>
            <button className="btn ">Submit</button>
          </Form>
        </div>
      </section> */}
    </>
  );
};

export default SetGrade;
