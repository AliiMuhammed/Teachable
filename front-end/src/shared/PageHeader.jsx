import "../style/pageHeader.css";

const PageHeader = ({header,children}) => {
  return (
    <header className="page-header">
      <h1>{header}</h1>
      <div className="header-content">
        <div>{children}</div>
      </div>
    </header>
  );
}

export default PageHeader