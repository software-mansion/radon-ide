import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import "./App.css";

const render = () => {
    ReactDOM.render(<App />, document.getElementById('root'));
}

if (module.hot) {
    module.hot.accept('./App', render);
}

render();