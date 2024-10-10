const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function showUsage() {
    console.log("Copies shared code to a destination directory. Shared code has navigation directory, integrating with expo-router. To copy it, use 'expo-router' as the first argument. Otherwise, use 'bare'.");
    console.log("Example: ./copy.js expo-router /src/shared");
    console.log("");
    console.log(`Usage: ${path.basename(process.argv[1])} {bare | expo-router} <destination>`);
    process.exit(1);
}

if (process.argv.length !== 4 || !["bare", "expo-router"].includes(process.argv[2])) {
    showUsage();
}

const mode = process.argv[2];
const destination = process.argv[3];
const scriptDir = path.dirname(__filename);

if (fs.existsSync(destination)) {
    fs.rmSync(destination, { recursive: true, force: true });
}
fs.mkdirSync(destination, { recursive: true });

const sourceDir = path.join(scriptDir, 'src');
execSync(`cp -R ${sourceDir}/ ${destination}`);

// Remove the "navigation" directory is only testable in expo-router setups so we need to remove it
if (mode === "bare") {
    const navigationDir = path.join(destination, 'navigation');
    if (fs.existsSync(navigationDir)) {
        fs.rmSync(navigationDir, { recursive: true, force: true });
    }
}
