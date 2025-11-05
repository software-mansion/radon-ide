import { ElementHelperService, VSCodeHelperService } from "./helperServices.js";
import RadonViewsService from "./radonViewsService.js";
import RadonSettingsService from "./radonSettingsService.js";
import ManagingDevicesService from "./managingDevicesService.js";
import AppManipulationService from "./appManipulationService.js";

export default function initServices(driver) {
  return {
    elementHelperService: new ElementHelperService(driver),
    vscodeHelperService: new VSCodeHelperService(driver),
    radonViewsService: new RadonViewsService(driver),
    radonSettingsService: new RadonSettingsService(driver),
    managingDevicesService: new ManagingDevicesService(driver),
    appManipulationService: new AppManipulationService(driver),
  };
}
