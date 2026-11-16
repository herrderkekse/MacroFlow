import Stepper from "@/src/shared/components/Stepper";
import React, { useState } from "react";
import { REST_MAX_SECONDS, REST_MIN_SECONDS } from "../hooks/useRestTimer";

const STEP = 15;
const MAX_DIGITS = 4;

interface RestDurationStepperProps {
    seconds: number;
    onChange: (seconds: number) => void;
}

function formatClock(seconds: number): string {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Typed digits fill the clock from the right, like a kitchen timer:
 * "1" → 0:01, "13" → 0:13, "130" → 1:30. The stepper's own "m:ss" text
 * comes back through here too and keeps its value.
 */
function toClockText(text: string): string | null {
    const digits = text.replace(/\D/g, "").replace(/^0+/, "");
    if (digits.length > MAX_DIGITS) return null;
    if (digits === "") return "";
    const padded = digits.padStart(3, "0");
    return `${Number(padded.slice(0, -2))}:${padded.slice(-2)}`;
}

/** The seconds an "m:ss" text stands for, or null when it is not a rest the timer accepts. */
function parseClock(text: string): number | null {
    const match = /^(\d+):([0-5]\d)$/.exec(text);
    if (!match) return null;
    const seconds = Number(match[1]) * 60 + Number(match[2]);
    return seconds >= REST_MIN_SECONDS && seconds <= REST_MAX_SECONDS ? seconds : null;
}

/** The rest duration as "m:ss" with ±15 s steps; only valid times reach `onChange`. */
export default function RestDurationStepper({ seconds, onChange }: RestDurationStepperProps) {
    const [text, setText] = useState(() => formatClock(seconds));
    const [syncedSeconds, setSyncedSeconds] = useState(seconds);

    // A preset tap changes the duration from outside the field.
    if (seconds !== syncedSeconds) {
        setSyncedSeconds(seconds);
        if (parseClock(text) !== seconds) setText(formatClock(seconds));
    }

    const handleChange = (value: string) => {
        const next = toClockText(value);
        if (next === null) return;
        setText(next);
        const parsed = parseClock(next);
        if (parsed !== null && parsed !== seconds) onChange(parsed);
    };

    const valid = parseClock(text) !== null;

    return (
        <Stepper
            value={text}
            onChangeText={handleChange}
            step={STEP}
            min={REST_MIN_SECONDS}
            max={REST_MAX_SECONDS}
            parse={(value) => parseClock(value) ?? seconds}
            format={formatClock}
            keyboardType="number-pad"
            invalid={!valid}
            // An unfinished or out-of-range entry falls back to the last valid duration.
            onBlur={() => { if (!valid) setText(formatClock(seconds)); }}
        />
    );
}
