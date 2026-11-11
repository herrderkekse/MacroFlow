import Button from "@/src/shared/atoms/Button";
import FieldLabel from "@/src/shared/atoms/FieldLabel";
import Sheet from "@/src/shared/components/Sheet";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, controlHeight, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

interface EditWorkoutTimesSheetProps {
    visible: boolean;
    onClose: () => void;
    startedAt: number;
    endedAt: number | null;
    onSave: (startEpoch: number, endEpoch: number | null) => void;
    labels: {
        title: string;
        startLabel: string;
        endLabel: string;
        save: string;
    };
}

function epochToHourMin(epoch: number): { h: string; m: string } {
    const d = new Date(epoch);
    return {
        h: String(d.getHours()).padStart(2, "0"),
        m: String(d.getMinutes()).padStart(2, "0"),
    };
}

function applyHourMin(epoch: number, h: number, m: number): number {
    const d = new Date(epoch);
    d.setHours(h, m, 0, 0);
    return d.getTime();
}

function clampNumStr(val: string, min: number, max: number): string {
    const n = parseInt(val, 10);
    if (isNaN(n)) return "";
    return String(Math.min(Math.max(n, min), max));
}

/** Corrects when a workout started and, once finished, when it ended. */
export default function EditWorkoutTimesSheet({
    visible, onClose, startedAt, endedAt, onSave, labels,
}: EditWorkoutTimesSheetProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const initStart = epochToHourMin(startedAt);
    const initEnd = endedAt ? epochToHourMin(endedAt) : null;

    const [startH, setStartH] = useState(initStart.h);
    const [startM, setStartM] = useState(initStart.m);
    const [endH, setEndH] = useState(initEnd?.h ?? "");
    const [endM, setEndM] = useState(initEnd?.m ?? "");

    function resetDrafts() {
        const s = epochToHourMin(startedAt);
        const e = endedAt ? epochToHourMin(endedAt) : null;
        setStartH(s.h);
        setStartM(s.m);
        setEndH(e?.h ?? "");
        setEndM(e?.m ?? "");
    }

    function handleSave() {
        const sh = parseInt(startH, 10) || 0;
        const sm = parseInt(startM, 10) || 0;
        const newStart = applyHourMin(startedAt, sh, sm);

        let newEnd: number | null = null;
        if (endedAt != null && endH !== "") {
            const eh = parseInt(endH, 10) || 0;
            const em = parseInt(endM, 10) || 0;
            newEnd = applyHourMin(endedAt, eh, em);
        }

        onSave(newStart, newEnd);
        onClose();
    }

    // The drafts restart from the stored times every time the sheet opens.
    const [wasVisible, setWasVisible] = useState(visible);
    if (visible !== wasVisible) {
        setWasVisible(visible);
        if (visible) resetDrafts();
    }

    return (
        <Sheet
            visible={visible}
            onClose={onClose}
            title={labels.title}
            footer={<Button title={labels.save} onPress={handleSave} />}
        >
            <FieldLabel style={styles.firstField}>{labels.startLabel}</FieldLabel>
            <TimeFields
                hours={startH}
                minutes={startM}
                onChangeHours={setStartH}
                onChangeMinutes={setStartM}
                colors={colors}
                styles={styles}
            />

            {/* End time (only shown if workout is finished) */}
            {endedAt != null && (
                <>
                    <FieldLabel>{labels.endLabel}</FieldLabel>
                    <TimeFields
                        hours={endH}
                        minutes={endM}
                        onChangeHours={setEndH}
                        onChangeMinutes={setEndM}
                        colors={colors}
                        styles={styles}
                    />
                </>
            )}
            <View style={styles.bottomSpace} />
        </Sheet>
    );
}

interface TimeFieldsProps {
    hours: string;
    minutes: string;
    onChangeHours: (value: string) => void;
    onChangeMinutes: (value: string) => void;
    colors: ThemeColors;
    styles: ReturnType<typeof createStyles>;
}

/** An "HH : MM" pair that clamps each part to a valid clock value on blur. */
function TimeFields({ hours, minutes, onChangeHours, onChangeMinutes, colors, styles }: TimeFieldsProps) {
    return (
        <View style={styles.timeRow}>
            <TextInput
                style={styles.timeInput}
                value={hours}
                onChangeText={(v) => onChangeHours(v.replace(/[^0-9]/g, "").slice(0, 2))}
                onBlur={() => onChangeHours(clampNumStr(hours, 0, 23).padStart(2, "0"))}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
                selectionColor={colors.textSecondary}
                placeholder="HH"
                placeholderTextColor={colors.textTertiary}
            />
            <Text style={styles.timeSeparator}>:</Text>
            <TextInput
                style={styles.timeInput}
                value={minutes}
                onChangeText={(v) => onChangeMinutes(v.replace(/[^0-9]/g, "").slice(0, 2))}
                onBlur={() => onChangeMinutes(clampNumStr(minutes, 0, 59).padStart(2, "0"))}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
                selectionColor={colors.textSecondary}
                placeholder="MM"
                placeholderTextColor={colors.textTertiary}
            />
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        firstField: { marginTop: 0 },
        timeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
        timeInput: {
            flex: 1,
            minHeight: controlHeight.md,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
            textAlign: "center",
            fontSize: fontSize.lg,
            fontWeight: "600",
            color: colors.text,
            fontVariant: ["tabular-nums"],
        },
        timeSeparator: { fontSize: fontSize.lg, fontWeight: "600", color: colors.textSecondary },
        bottomSpace: { height: spacing.md },
    });
}
