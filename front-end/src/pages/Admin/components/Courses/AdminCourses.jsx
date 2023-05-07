import SectionHeader from "../../../../shared/SectionHeader";
import "../../style/courses.css"
import Table from "react-bootstrap/Table";
import { getAuthUser } from "../../../../helper/Storage";

const AdminCourses = () => {
    const admin = getAuthUser();
  return (
    <>
      <section className="courses-dataSection">
        <SectionHeader
          title={"Courses Section"}
          smTilte={`Hi ${admin.name}`}
          description={"Here you can add, update, and delete courses"}
          className={"adminCourse-header"}
        />
        <div className="container courses-table-container">
          <Table striped bordered hover>
            <thead>
              <tr>
                <th>#</th>
                <th>First Name</th>
                <th>Last Name</th>
                <th>Username</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>Mark</td>
                <td>Otto</td>
                <td>@mdo</td>
              </tr>
              <tr>
                <td>2</td>
                <td>Jacob</td>
                <td>Thornton</td>
                <td>@fat</td>
              </tr>
              <tr>
                <td>3</td>
                <td colSpan={2}>Larry the Bird</td>
                <td>@twitter</td>
              </tr>
            </tbody>
          </Table>
        </div>
      </section>
    </>
  );
};

export default AdminCourses;
