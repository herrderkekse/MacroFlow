import { getEntryById } from "@/src/features/log/services/logDb";
import { getFoodById } from "@/src/features/templates/services/templateDb";
import i18n from "@/src/i18n";

/**
 * Returns the human-readable, translated display name for an internal tool name.
 * Falls back to a formatted version of the tool name if no key is found.
 */
export function getToolDisplayName(toolName: string): string {
    const key = `chat.toolNames.${toolName}`;
    const result = i18n.t(key);
    return result === key ? toolName.replace(/_/g, " ") : result;
}

/**
 * Builds a localized, human-readable description of what a tool call will do,
 * including its resolved parameters (e.g. food names instead of raw IDs).
 * Used for tool-request bubble content and the approval banner detail line.
 */
export function buildToolRequestContent(toolName: string, args: Record<string, unknown>): string {
    const params = resolveToolRequestParams(toolName, args);
    const key = `chat.toolRequest.${toolName}`;
    const result = i18n.t(key, { defaultValue: getToolDisplayName(toolName), ...params });
    return result === key ? getToolDisplayName(toolName) : result;
}

// ── Parameter resolvers ───────────────────────────────────

function resolveToolRequestParams(toolName: string, args: Record<string, unknown>): Record<string, unknown> {
    switch (toolName) {
        case "log_food": {
            const food = getFoodById(Number(args.food_id));
            return {
                quantity: args.quantity,
                unit: args.unit ?? food?.default_unit ?? "g",
                food: food?.name ?? `#${args.food_id}`,
                meal: args.meal_type,
                date: args.date,
            };
        }
        case "move_log_entry": {
            const row = getEntryById(Number(args.entry_id));
            return {
                food: row?.foods?.name ?? `#${args.entry_id}`,
                meal: args.target_meal_type ?? "—",
                date: args.target_date ?? "—",
            };
        }
        case "update_log_entry": {
            const row = getEntryById(Number(args.entry_id));
            return {
                food: row?.foods?.name ?? `#${args.entry_id}`,
                quantity: args.quantity,
                unit: args.unit ?? "g",
            };
        }
        case "delete_log_entry": {
            const row = getEntryById(Number(args.entry_id));
            return { food: row?.foods?.name ?? `#${args.entry_id}` };
        }
        case "create_meal_plan": {
            return { count: Number(args.days) || 3 };
        }
        case "save_memory": {
            const content = String(args.content ?? "");
            return { content: content.length > 50 ? `${content.slice(0, 50)}…` : content };
        }
        case "create_food_template":
        case "create_recipe_template":
        case "update_recipe_template":
            return { name: String(args.name ?? "") };
        default:
            return {};
    }
}
