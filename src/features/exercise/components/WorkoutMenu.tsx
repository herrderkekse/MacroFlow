import ActionSheet from "@/src/shared/components/ActionSheet";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import type { Workout } from "../services/exerciseDb";
import CopyWorkoutSheet from "./CopyWorkoutSheet";
import EditWorkoutTimesSheet from "./EditWorkoutTimesSheet";

interface WorkoutMenuProps {
    visible: boolean;
    onClose: () => void;
    workout: Workout;
    onSaveTimes: (startEpoch: number, endEpoch: number | null) => void;
    /** A previous workout's exercises were copied in as scheduled sets. */
    onCopied: () => void;
    onDiscard: () => void;
}

/** The workout's own actions, behind the header's "more" button, and the sheets they open. */
export default function WorkoutMenu({ visible, onClose, workout, onSaveTimes, onCopied, onDiscard }: WorkoutMenuProps) {
    const { t } = useTranslation();
    const [showTimes, setShowTimes] = useState(false);
    const [showCopy, setShowCopy] = useState(false);

    function confirmDiscard() {
        Alert.alert(t("exercise.workout.discard"), t("exercise.workoutSummary.deleteConfirm"), [
            { text: t("common.cancel"), style: "cancel" },
            { text: t("common.delete"), style: "destructive", onPress: onDiscard },
        ]);
    }

    return (
        <>
            <ActionSheet
                visible={visible}
                onClose={onClose}
                title={workout.title || t("exercise.workout.defaultTitle")}
                actions={[
                    {
                        key: "times",
                        icon: "time-outline",
                        label: t("exercise.workout.editTimes"),
                        onPress: () => setShowTimes(true),
                    },
                    {
                        key: "copy",
                        icon: "copy-outline",
                        label: t("exercise.workout.copyPrevious"),
                        onPress: () => setShowCopy(true),
                    },
                    {
                        key: "discard",
                        icon: "trash-outline",
                        label: t("exercise.workout.discard"),
                        destructive: true,
                        onPress: confirmDiscard,
                    },
                ]}
            />

            <EditWorkoutTimesSheet
                visible={showTimes}
                onClose={() => setShowTimes(false)}
                startedAt={workout.started_at}
                endedAt={workout.ended_at}
                onSave={onSaveTimes}
                labels={{
                    title: t("exercise.workout.editTimes"),
                    startLabel: t("exercise.workout.startedAt"),
                    endLabel: t("exercise.workout.endedAt"),
                    save: t("common.save"),
                }}
            />

            <CopyWorkoutSheet
                visible={showCopy}
                targetWorkoutId={workout.id}
                onClose={() => setShowCopy(false)}
                onCopied={onCopied}
            />
        </>
    );
}
