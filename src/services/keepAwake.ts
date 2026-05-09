import { requireNativeModule } from "expo-modules-core";
import { useEffect, useId } from "react";

interface ExpoKeepAwakeModule {
    activate(tag: string): Promise<void>;
    deactivate(tag: string): Promise<void>;
}

const ExpoKeepAwake = requireNativeModule<ExpoKeepAwakeModule>("ExpoKeepAwake");

export const KEEP_AWAKE_DEFAULT_TAG = "ExpoKeepAwakeDefaultTag";
export const WORKOUT_KEEP_AWAKE_TAG = `${KEEP_AWAKE_DEFAULT_TAG}-workout`;

export async function activateKeepAwakeAsync(tag: string = KEEP_AWAKE_DEFAULT_TAG) {
    await ExpoKeepAwake.activate(tag);
}

export async function deactivateKeepAwakeAsync(tag: string = KEEP_AWAKE_DEFAULT_TAG) {
    await ExpoKeepAwake.deactivate(tag);
}

export function useKeepAwake(tag?: string) {
    const generatedTag = useId();
    const activeTag = tag ?? generatedTag;

    useEffect(() => {
        let isMounted = true;

        activateKeepAwakeAsync(activeTag).catch(() => { });

        return () => {
            isMounted = false;
            void deactivateKeepAwakeAsync(activeTag).catch(() => {
                if (isMounted) {
                    throw new Error("Failed to release keep awake state");
                }
            });
        };
    }, [activeTag]);
}