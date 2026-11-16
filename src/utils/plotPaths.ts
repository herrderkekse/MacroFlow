export interface XY {
    x: number;
    y: number;
}

const n = (value: number) => Number(value.toFixed(2));

/**
 * A smooth SVG path through `points` (ascending in x) that never overshoots
 * them: monotone cubic interpolation, so a flat stretch stays flat.
 */
export function smoothPath(points: XY[]): string {
    if (points.length === 0) return "";
    let path = `M${n(points[0].x)} ${n(points[0].y)}`;
    if (points.length === 1) return path;
    if (points.length === 2) return `${path}L${n(points[1].x)} ${n(points[1].y)}`;

    const dx = points.slice(1).map((p, i) => p.x - points[i].x);
    const slope = points.slice(1).map((p, i) => (p.y - points[i].y) / dx[i]);
    const tangent = points.map((_, i) => {
        if (i === 0) return slope[0];
        if (i === points.length - 1) return slope[slope.length - 1];
        if (slope[i - 1] * slope[i] <= 0) return 0;
        // Weighted harmonic mean of the neighbouring slopes.
        return (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / slope[i - 1] + (dx[i] + 2 * dx[i - 1]) / slope[i]);
    });

    for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        const third = dx[i] / 3;
        path += `C${n(a.x + third)} ${n(a.y + tangent[i] * third)} ${n(b.x - third)} ${n(b.y - tangent[i + 1] * third)} ${n(b.x)} ${n(b.y)}`;
    }
    return path;
}

/** A column segment: square at the bottom, rounded at the top. */
export function roundedTopBar(x: number, y: number, width: number, height: number, radius: number): string {
    const r = Math.max(0, Math.min(radius, width / 2, height));
    return (
        `M${n(x)} ${n(y + height)}V${n(y + r)}Q${n(x)} ${n(y)} ${n(x + r)} ${n(y)}` +
        `H${n(x + width - r)}Q${n(x + width)} ${n(y)} ${n(x + width)} ${n(y + r)}V${n(y + height)}Z`
    );
}
