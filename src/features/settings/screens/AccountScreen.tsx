import Button from "@/src/shared/atoms/Button";
import Card from "@/src/shared/atoms/Card";
import Input from "@/src/shared/atoms/Input";
import ScreenHeader from "@/src/shared/components/ScreenHeader";
import SegmentedControl from "@/src/shared/components/SegmentedControl";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { getUsage, login, register, type UsageInfo } from "../services/syncClient";
import {
    clearSyncSettings,
    loadSyncSettings,
    saveSyncSettings,
} from "../services/syncSettings";

const MIN_PASSWORD_LENGTH = 8;

/** Formats a byte count as a short human-readable size, e.g. "4.9 MB". */
function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let value = bytes / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
    }
    return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

type Mode = "signIn" | "signUp";

export default function AccountScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    // Signed-in state, loaded once on mount.
    const [signedInAs, setSignedInAs] = useState<{ username: string; url: string } | null>(null);
    const [usage, setUsage] = useState<UsageInfo | null>(null);
    const [signingOut, setSigningOut] = useState(false);

    // Form state.
    const [mode, setMode] = useState<Mode>("signIn");
    const [url, setUrl] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Loads storage usage for the saved account. Usage is informational, so a
    // failure just leaves it hidden rather than surfacing an error.
    const refreshUsage = useCallback(async () => {
        const settings = await loadSyncSettings();
        if (!settings) return;
        try {
            setUsage(await getUsage(settings));
        } catch {
            setUsage(null);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const settings = await loadSyncSettings();
            if (cancelled || !settings) return;
            setSignedInAs({ username: settings.username, url: settings.url });
            // Pre-fill the URL so a re-sign-in on the same server is one tap.
            setUrl(settings.url);
            refreshUsage();
        })();
        return () => {
            cancelled = true;
        };
    }, [refreshUsage]);

    function validate(): string | null {
        if (!url.trim() || !username.trim() || !password) {
            return t("account.errorFieldsRequired");
        }
        if (mode === "signUp") {
            if (password.length < MIN_PASSWORD_LENGTH) {
                return t("account.errorPasswordTooShort", { count: MIN_PASSWORD_LENGTH });
            }
            if (password !== confirm) {
                return t("account.errorPasswordMismatch");
            }
        }
        return null;
    }

    async function handleSubmit() {
        const error = validate();
        if (error) {
            Alert.alert(t("account.title"), error);
            return;
        }
        const creds = { username: username.trim(), password };
        try {
            setSubmitting(true);
            if (mode === "signUp") {
                await register(url, creds);
            } else {
                await login(url, creds);
            }
            await saveSyncSettings({ url, username: creds.username, password });
            setSignedInAs({ username: creds.username, url: url.trim().replace(/\/+$/, "") });
            setPassword("");
            setConfirm("");
            refreshUsage();
            Alert.alert(
                t("account.title"),
                mode === "signUp" ? t("account.signUpSuccess") : t("account.signInSuccess"),
            );
        } catch (e: any) {
            Alert.alert(
                mode === "signUp" ? t("account.signUpFailed") : t("account.signInFailed"),
                e.message ?? t("common.unknownError"),
            );
        } finally {
            setSubmitting(false);
        }
    }

    function handleSignOut() {
        Alert.alert(t("account.signOutConfirmTitle"), t("account.signOutConfirmMessage"), [
            { text: t("common.cancel"), style: "cancel" },
            {
                text: t("account.signOut"),
                style: "destructive",
                onPress: async () => {
                    try {
                        setSigningOut(true);
                        await clearSyncSettings();
                        setSignedInAs(null);
                        setUsage(null);
                        setPassword("");
                        setConfirm("");
                    } finally {
                        setSigningOut(false);
                    }
                },
            },
        ]);
    }

    const usageRatio = usage && usage.quota > 0 ? Math.min(1, usage.bytes / usage.quota) : null;

    return (
        <KeyboardAvoidingView
            style={styles.screen}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScreenHeader title={t("account.title")} />
            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {signedInAs ? (
                    <>
                        <Card>
                            <View style={styles.identityRow}>
                                <View style={styles.avatar}>
                                    <Ionicons name="person" size={20} color={colors.text} />
                                </View>
                                <View style={styles.identityText}>
                                    <Text style={styles.signedInTitle} numberOfLines={1}>
                                        {t("account.signedInAs", { username: signedInAs.username })}
                                    </Text>
                                    <Text style={styles.signedInServer} numberOfLines={1}>{signedInAs.url}</Text>
                                </View>
                            </View>

                            {usage && (
                                <View style={styles.usageBlock}>
                                    <Text style={styles.usageText}>
                                        {usage.quota > 0
                                            ? t("account.storageUsedOf", {
                                                  used: formatBytes(usage.bytes),
                                                  total: formatBytes(usage.quota),
                                              })
                                            : t("account.storageUsed", { used: formatBytes(usage.bytes) })}
                                    </Text>
                                    {usageRatio != null && (
                                        <View style={styles.usageBarTrack}>
                                            <View
                                                style={[
                                                    styles.usageBarFill,
                                                    { flex: usageRatio },
                                                    usageRatio >= 0.9 && { backgroundColor: colors.danger },
                                                ]}
                                            />
                                            {usageRatio < 1 && <View style={{ flex: 1 - usageRatio }} />}
                                        </View>
                                    )}
                                </View>
                            )}
                        </Card>

                        <Text style={styles.note}>{t("account.signedInHint")}</Text>
                        <Button
                            title={t("account.signOut")}
                            variant="danger"
                            onPress={handleSignOut}
                            loading={signingOut}
                            style={styles.signOutBtn}
                        />
                    </>
                ) : (
                    <>
                        <Text style={styles.intro}>{t("account.intro")}</Text>

                        <SegmentedControl<Mode>
                            options={[
                                { key: "signIn", label: t("account.modeSignIn") },
                                { key: "signUp", label: t("account.modeSignUp") },
                            ]}
                            value={mode}
                            onChange={setMode}
                            style={styles.modeSwitch}
                        />

                        <Input
                            label={t("account.serverUrl")}
                            value={url}
                            onChangeText={setUrl}
                            placeholder="https://sync.example.com"
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="url"
                            containerStyle={styles.field}
                        />
                        <Input
                            label={t("account.username")}
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                            autoCorrect={false}
                            textContentType="username"
                            containerStyle={styles.field}
                        />
                        <Input
                            label={t("account.password")}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            autoCapitalize="none"
                            textContentType={mode === "signUp" ? "newPassword" : "password"}
                            containerStyle={styles.field}
                        />
                        {mode === "signUp" && (
                            <Input
                                label={t("account.confirmPassword")}
                                value={confirm}
                                onChangeText={setConfirm}
                                secureTextEntry
                                autoCapitalize="none"
                                textContentType="newPassword"
                                containerStyle={styles.field}
                            />
                        )}

                        <Button
                            title={mode === "signUp" ? t("account.signUpButton") : t("account.signInButton")}
                            onPress={handleSubmit}
                            loading={submitting}
                            style={styles.submitBtn}
                        />

                        <Text style={[styles.note, styles.centered]}>
                            {mode === "signIn" ? t("account.switchToSignUp") : t("account.switchToSignIn")}
                        </Text>
                    </>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        content: { paddingHorizontal: screenPadding, paddingTop: spacing.sm, paddingBottom: spacing.xl },
        intro: { fontSize: fontSize.sm, lineHeight: 20, color: colors.textSecondary },
        modeSwitch: { marginTop: spacing.md, marginBottom: spacing.md },
        field: { marginBottom: spacing.md },
        submitBtn: { marginTop: spacing.sm },
        note: {
            fontSize: fontSize.xs,
            lineHeight: 17,
            color: colors.textSecondary,
            marginTop: spacing.md,
            marginHorizontal: spacing.xs,
        },
        centered: { textAlign: "center" },
        identityRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4 },
        avatar: {
            width: 44,
            height: 44,
            borderRadius: borderRadius.full,
            backgroundColor: colors.primaryLight,
            alignItems: "center",
            justifyContent: "center",
        },
        identityText: { flex: 1 },
        signedInTitle: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
        signedInServer: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
        usageBlock: {
            marginTop: spacing.md,
            paddingTop: spacing.md,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            gap: spacing.sm,
        },
        usageText: { fontSize: fontSize.xs, color: colors.textSecondary },
        usageBarTrack: {
            flexDirection: "row",
            height: 6,
            borderRadius: borderRadius.full,
            backgroundColor: colors.border,
            overflow: "hidden",
        },
        usageBarFill: { backgroundColor: colors.primary },
        signOutBtn: { marginTop: spacing.md },
    });
}
