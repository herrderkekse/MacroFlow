import Button from "@/src/shared/atoms/Button";
import EmptyState from "@/src/shared/atoms/EmptyState";
import IconButton from "@/src/shared/atoms/IconButton";
import Input from "@/src/shared/atoms/Input";
import ListGroup from "@/src/shared/components/ListGroup";
import ScreenHeader from "@/src/shared/components/ScreenHeader";
import Sheet from "@/src/shared/components/Sheet";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { fontSize, screenPadding, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAiMemories } from "../hooks/useAiMemories";

export default function AiMemoriesScreen() {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [isAdding, setIsAdding] = useState(false);

    const {
        memories, newText, setNewText,
        editId, editText, setEditText,
        handleAdd, startEdit, cancelEdit, handleSaveEdit, handleDelete,
    } = useAiMemories();

    const isEditing = editId !== null;

    function closeSheet() {
        if (isEditing) cancelEdit();
        setIsAdding(false);
    }

    function handleSubmit() {
        if (isEditing) {
            handleSaveEdit();
        } else {
            handleAdd();
            setIsAdding(false);
        }
    }

    function confirmDelete(id: number) {
        Alert.alert(
            t("memory.deleteTitle"),
            t("memory.deleteConfirm"),
            [
                { text: t("common.cancel"), style: "cancel" },
                {
                    text: t("common.delete"),
                    style: "destructive",
                    onPress: () => {
                        cancelEdit();
                        handleDelete(id);
                    },
                },
            ],
        );
    }

    const draft = isEditing ? editText : newText;

    return (
        <View style={styles.screen}>
            <ScreenHeader
                title={t("memory.title")}
                right={<IconButton icon="add" label={t("memory.add")} onPress={() => setIsAdding(true)} />}
            />
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.description}>{t("memory.description")}</Text>

                {memories.length === 0 ? (
                    <EmptyState
                        icon="bookmark-outline"
                        title={t("memory.empty")}
                        action={<Button title={t("memory.add")} size="sm" variant="outline" onPress={() => setIsAdding(true)} />}
                    />
                ) : (
                    <ListGroup>
                        {memories.map((memory) => (
                            <Pressable
                                key={memory.id}
                                onPress={() => startEdit(memory)}
                                style={({ pressed }) => [styles.memoryRow, pressed && styles.pressed]}
                                accessibilityRole="button"
                            >
                                <Text style={styles.memoryText}>{memory.content}</Text>
                                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                            </Pressable>
                        ))}
                    </ListGroup>
                )}
            </ScrollView>

            <Sheet
                visible={isAdding || isEditing}
                onClose={closeSheet}
                title={isEditing ? t("memory.editTitle") : t("memory.add")}
                footer={
                    <>
                        <Button title={t("common.save")} onPress={handleSubmit} disabled={!draft.trim()} />
                        {isEditing && (
                            <Button title={t("common.delete")} variant="danger" onPress={() => confirmDelete(editId)} />
                        )}
                    </>
                }
            >
                <Input
                    value={draft}
                    onChangeText={isEditing ? setEditText : setNewText}
                    placeholder={t("memory.addPlaceholder")}
                    multiline
                    autoFocus
                    style={styles.input}
                    containerStyle={styles.inputContainer}
                />
            </Sheet>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        content: { paddingHorizontal: screenPadding, paddingTop: spacing.sm, paddingBottom: spacing.xl },
        description: {
            fontSize: fontSize.sm,
            lineHeight: 20,
            color: colors.textSecondary,
            marginBottom: spacing.md,
        },
        memoryRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            minHeight: 56,
            paddingHorizontal: screenPadding,
            paddingVertical: spacing.sm + 4,
        },
        pressed: { backgroundColor: colors.surfaceMuted },
        memoryText: { flex: 1, fontSize: fontSize.md, lineHeight: 22, color: colors.text },
        input: { minHeight: 96 },
        inputContainer: { marginBottom: spacing.md },
    });
}
