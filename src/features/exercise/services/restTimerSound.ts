import logger from "@/src/utils/logger";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { shouldPlayTimerSound } from "./restTimerNotifications";

// Longer than the chime itself; frees the player even if "finished" never arrives.
const RELEASE_FALLBACK_MS = 5000;

let audioModeSet = false;
let player: AudioPlayer | null = null;
let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * On Android every expo-audio player owns a media session, and the headphone
 * play/pause button goes to whichever session played last. A player that
 * outlives the chime would keep the button, so pressing it to resume your music
 * replays the chime (issue #423). Removing the player releases its session.
 */
function releasePlayer() {
    if (fallbackTimer) clearTimeout(fallbackTimer);
    fallbackTimer = null;
    const current = player;
    player = null;
    try {
        current?.remove();
    } catch (e) {
        logger.warn("[RestTimer] Failed to release chime player", e instanceof Error ? e.message : e);
    }
}

/**
 * Play the timer-finished chime if the exercise timer sound setting allows it
 * right now. Music from other apps is ducked, not paused. A fresh player is
 * created per chime and released once it finishes.
 */
export async function playTimerChimeIfEnabled() {
    try {
        if (!(await shouldPlayTimerSound())) return;
        if (!audioModeSet) {
            await setAudioModeAsync({
                playsInSilentMode: true,
                interruptionMode: "duckOthers",
                interruptionModeAndroid: "duckOthers",
            });
            audioModeSet = true;
        }
        releasePlayer();
        const chime = createAudioPlayer(require("@/assets/sounds/rest_timer_done.wav"));
        player = chime;
        chime.addListener("playbackStatusUpdate", (status) => {
            if (status.didJustFinish && player === chime) releasePlayer();
        });
        fallbackTimer = setTimeout(() => {
            if (player === chime) releasePlayer();
        }, RELEASE_FALLBACK_MS);
        chime.play();
    } catch (e) {
        logger.warn("[RestTimer] Failed to play chime", e instanceof Error ? e.message : e);
        releasePlayer();
    }
}
