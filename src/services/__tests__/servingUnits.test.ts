// #414: which serving unit an amount form opens pre-selected. Pure logic over
// rows that are passed in, so it needs no DB and no mocks.

import { describe, expect, it } from "@jest/globals";
import { isServingUnitKind, servingUnitToPreselect } from "@/src/services/servingUnits";

const neverLogged = { last_logged_amount: null, last_logged_unit: null };

// Named as a German import would be, to make the point that nothing here reads
// the name: names are translated once at import and then frozen in the DB.
const offServing = { name: "Portion", grams: 30, kind: "serving" };
const offPackage = { name: "Packung", grams: 500, kind: "package" };
const handAdded = { name: "handful", grams: 20, kind: null };

describe("servingUnitToPreselect", () => {
    it("picks the OFF serving row for a food that has never been logged", () => {
        expect(servingUnitToPreselect(neverLogged, [offServing, offPackage])).toBe(offServing);
        // Order in the list is not what makes it the serving row.
        expect(servingUnitToPreselect(neverLogged, [offPackage, offServing])).toBe(offServing);
    });

    // Defaulting a 1 kg bag of rice to logging the whole bag would be worse than
    // defaulting it to 100 g.
    it("never picks the package row", () => {
        expect(servingUnitToPreselect(neverLogged, [offPackage])).toBeUndefined();
    });

    // The rule is "the OFF serving row", not "the first serving unit" — a row we
    // did not derive says nothing about what one serving is.
    it("ignores a hand-added row", () => {
        expect(servingUnitToPreselect(neverLogged, [handAdded])).toBeUndefined();
        expect(servingUnitToPreselect(neverLogged, [handAdded, offServing])).toBe(offServing);
    });

    // Every row that predates the kind column reads as hand-added, which is the
    // safe way round: those foods keep behaving exactly as they did.
    it("ignores a row whose kind is absent or unrecognised", () => {
        expect(servingUnitToPreselect(neverLogged, [{ name: "slice", grams: 25 }])).toBeUndefined();
        expect(
            servingUnitToPreselect(neverLogged, [{ name: "slice", grams: 25, kind: "shelf" }]),
        ).toBeUndefined();
    });

    it("keeps out of the way of a food the user has logged before", () => {
        const logged = { last_logged_amount: 250, last_logged_unit: "ml" };
        expect(servingUnitToPreselect(logged, [offServing, offPackage])).toBeUndefined();
        // Both halves of the remembered choice have to be there to count, which
        // is the same condition the entry form has always used.
        expect(
            servingUnitToPreselect({ last_logged_amount: 250, last_logged_unit: null }, [offServing]),
        ).toBe(offServing);
        expect(
            servingUnitToPreselect({ last_logged_amount: null, last_logged_unit: "ml" }, [offServing]),
        ).toBe(offServing);
    });

    it("has nothing to offer a food with no serving units", () => {
        expect(servingUnitToPreselect(neverLogged, [])).toBeUndefined();
    });
});

describe("isServingUnitKind", () => {
    it("accepts only the two markers we write", () => {
        expect(isServingUnitKind("serving")).toBe(true);
        expect(isServingUnitKind("package")).toBe(true);
        expect(isServingUnitKind(null)).toBe(false);
        expect(isServingUnitKind(undefined)).toBe(false);
        expect(isServingUnitKind("Portion")).toBe(false);
        expect(isServingUnitKind(1)).toBe(false);
    });
});
