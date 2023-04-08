import '../style/home.css'
import { Link } from 'react-router-dom'
import dotedImg from '../../../assests/images/home page imgs/dot-bg.png'
import landingImg from '../../../assests/images/home page imgs/landingImg.jpg'
import "../style/mainHeader.css";

const MainHeader = () => {
  return (
      <header className='main-header'>
          <div className="container mainHeader-container">
              <div className="mainHeader-left">
                  <h4>EXPERT INSTRUCTION</h4>
                  <h1>Convenient easy way of learning new skills!</h1>
                  <p>The ultimate planning solution for busy women who want to reach their personal goals.Effortless comfortable eye-catching unique detail</p>
                  <Link to="/courses" className="btn btn-lg">Our Courses</Link>
              </div>
              <div className="mainHeader-right">
                  <div className="mainHeader-img">
                        <div className="bg-doted-img">
                            <img src={dotedImg} alt="" />
                        </div>
                      <img src={landingImg} className='landImg' alt="landing img" />
                  </div>
              </div>
          </div>
    </header>
  )
}

export default MainHeader