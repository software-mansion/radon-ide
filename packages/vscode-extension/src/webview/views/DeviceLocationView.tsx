import { useProject } from "../providers/ProjectProvider";
import React, { useState, useEffect } from "react";

import './DeviceLocationView.css';

export function DeviceLocationView() {
  const { project, deviceSettings } = useProject();

  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [latDirection, setLatDirection] = useState('N');
  const [lonDirection, setLonDirection] = useState('E');
  const [calcValue, setCalcValue] = useState<{ lat: string; lon: string }>({ lat: "", lon: "" });

  // Set default values
//   useEffect(() => {
//     if (deviceSettings && deviceSettings.defaultLat && deviceSettings.defaultLon) {
//       setLatitude(deviceSettings.defaultLat);
//       setLongitude(deviceSettings.defaultLon);
//     }
//   }, [deviceSettings]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Manipulation logic for latitude and longitude can go here
    let finalLat = latDirection === 'S' ? -parseFloat(latitude) : parseFloat(latitude);
    let finalLon = lonDirection === 'W' ? -parseFloat(longitude) : parseFloat(longitude);

    setCalcValue({ lat: (finalLat * 2).toString(), lon: (finalLon * 2).toString() });
  };
     
  return (
    <div className="location-controls">
      <form onSubmit={handleSubmit}>

          <label className="latitude">
  Latitude:
  <div className="picker">
    <input className="coordinate" type="number" step="0.00001" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
    <select className="direction" value={latDirection} onChange={(e) => setLatDirection(e.target.value)}>
      <option value="N">N</option>
      <option value="S">S</option>
    </select>
  </div>
</label>


          <label className="longitude">
  Longitude:
  <div className="picker">
    <input className="coordinate" type="number" step="0.00001" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
    <select className="direction" value={lonDirection} onChange={(e) => setLonDirection(e.target.value)}>
      <option value="E">E</option>
      <option value="W">W</option>
    </select>
  </div>

        </label>
        <button type="submit">Submit</button>
      </form>
      <div>
        <h3>Manipulated Latitude:</h3>
        <p>{calcValue.lat}</p>
        <h3>Manipulated Longitude:</h3>
        <p>{calcValue.lon}</p>
      </div>
    </div>
  );
};