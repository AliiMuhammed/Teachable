import React from "react";
import CourseCard from "../../../shared/CourseCard";
import { courses } from "../../../core/data/data";
import "../style/myCourses.css";

const MyCourses = () => {
  const displayCourses = () => {
    return courses.map((course) => {
      return (
        <CourseCard
          key={course.id}
          title={course.title}
          instractor={course.instractor}
          courseImage={course.Image}
          durations={course.durations}
          className={"myCourses-card"}
        />
      );
    });
  };

  return (
    <article>
      <div className="container myCourses-container">{displayCourses()}</div>
    </article>
  );
};

export default MyCourses;
