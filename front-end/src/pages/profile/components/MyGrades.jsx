
import "../style/myGrades.css";
import { CompactTable } from "@table-library/react-table-library/compact";
import { useTheme } from "@table-library/react-table-library/theme";
import { getTheme } from "@table-library/react-table-library/baseline";
import { nodes } from "../../../core/data/grades";

const key = "Compact Table";

const MyGrades = () => {
 
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