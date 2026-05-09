export const ExpoKeepAwakeTag = "ExpoKeepAwakeDefaultTag";

export function useKeepAwake() {
    // Expo's dev wrapper auto-imports expo-keep-awake when the package is present.
    // This shim prevents a global dev-only wake lock.
}

export async function activateKeepAwakeAsync() { }

export async function deactivateKeepAwake() { }