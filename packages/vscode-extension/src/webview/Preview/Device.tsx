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
            {children}
            <DeviceFrame device={device} isFrameDisabled={isFrameDisabled} />
         </div>
      </Resizable>
   );
}