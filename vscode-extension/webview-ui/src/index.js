import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import "./App.css";
import GlobalStateProvider from "./components/GlobalStateContext";

const render = () => {
    ReactDOM.render(
    <React.StrictMode>
        <GlobalStateProvider>
        <App />
        </GlobalStateProvider>
    </React.StrictMode>, 
    document.getElementById('root'));
}

if (module.hot) {
    module.hot.accept('./App', render);
}

render();
