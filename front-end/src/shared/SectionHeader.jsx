import "../style/sectionHeader.css";

const SectionHeader = ({ smTilte, title, description, className }) => {
  return (
    <div className={`sectionHeader ${className}`}>
      <div className="sectionHeader-container">
        <div className="content">
          <span>{smTilte}</span>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
    </div>
  );
};

export default SectionHeader