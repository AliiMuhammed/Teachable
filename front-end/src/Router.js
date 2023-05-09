import { createBrowserRouter } from "react-router-dom";
import Home from "./pages/home/Home";
import Login from "./pages/login/Login";
import Courses from "./pages/courses/Courses";
import CouresDetails from "./pages/couresDetails/CouresDetails";
import About from "./pages/about/About";
import NotFound from "./pages/notFound/NotFound";
import ContactUs from "./pages/contactUs/ContactUs";
import Profile from "./pages/profile/Profile";
import App from "./App";
import Guest from "./middleware/Guest";
import GuestProfile from "./middleware/GuestProfile";
import Admin from "./middleware/Admin";
import DashBoard from "./pages/Admin/DashBoard";
import AdminCourses from "./pages/Admin/components/Courses/AdminCourses";
import MainAdmin from "./pages/Admin/components/MainAdmin";
import AdminInstructors from "./pages/Admin/components/Instructors/AdminInstructors";
import AdminStudents from "./pages/Admin/components/Students/AdminStudents";
import AddCourses from "./pages/Admin/components/Courses/AddCourses";
import UpdateCoures from "./pages/Admin/components/Courses/UpdateCoures";
import CoursesTable from "./pages/Admin/components/Courses/CoursesTable";
import InstructorTable from "./pages/Admin/components/Instructors/InstructorTable";
import UpdateInstructor from "./pages/Admin/components/Instructors/UpdateInstructor";
import AddUser from "./pages/Admin/components/AddUser";
import AssignInstarctorToCourse from "./pages/Admin/components/AssignInstarctorToCourse";
import StudentsTable from "./pages/Admin/components/Students/StudentsTable";
import UpdateStudent from "./pages/Admin/components/Students/UpdateStudent";
import InstructorProfile from "./pages/profile/components/InstructorProfile";
import StudentProfile from "./pages/profile/components/StudentProfile";
import StudentsEnrolled from "./pages/profile/components/StudentsEnrolled";
import SetGrade from "./pages/profile/components/SetGrade";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: "/",
        element: <Home />,
      },
      {
        path: "/about",
        element: <About />,
      },
      {
        path: "/contactUs",
        element: <ContactUs />,
      },
      {
        path: "/courses",
        element: <Courses />,
      },
      {
        path: "/courses/:id/:code",
        element: <CouresDetails />,
      },
      //Guest Profile Middleware
      {
        element: <GuestProfile />,
        children: [
          {
            path: "/profile",
            element: <Profile />,
            children: [
              {
                path: "/profile/student",
                element: <StudentProfile />,
              },
              {
                path: "/profile/instractor",
                element: <InstructorProfile />,
              },
              {
                path: "/profile/instractor/studentEnrolled/:id/:code",
                element: <StudentsEnrolled />,
              },
              {
                path: "/profile/instractor/studentEnrolled/grade/:student_id/:coures_id",
                element: <SetGrade/>,
              },
            ],
          },
        ],
      },
      //Guest Middleware
      {
        element: <Guest />,
        children: [
          {
            path: "/login",
            element: <Login />,
          },
        ],
      },
    ],

    errorElement: <NotFound />,
  },
  //Admin Middleware
  {
    path: "/admin",
    element: <Admin />,
    children: [
      {
        path: "/admin",
        element: <DashBoard />,
        children: [
          {
            path: "",
            element: <MainAdmin />,
          },

          {
            path: "/admin/courses",
            element: <AdminCourses />,
            children: [
              {
                path: "",
                element: <CoursesTable />,
              },
              {
                path: "/admin/courses/update/:id/:code",
                element: <UpdateCoures />,
              },
              {
                path: "/admin/courses/add",
                element: <AddCourses />,
              },
              {
                path: "/admin/courses/assgin",
                element: <AssignInstarctorToCourse />,
              },
            ],
          },
          {
            path: "/admin/instructors",
            element: <AdminInstructors />,
            children: [
              {
                path: "",
                element: <InstructorTable />,
              },
              {
                path: "/admin/instructors/update/:id",
                element: <UpdateInstructor />,
              },
              {
                path: "/admin/instructors/add",
                element: <AddUser />,
              },
              {
                path: "/admin/instructors/assgin",
                element: <AssignInstarctorToCourse />,
              },
            ],
          },
          {
            path: "/admin/students",
            element: <AdminStudents />,
            children: [
              {
                path: "",
                element: <StudentsTable />,
              },
              {
                path: "/admin/students/add",
                element: <AddUser />,
              },
              {
                path: "/admin/students/update/:id",
                element: <UpdateStudent />,
              },
            ],
          },
        ],
      },
    ],
  },
]);

export default router;
