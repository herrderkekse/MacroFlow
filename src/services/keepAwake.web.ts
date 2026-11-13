// Web build (screen gallery): there is no native keep-awake module; all no-ops.

export const KEEP_AWAKE_DEFAULT_TAG = "ExpoKeepAwakeDefaultTag";
export const WORKOUT_KEEP_AWAKE_TAG = `${KEEP_AWAKE_DEFAULT_TAG}-workout`;

export async function activateKeepAwakeAsync(_tag?: string) { }

export async function deactivateKeepAwakeAsync(_tag?: string) { }

export function useKeepAwake(_tag?: string) { }
