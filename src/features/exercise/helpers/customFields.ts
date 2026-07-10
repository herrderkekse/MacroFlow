// Custom set-tracking fields for "other" type exercises (issue #362).
// A template defines an ordered list of CustomField; each set stores a
// { [fieldId]: number } map of values. Both are persisted as JSON text.

export interface CustomField {
    id: string;
    name: string;
    /** Optional unit label shown in the column header, e.g. "s", "cm". */
    unit: string;
    /** Progression direction — true if a higher value is an improvement. */
    higherIsBetter: boolean;
}

export type CustomValues = Record<string, number | null>;

/** Generate a stable-enough id for a new custom field. */
export function newCustomFieldId(): string {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function parseCustomFields(json: string | null | undefined): CustomField[] {
    if (!json) return [];
    try {
        const parsed = JSON.parse(json);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
            .map((f) => ({
                id: typeof f.id === "string" ? f.id : newCustomFieldId(),
                name: typeof f.name === "string" ? f.name : "",
                unit: typeof f.unit === "string" ? f.unit : "",
                higherIsBetter: f.higherIsBetter !== false,
            }));
    } catch {
        return [];
    }
}

/** Serialize fields for storage; drops unnamed fields. Returns null when empty. */
export function serializeCustomFields(fields: CustomField[]): string | null {
    const cleaned = fields
        .map((f) => ({ ...f, name: f.name.trim(), unit: f.unit.trim() }))
        .filter((f) => f.name.length > 0);
    return cleaned.length > 0 ? JSON.stringify(cleaned) : null;
}

export function parseCustomValues(json: string | null | undefined): CustomValues {
    if (!json) return {};
    try {
        const parsed = JSON.parse(json);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
        const result: CustomValues = {};
        for (const [key, value] of Object.entries(parsed)) {
            result[key] = typeof value === "number" ? value : null;
        }
        return result;
    } catch {
        return {};
    }
}

/** Serialize values for storage, keeping only numeric entries. Null when empty. */
export function serializeCustomValues(values: CustomValues): string | null {
    const entries = Object.entries(values).filter(([, v]) => typeof v === "number");
    return entries.length > 0 ? JSON.stringify(Object.fromEntries(entries)) : null;
}

/** Whether an "other" exercise should render its custom-field columns. */
export function hasCustomFields(fields: CustomField[]): boolean {
    return fields.length > 0;
}
