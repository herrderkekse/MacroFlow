import type { ThemeColors } from "@/src/utils/theme";

const MUSCLE_GROUP_COLOR_MAP: Partial<Record<string, keyof ThemeColors>> = {
    chest: "exerciseChest",
    back: "exerciseBack",
    legs: "exerciseLegs",
    shoulders: "exerciseShoulders",
    arms: "exerciseArms",
    core: "exerciseCore",
    full_body: "exerciseFullBody",
};

/** The dot colour of a muscle group; anything unknown gets the generic exercise colour. */
export function getMuscleGroupColor(muscleGroup: string, colors: ThemeColors): string {
    const key = MUSCLE_GROUP_COLOR_MAP[muscleGroup];
    return key ? colors[key] : colors.exercise;
}
