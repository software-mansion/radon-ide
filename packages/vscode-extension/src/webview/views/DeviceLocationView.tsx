import { useProject } from "../providers/ProjectProvider";
import React, { useState } from "react";
import "./DeviceLocationView.css";
import Button from "../components/shared/Button";
import Label from "../components/shared/Label";
import * as Switch from "@radix-ui/react-switch";

enum Direction {
  South = "S",
  North = "N",
  West = "W",
  East = "E",
}

export function DeviceLocationView() {
  const { project, deviceSettings } = useProject();

  const [isLatitudeValid, setIsLatitudeValid] = useState(true);
  const [isLongitudeValid, setIsLongitudeValid] = useState(true);

  const [shouldDisplaySubmitRejectionMessage, setShouldDisplaySubmitRejectionMessage] =
    useState(false);

  const [latitude, setLatitude] = useState(
    deviceSettings.location.latitude < 0
      ? -deviceSettings.location.latitude
      : deviceSettings.location.latitude
  );
  const [longitude, setLongitude] = useState(
    deviceSettings.location.longitude < 0
      ? -deviceSettings.location.longitude
      : deviceSettings.location.longitude
  );

  const [latDirection, setLatDirection] = useState(
    deviceSettings.location.latitude < 0 ? Direction.South : Direction.North
  );

  const [lonDirection, setLonDirection] = useState(
    deviceSettings.location.longitude < 0 ? Direction.West : Direction.East
  );

  const handleLatitudeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newLatitude = parseFloat(event.target.value);
    if (newLatitude < -90 || newLatitude > 90) {
      setIsLatitudeValid(false);
      return;
    }
    setShouldDisplaySubmitRejectionMessage(false);
    setIsLatitudeValid(true);
    setLatitude(newLatitude);
  };

  const handleLongitudeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newLongitude = parseFloat(event.target.value);
    if (newLongitude < -180 || newLongitude > 180) {
      setIsLongitudeValid(false);
      return;
    }
    setShouldDisplaySubmitRejectionMessage(false);
    setIsLongitudeValid(true);
    setLatitude(newLongitude);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!(isLatitudeValid && isLongitudeValid)) {
      setShouldDisplaySubmitRejectionMessage(true);
      return;
    }

    project.updateDeviceSettings({
      ...deviceSettings,
      location: {
        ...deviceSettings.location,
        latitude: latDirection === Direction.South ? -latitude : latitude,
        longitude: lonDirection === Direction.West ? -longitude : longitude,
      },
    });
  };

  const handleEnableLocation = (check: boolean) => {
    const isDisabled = !check;
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
              style={isLatitudeValid ? {} : { border: "1px solid var(--red-light-100)" }}
              type="number"
              step="0.000001"
              defaultValue={latitude}
              onChange={handleLatitudeChange}
            />
            <select
              className="direction"
              defaultValue={latDirection}
              onChange={(e) =>
                setLatDirection(e.target.value === "N" ? Direction.North : Direction.South)
              }>
              <option value={Direction.North}>N</option>
              <option value={Direction.South}>S</option>
            </select>
          </div>
        </label>

        <Label>Longitude</Label>
        <label className="longitude">
          <div className="picker">
            <input
              className="coordinate"
              style={isLongitudeValid ? {} : { border: "1px solid var(--red-light-100)" }}
              type="number"
              step="0.000001"
              defaultValue={longitude}
              onChange={handleLongitudeChange}
            />
            <select
              className="direction"
              defaultValue={lonDirection}
              onChange={(e) =>
                setLonDirection(e.target.value === "E" ? Direction.East : Direction.West)
              }>
              <option value={Direction.East}>E</option>
              <option value={Direction.West}>W</option>
            </select>
          </div>
        </label>
        <Button type="submit">Set Current Location</Button>
        {shouldDisplaySubmitRejectionMessage && (
          <div className="submit-rejection-message">Make sure that the coordinates are valid.</div>
        )}
      </form>
      <Label>Enable Location</Label>
      <div style={{ display: "flex", alignItems: "center" }}>
        <Switch.Root
          className="SwitchRoot"
          id="enable-location"
          onCheckedChange={handleEnableLocation}
          defaultChecked={!deviceSettings.location.isDisabled}>
          <Switch.Thumb className="SwitchThumb" />
        </Switch.Root>
      </div>
    </>
  );
}
