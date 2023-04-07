import{BrowserRouter,Routes,Route} from 'react-router-dom'

import Home from './pages/home/Home'
import Login from './pages/login/Login'
import Courses from './pages/courses/Courses'
import About from './pages/about/About'
import NotFound from './pages/notFound/NotFound'
import ContactUs from './pages/contactUs/ContactUs'
import NavBar from './shared/NavBar';
import Footer from './shared/Footer';
import ScrollToTop from "react-scroll-to-top";

function App() {
  return (
    <>
      <BrowserRouter>
        <NavBar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/about" element={<About />} />
          <Route path="/contactUs" element={<ContactUs />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Footer />
        <ScrollToTop smooth className='scrollToTop-btn' color='white' />
      </BrowserRouter>
    </>
  );
}

export default App;
