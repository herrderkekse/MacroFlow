import Button from "@/src/shared/atoms/Button";
import Input from "@/src/shared/atoms/Input";
import {
    deleteProviderSettings,
    getProviderDefaults,
    loadActiveProvider,
    loadProviderSettings,
    saveActiveProvider,
    saveProviderSettings,
    createModelFromConfig,
    type AiProviderId,
    type ProviderSettings,
} from "../services/aiConfig";
import { generateText } from "ai";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PROVIDER_OPTIONS: { key: AiProviderId; label: string }[] = [
    { key: "nvidia", label: "NVIDIA" },
    { key: "openai", label: "OpenAI" },
];

const API_KEY_PLACEHOLDERS: Record<AiProviderId, string> = {
    nvidia: "nvapi-...",
    openai: "sk-...",
};

export default function AiSettingsScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [provider, setProvider] = useState<AiProviderId>("nvidia");
    const [configs, setConfigs] = useState<Partial<Record<AiProviderId, ProviderSettings>>>({});
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const current: ProviderSettings = configs[provider] ?? { apiKey: "", ...getProviderDefaults(provider) };

    useEffect(() => {
        async function init() {
            const active = await loadActiveProvider();
            const drafts: Partial<Record<AiProviderId, ProviderSettings>> = {};
            for (const opt of PROVIDER_OPTIONS) {
                const saved = await loadProviderSettings(opt.key);
                const defaults = getProviderDefaults(opt.key);
                drafts[opt.key] = saved ?? { apiKey: "", baseUrl: defaults.baseUrl, model: defaults.model };
            }
            setProvider(active);
            setConfigs(drafts);
            setLoaded(true);
        }
        init();
    }, []);

    function updateField(field: keyof ProviderSettings, value: string) {
        setConfigs((prev) => ({
            ...prev,
            [provider]: { ...prev[provider]!, [field]: value },
        }));
    }

    function handleProviderChange(id: AiProviderId) {
        setProvider(id);
    }

    async function handleSave() {
        if (!current.apiKey.trim()) {
            Alert.alert(t("ai.settings"), t("ai.apiKeyRequired"));
            return;
        }
        try {
            setSaving(true);
            await saveProviderSettings(provider, { apiKey: current.apiKey.trim(), baseUrl: current.baseUrl.trim(), model: current.model.trim() });
            await saveActiveProvider(provider);
            Alert.alert(t("ai.settings"), t("ai.configSaved"));
        } catch {
            Alert.alert(t("ai.settings"), t("common.unknownError"));
        } finally {
            setSaving(false);
        }
    }

    async function handleTest() {
        if (!current.apiKey.trim()) {
            Alert.alert(t("ai.settings"), t("ai.apiKeyRequired"));
            return;
        }
        try {
            setTesting(true);
            const modelInstance = createModelFromConfig({
                provider,
                apiKey: current.apiKey.trim(),
                baseUrl: current.baseUrl.trim(),
                model: current.model.trim(),
            });
            await generateText({
                model: modelInstance,
                messages: [{ role: "user", content: "Reply with: OK" }],
            });
            Alert.alert(t("ai.settings"), t("ai.connectionSuccess"));
        } catch (e: any) {
            Alert.alert(t("ai.connectionFailed"), e.message ?? t("common.unknownError"));
        } finally {
            setTesting(false);
        }
    }

    async function handleDelete() {
        Alert.alert(
            t("ai.settings"),
            t("ai.deleteConfigConfirm"),
            [
                { text: t("common.cancel"), style: "cancel" },
                {
                    text: t("common.delete"),
                    style: "destructive",
                    onPress: async () => {
                        await deleteProviderSettings(provider);
                        const defaults = getProviderDefaults(provider);
                        setConfigs((prev) => ({
                            ...prev,
                            [provider]: { apiKey: "", baseUrl: defaults.baseUrl, model: defaults.model },
                        }));
                    },
                },
            ],
        );
    }

    if (!loaded) return null;

    return (
        <ScrollView
            style={styles.screen}
            contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
            keyboardShouldPersistTaps="handled"
        >
            <View style={styles.headerRow}>
                <Pressable onPress={() => router.navigate("/(tabs)/more" as any)} style={styles.backBtn} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={colors.primary} />
                </Pressable>
                <Text style={styles.heading}>{t("ai.settings")}</Text>
            </View>

            {/* Security warning */}
            <View style={styles.warningCard}>
                <Ionicons name="warning-outline" size={18} color={colors.danger} />
                <Text style={styles.warningText}>{t("ai.securityWarning")}</Text>
            </View>

            {/* Provider selector */}
            <Text style={styles.sectionLabel}>{t("ai.provider")}</Text>
            <View style={styles.chipRow}>
                {PROVIDER_OPTIONS.map((opt) => (
                    <Pressable
                        key={opt.key}
                        style={[styles.chip, provider === opt.key && styles.chipActive]}
                        onPress={() => handleProviderChange(opt.key)}
                    >
                        <Text style={[styles.chipText, provider === opt.key && styles.chipTextActive]}>
                            {opt.label}
                        </Text>
                    </Pressable>
                ))}
            </View>

            {/* API Key */}
            <Input
                label={t("ai.apiKey")}
                value={current.apiKey}
                onChangeText={(v) => updateField("apiKey", v)}
                placeholder={API_KEY_PLACEHOLDERS[provider]}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                containerStyle={styles.field}
            />

            {/* Base URL */}
            <Input
                label={t("ai.baseUrl")}
                value={current.baseUrl}
                onChangeText={(v) => updateField("baseUrl", v)}
                placeholder={getProviderDefaults(provider).baseUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                containerStyle={styles.field}
            />

            {/* Model */}
            <Input
                label={t("ai.model")}
                value={current.model}
                onChangeText={(v) => updateField("model", v)}
                placeholder={getProviderDefaults(provider).model}
                autoCapitalize="none"
                autoCorrect={false}
                containerStyle={styles.field}
            />

            {/* Action buttons */}
            <View style={styles.buttonRow}>
                <Button
                    title={t("ai.testConnection")}
                    variant="outline"
                    onPress={handleTest}
                    loading={testing}
                    style={styles.flexButton}
                />
                <Button
                    title={t("common.save")}
                    onPress={handleSave}
                    loading={saving}
                    style={styles.flexButton}
                />
            </View>

            {current.apiKey.trim().length > 0 && (
                <Button
                    title={t("ai.deleteConfig")}
                    variant="ghost"
                    onPress={handleDelete}
                    textStyle={{ color: colors.danger }}
                    style={styles.deleteBtn}
                />
            )}
        </ScrollView>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        content: { padding: spacing.lg, paddingBottom: 100 },
        headerRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            marginBottom: spacing.lg,
        },
        backBtn: { padding: 4 },
        heading: {
            fontSize: fontSize.xl,
            fontWeight: "700",
            color: colors.text,
        },
        warningCard: {
            flexDirection: "row",
            alignItems: "flex-start",
            gap: spacing.sm,
            backgroundColor: colors.danger + "15",
            borderRadius: borderRadius.md,
            padding: spacing.md,
            marginBottom: spacing.lg,
            borderWidth: 1,
            borderColor: colors.danger + "30",
        },
        warningText: {
            flex: 1,
            fontSize: fontSize.sm,
            color: colors.text,
            lineHeight: 20,
        },
        sectionLabel: {
            fontSize: fontSize.xs,
            fontWeight: "600",
            color: colors.textSecondary,
            letterSpacing: 0.5,
            marginBottom: spacing.sm,
            marginTop: spacing.md,
        },
        chipRow: {
            flexDirection: "row",
            gap: spacing.sm,
            marginBottom: spacing.md,
        },
        chip: {
            flex: 1,
            paddingVertical: spacing.sm + 2,
            borderRadius: borderRadius.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
        },
        chipActive: {
            backgroundColor: colors.primaryLight,
            borderColor: colors.primary,
        },
        chipText: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
        },
        chipTextActive: {
            color: colors.primary,
            fontWeight: "600",
        },
        field: { marginBottom: spacing.md },
        buttonRow: {
            flexDirection: "row",
            gap: spacing.sm,
            marginTop: spacing.md,
        },
        flexButton: { flex: 1 },
        deleteBtn: {
            marginTop: spacing.md,
            alignSelf: "center",
        },
    });
}
