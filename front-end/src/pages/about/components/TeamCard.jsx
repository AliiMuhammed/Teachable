import React from 'react'
import "../style/teamCard.css"
const TeamCard = ({name,title,img}) => {
  return (
    <div className="teamCard">
      <div className="teamCard-image">
        <img src={img} alt="" />
      </div>
      <div className="teamCard-content">
        <h3>{name}</h3>
        <h4>{title}</h4>
      </div>
    </div>
  );
}

export default TeamCard