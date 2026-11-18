import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import Notice from "@/src/shared/atoms/Notice";
import SectionLabel from "@/src/shared/atoms/SectionLabel";
import ListGroup from "@/src/shared/components/ListGroup";
import ListRow from "@/src/shared/components/ListRow";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { useAppStore } from "@/src/shared/store/useAppStore";
import { fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { formatDistance, formatSeconds, formatVelocity } from "../helpers/barPathFormat";
import type { RepAnalysis } from "../types";

// Below this share of frames with the plate found, the numbers are flagged.
const CONFIDENT_SHARE = 0.85;

interface RepListProps {
    analysis: RepAnalysis;
    /** A rep was tapped: play it. */
    onRepPress: (startMs: number) => void;
}

/** The set's reps as measured from the bar path: speed, travel, way down and drift of each. */
export default function RepList({ analysis, onRepPress }: RepListProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const unitSystem = useAppStore((s) => s.unitSystem);
    const { reps, confidence, velocityLoss } = analysis;
    const fastest = Math.max(0, ...reps.map((r) => r.meanVelocity));

    return (
        <View style={styles.list}>
            {confidence < CONFIDENT_SHARE && (
                <Notice tone="warning">{t("barPath.lowConfidence", { share: Math.round(confidence * 100) })}</Notice>
            )}
            {reps.length === 0 ? (
                <Notice>{t("barPath.noReps")}</Notice>
            ) : (
                <>
                    <View style={styles.summary}>
                        <Figure value={String(reps.length)} label={t("barPath.repCount", { count: reps.length })} styles={styles} />
                        <Figure value={formatVelocity(fastest)} label={t("barPath.bestVelocity")} styles={styles} />
                        {velocityLoss != null && (
                            <Figure value={`${Math.round(velocityLoss * 100)} %`} label={t("barPath.velocityLoss")} styles={styles} />
                        )}
                    </View>
                    <SectionLabel>{t("barPath.reps")}</SectionLabel>
                    <ListGroup>
                        {reps.map((rep, i) => {
                            const details = [
                                formatDistance(rep.rangeM, unitSystem),
                                rep.loweringMs != null ? t("barPath.lowering", { time: formatSeconds(rep.loweringMs) }) : null,
                                t("barPath.drift", { distance: formatDistance(rep.driftM, unitSystem) }),
                            ].filter(Boolean).join(" · ");
                            return (
                                <ListRow
                                    key={rep.liftStartMs}
                                    title={t("barPath.rep", { number: i + 1 })}
                                    subtitle={details}
                                    value={formatVelocity(rep.meanVelocity)}
                                    onPress={() => onRepPress(rep.startMs)}
                                    showChevron={false}
                                />
                            );
                        })}
                    </ListGroup>
                    <Text style={styles.footnote}>{t("barPath.velocityNote")}</Text>
                </>
            )}
        </View>
    );
}

function Figure({ value, label, styles }: { value: string; label: string; styles: ReturnType<typeof createStyles> }) {
    return (
        <View style={styles.figure}>
            <Text style={styles.figureValue}>{value}</Text>
            <Text style={styles.figureLabel}>{label}</Text>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        list: { gap: spacing.sm },
        summary: { flexDirection: "row", gap: spacing.md, paddingVertical: spacing.xs },
        figure: { flex: 1 },
        figureValue: { color: colors.text, fontSize: fontSize.lg, fontWeight: "600", fontVariant: ["tabular-nums"] },
        figureLabel: { color: colors.textSecondary, fontSize: fontSize.xs },
        footnote: { color: colors.textTertiary, fontSize: fontSize.xs },
    });
}
