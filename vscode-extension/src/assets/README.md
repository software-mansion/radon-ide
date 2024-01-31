# Device frames

## Android

### Android frames and masks

`~/Library/Android/sdk/skins/`

### How to prepare an Android mask

Take the transparent mask from Android SDK and open it in [Photopea](https://www.photopea.com/) (a free online image editor)

Add a new rasterize mask by:

- Layers > Rasterize mask > From Transparency

And then invert it by:

- cmd + i (Image > Adjustments > Inverse)

## iOS

### iOS frames

`/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Library/Developer/DeviceKit/Chrome/`

### iOS screen masks

`/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Library/Developer/CoreSimulator/Profiles/DeviceTypes/`

### iPhone screen dimensions

https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications

### How to prepare an iOS mask

Apple provides masks as vector `.pdf` files. You need to convert the .pdf file to .svg. Online converters like "pdf to svg" work just fine.
