import Button from "@/src/shared/atoms/Button";
import Input from "@/src/shared/atoms/Input";
import {
    deleteAiConfig,
    getProviderDefaults,
    loadAiConfig,
    saveAiConfig,
    createModelFromConfig,
} from "../services/aiConfig";
import { generateText } from "ai";
import type { AiProviderId } from "../services/aiConfig";
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
    const [apiKey, setApiKey] = useState("");
    const [baseUrl, setBaseUrl] = useState("");
    const [model, setModel] = useState("");
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        loadAiConfig().then((cfg) => {
            if (cfg) {
                setProvider(cfg.provider);
                setApiKey(cfg.apiKey);
                setBaseUrl(cfg.baseUrl);
                setModel(cfg.model);
            } else {
                const defaults = getProviderDefaults("nvidia");
                setBaseUrl(defaults.baseUrl);
                setModel(defaults.model);
            }
            setLoaded(true);
        });
    }, []);

    function handleProviderChange(id: AiProviderId) {
        setProvider(id);
        const defaults = getProviderDefaults(id);
        setBaseUrl(defaults.baseUrl);
        setModel(defaults.model);
    }

    async function handleSave() {
        if (!apiKey.trim()) {
            Alert.alert(t("ai.settings"), t("ai.apiKeyRequired"));
            return;
        }
        try {
            setSaving(true);
            await saveAiConfig({ provider, apiKey: apiKey.trim(), baseUrl: baseUrl.trim(), model: model.trim() });
            Alert.alert(t("ai.settings"), t("ai.configSaved"));
        } catch {
            Alert.alert(t("ai.settings"), t("common.unknownError"));
        } finally {
            setSaving(false);
        }
    }

    async function handleTest() {
        if (!apiKey.trim()) {
            Alert.alert(t("ai.settings"), t("ai.apiKeyRequired"));
            return;
        }
        try {
            setTesting(true);
            const modelInstance = createModelFromConfig({
                provider,
                apiKey: apiKey.trim(),
                baseUrl: baseUrl.trim(),
                model: model.trim(),
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
                        await deleteAiConfig();
                        setApiKey("");
                        const defaults = getProviderDefaults(provider);
                        setBaseUrl(defaults.baseUrl);
                        setModel(defaults.model);
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
                value={apiKey}
                onChangeText={setApiKey}
                placeholder={API_KEY_PLACEHOLDERS[provider]}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                containerStyle={styles.field}
            />

            {/* Base URL */}
            <Input
                label={t("ai.baseUrl")}
                value={baseUrl}
                onChangeText={setBaseUrl}
                placeholder="https://integrate.api.nvidia.com/v1"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                containerStyle={styles.field}
            />

            {/* Model */}
            <Input
                label={t("ai.model")}
                value={model}
                onChangeText={setModel}
                placeholder="meta/llama-3.1-70b-instruct"
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

            {apiKey.trim().length > 0 && (
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
