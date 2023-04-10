import React, { useState } from "react";
import "./style/contactUs.css";
import PageHeader from "../../shared/PageHeader";
import { Link } from "react-router-dom";
import SectionHeader from "../../shared/SectionHeader";
// import { Navigate } from "react-router-dom";

const ContactUs = () => {
  const [contactUsForm, setContactUsForm] = useState({
    email: "",
    subject: "",
    message: "",
    name: "",
  });

  const [errorText, setErrorText] = useState();
  const ContactUs = (e) => {
    e.preventDefault();
    if (
      contactUsForm.name === "" ||
      contactUsForm.email === "" ||
      contactUsForm.subject === "" ||
      contactUsForm.message === ""
    ) {
      setErrorText(true);
    } else {
      setErrorText(false);
    }
  };

  return (
    <>
      <PageHeader header={"Contact Us"}>
        <ul className="navigate-links">
          <li>
            <Link to={"/"}>Home</Link>
          </li>
          <li>/</li>
          <li>Contact</li>
        </ul>
      </PageHeader>
      <section className="map-section">
        <div className="container map-container">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3460.036848473182!2d31.315324484568595!3d29.86321113406534!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x1458368becfaa68d%3A0xb8a6f7d9576f81f8!2z2YPZhNmK2Kkg2KfZhNit2KfYs9io2KfYqiDZiNin2YTYsNmD2KfYoSDYp9mE2KfYtdi32YbYp9i52YrYjCDYrNin2YXYudipINit2YTZiNin2YY!5e0!3m2!1sar!2seg!4v1680655316486!5m2!1sar!2seg"
            width="800"
            height="400"
            style={{ border: 0 }}
            allowFullScreen=""
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="map"
          ></iframe>
        </div>
      </section>

      <section className="leaveMsg-section">
        <div className="container leaveMsg-container">
          <SectionHeader
            smTilte={"CONTACT"}
            title={"For more information about our courses, get in touch"}
          />
          <div className="contact-details">
            <div className="contact-left">
              <div className="contact-item">
                <p>Email Us</p>
                <h4>support@email.com</h4>
              </div>
              <div className="contact-item">
                <p>Make a Call</p>
                <h4>01066567630</h4>
              </div>
              <div className="contact-item">
                <p>Location</p>
                <h4>
                  Faculty of computers and artificial intelligence helwan
                  university
                </h4>
              </div>
            </div>
            <div className="contact-right">
              <div className="contact-form">
                <form
                  action="POST"
                  onSubmit={(e) => {
                    ContactUs(e);
                  }}
                >
                  {errorText ? <h1>error</h1> :""}
                  <div className="form-group contact-form-group">
                    <input
                      type="text"
                      placeholder="Name"
                      value={contactUsForm.name}
                      onChange={(event) =>
                        setContactUsForm({
                          ...contactUsForm,
                          name: event.target.value,
                        })
                      }
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={contactUsForm.email}
                      onChange={(event) =>
                        setContactUsForm({
                          ...contactUsForm,
                          email: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <input
                      type="text"
                      placeholder="Subject"
                      value={contactUsForm.subject}
                      onChange={(event) =>
                        setContactUsForm({
                          ...contactUsForm,
                          subject: event.target.value,
                        })
                      }
                    />
                  </div>
                  <textarea
                    placeholder="Your Message"
                    value={contactUsForm.message}
                    onChange={(event) =>
                      setContactUsForm({
                        ...contactUsForm,
                        message: event.target.value,
                      })
                    }
                  />
                  <input
                    type="submit"
                    value={"Send Message"}
                    className="btn contact-btn"
                  />
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default ContactUs;
