import { Outlet } from 'react-router';
import NavBar from './shared/NavBar';
import Footer from './shared/Footer';
import ScrollToTop from "react-scroll-to-top";
import ScrollTop from "./shared/ScrollTop"
function App() {
  return (
    <>
      <NavBar />
      <Outlet />
      <Footer />
      <ScrollToTop smooth className='scrollToTop-btn' color='white' />
      <ScrollTop/>
    </>
  );
}

export default App;
