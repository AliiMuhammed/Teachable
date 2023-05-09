import "./style/home.css";
import MainHeader from "./components/MainHeader";
import Features from "../../shared/Features";
import CoursesSection_H from "../../shared/CoursesSection_H";
import CoursesSection_V from "../../shared/CoursesSection_V";
import Statistics from "../../shared/Statistics";
import axios from "axios";
import Spinner from "react-bootstrap/Spinner";
import Alert from "react-bootstrap/Alert";
import { useState, useEffect } from "react";
import CourseCard from "../../shared/CourseCard";

const Home = () => {
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
        setCourses({
          ...course,
          loading: false,
          err: "Error can't load Courses",
        });
      });
  }, [setCourses]);

  const activeCourses = [];
  course.results.map((course) => {
    if (course.status === 1) {
      activeCourses.push(course);
    }
  });



  const displayNewCourses = () => {
    return (
      <CoursesSection_V
        className={"courses-NewCourses"}
        sectionTilte="Discover New Opportunities for Learning and Growth with Our Latest Courses!"
        smSectionTitle="NEW COURSES"
        sectionDes="We are excited to offer a range of new courses that cater to various interests and skill levels."
      >
        {
        activeCourses.slice(0,4).map((course) => {
          if (course.status === 1) {
            return (
              <CourseCard
                key={course.id}
                id={course.id}
                title={course.name}
                code={course.code}
                courseImage={course.image_url}
                durations={course.durations}
                description={course.description}
                className={"v-card"}
              />
            );
          }
        })}
      </CoursesSection_V>
    );
  };

  const displayTrendCourses = () => {
    return (
      <CoursesSection_H
        sectionTilte={
          " Explore our diverse range of courses and enhance your knowledge and skills."
        }
        smSectionTitle={"TRENDING COURSES"}
        sectionDes={
          "A wide range of educational opportunities for individuals seeking to enhance their skills and knowledge."
        }
      >
        {activeCourses.slice(0,4).map((course) => {
            return (
              <CourseCard
                key={course.id}
                id={course.id}
                title={course.name}
                code={course.code}
                courseImage={course.image_url}
                durations={course.durations}
                description={course.description}
                className={"h-card"}
              />
            );
        })}
      </CoursesSection_H>
    );
  };

  return (
    <>
      {/* Loader */}
      {course.loading === true && (
        <div className="pageSpinner">
          <Spinner animation="border" role="status" className="spinner">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      )}

      <MainHeader />
      <Features className={"card-Feature_home"} />
      {/* displayCourses */}
      {course.loading === false && course.err === null && (
        <>
          {displayTrendCourses()}
          <Statistics />
          {displayNewCourses()}
        </>
      )}

      {/* errors handling */}
      {course.loading === false && course.err != null && (
        <div className="alert-container">
          <Alert variant="danger" className="alret">
            {course.err}
          </Alert>
        </div>
      )}
    </>
  );
};

export default Home;
