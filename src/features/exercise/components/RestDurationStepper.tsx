import Stepper from "@/src/shared/components/Stepper";
import React, { useState } from "react";
import { digitsToClockText } from "../helpers/durationFormat";
import { REST_MAX_SECONDS, REST_MIN_SECONDS } from "../hooks/useRestTimer";

const STEP = 15;
const MAX_DIGITS = 4;

interface RestDurationStepperProps {
    seconds: number;
    onChange: (seconds: number) => void;
    /** The accepted range; the rest timer's by default. */
    min?: number;
    max?: number;
}

function formatClock(seconds: number): string {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** The seconds an "m:ss" text stands for, or null when it is not a duration in range. */
function parseClock(text: string, min: number, max: number): number | null {
    const match = /^(\d+):([0-5]\d)$/.exec(text);
    if (!match) return null;
    const seconds = Number(match[1]) * 60 + Number(match[2]);
    return seconds >= min && seconds <= max ? seconds : null;
}

/** A duration as "m:ss" with ±15 s steps; only valid times reach `onChange`. */
export default function RestDurationStepper({
    seconds, onChange, min = REST_MIN_SECONDS, max = REST_MAX_SECONDS,
}: RestDurationStepperProps) {
    const [text, setText] = useState(() => formatClock(seconds));
    const [syncedSeconds, setSyncedSeconds] = useState(seconds);

    // A preset tap changes the duration from outside the field.
    if (seconds !== syncedSeconds) {
        setSyncedSeconds(seconds);
        if (parseClock(text, min, max) !== seconds) setText(formatClock(seconds));
    }

    const handleChange = (value: string) => {
        // Typed digits fill the clock from the right: "130" → 1:30.
        const next = digitsToClockText(value, MAX_DIGITS);
        if (next === null) return;
        setText(next);
        const parsed = parseClock(next, min, max);
        if (parsed !== null && parsed !== seconds) onChange(parsed);
    };

    const valid = parseClock(text, min, max) !== null;

    return (
        <Stepper
            value={text}
            onChangeText={handleChange}
            step={STEP}
            min={min}
            max={max}
            parse={(value) => parseClock(value, min, max) ?? seconds}
            format={formatClock}
            keyboardType="number-pad"
            invalid={!valid}
            // An unfinished or out-of-range entry falls back to the last valid duration.
            onBlur={() => { if (!valid) setText(formatClock(seconds)); }}
        />
    );
}
