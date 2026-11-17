/** Where a frame sits in a box it is fitted into whole ("contain"): its scale and top-left corner. */
export interface Fit {
    scale: number;
    left: number;
    top: number;
}

export function fitContain(boxWidth: number, boxHeight: number, frameWidth: number, frameHeight: number): Fit {
    if (boxWidth <= 0 || boxHeight <= 0 || frameWidth <= 0 || frameHeight <= 0) return { scale: 0, left: 0, top: 0 };
    const scale = Math.min(boxWidth / frameWidth, boxHeight / frameHeight);
    return {
        scale,
        left: (boxWidth - frameWidth * scale) / 2,
        top: (boxHeight - frameHeight * scale) / 2,
    };
}

/** A point in the box, in frame pixels; null when it lies outside the frame (on the bars around it). */
export function boxToFrame(fit: Fit, x: number, y: number, frameWidth: number, frameHeight: number): { x: number; y: number } | null {
    if (fit.scale <= 0) return null;
    const fx = (x - fit.left) / fit.scale;
    const fy = (y - fit.top) / fit.scale;
    if (fx < 0 || fy < 0 || fx > frameWidth || fy > frameHeight) return null;
    return { x: fx, y: fy };
}
