import Button from "@/src/shared/atoms/Button";
import Input from "@/src/shared/atoms/Input";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAiMemories } from "../hooks/useAiMemories";

export default function AiMemoriesScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const {
        memories, newText, setNewText,
        editId, editText, setEditText,
        handleAdd, startEdit, cancelEdit, handleSaveEdit, handleDelete,
    } = useAiMemories();

    function confirmDelete(id: number) {
        Alert.alert(
            t("memory.deleteTitle"),
            t("memory.deleteConfirm"),
            [
                { text: t("common.cancel"), style: "cancel" },
                { text: t("common.delete"), style: "destructive", onPress: () => handleDelete(id) },
            ],
        );
    }

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
                <Text style={styles.heading}>{t("memory.title")}</Text>
            </View>

            <Text style={styles.description}>{t("memory.description")}</Text>

            {memories.length === 0 && (
                <Text style={styles.emptyText}>{t("memory.empty")}</Text>
            )}

            {memories.map((memory) => (
                <View key={memory.id} style={styles.memoryCard}>
                    {editId === memory.id ? (
                        <View style={styles.editRow}>
                            <Input
                                value={editText}
                                onChangeText={setEditText}
                                containerStyle={styles.editInput}
                                autoFocus
                                multiline
                            />
                            <View style={styles.editActions}>
                                <Button title={t("common.save")} onPress={handleSaveEdit} style={styles.saveBtn} />
                                <Button title={t("common.cancel")} onPress={cancelEdit} variant="outline" style={styles.cancelBtn} />
                            </View>
                        </View>
                    ) : (
                        <View style={styles.memoryRow}>
                            <Ionicons name="bookmark-outline" size={16} color={colors.primary} style={styles.memoryIcon} />
                            <Text style={styles.memoryText}>{memory.content}</Text>
                            <View style={styles.memoryActions}>
                                <Pressable onPress={() => startEdit(memory)} hitSlop={8} style={styles.iconBtn}>
                                    <Ionicons name="pencil-outline" size={18} color={colors.textSecondary} />
                                </Pressable>
                                <Pressable onPress={() => confirmDelete(memory.id)} hitSlop={8} style={styles.iconBtn}>
                                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                                </Pressable>
                            </View>
                        </View>
                    )}
                </View>
            ))}

            <Text style={styles.sectionLabel}>{t("memory.addNew")}</Text>
            <Input
                value={newText}
                onChangeText={setNewText}
                placeholder={t("memory.addPlaceholder")}
                multiline
                containerStyle={styles.addInput}
            />
            <Button title={t("memory.add")} onPress={handleAdd} style={styles.addBtn} />
        </ScrollView>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        content: { padding: spacing.lg, paddingBottom: 40 },
        headerRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg, gap: spacing.sm },
        backBtn: { padding: spacing.xs },
        heading: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text },
        description: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.lg },
        emptyText: { fontSize: fontSize.sm, color: colors.textTertiary, textAlign: "center", marginVertical: spacing.xl },
        memoryCard: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.md,
            marginBottom: spacing.sm,
        },
        memoryRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
        memoryIcon: { marginTop: 2 },
        memoryText: { flex: 1, fontSize: fontSize.sm, color: colors.text, lineHeight: 20 },
        memoryActions: { flexDirection: "row", gap: spacing.xs },
        iconBtn: { padding: spacing.xs },
        editRow: { gap: spacing.sm },
        editInput: { flex: 1 },
        editActions: { flexDirection: "row", gap: spacing.sm },
        saveBtn: { flex: 1 },
        cancelBtn: { flex: 1 },
        sectionLabel: {
            fontSize: fontSize.xs,
            fontWeight: "600",
            color: colors.textSecondary,
            textTransform: "uppercase",
            letterSpacing: 0.8,
            marginTop: spacing.lg,
            marginBottom: spacing.sm,
        },
        addInput: { marginBottom: spacing.sm },
        addBtn: {},
    });
}
