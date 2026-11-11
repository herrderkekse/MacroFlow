import Button from "@/src/shared/atoms/Button";
import FieldLabel from "@/src/shared/atoms/FieldLabel";
import Input from "@/src/shared/atoms/Input";
import Notice from "@/src/shared/atoms/Notice";
import FooterBar from "@/src/shared/components/FooterBar";
import ScreenHeader from "@/src/shared/components/ScreenHeader";
import SegmentedControl from "@/src/shared/components/SegmentedControl";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import { generateText } from "ai";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { createModelFromConfig } from "../helpers/createModelFromConfig";
import {
    deleteProviderSettings,
    getProviderDefaults,
    loadActiveProvider,
    loadProviderSettings,
    saveActiveProvider,
    saveProviderSettings,
    type AiProviderId,
    type ProviderSettings,
} from "../services/aiConfig";

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
        <View style={styles.screen}>
            <ScreenHeader title={t("ai.settings")} />
            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <Notice tone="danger">{t("ai.securityWarning")}</Notice>

                <FieldLabel>{t("ai.provider")}</FieldLabel>
                <SegmentedControl options={PROVIDER_OPTIONS} value={provider} onChange={setProvider} />

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
                <Input
                    label={t("ai.model")}
                    value={current.model}
                    onChangeText={(v) => updateField("model", v)}
                    placeholder={getProviderDefaults(provider).model}
                    autoCapitalize="none"
                    autoCorrect={false}
                    containerStyle={styles.field}
                />

                {current.apiKey.trim().length > 0 && (
                    <Button
                        title={t("ai.deleteConfig")}
                        variant="danger"
                        onPress={handleDelete}
                        style={styles.deleteBtn}
                    />
                )}
            </ScrollView>
            <FooterBar horizontal>
                <Button
                    title={t("ai.testConnection")}
                    variant="outline"
                    onPress={handleTest}
                    loading={testing}
                    style={styles.flexButton}
                />
                <Button title={t("common.save")} onPress={handleSave} loading={saving} style={styles.flexButton} />
            </FooterBar>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        content: { paddingHorizontal: screenPadding, paddingTop: spacing.sm, paddingBottom: spacing.xl },
        field: { marginTop: spacing.md },
        flexButton: { flex: 1 },
        deleteBtn: { marginTop: spacing.lg },
    });
}
