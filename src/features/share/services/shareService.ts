// High-level share operations the entry-point screens call: check whether
// sharing is possible (a sync account doubles as the share credential), turn
// a local food/recipe/log selection into an uploaded share URL, and fetch a
// shared payload back when importing.

import { loadSyncSettings } from "@/src/features/settings/services/syncSettings";
import { type EntryWithFood } from "@/src/features/log/services/logDb";
import { getFoodById } from "@/src/features/templates/services/templateDb";
import { createShare, fetchShare, type FetchedShare } from "./shareClient";
import {
    buildFoodPayload,
    buildLogSelectionPayload,
    buildRecipePayload,
} from "./sharePayloads";

/** Sharing rides on the sync account; without one there is nowhere to POST. */
export async function isShareConfigured(): Promise<boolean> {
    return (await loadSyncSettings()) !== null;
}

export async function shareFood(foodId: number): Promise<string> {
    const creds = await requireCreds();
    const food = getFoodById(foodId);
    if (!food) throw new Error("Food not found.");
    const { url } = await createShare(creds, "food", buildFoodPayload(food));
    return url;
}

export async function shareRecipe(recipeId: number): Promise<string> {
    const creds = await requireCreds();
    const payload = buildRecipePayload(recipeId);
    if (!payload) throw new Error("Recipe not found.");
    const { url } = await createShare(creds, "recipe", payload);
    return url;
}

export async function shareLogSelection(
    allRows: EntryWithFood[],
    selectedIds: Set<number>,
): Promise<string> {
    const creds = await requireCreds();
    const payload = buildLogSelectionPayload(allRows, selectedIds);
    if (payload.items.length === 0) throw new Error("Nothing selected to share.");
    const { url } = await createShare(creds, "log", payload);
    return url;
}

/**
 * Fetches a shared payload for import. `origin` comes from the share link's
 * query parameter and names the server the token lives on; when absent (e.g.
 * a hand-typed link) the user's own sync server is tried instead.
 */
export async function fetchSharedContent(token: string, origin?: string): Promise<FetchedShare> {
    let base = origin?.trim();
    if (base && !/^https?:\/\//i.test(base)) base = undefined;
    if (!base) base = (await loadSyncSettings())?.url;
    if (!base) {
        throw new Error(
            "This link does not say which server it lives on, and no sync account is configured.",
        );
    }
    return fetchShare(base, token);
}

async function requireCreds() {
    const creds = await loadSyncSettings();
    if (!creds) throw new Error("Sharing needs a sync account. Sign in first.");
    return creds;
}
