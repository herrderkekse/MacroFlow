import logger from "@/src/utils/logger";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { shouldPlayTimerSound } from "./restTimerNotifications";

let player: AudioPlayer | null = null;

/**
 * Play the timer-finished chime if the exercise timer sound setting allows it
 * right now. Music from other apps is ducked, not paused.
 */
export async function playTimerChimeIfEnabled() {
    try {
        if (!(await shouldPlayTimerSound())) return;
        if (!player) {
            await setAudioModeAsync({
                playsInSilentMode: true,
                interruptionMode: "duckOthers",
                interruptionModeAndroid: "duckOthers",
            });
            player = createAudioPlayer(require("@/assets/sounds/rest_timer_done.wav"));
        }
        await player.seekTo(0);
        player.play();
    } catch (e) {
        logger.warn("[RestTimer] Failed to play chime", e instanceof Error ? e.message : e);
    }
}
