import { createBrowserRouter } from "react-router-dom";
import Home from "./pages/home/Home";
import Login from "./pages/login/Login";
import Courses from "./pages/courses/Courses";
import CouresDetails from "./pages/couresDetails/CouresDetails";
import About from "./pages/about/About";
import NotFound from "./pages/notFound/NotFound";
import ContactUs from "./pages/contactUs/ContactUs";
import Profile from "./pages/profile/Profile";
import MyCourses from "./pages/profile/components/MyCourses";
import MyGrades from "./pages/profile/components/MyGrades";
import App from "./App";
import Guest from "./middleware/Guest";
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
      {
        path: "/profile",
        element: <Profile />,
        children: [
          {
            path: "/profile/my-courses",
            element: <MyCourses />,
          },
          {
            path: "/profile/my-grades",
            element: <MyGrades />,
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

      // {
      //   path: "courses",
      //   children: [
      //     {
      //       path: "/addCourse",
      //       element: <AddCourse/>,
      //     },
      //     {
      //       path: "update",
      //       element: <div></div>,
      //     },
      //     {
      //       path: "create",
      //       element: <div></div>,
      //     },
      //     {
      //       path: "delete",
      //       element: <div></div>,
      //     },
      //   ],
      // }
    ],
  },
]);

export default router;
