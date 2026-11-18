import { useCallback, useMemo, useState } from "react";
import { useSharedValue } from "react-native-reanimated";
import { aspectRatio, clampShift, cropFrame, cropShare, isWholePicture, type CropAspectKey, type CropShare } from "../helpers/cropGeometry";

/**
 * The crop of the video being trimmed: the frame's shape, and how the video is
 * zoomed and shifted under it. Gestures change the shared values on the UI
 * thread; `commit` brings the result back when they end. The shift is kept as
 * shares of the box, so it holds when the box changes size.
 */
export function useCrop(videoAspect: number | null) {
    const [aspect, setAspectKey] = useState<CropAspectKey>("original");
    const zoom = useSharedValue(1);
    const shiftX = useSharedValue(0);
    const shiftY = useSharedValue(0);
    const [share, setShare] = useState<CropShare | null>(null);
    const ratio = aspectRatio(aspect);

    /** Reads the crop the gestures left; null while it keeps the whole picture. */
    const commit = useCallback((forRatio: number | null = ratio) => {
        if (!videoAspect) { setShare(null); return; }
        // The share depends only on the box's shape, which is the video's.
        const box = { width: videoAspect, height: 1 };
        const frame = cropFrame(box, forRatio);
        const next = cropShare(box, frame, zoom.get(), shiftX.get() * box.width, shiftY.get() * box.height);
        setShare(isWholePicture(next) ? null : next);
    }, [videoAspect, ratio, zoom, shiftX, shiftY]);

    /** A new shape starts from the whole video, centred in the frame. */
    const setAspect = useCallback((key: CropAspectKey) => {
        setAspectKey(key);
        zoom.set(1);
        if (videoAspect) {
            const box = { width: videoAspect, height: 1 };
            const centred = clampShift(box, cropFrame(box, aspectRatio(key)), 1, 0, 0);
            shiftX.set(centred.x / box.width);
            shiftY.set(centred.y / box.height);
        } else {
            shiftX.set(0);
            shiftY.set(0);
        }
        commit(aspectRatio(key));
    }, [videoAspect, zoom, shiftX, shiftY, commit]);

    return useMemo(() => ({ aspect, ratio, zoom, shiftX, shiftY, share, setAspect, commit }), [
        aspect, ratio, zoom, shiftX, shiftY, share, setAspect, commit,
    ]);
}

export type CropState = ReturnType<typeof useCrop>;
