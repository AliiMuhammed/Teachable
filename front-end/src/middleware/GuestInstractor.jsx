import { Outlet, Navigate } from "react-router-dom";
import { getAuthUser } from "../helper/Storage";

const GuestInstractor = () => {
  const auth = getAuthUser();
  return (
    <>
      {auth ? (
        auth.type === "instractor" ? (
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

export default GuestInstractor;
