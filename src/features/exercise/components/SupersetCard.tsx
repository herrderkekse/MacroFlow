import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { borderRadius, fontSize, spacing, type ThemeColors } from "@/src/utils/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { parseCustomFields } from "../helpers/customFields";
import { activeRowIndex, nextAddTarget, orderSupersetRows, type SupersetRow, type WorkoutCard } from "../helpers/supersets";
import type { ExerciseSet, WorkoutExerciseWithSets } from "../services/exerciseDb";
import type { ExerciseType } from "../types";
import { createExerciseCardStyles, getPrefillForSet } from "./ExerciseCardHelpers";
import { ExerciseNoteModal, MenuItem } from "./ExerciseCardModals";
import RestTimer from "./RestTimer";
import SetInputRow, { type SetValues } from "./SetInputRow";

// Distinct, theme-aware accent per member so each set row can be tied to its exercise.
function memberColor(colors: ThemeColors, memberIndex: number): string {
    return memberIndex === 0 ? colors.primary : colors.exercise;
}

interface SupersetCardProps {
    card: WorkoutCard;
    index: number;
    isFinished: boolean;
    isExpanded: boolean;
    onExpand: () => void;
    onDragStart: () => void;
    getLastSets: (templateId: number | null) => ExerciseSet[];
    onRemove: (workoutExerciseId: number) => void;
    onNoteChange: (workoutExerciseId: number, note: string) => void;
    onConfirmSet: (setId: number, values: SetValues) => void;
    onUpdateSet: (setId: number, values: SetValues) => void;
    onDeleteSet: (setId: number) => void;
    onSetTypeChange: (setId: number, type: string) => void;
    onAddSet: (workoutExerciseId: number) => void;
    onCopyFromLast: (workoutExerciseId: number, templateId: number) => void;
    onReorderSet: (setId: number, toIndex: number) => void;
    restTimerActive: boolean;
    restTimerElapsed: number;
    restTimerTarget: number;
    restTimerReached: boolean;
    onRestTimerSkip: () => void;
    onRestTimerChangeDuration: (seconds: number) => void;
}

export default function SupersetCard(props: SupersetCardProps) {
    const { card, isExpanded, onExpand, onDragStart } = props;
    if (!isExpanded) {
        return <CollapsedSupersetCard card={card} index={props.index} onExpand={onExpand} onLongPress={onDragStart} />;
    }
    return <ExpandedSupersetCard {...props} />;
}

// ── Collapsed ────────────────────────────────────────────────────────────────

function CollapsedSupersetCard({ card, index, onExpand, onLongPress }: {
    card: WorkoutCard; index: number; onExpand: () => void; onLongPress: () => void;
}) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const allSets = card.members.flatMap((m) => m.sets);
    const completed = allSets.filter((s) => !!s.completed_at).length;
    const isAllDone = allSets.length > 0 && completed === allSets.length;

    return (
        <Pressable style={styles.collapsedCard} onPress={onExpand} onLongPress={onLongPress}>
            <Text style={styles.collapsedOrderNum}>{index + 1}.</Text>
            <Text style={styles.collapsedName} numberOfLines={1}>
                {card.members.map((m) => m.exerciseTemplate?.name ?? "?").join("  +  ")}
            </Text>
            <View style={[styles.progressBadge, isAllDone && styles.progressBadgeComplete]}>
                {isAllDone && <Ionicons name="checkmark-circle" size={12} color={colors.success} />}
                <Text style={[styles.progressText, isAllDone && styles.progressTextComplete]}>
                    {allSets.length === 0
                        ? t("exercise.exerciseCard.noSetsYet")
                        : t("exercise.exerciseCard.setsProgress", { completed, total: allSets.length })}
                </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </Pressable>
    );
}

// ── Expanded ─────────────────────────────────────────────────────────────────

function ExpandedSupersetCard({
    card, index, isFinished, onDragStart, getLastSets,
    onRemove, onNoteChange, onConfirmSet, onUpdateSet, onDeleteSet, onSetTypeChange, onAddSet, onCopyFromLast, onReorderSet,
    restTimerActive, restTimerElapsed, restTimerTarget, restTimerReached, onRestTimerSkip, onRestTimerChangeDuration,
}: SupersetCardProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const router = useRouter();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const cardStyles = useMemo(() => createExerciseCardStyles(colors), [colors]);

    const [menuOpen, setMenuOpen] = useState(false);
    const [noteOpen, setNoteOpen] = useState(false);
    const [noteDraft, setNoteDraft] = useState("");

    const members = card.members;
    // A superset carries a single, shared note — kept on the base (first) member.
    const noteHost = members[0];
    const rows = useMemo(() => orderSupersetRows(members), [members]);
    const activeIdx = isFinished ? -1 : activeRowIndex(rows);

    function renderRow({ item: row, drag, getIndex }: RenderItemParams<SupersetRow>) {
        const i = getIndex() ?? 0;
        const member = members[row.memberIndex];
        const template = member.exerciseTemplate;
        const exerciseType = (template?.type as ExerciseType) ?? "weight";
        const customFields = parseCustomFields(template?.custom_fields);
        const prefill = getPrefillForSet(row.withinIndex, member.sets, getLastSets(template?.id ?? null));
        const active = i === activeIdx;
        return (
            <React.Fragment key={row.set.id}>
                {active && restTimerActive && (
                    <RestTimer
                        elapsedSeconds={restTimerElapsed}
                        targetSeconds={restTimerTarget}
                        isTargetReached={restTimerReached}
                        onSkip={onRestTimerSkip}
                        onChangeDuration={onRestTimerChangeDuration}
                    />
                )}
                <View style={styles.rowWrap}>
                    <View style={styles.chipCol}>
                        <View style={[styles.rowBar, { backgroundColor: memberColor(colors, row.memberIndex) }]} />
                    </View>
                    <View style={styles.rowInput}>
                        <SetInputRow
                            set={row.set}
                            index={row.withinIndex}
                            exerciseType={exerciseType}
                            customFields={customFields}
                            isActive={active}
                            isFinished={isFinished}
                            prefillWeight={prefill.weight}
                            prefillReps={prefill.reps}
                            prefillRir={prefill.rir}
                            prefillDuration={prefill.duration}
                            prefillDistance={prefill.distance}
                            prefillCustom={prefill.custom}
                            onConfirm={onConfirmSet}
                            onUpdate={onUpdateSet}
                            onDelete={onDeleteSet}
                            onTypeChange={onSetTypeChange}
                            onDragStart={drag}
                        />
                    </View>
                </View>
            </React.Fragment>
        );
    }

    const sameType = members.every((m) => m.exerciseTemplate?.type === members[0].exerciseTemplate?.type);
    const headerType = (members[0].exerciseTemplate?.type as ExerciseType) ?? "weight";
    const headerCustomFields = parseCustomFields(members[0].exerciseTemplate?.custom_fields);

    function handleRemove(member: WorkoutExerciseWithSets) {
        setMenuOpen(false);
        Alert.alert(
            t("exercise.superset.removeMember", { name: member.exerciseTemplate?.name ?? "" }),
            t("exercise.superset.removeMemberConfirm"),
            [
                { text: t("common.cancel"), style: "cancel" },
                { text: t("common.delete"), style: "destructive", onPress: () => onRemove(member.workoutExercise.id) },
            ],
        );
    }

    function handleHistory() {
        const valid = members.filter((m) => m.exerciseTemplate);
        if (valid.length === 0) return;
        router.push({
            pathname: "/workout/exercise-history",
            params: {
                templateId: String(valid[0].exerciseTemplate!.id),
                name: valid[0].exerciseTemplate!.name,
                workoutExerciseId: String(valid[0].workoutExercise.id),
                templateIds: valid.map((m) => m.exerciseTemplate!.id).join(","),
                workoutExerciseIds: valid.map((m) => m.workoutExercise.id).join(","),
            },
        });
    }

    function handleAddSet() {
        onAddSet(members[nextAddTarget(members)].workoutExercise.id);
    }

    return (
        <Pressable style={[cardStyles.card, styles.supersetCardBorder]} onLongPress={onDragStart} delayLongPress={180}>
            {/* Title row: order number, colored "A + B" title, history + menu */}
            <View style={styles.titleRow}>
                <Text style={cardStyles.orderNum}>{index + 1}.</Text>
                <Text style={styles.titleText} numberOfLines={2}>
                    {members.map((m, i) => (
                        <Text key={m.workoutExercise.id} style={{ color: memberColor(colors, i) }}>
                            {i > 0 ? "  +  " : ""}{m.exerciseTemplate?.name ?? "?"}
                        </Text>
                    ))}
                </Text>
                <Pressable onPress={handleHistory} hitSlop={8}>
                    <Ionicons name="bar-chart-outline" size={18} color={colors.textSecondary} />
                </Pressable>
                <Pressable onPress={() => setMenuOpen(true)} hitSlop={8}>
                    <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
                </Pressable>
            </View>

            {/* Shared note */}
            {noteHost.workoutExercise.notes ? (
                <Text style={cardStyles.noteText} numberOfLines={2}>{noteHost.workoutExercise.notes}</Text>
            ) : null}

            {/* Column headers (only when both members share a type) */}
            {sameType && (
                <View style={cardStyles.headerRow}>
                    <View style={styles.chipCol} />
                    <View style={cardStyles.handleCol} />
                    <Text style={[cardStyles.headerCell, cardStyles.setCol]}>{t("exercise.exerciseCard.set")}</Text>
                    {headerType === "weight" && (
                        <Text style={[cardStyles.headerCell, cardStyles.valueCol]}>{t("exercise.exerciseCard.weight")}</Text>
                    )}
                    {headerType !== "cardio" && !(headerType === "other" && headerCustomFields.length > 0) && (
                        <Text style={[cardStyles.headerCell, cardStyles.valueCol]}>{t("exercise.exerciseCard.reps")}</Text>
                    )}
                    {headerType === "cardio" && (
                        <>
                            <Text style={[cardStyles.headerCell, cardStyles.valueCol]}>{t("exercise.exerciseCard.duration")}</Text>
                            <Text style={[cardStyles.headerCell, cardStyles.valueCol]}>{t("exercise.exerciseCard.distance")}</Text>
                        </>
                    )}
                    {headerType !== "cardio" && !(headerType === "other" && headerCustomFields.length > 0) && (
                        <Text style={[cardStyles.headerCell, cardStyles.rirCol]}>{t("exercise.exerciseCard.rir")}</Text>
                    )}
                    <Text style={[cardStyles.headerCell, cardStyles.emptyCol]}></Text>
                </View>
            )}

            {/* Combined set rows (draggable; a colored bar ties each set to its exercise) */}
            <DraggableFlatList
                data={rows}
                keyExtractor={(row) => String(row.set.id)}
                scrollEnabled={false}
                activationDistance={0}
                onDragEnd={({ from, to }) => { if (from !== to) onReorderSet(rows[from].set.id, to); }}
                renderItem={renderRow}
            />

            {rows.length === 0 && (
                <Text style={cardStyles.emptyText}>{t("exercise.workout.emptyState")}</Text>
            )}

            {!isFinished && (
                <Pressable style={cardStyles.addSetBtn} onPress={handleAddSet}>
                    <Text style={cardStyles.addSetText}>{t("exercise.exerciseCard.addSet")}</Text>
                </Pressable>
            )}

            {/* Unified menu: one shared note, then per-member copy and remove */}
            <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
                <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
                    <View style={styles.menu}>
                        <MenuItem
                            label={noteHost.workoutExercise.notes ? t("exercise.exerciseCard.editNote") : t("exercise.exerciseCard.addNote")}
                            icon="create-outline"
                            colors={colors}
                            onPress={() => { setMenuOpen(false); setNoteDraft(noteHost.workoutExercise.notes ?? ""); setNoteOpen(true); }}
                        />
                        {members.map((member, i) => member.exerciseTemplate && (
                            <MenuItem
                                key={`copy-${member.workoutExercise.id}`}
                                label={t("exercise.superset.copyMember", { name: member.exerciseTemplate.name })}
                                icon="copy-outline"
                                colors={colors}
                                onPress={() => { setMenuOpen(false); onCopyFromLast(member.workoutExercise.id, member.exerciseTemplate!.id); }}
                            />
                        ))}
                        {members.map((member) => (
                            <MenuItem
                                key={`remove-${member.workoutExercise.id}`}
                                label={t("exercise.superset.removeMember", { name: member.exerciseTemplate?.name ?? "" })}
                                icon="trash-outline"
                                colors={colors}
                                destructive
                                onPress={() => handleRemove(member)}
                            />
                        ))}
                    </View>
                </Pressable>
            </Modal>

            <ExerciseNoteModal
                visible={noteOpen}
                onClose={() => setNoteOpen(false)}
                value={noteDraft}
                onChangeText={setNoteDraft}
                onSave={() => { onNoteChange(noteHost.workoutExercise.id, noteDraft.trim()); setNoteOpen(false); }}
                labels={{
                    title: t("exercise.exerciseCard.note"),
                    placeholder: t("exercise.exerciseCard.notePlaceholder"),
                    save: t("common.save"),
                }}
            />
        </Pressable>
    );
}

const CHIP_COL_WIDTH = 12;

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        // Collapsed
        collapsedCard: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            paddingVertical: spacing.sm + 2,
            paddingHorizontal: spacing.md,
            marginBottom: spacing.sm,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
        },
        collapsedOrderNum: {
            fontSize: fontSize.sm,
            fontWeight: "700",
            color: colors.textTertiary,
            width: 22,
        },
        collapsedName: {
            flex: 1,
            fontSize: fontSize.sm,
            fontWeight: "500",
            color: colors.text,
        },
        progressBadge: {
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor: colors.primaryLight,
            paddingHorizontal: spacing.sm,
            paddingVertical: 3,
            borderRadius: borderRadius.sm,
        },
        progressBadgeComplete: { backgroundColor: colors.success + "22" },
        progressText: { fontSize: fontSize.xs, fontWeight: "600", color: colors.primary },
        progressTextComplete: { color: colors.success },

        // Expanded
        supersetCardBorder: {
            borderColor: colors.exercise,
        },
        titleRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            marginBottom: spacing.sm,
        },
        titleText: {
            flex: 1,
            fontSize: fontSize.lg,
            fontWeight: "700",
        },
        chipCol: {
            width: CHIP_COL_WIDTH,
            alignItems: "center",
            paddingVertical: 4,
        },
        rowWrap: {
            flexDirection: "row",
            alignItems: "stretch",
        },
        // flex:1 fills the (stretched) chipCol's full height, so the bar spans the row.
        rowBar: {
            flex: 1,
            width: 3,
            borderRadius: 2,
        },
        rowInput: {
            flex: 1,
        },
        menuOverlay: {
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
