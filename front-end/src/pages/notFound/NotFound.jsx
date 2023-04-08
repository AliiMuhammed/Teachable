import React from 'react'
import './style/notFound.css'
import { Link } from 'react-router-dom';
import Img from "../../assests/images/notFound page imgs/notFound.jpg";
const NotFound = () => {
  return (
    <section className="notFound-section">
      <div className="container notFound-container">
        <div className="notFound-img">
          <img src={Img} alt="404" />
        </div>
        <div className="notFound-text">
          <h1>Page Not Found</h1>
          <p>
            We're sorry, the page you requested could not be found please go
            back to the homepage
          </p>
        </div>
        <div className="notFound-btn">
          <Link to={"/"} className='btn notFound-btn'>Go Back Home</Link>
        </div>
      </div>
    </section>
  );
}

export default NotFound