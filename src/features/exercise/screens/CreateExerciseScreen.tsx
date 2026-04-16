import { router, useLocalSearchParams } from "expo-router";
import CreateExerciseModal from "../components/CreateExerciseModal";

export default function CreateExerciseScreen() {
    const { exerciseId } = useLocalSearchParams<{ exerciseId?: string }>();
    const parsedId = exerciseId ? Number(exerciseId) : undefined;

    return (
        <CreateExerciseModal
            visible
            exerciseId={parsedId}
            onClose={() => router.back()}
            onCreated={() => router.back()}
        />
    );
}
