import './style/home.css'
import MainHeader from './components/MainHeader'
import Features from '../../shared/Features'
import TrendCourses from '../../shared/TrendCourses'
import NewCourses from '../../shared/NewCourses'
import Statistics from '../../shared/Statistics'

const Home = () => {
  return (
    <div>
      <MainHeader />
      <Features className={"card-Feature_home"} />
      <TrendCourses />
      <Statistics />
      <NewCourses />
    </div>
  );
}

export default Home