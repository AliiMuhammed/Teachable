import { createBrowserRouter, Navigate } from "react-router-dom";
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
import AdminCourses from "./pages/Admin/components/Courses/AdminCourses"
import MainAdmin from "./pages/Admin/components/MainAdmin";
import AdminInstractors from "./pages/Admin/components/Instractors/AdminInstractors";
import AdminStudents from "./pages/Admin/components/Students/AdminStudents";

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
        path: "",
        element: <DashBoard />,
        children: [
          {
            path: "",
            element: <MainAdmin />,
          },

          {
            path: "/admin/courses",
            element: <AdminCourses />,
          },
          {
            path: "/admin/instractors",
            element:<AdminInstractors/>
          },
          {
            path: "/admin/students",
            element:<AdminStudents/>
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
