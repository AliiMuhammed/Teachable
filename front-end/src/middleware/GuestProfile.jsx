import { Outlet, Navigate } from "react-router-dom";
import { getAuthUser } from "../helper/Storage";

const GuestProfile = () => {
  const auth = getAuthUser();
  return <>{auth? <Outlet /> : <Navigate to={"/"} />}</>;
};

export default GuestProfile;
