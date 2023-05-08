import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS } from "chart.js/auto";
import axios from "axios";
import { useState, useEffect } from "react";

const DoughnutChart = () => {
  // Courses Api's
  const [counterOn, SetCounterOn] = useState(false);
  const [course, setCourses] = useState({
    loading: true,
    results: [],
    err: null,
    reload: 0,
  });

  useEffect(() => {
    setCourses({ ...course, loading: true });
    axios
      .get("http://localhost:4002/courses")
      .then((resp) => {
        setCourses({
          ...course,
          results: resp.data,
          loading: false,
          err: null,
        });
      })
      .catch((err) => {
        setCourses({ ...course, loading: false, err: "error" });
      });
  }, []);

  // instructors Api's
  const [instructor, setInstructor] = useState({
    loading: true,
    results: [],
    err: null,
    reload: 0,
  });

  useEffect(() => {
    setInstructor({ ...instructor, loading: true });
    axios
      .get("http://localhost:4002/instractors")
      .then((resp) => {
        setInstructor({
          ...instructor,
          results: resp.data,
          loading: false,
          err: null,
        });
      })
      .catch((err) => {
        setInstructor({ ...instructor, loading: false, err: "error" });
      });
  }, []);

  // students Api's
  const [student, setStudent] = useState({
    loading: true,
    results: [],
    err: null,
    reload: 0,
  });

  useEffect(() => {
    setStudent({ ...student, loading: true });
    axios
      .get("http://localhost:4002/students")
      .then((resp) => {
        setStudent({
          ...student,
          results: resp.data,
          loading: false,
          err: null,
        });
      })
      .catch((err) => {
        setStudent({ ...student, loading: false, err: "error" });
      });
  }, []);

  const studentNumber = student.results.length;
  const instructorNumber = instructor.results.length;
  const coursesNumber = course.results.length;

  const data = {
    labels: ["Instructor", "Studens", "Courses"],
    datasets: [
      {
        label: "Count",
        data: [instructorNumber, studentNumber, coursesNumber],
        tension: 0.5,
      },
    ],
  };
  return <Doughnut className="doughnutChart" data={data} />;
};

export default DoughnutChart;
