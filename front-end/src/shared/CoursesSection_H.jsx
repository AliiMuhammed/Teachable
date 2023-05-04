import { Link } from "react-router-dom";
import "../style/coursesSection_H.css";


const CoursesSectionH = ({
  className,
  sectionTilte,
  smSectionTitle,
  sectionDes,
  children,
}) => {

  return (
    <>
      <section className={`CoursesSection-H ${className}`}>
        <div className="container courses-container">
          <div className="courses-top">
            <div className="courses-top-left">
              <span>{smSectionTitle}</span>
              <h3>{sectionTilte}</h3>
              <p>{sectionDes}</p>
            </div>
            <div className="courses-top-right">
              <Link to="/courses" className="btn btn-lg">
                ALL COURSES
              </Link>
            </div>
          </div>
          <div className="courses-bottom">{children}</div>
        </div>
      </section>
    </>
  );
};

export default CoursesSectionH;
