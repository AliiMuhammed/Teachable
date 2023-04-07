import '../style/home.css';
import { Link } from 'react-router-dom';
import CourseCard from '../../../shared/CourseCard';
import "../style/trendCourses.css";
import { courses } from "../../../core/data/data";

const Courses = () => {

    const displayCourses = () => {
        return courses.map((course) => {
          return (
            <CourseCard
              key={course.id}
              title={course.title}
              instractor={course.instractor}
              Image={course.Image}
              durations={course.durations}
            />
          );
        });
}
    return (
      <>
        <section>
          <div className="container courses-container">
            <div className="courses-top">
              <div className="courses-top-left">
                <span>TRENDING COURSES</span>
                <h3>
                  Explore our diverse range of courses and enhance your
                  knowledge and skills.
                </h3>
                <p>
                  A wide range of educational opportunities for individuals
                  seeking to enhance their skills and knowledge.
                </p>
              </div>
              <div className="courses-top-right">
                <Link to="/courses" className="btn btn-lg">
                  ALL COURSES
                </Link>
              </div>
            </div>
            <div className="courses-bottom">{displayCourses()}</div>
          </div>
        </section>
      </>
    );
}

export default Courses