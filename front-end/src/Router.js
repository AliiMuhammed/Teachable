import {  createBrowserRouter, Navigate} from "react-router-dom";
import Home from "./pages/home/Home";
import Login from "./pages/login/Login";
import Courses from "./pages/courses/Courses";
import About from "./pages/about/About";
import NotFound from "./pages/notFound/NotFound";
import ContactUs from "./pages/contactUs/ContactUs";
 import Profile from "./pages/profile/Profile";
import MyCourses from "./pages/profile/components/MyCourses";
import MyGrades from "./pages/profile/components/MyGrades";
import App from "./App";

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
      {
        path: "/login",
        element: <Login />,
      }
    ],
    errorElement:<NotFound />
  }
]);

export default router
