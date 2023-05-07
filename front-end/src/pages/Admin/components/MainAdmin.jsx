import { getAuthUser } from "../../../helper/Storage";
import "../style/mainAdmin.css";
import { AiFillHeart } from "react-icons/ai";
import BarChart from "./Charts/BarChart";
import Doughnut from "./Charts/DoughnutChart";
import LineChart from "./Charts/LineChart";
import SectionHeader from "../../../shared/SectionHeader";

const MainAdmin = () => {
  const admin = getAuthUser();
  return (
    <>
      <section className="welcome-Section">
        <SectionHeader
          title={`${admin.name}`}
          smTilte={"Welcome"}
          description={"Here you can manage courses, instractors, and students"}
          className={"AdminWelcome-header"}
        />
      </section>
      <section className="charts-sectoin">
        <div className="container charts-container">
          <div className="lineCharts">
            <LineChart />
          </div>
          <div className="barCharts">
            <BarChart />
          </div>
          <div className="doughnutCharts">
            <Doughnut />
          </div>
        </div>
      </section>
    </>
  );
};

export default MainAdmin;
