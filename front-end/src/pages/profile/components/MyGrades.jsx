
import "../style/myGrades.css";
import { CompactTable } from "@table-library/react-table-library/compact";
import { useTheme } from "@table-library/react-table-library/theme";
import { getTheme } from "@table-library/react-table-library/baseline";
import { nodes } from "../../../core/data/grades";
import React, {useState, useEffect} from "react"
import axios from 'axios'
import Alert from "react-bootstrap/Alert";

const key = "Compact Table";

const MyGrades = () => {
//   const [grades, setGrades] = useState({
//     loading: true,
//     results: [],
//     err: null,
//     reload: 0
// })

// useEffect(() => {
//   setGrades({...grades, loading: true})
//   axios.get("http://localhost:4002/students/18")
//   .then((resp) =>  {
//     console.log(resp);
//     setGrades({...grades, results: resp.data, loading: false, err: null})
//   })
//   .catch((err) => {
//     setGrades({...grades, loading: false, err:"Something failed"})

//   });
// }, [])
 
  const data = { nodes };
  const theme = useTheme(getTheme());
const COLUMNS = [
  { label: "Course", renderCell: (item) => item.course },
  {label: "Your Grade",renderCell: (item) =>item.grade},
  { label: "Total Course Grade", renderCell: (item) => item.total },
];
  return (
    <article className="gradeTable">
      <div className="container table-container">
        <CompactTable columns={COLUMNS} data={data} theme={theme} key={key} />
      </div>
    </article>
  );
}

export default MyGrades