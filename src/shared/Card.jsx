import '../style/card.css'
const Card = ({title,description,icon ,className}) => {
  return (
    <div className={`card ${className}`}>
        <div className="card-body">
        <div className="card-icon">{icon}</div>      
        <h4 className="card-title">{title}</h4>
        <p className="card-text">{description}</p>
      </div>
    </div>
  )
}

export default Card