import SectionHeader from "./SectionHeader"
import "../style/coursesSection_V.css";


const CoursesSection_V = ({className,sectionTilte,smSectionTitle,sectionDes,children}) => {
  return (
    <section className={`coursesSection-V ${className}`}>
      <SectionHeader
        title={sectionTilte}
        smTilte={smSectionTitle}
        description={sectionDes}
      />
      <div className="container coursesSection-V-container">{children}</div>
    </section>
  );
}

export default CoursesSection_V;