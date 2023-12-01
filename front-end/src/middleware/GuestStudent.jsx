import { Outlet, Navigate } from "react-router-dom";
import { getAuthUser } from "../helper/Storage";

const GuestStudent = () => {
  const auth = getAuthUser();
  return (
    <>
      {auth ? (
        auth.type === "student" ? (
          <Outlet />
        ) : (
          <Navigate to={"/"} />
        )
      ) : (
        <Navigate to={"/"} />
      )}
    </>
  );
};

export default GuestStudent;
