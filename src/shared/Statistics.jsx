import { useState } from "react"
import CountUp from 'react-countup';
import ScrollTrigger from "react-scroll-trigger"

import {GiTeacher} from "react-icons/gi"
import {ImBooks} from "react-icons/im"
import {BsFillPersonPlusFill} from "react-icons/bs"
import "../style/statistics.css"

const Statistics = () => {

    const [counterOn, SetCounterOn]=useState(false)
    return (
        <ScrollTrigger onEnter={()=>SetCounterOn(true)} onExit={()=>SetCounterOn(false)}>
            <section className="stats-section">
                <div className="container stats-container">
                    <div className="instractor-stats">
                        <div className="stats-icon"><GiTeacher/></div>
                        <h1>{counterOn && <CountUp start={0} end={150} duration={3} delay={0}/>}</h1>
                        <span className="stats-type">Instractors</span>
                    </div>
                    <div className="courses-stats">
                        <div className="stats-icon"><ImBooks/></div>
                        <h1>{counterOn && <CountUp start={0} end={260} duration={3} delay={0}/>}</h1>
                        <span className="stats-type">Total Courses</span>
                    </div>
                    <div className="students-stats">
                        <div className="stats-icon"><BsFillPersonPlusFill/></div>
                        <h1>{counterOn && <CountUp start={0} end={900} duration={3} delay={0}/>}</h1>
                        <span className="stats-type">Registered Enrolls</span>
                    </div>
                </div>
            </section>
        </ScrollTrigger>

  )
}

export default Statistics