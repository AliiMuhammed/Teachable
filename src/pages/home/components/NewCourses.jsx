import SectionHeader from "../../../shared/SectionHeader"
import CourseCard from "../../../shared/CourseCard"
import { courses } from "../../../core/data/data";
import "../style/newCourses.css"

const NewCourses = () => {

  const displayCourses = () => { 
    return courses.map((course) => {
      return (
        <CourseCard
          key={course.id}
          title={course.title}
          instractor={course.instractor}
          Image={course.Image}
          durations={course.durations}
          className={"newCourses-card"}
        />
      );
    });
  }


  return (
    <section>
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