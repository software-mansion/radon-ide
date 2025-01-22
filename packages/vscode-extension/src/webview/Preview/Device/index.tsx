import { Resizable, ResizableProps } from "re-resizable";

import DeviceFrame from "./DeviceFrame";

import { DeviceProperties, DevicePropertiesFrame } from "../../utilities/consts";
import { useWorkspaceConfig } from "../../providers/WorkspaceConfigProvider";

declare module "react" {
   interface CSSProperties {
     [key: `--${string}`]: string | number;
   }
 }

interface DeviceProps {
   device: DeviceProperties,
   resizableProps: ResizableProps;
   children: React.ReactNode;
}

function cssPropertiesForDevice(device: DeviceProperties, frame: DevicePropertiesFrame) {
   return {
     "--phone-screen-height": `${(device.screenHeight / frame.height) * 100}%`,
     "--phone-screen-width": `${(device.screenWidth / frame.width) * 100}%`,
     "--phone-aspect-ratio": `${frame.width / frame.height}`,
     "--phone-top": `${(frame.offsetY / frame.height) * 100}%`,
     "--phone-left": `${(frame.offsetX / frame.width) * 100}%`,
     "--phone-mask-image": `url(${device.maskImage})`,
   } as const;
 }

export default function Device({
   device,
   resizableProps,
   children
}: DeviceProps) {
   const workspace = useWorkspaceConfig();
   const isFrameDisabled = workspace.showDeviceFrame === false;
   const frame = isFrameDisabled ? device.bezel : device.skin;

   return (
      <Resizable {...resizableProps}>
         <div className="phone-content" style={cssPropertiesForDevice(device, frame)}>
            <DeviceFrame frame={frame} />
            <img src={device.screenImage} className="phone-screen-background" />
            {children}
         </div>
      </Resizable>
   );
}