import { useProject } from "../providers/ProjectProvider";
import React, { useState, useEffect } from "react";

import "./DeviceLocationView.css";
import Button from "../components/shared/Button";

export function DeviceLocationView() {
  const { project, deviceSettings } = useProject();

  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [latDirection, setLatDirection] = useState("N");
  const [lonDirection, setLonDirection] = useState("E");

  //   Set default values
  useEffect(() => {
    if (deviceSettings.location) {
      if (deviceSettings.location.latitude < 0) {
        setLatitude((-deviceSettings.location.latitude).toString());
        setLatDirection("S");
      } else {
        setLatitude(deviceSettings.location.latitude.toString());
        setLatDirection("N");
      }
      if (deviceSettings.location.longitude < 0) {
        setLongitude((-deviceSettings.location.longitude).toString());
        setLonDirection("W");
      } else {
        setLongitude(deviceSettings.location.longitude.toString());
        setLonDirection("E");
      }
    }
  }, [deviceSettings]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    project.updateDeviceSettings({
      ...deviceSettings,
      location: {
        latitude: latDirection === "S" ? -parseFloat(latitude) : parseFloat(latitude),
        longitude: lonDirection === "W" ? -parseFloat(longitude) : parseFloat(longitude),
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="location-controls">
      <label className="latitude">
        Latitude:
        <div className="picker">
          <input
            className="coordinate"
            type="number"
            step="0.00001"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
          />
          <select
            className="direction"
            value={latDirection}
            onChange={(e) => setLatDirection(e.target.value)}>
            <option value="N">N</option>
            <option value="S">S</option>
          </select>
        </div>
      </label>

      <label className="longitude">
        Longitude:
        <div className="picker">
          <input
            className="coordinate"
            type="number"
            step="0.00001"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
          />
          <select
            className="direction"
            value={lonDirection}
            onChange={(e) => setLonDirection(e.target.value)}>
            <option value="E">E</option>
            <option value="W">W</option>
          </select>
        </div>
      </label>
      <Button type="submit">Set Current Location</Button>
    </form>
  );
}
