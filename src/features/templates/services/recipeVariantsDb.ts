import { db } from "@/src/services/db";
import { recipeItems, recipes } from "@/src/services/db/schema";
import { eq } from "drizzle-orm";
import { getAllRecipes, getRecipeById, type Recipe } from "./templateDb";

export interface RecipeGroup {
    recipe: Recipe;
    variants: Recipe[];
}

// A variant's `name` is only the specification (e.g. "with sprinkles");
// the full display name is resolved against the base recipe.
export interface RecipeDisplayName {
    name: string;
    variant: string | null;
}

export function getRecipeDisplayName(recipe: Recipe): RecipeDisplayName {
    if (recipe.parent_recipe_id == null) return { name: recipe.name, variant: null };
    const base = getRecipeById(recipe.parent_recipe_id);
    if (!base) return { name: recipe.name, variant: null };
    return { name: base.name, variant: recipe.name };
}

/** One-line form, e.g. "Cupcakes · with sprinkles", for flat lists. */
export function formatRecipeName(recipe: Recipe): string {
    const display = getRecipeDisplayName(recipe);
    return display.variant ? `${display.name} · ${display.variant}` : display.name;
}

/**
 * Non-deleted recipes grouped into base recipes with their variants.
 * A group matches `query` if the base or any of its variants matches,
 * so searching for a variant still surfaces the (collapsed) base.
 */
export function getRecipeGroups(query?: string): RecipeGroup[] {
    const all = getAllRecipes();
    const ids = new Set(all.map((r) => r.id));
    const byParent = new Map<number, Recipe[]>();
    const topLevel: Recipe[] = [];
    for (const r of all) {
        // A variant whose base was deleted is shown as a top-level recipe.
        if (r.parent_recipe_id != null && ids.has(r.parent_recipe_id)) {
            const siblings = byParent.get(r.parent_recipe_id);
            if (siblings) siblings.push(r);
            else byParent.set(r.parent_recipe_id, [r]);
        } else {
            topLevel.push(r);
        }
    }
    const groups = topLevel.map((r) => ({ recipe: r, variants: byParent.get(r.id) ?? [] }));
    const q = query?.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
        (g) =>
            g.recipe.name.toLowerCase().includes(q) ||
            g.variants.some((v) => v.name.toLowerCase().includes(q)),
    );
}

function copyRecipe(source: Recipe, name: string, parentId: number | null): Recipe {
    const created = db.insert(recipes).values({ name, parent_recipe_id: parentId }).returning().get();
    const items = db.select().from(recipeItems).where(eq(recipeItems.recipe_id, source.id)).all();
    for (const item of items) {
        db.insert(recipeItems).values({
            recipe_id: created.id,
            food_id: item.food_id,
            quantity_grams: item.quantity_grams,
            quantity_unit: item.quantity_unit,
        }).run();
    }
    return created;
}

/**
 * Fork a recipe into a new variant (a copy of the recipe and its items).
 *
 * - Forking a variant adds a sibling variant under the same base.
 * - Forking a base or standalone recipe adds a new variant under it — the
 *   recipe being forked always stays put and becomes/remains the base, so
 *   nothing gets duplicated except the new variant itself.
 */
export function forkRecipe(recipeId: number, variantName: string): Recipe {
    const original = getRecipeById(recipeId);
    if (!original) throw new Error(`Recipe ${recipeId} not found`);

    const baseId = original.parent_recipe_id ?? original.id;
    return copyRecipe(original, variantName, baseId);
}
