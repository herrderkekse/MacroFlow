import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

interface MenuItemProps {
    label: string;
    icon: string;
    onPress: () => void;
    colors: ReturnType<typeof useThemeColors>;
    destructive?: boolean;
}

export function MenuItem({ label, icon, onPress, colors, destructive }: MenuItemProps) {
    return (
        <Pressable style={menuItemStyles.item} onPress={onPress}>
            <Ionicons name={icon as never} size={20} color={destructive ? "#ef4444" : colors.text} />
            <Text style={[menuItemStyles.label, { color: destructive ? "#ef4444" : colors.text }]}>{label}</Text>
        </Pressable>
    );
}

const menuItemStyles = StyleSheet.create({
    item: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
    label: { fontSize: fontSize.sm },
});

interface ExerciseCardMenuProps {
    visible: boolean;
    onClose: () => void;
    isFinished: boolean;
    hasNote: boolean;
    hasTemplate: boolean;
    onEditNote: () => void;
    onCopyFromLast: () => void;
    onRemove: () => void;
    labels: {
        editNote: string;
        addNote: string;
        copyFromLast: string;
        remove: string;
    };
}

export function ExerciseCardMenu({
    visible, onClose, isFinished,
    hasNote, hasTemplate,
    onEditNote, onCopyFromLast, onRemove,
    labels,
}: ExerciseCardMenuProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createMenuStyles(colors), [colors]);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <View style={styles.menu}>
                    <MenuItem
                        label={hasNote ? labels.editNote : labels.addNote}
                        icon="create-outline"
                        onPress={onEditNote} colors={colors}
                    />
                    {hasTemplate && (
                        <MenuItem label={labels.copyFromLast} icon="copy-outline" onPress={onCopyFromLast} colors={colors} />
                    )}
                    <MenuItem label={labels.remove} icon="trash-outline" onPress={onRemove} colors={colors} destructive />
                </View>
            </Pressable>
        </Modal>
    );
}

interface ExerciseNoteModalProps {
    visible: boolean;
    onClose: () => void;
    value: string;
    onChangeText: (text: string) => void;
    onSave: () => void;
    labels: { title: string; placeholder: string; save: string };
}

export function ExerciseNoteModal({ visible, onClose, value, onChangeText, onSave, labels }: ExerciseNoteModalProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createNoteStyles(colors), [colors]);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={styles.noteModal} onPress={() => { }}>
                    <Text style={styles.noteTitle}>{labels.title}</Text>
                    <TextInput
                        style={styles.noteInput}
                        value={value}
                        onChangeText={onChangeText}
                        placeholder={labels.placeholder}
                        placeholderTextColor={colors.textTertiary}
                        multiline
                        autoFocus
                    />
                    <Pressable style={styles.noteSaveBtn} onPress={onSave}>
                        <Text style={styles.noteSaveText}>{labels.save}</Text>
                    </Pressable>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

function createMenuStyles(colors: ThemeColors) {
    return StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: spacing.lg,
        },
        menu: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            width: "100%",
            maxWidth: 300,
        },
    });
}

function createNoteStyles(colors: ThemeColors) {
    return StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: spacing.lg,
        },
        noteModal: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.lg,
            width: "100%",
            maxWidth: 340,
        },
        noteTitle: {
            fontSize: fontSize.lg,
            fontWeight: "700",
            color: colors.text,
            marginBottom: spacing.md,
        },
        noteInput: {
            fontSize: fontSize.sm,
            color: colors.text,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: borderRadius.md,
            padding: spacing.sm,
            minHeight: 80,
            textAlignVertical: "top",
            marginBottom: spacing.md,
        },
        noteSaveBtn: {
            backgroundColor: colors.primary,
            borderRadius: borderRadius.md,
            paddingVertical: spacing.sm,
            alignItems: "center",
        },
        noteSaveText: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: "#fff",
        },
    });
}
