import "semantic-ui-less/semantic.less";
import App from "./components/App";
import React from "react";
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router } from "react-router-dom";

const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <Router>
    <App />
  </Router>
);
