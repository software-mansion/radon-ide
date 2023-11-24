export function isDev() {
    return process.env.ENVIRONMENT === "DEVELOPMENT";
}

export function getDevServerScriptUrl() {
    return process.env.DEV_SCRIPT_URL;
}
