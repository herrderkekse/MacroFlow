import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

interface EditWorkoutTimesModalProps {
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

export default function EditWorkoutTimesModal({
    visible, onClose, startedAt, endedAt, onSave, labels,
}: EditWorkoutTimesModalProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const initStart = epochToHourMin(startedAt);
    const initEnd = endedAt ? epochToHourMin(endedAt) : null;

    const [startH, setStartH] = useState(initStart.h);
    const [startM, setStartM] = useState(initStart.m);
    const [endH, setEndH] = useState(initEnd?.h ?? "");
    const [endM, setEndM] = useState(initEnd?.m ?? "");

    // Reset draft values when modal opens with new data
    const resetDrafts = useCallback(() => {
        const s = epochToHourMin(startedAt);
        const e = endedAt ? epochToHourMin(endedAt) : null;
        setStartH(s.h);
        setStartM(s.m);
        setEndH(e?.h ?? "");
        setEndM(e?.m ?? "");
    }, [startedAt, endedAt]);

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

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
            onShow={resetDrafts}
        >
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <Pressable style={styles.overlay} onPress={onClose}>
                    <Pressable style={styles.modal} onPress={() => {}}>
                        <Text style={styles.title}>{labels.title}</Text>

                        {/* Start time */}
                        <Text style={styles.fieldLabel}>{labels.startLabel}</Text>
                        <View style={styles.timeRow}>
                            <TextInput
                                style={styles.timeInput}
                                value={startH}
                                onChangeText={(v) => setStartH(v.replace(/[^0-9]/g, "").slice(0, 2))}
                                onBlur={() => setStartH(clampNumStr(startH, 0, 23).padStart(2, "0"))}
                                keyboardType="number-pad"
                                maxLength={2}
                                selectTextOnFocus
                                placeholder="HH"
                                placeholderTextColor={colors.textTertiary}
                            />
                            <Text style={styles.timeSeparator}>:</Text>
                            <TextInput
                                style={styles.timeInput}
                                value={startM}
                                onChangeText={(v) => setStartM(v.replace(/[^0-9]/g, "").slice(0, 2))}
                                onBlur={() => setStartM(clampNumStr(startM, 0, 59).padStart(2, "0"))}
                                keyboardType="number-pad"
                                maxLength={2}
                                selectTextOnFocus
                                placeholder="MM"
                                placeholderTextColor={colors.textTertiary}
                            />
                        </View>

                        {/* End time (only shown if workout is finished) */}
                        {endedAt != null && (
                            <>
                                <Text style={styles.fieldLabel}>{labels.endLabel}</Text>
                                <View style={styles.timeRow}>
                                    <TextInput
                                        style={styles.timeInput}
                                        value={endH}
                                        onChangeText={(v) => setEndH(v.replace(/[^0-9]/g, "").slice(0, 2))}
                                        onBlur={() => setEndH(clampNumStr(endH, 0, 23).padStart(2, "0"))}
                                        keyboardType="number-pad"
                                        maxLength={2}
                                        selectTextOnFocus
                                        placeholder="HH"
                                        placeholderTextColor={colors.textTertiary}
                                    />
                                    <Text style={styles.timeSeparator}>:</Text>
                                    <TextInput
                                        style={styles.timeInput}
                                        value={endM}
                                        onChangeText={(v) => setEndM(v.replace(/[^0-9]/g, "").slice(0, 2))}
                                        onBlur={() => setEndM(clampNumStr(endM, 0, 59).padStart(2, "0"))}
                                        keyboardType="number-pad"
                                        maxLength={2}
                                        selectTextOnFocus
                                        placeholder="MM"
                                        placeholderTextColor={colors.textTertiary}
                                    />
                                </View>
                            </>
                        )}

                        <Pressable style={styles.saveBtn} onPress={handleSave}>
                            <Ionicons name="checkmark" size={18} color="#fff" />
                            <Text style={styles.saveText}>{labels.save}</Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
            </KeyboardAvoidingView>
        </Modal>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        keyboardView: {
            flex: 1,
        },
        overlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: spacing.lg,
        },
        modal: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.lg,
            width: "100%",
            maxWidth: 300,
            alignItems: "center",
        },
        title: {
            fontSize: fontSize.lg,
            fontWeight: "700",
            color: colors.text,
            marginBottom: spacing.lg,
            textAlign: "center",
        },
        fieldLabel: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.textSecondary,
            marginBottom: spacing.xs,
            textAlign: "center",
        },
        timeRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: spacing.md,
            gap: spacing.xs,
        },
        timeInput: {
            fontSize: fontSize.xl,
            fontWeight: "700",
            fontVariant: ["tabular-nums"],
            color: colors.text,
            backgroundColor: colors.background,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            textAlign: "center",
            width: 64,
            paddingVertical: spacing.sm,
        },
        timeSeparator: {
            fontSize: fontSize.xl,
            fontWeight: "700",
            color: colors.text,
        },
        saveBtn: {
            flexDirection: "row",
            alignItems: "center",
            alignSelf: "stretch",
            justifyContent: "center",
            gap: spacing.xs,
            backgroundColor: colors.primary,
            borderRadius: borderRadius.md,
            paddingVertical: spacing.sm,
            marginTop: spacing.sm,
        },
        saveText: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: "#fff",
        },
    });
}
