# Custom Icons bundled as a font

This directory contains the icons that are bundled as a font in the `assets/font-icons` directory.

Some custom icons that are used by the extensions cannot be provided as SVGs because they are not styled according to the editor themes.

This is specifically the case for icons used by "menus" extension point as defined in `package.json`.

Icons bundled as a font can be referenced in the extension configuration using the `$(icon-id)` syntax.

## Adding new icons

In order to add new icons to the font, you can use the following steps:

1. Add SVG version of the icon to the `font-icons` directory. Keep the size and format consistent with the existing icons and with VSCode guidelines (i.e. https://code.visualstudio.com/api/references/contribution-points#Command-icon-specifications).
2. Add the icon to the `fantasticon.config.json` file and assign a codepoint.
3. Run `npm run build:icons` to build the font.
4. List the new icon in `package.json` under `contributes.icons` section, assign a name and use the codepoint of the icon as the `fontCharacter` value. Use `"radon-"` prefix for the icon name to avoid it colliding with other icons.
5. Commit the icon, updated woff2 font file, and the updates to the `package.json` file.
