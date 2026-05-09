import { WORKOUT_KEEP_AWAKE_TAG, useKeepAwake } from "@/src/services/keepAwake";
import { useIsFocused } from "@react-navigation/native";

interface WorkoutKeepAwakeProps {
    enabled: boolean;
}

export default function WorkoutKeepAwake({ enabled }: WorkoutKeepAwakeProps) {
    const isFocused = useIsFocused();

    if (!enabled || !isFocused) {
        return null;
    }

    return <ActiveWorkoutKeepAwake />;
}

function ActiveWorkoutKeepAwake() {
    useKeepAwake(WORKOUT_KEEP_AWAKE_TAG);

    return null;
}