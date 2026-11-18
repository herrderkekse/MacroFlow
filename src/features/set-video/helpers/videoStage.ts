// Where the video sits on the trim screen: as tall as its shape asks for at
// the stage's width, so there are no bars beside or above it.

export interface VideoStageInput {
    /** The space between the header and the footer. */
    stageWidth: number;
    stageHeight: number;
    /** Height of the controls along the stage's bottom edge (filmstrip, times). */
    controlsHeight: number;
    /** Gap kept to the stage's left and right edges. */
    sideInset: number;
    /** Width over height of the video as shown; null while not known yet. */
    aspect: number | null;
}

export interface VideoStageBox {
    top: number;
    height: number;
    /** True when the video reaches under the controls, which then need a backdrop to stay legible. */
    underControls: boolean;
}

/**
 * The video box: full width; centred above the controls when it fits there;
 * otherwise from the top, reaching under the controls; and only when it would
 * not fit even then, as tall as the stage, with bars at its sides.
 */
export function fitVideoStage({ stageWidth, stageHeight, controlsHeight, sideInset, aspect }: VideoStageInput): VideoStageBox {
    const above = Math.max(0, stageHeight - controlsHeight);
    if (!aspect || aspect <= 0 || stageWidth <= 0) return { top: 0, height: above, underControls: false };
    const natural = Math.max(0, stageWidth - 2 * sideInset) / aspect;
    if (natural <= above) return { top: (above - natural) / 2, height: natural, underControls: false };
    const height = Math.min(natural, stageHeight);
    return { top: 0, height, underControls: height > above };
}
