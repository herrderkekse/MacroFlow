// The `serving_units.kind` marker and the one rule that reads it: which serving
// unit an amount form opens with selected. Logging an entry and adding a recipe
// ingredient ask the same question, so the answer lives here — an app-wide
// service both features may import — rather than once in each feature's hook.

/**
 * Which of OpenFoodFacts' two quantities a derived serving unit came from,
 * stored in `serving_units.kind` at import time.
 *
 * Deliberately not the row's *name*: names are translated once, at import
 * (`i18n.t("common.offServingUnitServing")`), and then frozen in the DB, so a
 * food imported in German carries "Portion" and matching an English string
 * would silently never fire. Also not the `grams === food.serving_size`
 * heuristic, which holds for OFF imports by construction but misfires on a
 * hand-added row of the same size.
 */
export type ServingUnitKind = "serving" | "package";

/** One serving of the product, from OFF's `serving_quantity`. */
export const SERVING_UNIT_KIND_SERVING: ServingUnitKind = "serving";

/** The whole package, from OFF's `product_quantity`. */
export const SERVING_UNIT_KIND_PACKAGE: ServingUnitKind = "package";

/**
 * Whether a value that came back from the DB or off a share payload names a
 * kind we know. Null — every hand-added row, and every row written before the
 * column existed — is not one.
 */
export function isServingUnitKind(value: unknown): value is ServingUnitKind {
    return value === SERVING_UNIT_KIND_SERVING || value === SERVING_UNIT_KIND_PACKAGE;
}

/** The part of a `serving_units` row the rule below reads. */
interface KindedServingUnit {
    name: string;
    grams: number;
    kind?: string | null;
}

/** The part of a `foods` row the rule below reads. */
interface PreviouslyLoggedFood {
    last_logged_amount?: number | null;
    last_logged_unit?: string | null;
}

/**
 * True once the food has been logged, i.e. once the user has made a choice of
 * unit and amount that is worth restoring over any guess of ours.
 */
function hasLoggingHistory(food: PreviouslyLoggedFood): boolean {
    return food.last_logged_amount != null && food.last_logged_unit != null;
}

/**
 * The serving unit an amount form should open with selected — always at amount
 * `1`, which is the number a user thinks in — or undefined to keep the existing
 * default of `default_unit` + `serving_size`.
 *
 * The rule, narrowly:
 *
 * - A food with logging history gets nothing: `last_logged_unit` wins, as it
 *   already did. This only ever changes the first-time case.
 * - Only the OFF *serving* row is offered. The package row never is —
 *   pre-selecting it would default a 1 kg bag of rice to logging the whole bag.
 * - A row with no `kind` is not the OFF serving row, so a hand-added serving
 *   unit does not trigger this. That is the honest reading of "the derived
 *   serving unit"; widening it to "the first serving unit" is a separate
 *   decision (see #414).
 * - A food with no derived serving row therefore keeps today's behaviour
 *   exactly.
 */
export function servingUnitToPreselect<T extends KindedServingUnit>(
    food: PreviouslyLoggedFood,
    units: T[],
): T | undefined {
    if (hasLoggingHistory(food)) return undefined;
    return units.find((unit) => unit.kind === SERVING_UNIT_KIND_SERVING);
}
