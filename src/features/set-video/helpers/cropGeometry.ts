// Cropping a video on the trim screen. The video fills its box; the crop
// frame is the largest rectangle of the chosen shape inside that box. The
// video is zoomed about the box's centre and shifted, and must always cover
// the frame. All functions are worklets: gestures run them on the UI thread.

export interface Size {
    width: number;
    height: number;
}

export interface Rect {
    left: number;
    top: number;
    width: number;
    height: number;
}

/** The part of the picture kept, as shares of its width and height from its top left. */
export interface CropShare {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** How far the video is zoomed in at most. */
export const MAX_ZOOM = 4;

/** The shapes offered; `null` keeps the video's own. Width over height. */
export const CROP_ASPECTS = [
    { key: "original", ratio: null },
    { key: "9:16", ratio: 9 / 16 },
    { key: "4:5", ratio: 4 / 5 },
    { key: "1:1", ratio: 1 },
    { key: "16:9", ratio: 16 / 9 },
] as const;
export type CropAspectKey = (typeof CROP_ASPECTS)[number]["key"];

export function aspectRatio(key: CropAspectKey): number | null {
    return CROP_ASPECTS.find((a) => a.key === key)?.ratio ?? null;
}

/** The crop frame in the box: as large as fits, centred; the whole box for the video's own shape. */
export function cropFrame(box: Size, ratio: number | null): Rect {
    "worklet";
    if (ratio == null || box.width <= 0 || box.height <= 0) return { left: 0, top: 0, width: box.width, height: box.height };
    const width = Math.min(box.width, box.height * ratio);
    const height = width / ratio;
    return { left: (box.width - width) / 2, top: (box.height - height) / 2, width, height };
}

export function clampZoom(zoom: number): number {
    "worklet";
    return Math.min(Math.max(zoom, 1), MAX_ZOOM);
}

/**
 * The shift (in box pixels, from the centred position) brought back to where
 * the zoomed video still covers the frame.
 */
export function clampShift(box: Size, frame: Rect, zoom: number, shiftX: number, shiftY: number): { x: number; y: number } {
    "worklet";
    const halfW = (zoom * box.width) / 2;
    const halfH = (zoom * box.height) / 2;
    const cx = box.width / 2;
    const cy = box.height / 2;
    const minX = frame.left + frame.width - cx - halfW;
    const maxX = frame.left - cx + halfW;
    const minY = frame.top + frame.height - cy - halfH;
    const maxY = frame.top - cy + halfH;
    return {
        x: Math.min(Math.max(shiftX, minX), Math.max(minX, maxX)),
        y: Math.min(Math.max(shiftY, minY), Math.max(minY, maxY)),
    };
}

/** Where the video is drawn in the box, zoomed and shifted. */
export function videoRect(box: Size, zoom: number, shiftX: number, shiftY: number): Rect {
    "worklet";
    const width = zoom * box.width;
    const height = zoom * box.height;
    return { left: (box.width - width) / 2 + shiftX, top: (box.height - height) / 2 + shiftY, width, height };
}

/**
 * The shift that keeps the point under the fingers (`focusX/Y`, in the box)
 * in place while zooming from `fromZoom` to `toZoom`.
 */
export function zoomAbout(box: Size, fromZoom: number, toZoom: number, shiftX: number, shiftY: number, focusX: number, focusY: number) {
    "worklet";
    const fx = focusX - box.width / 2;
    const fy = focusY - box.height / 2;
    const k = toZoom / fromZoom;
    return { x: fx - (fx - shiftX) * k, y: fy - (fy - shiftY) * k };
}

/** The picture under the frame, as shares of the whole picture. */
export function cropShare(box: Size, frame: Rect, zoom: number, shiftX: number, shiftY: number): CropShare {
    "worklet";
    const video = videoRect(box, zoom, shiftX, shiftY);
    return {
        x: (frame.left - video.left) / video.width,
        y: (frame.top - video.top) / video.height,
        width: frame.width / video.width,
        height: frame.height / video.height,
    };
}

/** True when the crop keeps (practically) the whole picture, so there is nothing to crop. */
export function isWholePicture(share: CropShare): boolean {
    const EPS = 0.002;
    return share.x < EPS && share.y < EPS && share.width > 1 - EPS && share.height > 1 - EPS;
}
