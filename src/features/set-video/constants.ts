/** A full-size plate: every bumper plate and the 20/25 kg iron ones, in metres. */
export const STANDARD_PLATE_M = 0.45;

/** The plate sizes offered, largest first, in metres. */
export const PLATE_DIAMETERS_M = [0.45, 0.4, 0.35, 0.3, 0.25] as const;

/**
 * The filmstrip under the video, in the trim bar and the timeline alike, so
 * it doesn't move when switching between them: its height, the frame drawn
 * around the kept part, and the room kept at each end for a trim handle.
 */
export const FILMSTRIP = { height: 56, border: 3, endInset: 16 } as const;
