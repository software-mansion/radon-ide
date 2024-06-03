import { useProject } from "../providers/ProjectProvider";
import React, { useState } from "react";
import "./DeviceLocationView.css";
import Label from "../components/shared/Label";
import * as Switch from "@radix-ui/react-switch";
import CoordinateParser from "coordinate-parser";
import { throttleWithTrailing } from "../../common/utils";

const THROTTLE_LIMIT = 1000;

export function DeviceLocationView() {
  const { project, deviceSettings } = useProject();

  const updateProjectSettingWithThrottle = throttleWithTrailing(
    project.updateDeviceSettings,
    THROTTLE_LIMIT
  );

  const [isCoordinateValid, setIsCoordinateValid] = useState(true);

  const handleCoordinateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newCoordinate = event.target.value;
    let position;
    try {
      position = new CoordinateParser(newCoordinate);
      setIsCoordinateValid(true);
    } catch (e) {
      setIsCoordinateValid(false);
      return;
    }

    updateProjectSettingWithThrottle({
      ...deviceSettings,
      location: {
        ...deviceSettings.location,
        latitude: position.getLatitude(),
        longitude: position.getLongitude(),
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
      <Label>Latitude</Label>
      <label className="latitude">
        <div className="picker">
          <input
            className="coordinate"
            style={isCoordinateValid ? {} : { border: "1px solid var(--red-light-100)" }}
            type="string"
            defaultValue={`(${deviceSettings.location.latitude}, ${deviceSettings.location.longitude})`}
            onChange={handleCoordinateChange}
          />
        </div>
      </label>

      {!isCoordinateValid && (
        <div className="submit-rejection-message">Make sure that the coordinates are valid.</div>
      )}
    </>
  );
}
