import type { UiChatMessage } from "@/src/services/ai/chat";
import type { ThemeColors } from "@/src/utils/theme";
import React from "react";
import MealPlanToolResult from "./MealPlanToolResult";

interface ToolResultContainerProps {
    message: UiChatMessage;
    colors: ThemeColors;
    onImport: (msgId: string) => void;
    onDismiss: (msgId: string) => void;
}

/**
 * Dispatches to the correct tool-result UI based on `toolResultData`.
 * Add new tool result renderers here when adding tools.
 */
export default function ToolResultContainer({
    message,
    colors,
    onImport,
    onDismiss,
}: ToolResultContainerProps) {
    const data = message.toolResultData;
    if (!data) return null;

    if (data.mealPlanEntries) {
        return (
            <MealPlanToolResult
                entries={data.mealPlanEntries}
                colors={colors}
                onImport={() => onImport(message.id)}
                onDismiss={() => onDismiss(message.id)}
            />
        );
    }

    // Future tools: add more checks here
    // if (data.someOtherToolData) { return <SomeOtherToolResult ... />; }

    return null;
}
