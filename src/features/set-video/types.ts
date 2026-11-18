/** One video frame as 8-bit brightness, row by row. */
export interface GrayFrame {
    width: number;
    height: number;
    data: Uint8Array;
}

/**
 * The circle put on the plate (or whatever else is followed), in frame pixels.
 * Coordinates are continuous: (0, 0) is the frame's top-left corner and the
 * first pixel covers 0 to 1.
 */
export interface Marker {
    x: number;
    y: number;
    r: number;
}

/** Where the marked point is in one frame. */
export interface TrackPoint {
    /** The frame's time in the video, in milliseconds. */
    t: number;
    x: number;
    y: number;
    /** How well the frame matched what is being followed, 0 to 1. */
    score: number;
}

/**
 * What tracking a video produces, and what is stored with the set's video.
 * Only the measured path is kept; reps and speeds are worked out from it on
 * reading (`analyzeReps`), so the plate size can be corrected afterwards and
 * old recordings pick up improvements to the analysis.
 */
export interface BarPathData {
    version: 1;
    /** Size of the frames the path was measured in; the path is in these pixels. */
    frameWidth: number;
    frameHeight: number;
    marker: Marker;
    /** What the marker's diameter is in reality, which gives the path its scale. */
    plateDiameterM: number;
    /** One entry per analysed frame: time in ms, position in frame pixels, match 0 to 1. */
    t: number[];
    x: number[];
    y: number[];
    score: number[];
}

/** One repetition: the way down, if it was filmed, and the way up. */
export interface Rep {
    /** Where the rep begins in the video: the start of the way down, or of the way up. */
    startMs: number;
    /** The concentric (upward) phase. */
    liftStartMs: number;
    liftEndMs: number;
    /** How far the bar travelled upward, in metres. */
    rangeM: number;
    /** Mean and peak speed of the way up, in m/s. */
    meanVelocity: number;
    peakVelocity: number;
    /** How long the way down took, or null when the rep starts from the bottom. */
    loweringMs: number | null;
    /** How far the bar strayed sideways over the rep, in metres. */
    driftM: number;
    /** Indexes into the path of the rep's first and last frame. */
    startIndex: number;
    endIndex: number;
}

export interface RepAnalysis {
    reps: Rep[];
    /** The path after smoothing, in frame pixels; same length as the measured one. */
    x: number[];
    y: number[];
    /** Share of the frames in which the marker was found, 0 to 1. */
    confidence: number;
    /** How much slower the last rep's way up was than the fastest one's, 0 to 1; null below two reps. */
    velocityLoss: number | null;
}
