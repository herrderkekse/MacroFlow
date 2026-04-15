import ModalHeader from "@/src/shared/atoms/ModalHeader";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    FlatList,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { MUSCLE_GROUPS } from "../constants";
import { type ExerciseTemplate } from "../services/exerciseDb";
import type { MuscleGroup } from "../types";
import CreateExerciseModal from "./CreateExerciseModal";
import { useExerciseSearch } from "../hooks/useExerciseSearch";

interface AddExerciseModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (template: ExerciseTemplate) => void;
}

interface ExerciseRowProps {
    template: ExerciseTemplate;
    onPress: () => void;
}

function ExerciseRow({ template, onPress }: ExerciseRowProps) {
    const colors = useThemeColors();
    const styles = useMemo(() => createRowStyles(colors), [colors]);

    return (
        <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <View style={styles.info}>
                <Text style={styles.name}>{template.name}</Text>
                {(template.muscle_group || template.equipment) && (
                    <Text style={styles.meta}>
                        {[template.muscle_group, template.equipment].filter(Boolean).join(" · ")}
                    </Text>
                )}
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </Pressable>
    );
}

function createRowStyles(colors: ThemeColors) {
    return StyleSheet.create({
        row: {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: spacing.sm + 2,
            paddingHorizontal: spacing.lg,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        rowPressed: { backgroundColor: colors.primaryLight },
        info: { flex: 1 },
        name: { fontSize: fontSize.md, color: colors.text, fontWeight: "500" },
        meta: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
    });
}

export default function AddExerciseModal({ visible, onClose, onSelect }: AddExerciseModalProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [showCreate, setShowCreate] = useState(false);

    const search = useExerciseSearch();

    useEffect(() => {
        if (visible) {
            search.refresh();
        } else {
            search.setQuery("");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    function handleSelect(template: ExerciseTemplate) {
        onSelect(template);
    }

    function handleCreated(template: ExerciseTemplate) {
        setShowCreate(false);
        onSelect(template);
    }

    function handleCloseSelf() {
        setShowCreate(false);
        onClose();
    }

    const listData: ExerciseTemplate[] = search.isSearching
        ? search.searchResults
        : search.selectedMuscleGroup
            ? search.muscleGroupResults
            : [];

    const showList = search.isSearching || !!search.selectedMuscleGroup;

    return (
        <>
            <Modal
                visible={visible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={handleCloseSelf}
            >
                <View style={styles.container}>
                    <ModalHeader title={t("exercise.addExercise.title")} onClose={handleCloseSelf} />

                    {/* Search bar */}
                    <View style={styles.searchRow}>
                        <Ionicons name="search" size={18} color={colors.textTertiary} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder={t("exercise.addExercise.searchPlaceholder")}
                            placeholderTextColor={colors.textTertiary}
                            value={search.query}
                            onChangeText={search.setQuery}
                            returnKeyType="search"
                            clearButtonMode="while-editing"
                        />
                        {search.query.length > 0 && (
                            <Pressable onPress={() => search.setQuery("")} hitSlop={8}>
                                <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                            </Pressable>
                        )}
                    </View>

                    {/* Results or browse */}
                    {showList ? (
                        <FlatList
                            data={listData}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={({ item }) => (
                                <ExerciseRow template={item} onPress={() => handleSelect(item)} />
                            )}
                            ListEmptyComponent={
                                <Text style={styles.emptyText}>{t("exercise.addExercise.noResults")}</Text>
                            }
                            keyboardShouldPersistTaps="handled"
                        />
                    ) : (
                        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                            {/* Muscle group chips */}
                            <Text style={styles.sectionLabel}>{t("exercise.addExercise.sectionByMuscle")}</Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.chipRow}
                            >
                                {MUSCLE_GROUPS.map((mg) => (
                                    <Pressable
                                        key={mg.key}
                                        onPress={() => search.handleSelectMuscleGroup(mg.key as MuscleGroup)}
                                        style={[
                                            styles.muscleChip,
                                            search.selectedMuscleGroup === mg.key && styles.muscleChipActive,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.muscleChipText,
                                                search.selectedMuscleGroup === mg.key && styles.muscleChipTextActive,
                                            ]}
                                        >
                                            {t(mg.labelKey)}
                                        </Text>
                                    </Pressable>
                                ))}
                            </ScrollView>

                            {/* Recent templates */}
                            {search.recentTemplates.length > 0 && (
                                <>
                                    <Text style={styles.sectionLabel}>{t("exercise.addExercise.sectionRecent")}</Text>
                                    {search.recentTemplates.map((item) => (
                                        <ExerciseRow key={item.id} template={item} onPress={() => handleSelect(item)} />
                                    ))}
                                </>
                            )}
                        </ScrollView>
                    )}

                    {/* Footer: create new */}
                    <View style={styles.footer}>
                        <Pressable
                            onPress={() => setShowCreate(true)}
                            style={({ pressed }) => [styles.createButton, pressed && styles.createButtonPressed]}
                        >
                            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                            <Text style={styles.createButtonText}>{t("exercise.addExercise.createNew")}</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            <CreateExerciseModal
                visible={showCreate}
                onClose={() => setShowCreate(false)}
                onCreated={handleCreated}
            />
        </>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        searchRow: {
            flexDirection: "row",
            alignItems: "center",
            margin: spacing.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            gap: spacing.sm,
        },
        searchInput: {
            flex: 1,
            fontSize: fontSize.md,
            color: colors.text,
            padding: 0,
        },
        sectionLabel: {
            fontSize: fontSize.sm,
            fontWeight: "600",
            color: colors.textSecondary,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
            letterSpacing: 0.5,
        },
        chipRow: {
            flexDirection: "row",
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.sm,
        },
        muscleChip: {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: borderRadius.sm,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        muscleChipActive: {
            backgroundColor: colors.primaryLight,
            borderColor: colors.primary,
        },
        muscleChipText: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
        },
        muscleChipTextActive: {
            color: colors.primary,
            fontWeight: "600",
        },
        emptyText: {
            textAlign: "center",
            color: colors.textSecondary,
            fontSize: fontSize.md,
            padding: spacing.xl,
        },
        footer: {
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            padding: spacing.md,
        },
        createButton: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: borderRadius.md,
            borderWidth: 1.5,
            borderColor: colors.primary,
            borderStyle: "dashed",
        },
        createButtonPressed: {
            backgroundColor: colors.primaryLight,
        },
        createButtonText: {
            fontSize: fontSize.md,
            fontWeight: "600",
            color: colors.primary,
        },
    });
}
