import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import { boxToFrame, fitContain } from "../helpers/videoFit";
import type { Marker } from "../types";

// Drawn over the video, so it must not follow the theme (see BarPathOverlay).
const INK = "#FFFFFF";
const EDGE = "rgba(0, 0, 0, 0.55)";

interface MarkerPlacerProps {
    frameWidth: number;
    frameHeight: number;
    marker: Marker | null;
    /** A tap on the picture, in frame pixels. */
    onPlace: (x: number, y: number) => void;
}

/** Lies over the paused video: a tap on the plate puts the marker there. */
export default function MarkerPlacer({ frameWidth, frameHeight, marker, onPlace }: MarkerPlacerProps) {
    const { t } = useTranslation();
    const [box, setBox] = useState({ width: 0, height: 0 });
    const fit = fitContain(box.width, box.height, frameWidth, frameHeight);

    return (
        <Pressable
            style={StyleSheet.absoluteFill}
            onLayout={(e) => setBox(e.nativeEvent.layout)}
            onPress={(e) => {
                const point = boxToFrame(fit, e.nativeEvent.locationX, e.nativeEvent.locationY, frameWidth, frameHeight);
                if (point) onPlace(point.x, point.y);
            }}
            accessibilityRole="button"
            accessibilityLabel={t("barPath.placeLabel")}
        >
            {marker && fit.scale > 0 && (
                <Svg width={box.width} height={box.height} pointerEvents="none">
                    {[EDGE, INK].map((color, i) => {
                        const cx = fit.left + marker.x * fit.scale;
                        const cy = fit.top + marker.y * fit.scale;
                        const r = marker.r * fit.scale;
                        const width = i === 0 ? 4 : 2;
                        return (
                            <React.Fragment key={color}>
                                <Circle cx={cx} cy={cy} r={r} stroke={color} strokeWidth={width} fill="none" />
                                <Line x1={cx - 6} y1={cy} x2={cx + 6} y2={cy} stroke={color} strokeWidth={width} />
                                <Line x1={cx} y1={cy - 6} x2={cx} y2={cy + 6} stroke={color} strokeWidth={width} />
                            </React.Fragment>
                        );
                    })}
                </Svg>
            )}
        </Pressable>
    );
}
