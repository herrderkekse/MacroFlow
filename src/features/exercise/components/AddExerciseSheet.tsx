import Button from "@/src/shared/atoms/Button";
import EmptyState from "@/src/shared/atoms/EmptyState";
import SectionLabel from "@/src/shared/atoms/SectionLabel";
import SearchBar from "@/src/shared/components/SearchBar";
import Sheet from "@/src/shared/components/Sheet";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { screenPadding, spacing } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, ScrollView, StyleSheet, View } from "react-native";
import { MUSCLE_GROUPS } from "../constants";
import { type ExerciseTemplate } from "../services/exerciseDb";
import type { MuscleGroup } from "../types";
import CreateExerciseSheet from "./CreateExerciseSheet";
import ChipSelect from "./ChipSelect";
import ExerciseRow from "./ExerciseRow";
import { useExerciseSearch } from "../hooks/useExerciseSearch";

interface AddExerciseSheetProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (template: ExerciseTemplate, copyFromLast: boolean) => void;
}

/** Picks an exercise to add to a workout: search, browse by muscle group, or create one. */
export default function AddExerciseSheet({ visible, onClose, onSelect }: AddExerciseSheetProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
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

    function handleSelect(template: ExerciseTemplate, copyFromLast: boolean) {
        onSelect(template, copyFromLast);
    }

    function handleCreated(template: ExerciseTemplate) {
        setShowCreate(false);
        onSelect(template, false);
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

    function renderRow(item: ExerciseTemplate) {
        return (
            <ExerciseRow
                key={item.id}
                template={item}
                onAddEmpty={() => handleSelect(item, false)}
                onAddWithSets={() => handleSelect(item, true)}
            />
        );
    }

    const muscleChips = (
        <>
            <SectionLabel style={styles.sectionLabel}>{t("exercise.addExercise.sectionByMuscle")}</SectionLabel>
            <View style={styles.chipContainer}>
                <ChipSelect
                    items={MUSCLE_GROUPS.map((mg) => ({ key: mg.key, label: t(mg.labelKey) }))}
                    selected={search.selectedMuscleGroup}
                    onSelect={(key) => search.handleSelectMuscleGroup(key as MuscleGroup)}
                />
            </View>
        </>
    );

    return (
        <>
            <Sheet
                visible={visible}
                onClose={handleCloseSelf}
                title={t("exercise.addExercise.title")}
                tall
                scrollable={false}
                padded={false}
                footer={
                    <Button
                        title={t("exercise.addExercise.createNew")}
                        variant="outline"
                        icon={<Ionicons name="add" size={18} color={colors.text} />}
                        onPress={() => setShowCreate(true)}
                    />
                }
            >
                <SearchBar
                    value={search.query}
                    onChangeText={search.setQuery}
                    placeholder={t("exercise.addExercise.searchPlaceholder")}
                    style={styles.search}
                />

                {showList ? (
                    <FlatList
                        data={listData}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={({ item }) => renderRow(item)}
                        ListHeaderComponent={!search.isSearching ? muscleChips : null}
                        ListEmptyComponent={<EmptyState title={t("exercise.addExercise.noResults")} />}
                        keyboardShouldPersistTaps="handled"
                    />
                ) : (
                    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                        {muscleChips}
                        {search.recentTemplates.length > 0 && (
                            <>
                                <SectionLabel style={styles.sectionLabel}>
                                    {t("exercise.addExercise.sectionRecent")}
                                </SectionLabel>
                                {search.recentTemplates.map((item) => renderRow(item))}
                            </>
                        )}
                    </ScrollView>
                )}
            </Sheet>

            <CreateExerciseSheet
                visible={showCreate}
                initialName={search.query}
                onClose={() => setShowCreate(false)}
                onCreated={handleCreated}
            />
        </>
    );
}

const styles = StyleSheet.create({
    search: { marginHorizontal: screenPadding, marginBottom: spacing.xs },
    sectionLabel: { marginTop: spacing.md, paddingHorizontal: screenPadding },
    chipContainer: { paddingLeft: screenPadding, marginBottom: spacing.sm },
});
