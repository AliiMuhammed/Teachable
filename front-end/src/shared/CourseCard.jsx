import "../style/courseCard.css";
import { Link } from 'react-router-dom'
import {SlNotebook} from "react-icons/sl"

const CourseCard = ({title,id,description,instractor,durations,Image,className}) => {
  return (
    <div className={`course-card ${className}`}>
      <div className="course-card-image">
        <img src={Image} alt="course-image" />
      </div>
      <div className="course-card-content">
        <h3><Link to={"/courses/"+id}>{title}</Link></h3>
        <div className="course-meta">
            <span>By <span className='course-instractor'>{instractor}</span></span>
            <span className='course-lessons'><SlNotebook/>{durations}</span>
        </div>
      </div>
    </div>
  )
}

export default CourseCard