# assets formats:

To avoid bugs caused by other formats, please add skins as a `.webp` files and masks as `.png` files.

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

### iOS screen masks

Open 

`/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Library/Developer/CoreSimulator/Profiles/DeviceTypes/{deviceType}/Contents/Resources/{WEIRD_HASH}.pdf` 

And export it with 72 DPI. 

In `Profile.plist` you can find `chromeIdentifier` that points later to iOS frame. In this file you can find also `mainScreenHeight` and `mainScreenWidth`. 

Make sure mask matches screen width and height and there is no gap on the edge.

### iOS frames

Open `/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Library/Developer/DeviceKit/Chrome/{device}/Contents/Resources/PhoneComposite.pdf`

Open in preview and export with 216 DPI.

Where `{device}` is taken from `.plist` file mentioned above.

# Adding screen.png and bezel.png

To make screen.png just remove notches if there are any, and for `bezel.png` extend the screen by `4px` on each side and create an outline with radius `4px`.