// Web stand-in for expo-secure-store (screen gallery only): plain localStorage.
// expo-secure-store's own web build lacks the sync getItem/setItem the app uses.

function storage(): Storage | null {
    try {
        return globalThis.localStorage ?? null;
    } catch {
        return null;
    }
}

export function getItem(key: string): string | null {
    return storage()?.getItem(key) ?? null;
}

export function setItem(key: string, value: string): void {
    storage()?.setItem(key, value);
}

export async function getItemAsync(key: string): Promise<string | null> {
    return getItem(key);
}

export async function setItemAsync(key: string, value: string): Promise<void> {
    setItem(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
    storage()?.removeItem(key);
}

export async function isAvailableAsync(): Promise<boolean> {
    return storage() !== null;
}
