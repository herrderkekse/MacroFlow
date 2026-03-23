const isDev = __DEV__;

function formatData(data?: unknown): string {
    if (data === undefined) return "";
    try {
        return " " + JSON.stringify(data);
    } catch {
        return " [unserializable]";
    }
}

const logger = {
    debug(message: string, data?: unknown) {
        if (isDev) console.log(`[DEBUG] ${message}${formatData(data)}`);
    },
    info(message: string, data?: unknown) {
        if (isDev) console.log(`[INFO] ${message}${formatData(data)}`);
    },
    warn(message: string, data?: unknown) {
        console.warn(`[WARN] ${message}${formatData(data)}`);
    },
    error(message: string, data?: unknown) {
        console.error(`[ERROR] ${message}${formatData(data)}`);
    },
};

export default logger;
