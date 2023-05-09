import "../style/courseCard.css";
import { Link } from "react-router-dom";
import { SlNotebook } from "react-icons/sl";

const CourseCard = ({
  title,
  id,
  description,
  code,
  durations,
  courseImage,
  grad=null,
  className,
}) => {
  return (
    <div className={`course-card ${className}`}>
      <div className="course-card-image">
        <img src={courseImage} alt="" />
      </div>
      <div className="course-card-content">
        <h3>
          <Link to={"/courses/" + id + "/" + code}>{title}</Link>
        </h3>
        <p>{description}</p>
        <div className="course-meta">
          <span>
            Course Code: <span className="course-instructor">{code}</span>
          </span>
          <span className="course-lessons">
            <SlNotebook />
            <strong> {durations}</strong>
            lecture
          </span>
          {grad !==null && <span className="course-grade">Grade : {grad} / 100</span>}
        </div>
      </div>
    </div>
  );
};

export default CourseCard;
