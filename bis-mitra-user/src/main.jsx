import React from 'react';
import ReactDOM from 'react-dom/client';
import PortalApp from './portal/PortalApp';
import './portal/portal.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PortalApp mode="user" />
  </React.StrictMode>,
);
