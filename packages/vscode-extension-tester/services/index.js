import { ElementHelperService, VSCodeHelperService } from "./helperServices.js";
import {
  RadonViewsService,
  RadonSettingsService,
  ManagingDevicesService,
  AppManipulationService,
} from "./radonInteractionsServices.js";

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
