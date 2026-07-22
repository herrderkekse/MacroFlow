// Drives the import queue once the share has loaded: header + progress, the
// current slide (recipe / foods / summary), and the calendar. Kept separate
// from ImportScreen so the queue hook only runs when there is a ready share.

import { useImportQueue } from "@/src/features/share/hooks/useImportQueue";
import type { FetchedShare } from "@/src/features/share/services/shareClient";
import CalendarPicker from "@/src/shared/components/CalendarPicker";
import { spacing, type ThemeColors } from "@/src/utils/theme";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, StyleSheet, Text, View } from "react-native";
import ImportFoodBatch from "./ImportFoodBatch";
import ImportHeaderCard from "./ImportHeaderCard";
import ImportRecipeSlide from "./ImportRecipeSlide";
import ImportSummary from "./ImportSummary";

interface Props {
    share: FetchedShare;
    origin?: string;
    colors: ThemeColors;
    onClose: () => void;
}

export default function ImportQueueView({ share, origin, colors, onClose }: Props) {
    const { t } = useTranslation();
    const api = useImportQueue(share);
    const [saving, setSaving] = useState(false);
    const [calendarVisible, setCalendarVisible] = useState(false);

    const sharedBy = api.queue.sharedBy ?? originHost(origin);

    function handleConfirm() {
        setSaving(true);
        try {
            api.confirm();
            Alert.alert(t("share.import.title"), t("share.import.done"), [{ text: t("common.ok"), onPress: onClose }]);
        } catch (e: any) {
            Alert.alert(t("share.importFailed"), e?.message ?? t("common.unknownError"));
        } finally {
            setSaving(false);
        }
    }

    const openCalendar = () => setCalendarVisible(true);

    return (
        <>
            <ImportHeaderCard
                title={t("share.import.title")}
                sharedBy={sharedBy}
                total={api.total}
                index={api.index}
                showProgress={!api.isDone}
                onClose={onClose}
                colors={colors}
            />

            <View style={styles.slide}>
                {api.total === 0 ? (
                    <Text style={[styles.empty, { color: colors.textSecondary }]}>{t("share.import.empty")}</Text>
                ) : api.isDone ? (
                    <ImportSummary
                        decisions={api.decisions}
                        counts={api.counts}
                        onConfirm={handleConfirm}
                        onReset={api.reset}
                        saving={saving}
                        colors={colors}
                    />
                ) : api.current?.type === "recipe" ? (
                    <ImportRecipeSlide slide={api.current} api={api} colors={colors} onOpenCalendar={openCalendar} />
                ) : api.current?.type === "foods" ? (
                    <ImportFoodBatch foods={api.current.foods} api={api} colors={colors} onOpenCalendar={openCalendar} />
                ) : null}
            </View>

            <CalendarPicker
                visible={calendarVisible}
                selectedDate={api.date}
                onSelect={(d) => {
                    api.setDate(d);
                    setCalendarVisible(false);
                }}
                onClose={() => setCalendarVisible(false)}
            />
        </>
    );
}

function originHost(origin?: string): string | undefined {
    if (!origin) return undefined;
    try {
        return new URL(origin).host || undefined;
    } catch {
        return undefined;
    }
}

const styles = StyleSheet.create({
    slide: { flex: 1, marginTop: spacing.md },
    empty: { textAlign: "center", marginTop: spacing.xl },
});
