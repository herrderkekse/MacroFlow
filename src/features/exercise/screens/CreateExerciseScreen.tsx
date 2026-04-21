import { router, useLocalSearchParams } from "expo-router";
import CreateExerciseModal from "../components/CreateExerciseModal";

export default function CreateExerciseScreen() {
    const { exerciseId, initialName } = useLocalSearchParams<{ exerciseId?: string; initialName?: string }>();
    const parsedId = exerciseId ? Number(exerciseId) : undefined;

    return (
        <CreateExerciseModal
            visible
            exerciseId={parsedId}
            initialName={initialName}
            onClose={() => router.back()}
            onCreated={() => router.back()}
        />
    );
}
