import PinnedCard from "@/src/shared/components/PinnedCard";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import React from "react";
import { useTranslation } from "react-i18next";
import { formatDuration } from "../helpers/durationFormat";
import { useDurationClock, type DurationClock } from "../hooks/useDurationClock";
import type { StatusPage } from "../hooks/useStatusPage";
import StatusCardPager, { PageIndicator } from "./StatusCardPager";
import { CardAction, ClockDetails, Reading, RestDetails, Track } from "./StatusCardPages";

interface RestState {
    running: boolean;
    elapsedSeconds: number;
    /** The running rest's target, or the one a rest started now would get. */
    targetSeconds: number;
    onStart: () => void;
    onSkip: () => void;
    onChangeDuration: (seconds: number) => void;
}

interface WorkoutStatusCardProps {
    /** False for a finished workout: the card only reports the sets then. */
    isLive: boolean;
    page: StatusPage;
    pages: StatusPage[];
    onPageChange: (page: StatusPage) => void;
    setsDone: number;
    setsTotal: number;
    rest: RestState;
    /** The exercise the timing page is for; null when there is none (no timing page). */
    clockExercise: { id: number; name: string } | null;
    /** Starting the clock starts a set, so it ends the rest. */
    onClockStart: () => void;
}

/**
 * The workout's pinned card. Its pages are swiped through: the sets done,
 * the rest timer, and — for a timed exercise — its stopwatch or timer.
 * Tapping it opens the showing page's settings underneath. Built on
 * `PinnedCard`, like the recipe editor's macro card.
 */
export default function WorkoutStatusCard({
    isLive, page, pages, onPageChange, setsDone, setsTotal, rest, clockExercise, onClockStart,
}: WorkoutStatusCardProps) {
    const { t } = useTranslation();
    // Ticks only while the timing page shows.
    const clock = useDurationClock(clockExercise?.id ?? -1, page === "clock");

    const startClock = () => {
        onClockStart();
        clock.start();
    };

    function renderSummary(key: StatusPage) {
        if (key === "sets") {
            return (
                <Reading icon="checkmark-circle-outline" value={`${setsDone} / ${setsTotal}`} label={t("exercise.restTimer.setsDone")} />
            );
        }
        if (key === "rest") return <RestSummary rest={rest} isLive={isLive} />;
        return <ClockSummary clock={clock} name={clockExercise?.name ?? ""} onStart={startClock} />;
    }

    const summaryFooter = page === "sets"
        ? <Track fill={setsTotal > 0 ? setsDone / setsTotal : 0} />
        : page === "rest"
            ? <RestTrack rest={rest} />
            : <ClockTrack clock={clock} />;

    const details = !isLive ? undefined
        : page === "rest" ? <RestDetails seconds={rest.targetSeconds} onChange={rest.onChangeDuration} />
            // Mode and length are set before the clock starts, and stay put until it is reset.
            : page === "clock" && !clock.isOwn ? <ClockDetails clock={clock} />
                : undefined;

    return (
        <PinnedCard
            summaryHeader={<PageIndicator pages={pages} page={page} />}
            summary={<StatusCardPager pages={pages} page={page} onChange={onPageChange} renderPage={renderSummary} />}
            summaryFooter={summaryFooter}
            details={details}
            detailsLabel={t(page === "clock" ? "exercise.durationClock.settings" : "exercise.restTimer.duration")}
        />
    );

}

function RestTrack({ rest }: { rest: RestState }) {
    const colors = useThemeColors();
    const over = rest.running && rest.elapsedSeconds >= rest.targetSeconds;
    const fill = !rest.running ? 0 : over ? 1 : 1 - rest.elapsedSeconds / rest.targetSeconds;
    return <Track fill={fill} color={over ? colors.warning : undefined} />;
}

/** A timer's bar runs down like the rest's; a stopwatch has no end to fill towards. */
function ClockTrack({ clock }: { clock: DurationClock }) {
    const colors = useThemeColors();
    if (clock.mode !== "timer" || !clock.isOwn) return <Track fill={0} />;
    if (clock.isDone) return <Track fill={1} color={colors.success} />;
    return <Track fill={1 - clock.elapsedSeconds / clock.timerSeconds} />;
}

function RestSummary({ rest, isLive }: { rest: RestState; isLive: boolean }) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    if (!rest.running) {
        return (
            <Reading icon="timer-outline" value={formatDuration(rest.targetSeconds)} label={t("exercise.restTimer.ready")}>
                {isLive && (
                    <CardAction icon="play" text={t("exercise.restTimer.startShort")} label={t("exercise.restTimer.start")} onPress={rest.onStart} />
                )}
            </Reading>
        );
    }
    const over = rest.elapsedSeconds >= rest.targetSeconds;
    return (
        <Reading
            icon="timer-outline"
            value={over ? `+${formatDuration(rest.elapsedSeconds - rest.targetSeconds)}` : formatDuration(rest.targetSeconds - rest.elapsedSeconds)}
            label={t(over ? "exercise.restTimer.over" : "exercise.restTimer.left", { target: formatDuration(rest.targetSeconds) })}
            tint={over ? colors.warning : undefined}
        >
            <CardAction icon="play-skip-forward" label={t("exercise.restTimer.skipRest")} onPress={rest.onSkip} />
        </Reading>
    );
}

function ClockSummary({ clock, name, onStart }: { clock: DurationClock; name: string; onStart: () => void }) {
    const colors = useThemeColors();
    const { t } = useTranslation();
    const isTimer = clock.mode === "timer";
    const value = formatDuration(isTimer ? clock.timerSeconds - clock.elapsedSeconds : clock.elapsedSeconds);
    const status = clock.isDone
        ? t("exercise.durationClock.done")
        : clock.isRunning ? null
            : clock.isOwn ? t("exercise.durationClock.paused")
                : t(isTimer ? "exercise.durationClock.timer" : "exercise.durationClock.stopwatch");

    return (
        <Reading
            icon={isTimer ? "hourglass-outline" : "stopwatch-outline"}
            value={value}
            label={status ? `${name} · ${status}` : name}
            tint={clock.isDone ? colors.success : undefined}
        >
            {clock.isOwn && (
                <CardAction icon="refresh" label={t("exercise.durationClock.reset")} onPress={clock.reset} />
            )}
            {clock.isRunning ? (
                <CardAction icon="pause" label={t("exercise.durationClock.pause")} onPress={clock.pause} />
            ) : clock.isOwn && !clock.isDone ? (
                <CardAction icon="play" label={t("exercise.durationClock.resume")} onPress={onStart} />
            ) : (
                <CardAction icon="play" text={t("exercise.durationClock.start")} label={t("exercise.durationClock.start")} onPress={onStart} />
            )}
        </Reading>
    );
}
