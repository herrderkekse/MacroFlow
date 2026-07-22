import type { ExerciseSet, WorkoutExerciseWithSets } from "../services/exerciseDb";

/**
 * A rendered unit on the workout screen: either a single exercise or a superset
 * of exercises whose sets are performed alternately. `members` always has at
 * least one entry; a superset currently holds exactly two.
 */
export interface WorkoutCard {
    key: string;
    isSuperset: boolean;
    members: WorkoutExerciseWithSets[];
}

/** One row of a superset's combined set list. */
export interface SupersetRow {
    /** Index into the card's `members` this set belongs to. */
    memberIndex: number;
    /** The set's position within its own exercise (0-based) — used for its label and prefill. */
    withinIndex: number;
    set: ExerciseSet;
}

/**
 * Groups a flat, sort-ordered exercise list into cards. Exercises sharing a
 * non-null `superset_group` collapse into one card, ordered by first appearance;
 * everything else becomes a standalone card. Robust to group members not being
 * strictly adjacent in the input.
 */
export function groupIntoCards(exercises: WorkoutExerciseWithSets[]): WorkoutCard[] {
    const cards: WorkoutCard[] = [];
    const groupCardIndex = new Map<string, number>();

    for (const ex of exercises) {
        const group = ex.workoutExercise.superset_group;
        if (group != null && groupCardIndex.has(group)) {
            cards[groupCardIndex.get(group)!].members.push(ex);
            continue;
        }
        const card: WorkoutCard = {
            key: group != null ? `ss-${group}` : `ex-${ex.workoutExercise.id}`,
            isSuperset: group != null,
            members: [ex],
        };
        if (group != null) groupCardIndex.set(group, cards.length);
        cards.push(card);
    }

    // A group that ended up with a single member renders as a normal exercise.
    for (const card of cards) {
        if (card.isSuperset && card.members.length < 2) {
            card.isSuperset = false;
            card.key = `ex-${card.members[0].workoutExercise.id}`;
        }
    }

    return cards;
}

/**
 * Orders every member's sets into one list by their `set_order`, which is kept
 * global across the superset. Fresh supersets read as A1, B1, A2, B2, … (equal
 * set_orders tie-break to the earlier member); once the user drags a set the
 * new order persists. Ties break by member then set id for a stable result.
 */
export function orderSupersetRows(members: WorkoutExerciseWithSets[]): SupersetRow[] {
    const rows: SupersetRow[] = [];
    members.forEach((member, memberIndex) => {
        member.sets.forEach((set, withinIndex) => {
            rows.push({ memberIndex, withinIndex, set });
        });
    });
    rows.sort((a, b) =>
        (a.set.set_order - b.set.set_order) || (a.memberIndex - b.memberIndex) || (a.set.id - b.set.id));
    return rows;
}

/**
 * Which member the single "+ Add set" button should append to next: the member
 * with the fewest sets so the exercises stay balanced, ties going to the earlier
 * (base) member. Returns the member index.
 */
export function nextAddTarget(members: WorkoutExerciseWithSets[]): number {
    let target = 0;
    for (let i = 1; i < members.length; i++) {
        if (members[i].sets.length < members[target].sets.length) target = i;
    }
    return target;
}

/** Index of the active (first uncompleted) row in an ordered list, or -1. */
export function activeRowIndex(rows: SupersetRow[]): number {
    return rows.findIndex((r) => !r.set.completed_at);
}
