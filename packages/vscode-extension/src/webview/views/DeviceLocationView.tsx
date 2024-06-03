import { useProject } from "../providers/ProjectProvider";
import React, { useState } from "react";
import "./DeviceLocationView.css";
import Label from "../components/shared/Label";
import * as Switch from "@radix-ui/react-switch";
import CoordinateParser from "coordinate-parser";
import { throttleWithTrailing } from "../../common/utils";
import Tooltip from "../components/shared/Tooltip";

const CoordinateInfo = () => {
  return (
    <>
      <h3>Supported formats:</h3>
      <li>40.123, -74.123</li>
      <li>40.123° N 74.123° W</li>
      <li>40° 7´ 22.8" N 74° 7´ 22.8" W</li>
      <li>40° 7.38’, -74° 7.38’</li>
      <li>N40°7’22.8, W74°7’22.8"</li>
      <li>40°7’22.8"N, 74°7’22.8"W</li>
      <li>40 7 22.8, -74 7 22.8</li>
      <li>40.123 -74.123</li>
      <li>40.123°,-74.123°</li>
      <li>144442800, -266842800</li>
      <li>40.123N74.123W</li>
      <li>4007.38N7407.38W</li>
      <li>40°7’22.8"N, 74°7’22.8"W</li>
      <li>400722.8N740722.8W</li>
      <li>N 40 7.38 W 74 7.38</li>
      <li>40:7:23N,74:7:23W</li>
      <li>40:7:22.8N 74:7:22.8W</li>
      <li>40°7’23"N 74°7’23"W</li>
      <li>40°7’23" -74°7’23"</li>
      <li>40d 7’ 23" N 74d 7’ 23" W</li>
      <li>40.123N 74.123W</li>
      <li>40° 7.38, -74° 7.38</li>
    </>
  );
};

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
      <div className="coordinate-label">
        <Label>Coordinate</Label>
        <Tooltip label={CoordinateInfo()} side="right" type="primary">
          <span className="codicon codicon-info"></span>
        </Tooltip>
      </div>
      <label className="latitude">
        <div className="picker">
          <input
            className="coordinate"
            style={isCoordinateValid ? {} : { border: "1px solid var(--red-light-100)" }}
            type="string"
            defaultValue={`(${deviceSettings.location.latitude}, ${deviceSettings.location.longitude})`}
            onChange={handleCoordinateChange}
            disabled={deviceSettings.location.isDisabled}
          />
        </div>
      </label>

      {!isCoordinateValid && (
        <div className="submit-rejection-message">Make sure that the coordinates are valid.</div>
      )}
    </>
  );
}
