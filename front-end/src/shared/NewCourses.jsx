import SectionHeader from "./SectionHeader"
import CourseCard from "./CourseCard"
import { courses } from "../core/data/data";
import "../style/newCourses.css"

const NewCourses = ({className,coursesArray}) => {

  const displayCourses = () => { 
    return coursesArray.map((course) => {
      return (
        <CourseCard
          key={course.id}
          title={course.name}
          code={course.code}
          courseImage={course.image_url}
          durations={course.durations}
          description={course.description}
          className={"newCourses-card"}
        />
      );
    });
  }


  return (
    <section className={`NewCourses ${className}`}>
      <SectionHeader
        title="Discover New Opportunities for Learning and Growth with Our Latest Courses!"
        smTilte="NEW COURSES"
        description="We are excited to offer a range of new courses that cater to various interests and skill levels."
      />
      <div className="container newCourses-container">{displayCourses()}</div>
    </section>
  );
}

export default NewCourses