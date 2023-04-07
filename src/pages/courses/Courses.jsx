import React from 'react'
import { useParams } from 'react-router-dom';
const Courses = () => {
  let { id} = useParams();
  console.log(id);
  return (
    <>
      <div>ali</div>
      
    </>
  );
}

export default Courses