import "./style/about.css"
import PageHeader from "../../shared/PageHeader"
import Features from "../../shared/Features";
import Statistics from "../../shared/Statistics";
import SectionHeader from "../../shared/SectionHeader";
import TeamCard from "./components/TeamCard";

import { Link } from "react-router-dom";
import AboutImage from "../../assests/images/about page imgs/features.jpg"
import { FaCheck } from "react-icons/fa"
import { team } from "../../core/data/data";
const About = () => {

  const displayTeam = () => {
    return team.map((member) => {
      return (
        <TeamCard
          key={member.id}
          img={member.image}
          title={member.dep}
          name={member.name}
        />
      );
    });
  }

  
  return (
    <>
      <PageHeader header={"Who We Are"}>
        <ul className="navigate-links">
          <li>
            <Link to={"/"}>Home</Link>
          </li>
          <li>/</li>
          <li>About</li>
        </ul>
      </PageHeader>
      <Features className={"about-featuresCard"} />
      <section className="about-features">
        <div className="container about-features-container">
          <div className="about-features-left">
            <div className="about-features-image">
              <img src={AboutImage} alt="about" />
            </div>
          </div>
          <div className="about-features-right">
            <SectionHeader
              smTilte={"SELF DEVELOPMENT COURSE"}
              title={"Get Instant Access To Expert solution"}
              description={
                "The ultimate planning solution for busy women who want to reach their personal goals.Effortless comfortable eye-catching unique detail"
              }
              className={"about-features"}
            />
            <div className="features-adv">
              <div className="adv-item">
                <div className="icon">
                  <FaCheck />
                </div>
                <p>High Quality Video Details</p>
              </div>
              <div className="adv-item">
                <div className="icon">
                  <FaCheck />
                </div>
                <p>Powerful Audiance</p>
              </div>
              <div className="adv-item">
                <div className="icon">
                  <FaCheck />
                </div>
                <p>Premium Content Worldwide</p>
              </div>
            </div>
            <Link to={"/courses"} className="btn about-courses-btn">
              Our Courses
            </Link>
          </div>
        </div>
      </section>
      <Statistics />
      <section className="team">
        <SectionHeader
          smTilte={"BEST EXPERT TEAM"}
          title={"Our Professional Team"}
        />
        <div className="container team-container">{displayTeam()}</div>
      </section>
    </>
  );
}

export default About