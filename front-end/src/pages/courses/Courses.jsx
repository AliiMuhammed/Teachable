import React from 'react'
import { useParams } from 'react-router-dom';
const Courses = () => {
//   let {course, setCourses} = useState({
//   loading: true,
//   results: [],
//   err: null,
//   reload: 0,
// })

// useEffect(() =>{
//   setCourses({...course, loading: true})
//   axios.get('http://localhost:4002/courses')
//   .then((resp) => {
//     console.log(resp);
//     setCourses({...course, results: resp.data, loading: false})
//   })
//   .catch((err) => {
//     setCourses({...course, loading: false, err: "somthing went wrong"});
//   })
// }, [])
  let { id} = useParams();
  console.log(id);
  return (
    <>
      <div>ahmed</div>

    </>
  );
}

export default Courses