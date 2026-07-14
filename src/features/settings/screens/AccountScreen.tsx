import Button from "@/src/shared/atoms/Button";
import Input from "@/src/shared/atoms/Input";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
    const insets = useSafeAreaInsets();
    const router = useRouter();

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

    function goBack() {
        router.navigate("/(tabs)/more" as any);
    }

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

    return (
        <KeyboardAvoidingView
            style={styles.screen}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView
                contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.headerRow}>
                    <Pressable onPress={goBack} style={styles.backBtn} hitSlop={8}>
                        <Ionicons name="chevron-back" size={24} color={colors.primary} />
                    </Pressable>
                    <Text style={styles.heading}>{t("account.title")}</Text>
                </View>

                {signedInAs ? (
                    <View style={styles.signedInCard}>
                        <Ionicons name="checkmark-circle" size={44} color={colors.primary} />
                        <Text style={styles.signedInTitle}>
                            {t("account.signedInAs", { username: signedInAs.username })}
                        </Text>
                        <Text style={styles.signedInServer}>{signedInAs.url}</Text>

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
                                {usage.quota > 0 &&
                                    (() => {
                                        const ratio = Math.min(1, usage.bytes / usage.quota);
                                        return (
                                            <View style={styles.usageBarTrack}>
                                                <View
                                                    style={[
                                                        styles.usageBarFill,
                                                        { flex: ratio },
                                                        ratio >= 0.9 && { backgroundColor: colors.danger },
                                                    ]}
                                                />
                                                {ratio < 1 && <View style={{ flex: 1 - ratio }} />}
                                            </View>
                                        );
                                    })()}
                            </View>
                        )}

                        <Text style={styles.signedInHint}>{t("account.signedInHint")}</Text>
                        <Button
                            title={t("account.signOut")}
                            variant="outline"
                            onPress={handleSignOut}
                            loading={signingOut}
                            style={styles.signOutBtn}
                            textStyle={{ color: colors.danger }}
                        />
                    </View>
                ) : (
                    <>
                        <Text style={styles.intro}>{t("account.intro")}</Text>

                        {/* Sign In / Sign Up segmented toggle */}
                        <View style={styles.segment}>
                            {(["signIn", "signUp"] as Mode[]).map((m) => (
                                <Pressable
                                    key={m}
                                    style={[styles.segmentItem, mode === m && styles.segmentItemActive]}
                                    onPress={() => setMode(m)}
                                >
                                    <Text
                                        style={[
                                            styles.segmentText,
                                            mode === m && styles.segmentTextActive,
                                        ]}
                                    >
                                        {m === "signIn" ? t("account.modeSignIn") : t("account.modeSignUp")}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>

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

                        <Text style={styles.switchHint}>
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
        content: { padding: spacing.lg, paddingBottom: 40 },
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
        intro: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
            marginBottom: spacing.lg,
            lineHeight: fontSize.sm * 1.4,
        },
        segment: {
            flexDirection: "row",
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 3,
            marginBottom: spacing.lg,
        },
        segmentItem: {
            flex: 1,
            paddingVertical: spacing.sm + 2,
            borderRadius: borderRadius.sm,
            alignItems: "center",
        },
        segmentItemActive: {
            backgroundColor: colors.primary,
        },
        segmentText: {
            fontSize: fontSize.md,
            fontWeight: "600",
            color: colors.textSecondary,
        },
        segmentTextActive: {
            color: "#FFFFFF",
        },
        field: {
            marginBottom: spacing.md,
        },
        submitBtn: {
            marginTop: spacing.sm,
        },
        switchHint: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
            textAlign: "center",
            marginTop: spacing.md,
        },
        signedInCard: {
            alignItems: "center",
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
            gap: spacing.sm,
        },
        signedInTitle: {
            fontSize: fontSize.lg,
            fontWeight: "700",
            color: colors.text,
            textAlign: "center",
        },
        signedInServer: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
            textAlign: "center",
        },
        usageBlock: {
            alignSelf: "stretch",
            marginTop: spacing.sm,
            gap: spacing.xs,
        },
        usageText: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
            textAlign: "center",
        },
        usageBarTrack: {
            flexDirection: "row",
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.border,
            overflow: "hidden",
        },
        usageBarFill: {
            backgroundColor: colors.primary,
            borderRadius: 3,
        },
        signedInHint: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
            textAlign: "center",
            marginTop: spacing.sm,
            lineHeight: fontSize.sm * 1.4,
        },
        signOutBtn: {
            marginTop: spacing.md,
            alignSelf: "stretch",
            borderColor: colors.danger,
        },
    });
}
