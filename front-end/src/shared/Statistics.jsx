import CountUp from "react-countup";
import ScrollTrigger from "react-scroll-trigger";
import axios from "axios";
import { useState, useEffect } from "react";
import { GiTeacher } from "react-icons/gi";
import { ImBooks } from "react-icons/im";
import { BsFillPersonPlusFill } from "react-icons/bs";
import "../style/statistics.css";

const Statistics = () => {
  // Courses Api's
  const [counterOn, SetCounterOn] = useState(false);
  const [course, setCourses] = useState({
    loading: true,
    results: [],
    err: null,
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
        setCourses({ ...course, loading: false, err: "error" });
      });
  }, []);

  // instructors Api's
  const [instructor, setInstructor] = useState({
    loading: true,
    results: [],
    err: null,
    reload: 0,
  });

  useEffect(() => {
    setInstructor({ ...instructor, loading: true });
    axios
      .get("http://localhost:4002/instractors")
      .then((resp) => {
        setInstructor({
          ...instructor,
          results: resp.data,
          loading: false,
          err: null,
        });
      })
      .catch((err) => {
        setInstructor({ ...instructor, loading: false, err: "error" });
      });
  }, []);

  // students Api's
  const [student, setStudent] = useState({
    loading: true,
    results: [],
    err: null,
    reload: 0,
  });

  useEffect(() => {
    setStudent({ ...student, loading: true });
    axios
      .get("http://localhost:4002/students")
      .then((resp) => {
        setStudent({
          ...student,
          results: resp.data,
          loading: false,
          err: null,
        });
      })
      .catch((err) => {
        setStudent({ ...student, loading: false, err: "error" });
      });
  }, []);

  const activeCourses = [];
  course.results.map((course) => {
    if (course.status === 1) {
      activeCourses.push(course);
    }
  });

  const studentNumber = student.results.length;
  const instructorNumber = instructor.results.length;
  const coursesNumber = activeCourses.length;
  return (
    <ScrollTrigger
      onEnter={() => SetCounterOn(true)}
      onExit={() => SetCounterOn(false)}
    >
      <section className="stats-section">
        <div className="container stats-container">
          <div className="instructor-stats">
            <div className="stats-icon">
              <GiTeacher />
            </div>
            <h1>
              {counterOn && (
                <CountUp
                  start={0}
                  end={instructorNumber}
                  duration={3}
                  delay={0}
                />
              )}
            </h1>
            <span className="stats-type">Instructors</span>
          </div>
          <div className="courses-stats">
            <div className="stats-icon">
              <ImBooks />
            </div>
            <h1>
              {counterOn && (
                <CountUp start={0} end={coursesNumber} duration={3} delay={0} />
              )}
            </h1>
            <span className="stats-type">Total Courses</span>
          </div>
          <div className="students-stats">
            <div className="stats-icon">
              <BsFillPersonPlusFill />
            </div>
            <h1>
              {counterOn && (
                <CountUp start={0} end={studentNumber} duration={3} delay={0} />
              )}
            </h1>
            <span className="stats-type">Registered Enrolls</span>
          </div>
        </div>
      </section>
    </ScrollTrigger>
  );
};

export default Statistics;
