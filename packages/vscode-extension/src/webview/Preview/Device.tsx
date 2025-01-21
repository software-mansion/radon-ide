import { Resizable, ResizableProps } from "re-resizable";
import { useWorkspaceConfig } from "../providers/WorkspaceConfigProvider";
import DeviceFrame from "./DeviceFrame";
import { DeviceProperties } from "../utilities/consts";


interface DeviceProps {
   device: DeviceProperties,
   resizableProps: ResizableProps;
   children: React.ReactNode;
}

export default function Device({
   device,
   resizableProps,
   children
}: DeviceProps) {
   const workspace = useWorkspaceConfig();

   const isFrameDisabled = workspace.showDeviceFrame === false;
   
   return (
      <Resizable {...resizableProps}>
         <div className="phone-content">
            <DeviceFrame device={device} isFrameDisabled={isFrameDisabled} />
            <img src={device.screenImage} className="phone-screen-background" />
            {children}
         </div>
      </Resizable>
   );
}