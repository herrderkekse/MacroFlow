import { router } from "expo-router";
import CreateExerciseModal from "../components/CreateExerciseModal";

export default function CreateExerciseScreen() {
    return (
        <CreateExerciseModal
            visible
            onClose={() => router.back()}
            onCreated={() => router.back()}
        />
    );
}
