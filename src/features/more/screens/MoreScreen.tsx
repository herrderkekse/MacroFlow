import type { IconName } from "@/src/shared/atoms/IconButton";
import SectionLabel from "@/src/shared/atoms/SectionLabel";
import ListGroup from "@/src/shared/components/ListGroup";
import ListRow from "@/src/shared/components/ListRow";
import { useCollapsibleHeader } from "@/src/shared/hooks/useCollapsibleHeader";
import CollapsibleHeader from "@/src/shared/components/CollapsibleHeader";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { screenPadding, spacing } from "@/src/utils/theme";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import MoreSummaryDetails from "../components/MoreSummaryDetails";
import MoreSummaryRow from "../components/MoreSummaryRow";
import { useMoreSummary } from "../hooks/useMoreSummary";

interface MenuItem {
    icon: IconName;
    labelKey: string;
    descriptionKey: string;
    route: string;
}

interface MenuGroup {
    titleKey: string;
    items: MenuItem[];
}

const MENU: MenuGroup[] = [
    {
        titleKey: "more.groupYou",
        items: [
            { icon: "stats-chart-outline", labelKey: "more.analytics", descriptionKey: "more.analyticsDescription", route: "/analytics" },
            { icon: "flag-outline", labelKey: "more.goals", descriptionKey: "more.goalsDescription", route: "/settings/goals" },
            { icon: "person-circle-outline", labelKey: "more.account", descriptionKey: "more.accountDescription", route: "/settings/account" },
        ],
    },
    {
        titleKey: "more.groupCoach",
        items: [
            { icon: "sparkles-outline", labelKey: "more.mealPlan", descriptionKey: "more.mealPlanDescription", route: "/meal-plan" },
            { icon: "bookmark-outline", labelKey: "more.aiMemories", descriptionKey: "more.aiMemoriesDescription", route: "/settings/ai-memories" },
            { icon: "hardware-chip-outline", labelKey: "more.aiSettings", descriptionKey: "more.aiSettingsDescription", route: "/settings/ai-settings" },
        ],
    },
    {
        titleKey: "more.groupApp",
        items: [
            { icon: "settings-outline", labelKey: "more.settings", descriptionKey: "more.settingsDescription", route: "/settings" },
            { icon: "archive-outline", labelKey: "more.backup", descriptionKey: "more.backupDescription", route: "/settings/backup" },
        ],
    },
];

export default function MoreScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const router = useRouter();
    const header = useCollapsibleHeader();
    const summary = useMoreSummary();

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <CollapsibleHeader
                header={header}
                title={t("nav.more")}
                summary={<MoreSummaryRow summary={summary} onPress={() => router.push("/settings/account" as unknown as Href)} />}
                details={<MoreSummaryDetails summary={summary} />}
            />
            <Animated.ScrollView
                {...header.scrollProps}
                contentContainerStyle={[styles.content, header.contentStyle]}
                showsVerticalScrollIndicator={false}
            >
                {MENU.map((group, index) => (
                    <View key={group.titleKey}>
                        <SectionLabel style={index === 0 ? styles.firstLabel : undefined}>{t(group.titleKey)}</SectionLabel>
                        <ListGroup>
                            {group.items.map((item) => (
                                <ListRow
                                    key={item.route}
                                    icon={item.icon}
                                    title={t(item.labelKey)}
                                    subtitle={t(item.descriptionKey)}
                                    onPress={() => router.push(item.route as unknown as Href)}
                                />
                            ))}
                        </ListGroup>
                    </View>
                ))}
            </Animated.ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    content: { paddingHorizontal: screenPadding, paddingBottom: spacing.xl },
    firstLabel: { marginTop: 0 },
});
