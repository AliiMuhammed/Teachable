import "../style/features.css";
import Card from './Card'
import { features } from '../core/data/data';


const Features = ({ className }) => {
  const displayFeatures = () => {
    return features.map((feature, index) => {
      return (
        <Card
          className={`features-card ${className}`}
          key={index}
          title={feature.title}
          description={feature.description}
          icon={feature.icon}
        />
      );
    });
    }


  return (
    <section className="featureComponent-section">
      <div className="container features-container">{displayFeatures()}</div>
    </section>
  );
}

export default Features