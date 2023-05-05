import React from 'react';
import ReactDOM from 'react-dom/client';
import {RouterProvider} from "react-router-dom";
import {router} from './Router'
import 'bootstrap/dist/css/bootstrap.min.css';

import './style/index.css'
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(

    <RouterProvider router={router} />
  
)



