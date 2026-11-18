import { createContext, useContext } from "react";
import type { SetVideo } from "@/src/features/set-video/services/setVideoDb";

/** What a set row needs to show and open its video. Provided by `SetVideoProvider`. */
export interface SetVideoContextValue {
    videoFor: (setUuid: string | null) => SetVideo | undefined;
    /** Opens the set's video menu; `label` names the set in it ("Bench press · 3"). */
    open: (setUuid: string, label: string) => void;
    /** False where sets are only looked at (history): play and share, nothing else. */
    editable: boolean;
}

export const SetVideoContext = createContext<SetVideoContextValue | null>(null);

/** The set's video and how to open its menu, or null outside a `SetVideoProvider`. */
export function useSetVideo(setUuid: string | null) {
    const context = useContext(SetVideoContext);
    if (!context || !setUuid) return null;
    return {
        video: context.videoFor(setUuid),
        editable: context.editable,
        open: (label: string) => context.open(setUuid, label),
    };
}
