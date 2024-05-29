import { useProject } from "../providers/ProjectProvider";
import React, { useState, useEffect } from "react";

import "./DeviceLocationView.css";
import Button from "../components/shared/Button";
import Label from "../components/shared/Label";

export function DeviceLocationView() {
  const { project, deviceSettings } = useProject();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // @ts-ignore
    const latitude = event.target[0].value;
    // @ts-ignore
    const longitude = event.target[2].value;
    // @ts-ignore
    const latDirection = event.target[1].value;
    // @ts-ignore
    const lonDirection = event.target[3].value;

    project.updateDeviceSettings({
      ...deviceSettings,
      location: {
        ...deviceSettings.location,
        latitude: latDirection === "S" ? -parseFloat(latitude) : parseFloat(latitude),
        longitude: lonDirection === "W" ? -parseFloat(longitude) : parseFloat(longitude),
      },
    });
  };

  const handleDisableLocation = (e: any) => {
    e.preventDefault();

    const isDisabled = e.target.value === "true";
    project.updateDeviceSettings({
      ...deviceSettings,
      location: {
        ...deviceSettings.location,
        isDisabled,
      },
    });
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="location-controls">
        <Label>Latitude</Label>
        <label className="latitude">
          <div className="picker">
            <input
              className="coordinate"
              type="number"
              step="0.000001"
              defaultValue={
                deviceSettings.location.latitude < 0
                  ? -deviceSettings.location.latitude
                  : deviceSettings.location.latitude
              }
            />
            <select
              className="direction"
              defaultValue={deviceSettings.location.latitude < 0 ? "S" : "N"}>
              <option value="N">N</option>
              <option value="S">S</option>
            </select>
          </div>
        </label>

        <Label>Longitude</Label>
        <label className="longitude">
          <div className="picker">
            <input
              className="coordinate"
              type="number"
              step="0.000001"
              defaultValue={
                deviceSettings.location.longitude < 0
                  ? -deviceSettings.location.longitude
                  : deviceSettings.location.longitude
              }
            />
            <select
              className="direction"
              defaultValue={deviceSettings.location.longitude < 0 ? "W" : "E"}>
              <option value="E">E</option>
              <option value="W">W</option>
            </select>
          </div>
        </label>
        <Button type="submit">Set Current Location</Button>
      </form>
      <Label>Disable Location</Label>
      <select
        className="select-disable-location"
        defaultValue={deviceSettings.location.isDisabled ? "true" : "false"}
        onChange={handleDisableLocation}>
        <option value="true">YES</option>
        <option value="false">NO</option>
      </select>
    </>
  );
}
