// Owns the import screen's queue walk: which slide is showing, the pending
// (uncommitted) decisions, the shared target date, per-slide meal/phase state
// for recipes, and per-food state for the batch slide. The queue is forward-
// only; "Start over" resets everything. Nothing here writes to the DB — the
// screen calls `confirm()`, which delegates to `commitImportPlan`.

import type { FetchedShare } from "@/src/features/share/services/shareClient";
import { formatDateKey } from "@/src/utils/date";
import { useCallback, useMemo, useState } from "react";
import {
    buildImportQueue,
    commitImportPlan,
    logFoodDecision,
    logRecipeDecision,
    needsTemplatePhase,
    saveFoodDecision,
    saveTemplateDecision,
    skipDecision,
    summarizeDecisions,
    type Decision,
    type FoodBatchItem,
    type RecipeSlide,
    type Slide,
} from "@/src/features/share/services/importPlan";
import type { MealType } from "@/src/shared/types";

export type RecipeVersion = "original" | "edited";

interface FoodChoice {
    include: boolean;
    addLog: boolean;
    meal: MealType;
    expanded: boolean;
}

function defaultMeal(slide: Slide | undefined): MealType {
    if (slide?.type === "recipe" && slide.isEntry) return slide.originalMeal as MealType;
    return "snack";
}

export function useImportQueue(share: FetchedShare) {
    const queue = useMemo(() => buildImportQueue(share), [share]);
    const slides = queue.slides;

    const [index, setIndex] = useState(0);
    const [date, setDate] = useState(new Date());
    const [decisions, setDecisions] = useState<Decision[]>([]);
    const [savedSigs, setSavedSigs] = useState<Set<string>>(new Set());

    const [meal, setMeal] = useState<MealType>(() => defaultMeal(slides[0]));
    const [phase, setPhase] = useState<"tpl" | "log">("tpl");
    const [savedVersion, setSavedVersion] = useState<RecipeVersion | null>(null);
    const [logVersion, setLogVersion] = useState<RecipeVersion>("edited");

    const [foodChoices, setFoodChoices] = useState<Record<string, FoodChoice>>(() =>
        initialFoodChoices(slides),
    );

    const current = slides[index];
    const isDone = index >= slides.length;
    const dateLabel = useMemo(
        () => date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
        [date],
    );

    // Move to the next slide, appending decisions and seeding its transient state.
    const advance = useCallback(
        (added: Decision[], savedSig?: string | null) => {
            setDecisions((prev) => [...prev, ...added]);
            if (savedSig) setSavedSigs((prev) => new Set(prev).add(savedSig));
            setIndex((prev) => {
                const next = prev + 1;
                setMeal(defaultMeal(slides[next]));
                setPhase("tpl");
                setSavedVersion(null);
                setLogVersion("edited");
                return next;
            });
        },
        [slides],
    );

    // ── Non-edited recipe slide ──
    const logRecipe = useCallback(() => {
        if (current?.type !== "recipe") return;
        advance([logRecipeDecision(current, false, formatDateKey(date), dateLabel, meal)], current.originalSig);
    }, [current, advance, date, dateLabel, meal]);

    const saveRecipeLibrary = useCallback(() => {
        if (current?.type !== "recipe") return;
        advance([saveTemplateDecision(current, false)], current.originalSig);
    }, [current, advance]);

    const skipRecipe = useCallback(() => {
        if (current?.type !== "recipe") return;
        advance([skipDecision(current.id, current.title)]);
    }, [current, advance]);

    // ── Edited recipe slide (two phases) ──
    const editedNeedsTemplate = useMemo(
        () => (current?.type === "recipe" && current.isEdited ? needsTemplatePhase(current, savedSigs) : false),
        [current, savedSigs],
    );
    // Skip the template phase entirely when both versions already exist.
    const editedPhase: "tpl" | "log" = current?.type === "recipe" && current.isEdited && !editedNeedsTemplate ? "log" : phase;

    const saveTemplate = useCallback(
        (version: RecipeVersion) => {
            if (current?.type !== "recipe") return;
            const sig = version === "edited" ? current.editedSig : current.originalSig;
            setDecisions((prev) => [...prev, saveTemplateDecision(current, version === "edited")]);
            if (sig) setSavedSigs((prev) => new Set(prev).add(sig));
            setSavedVersion(version);
            setPhase("log");
        },
        [current],
    );

    const skipEdited = useCallback(() => {
        if (current?.type !== "recipe") return;
        advance([skipDecision(current.id, current.title)]);
    }, [current, advance]);

    // Phase 2: log the chosen version. When the template phase ran, the version
    // is the one that was saved; when skipped (both already imported), the user
    // picks it here.
    const logEditedVersion = useCallback(() => {
        if (current?.type !== "recipe") return;
        const version = savedVersion ?? logVersion;
        advance([logRecipeDecision(current, version === "edited", formatDateKey(date), dateLabel, meal)]);
    }, [current, advance, savedVersion, logVersion, date, dateLabel, meal]);

    const dontLogEdited = useCallback(() => {
        if (current?.type !== "recipe") return;
        // Template (if any) is already recorded; just move on.
        advance(savedVersion ? [] : [skipDecision(current.id, current.title)]);
    }, [current, advance, savedVersion]);

    // ── Food batch slide ──
    const setFoodChoice = useCallback((id: string, patch: Partial<FoodChoice>) => {
        setFoodChoices((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    }, []);
    const toggleFoodImport = useCallback(
        (id: string) => setFoodChoices((prev) => {
            const cur = prev[id];
            return { ...prev, [id]: { ...cur, include: !cur.include, expanded: cur.include ? false : cur.expanded } };
        }),
        [],
    );
    const toggleFoodExpand = useCallback(
        (id: string) => setFoodChoices((prev) => {
            const cur = prev[id];
            if (!cur.include) return prev;
            const open = !cur.expanded;
            const next: Record<string, FoodChoice> = {};
            for (const k of Object.keys(prev)) next[k] = { ...prev[k], expanded: k === id ? open : false };
            return next;
        }),
        [],
    );

    const finishFoods = useCallback(() => {
        if (current?.type !== "foods") return;
        const added: Decision[] = current.foods.map((food) => {
            const choice = foodChoices[food.id];
            if (!choice?.include) return { ...skipDecision(food.id, food.title), summaryKey: "share.import.outcomeNotImported" };
            if (choice.addLog) return logFoodDecision(food, formatDateKey(date), dateLabel, choice.meal);
            return saveFoodDecision(food);
        });
        advance(added);
    }, [current, foodChoices, date, dateLabel, advance]);

    // ── Summary ──
    const counts = useMemo(() => summarizeDecisions(decisions), [decisions]);
    const confirm = useCallback(() => commitImportPlan(decisions), [decisions]);

    const reset = useCallback(() => {
        setIndex(0);
        setDecisions([]);
        setSavedSigs(new Set());
        setMeal(defaultMeal(slides[0]));
        setPhase("tpl");
        setSavedVersion(null);
        setLogVersion("edited");
        setFoodChoices(initialFoodChoices(slides));
    }, [slides]);

    return {
        queue,
        slides,
        current,
        index,
        total: slides.length,
        isDone,
        date,
        setDate,
        dateLabel,
        meal,
        setMeal,
        // recipe (non-edited)
        logRecipe,
        saveRecipeLibrary,
        skipRecipe,
        // edited recipe
        editedPhase,
        editedNeedsTemplate,
        savedVersion,
        logVersion,
        setLogVersion,
        saveTemplate,
        skipEdited,
        logEditedVersion,
        dontLogEdited,
        // foods
        foodChoices,
        toggleFoodImport,
        toggleFoodExpand,
        setFoodChoice,
        finishFoods,
        // summary
        decisions,
        counts,
        confirm,
        reset,
    };
}

function initialFoodChoices(slides: Slide[]): Record<string, FoodChoice> {
    const foods = slides.find((s): s is Extract<Slide, { type: "foods" }> => s.type === "foods")?.foods ?? [];
    const state: Record<string, FoodChoice> = {};
    for (const food of foods) {
        state[food.id] = {
            include: true,
            addLog: food.fromLog, // logged foods default to logging; bare templates to library-only
            meal: food.meal as MealType,
            expanded: false,
        };
    }
    return state;
}

export type ImportQueueApi = ReturnType<typeof useImportQueue>;
export type { FoodBatchItem, RecipeSlide };
