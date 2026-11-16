import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { playTimerChimeIfEnabled } from "../restTimerSound";

type StatusListener = (status: { didJustFinish: boolean }) => void;

interface FakePlayer {
    play: jest.Mock;
    remove: jest.Mock;
    listener: StatusListener | null;
}

const players: FakePlayer[] = [];

jest.mock("expo-audio", () => ({
    setAudioModeAsync: jest.fn(async () => { }),
    createAudioPlayer: jest.fn(() => {
        const p: FakePlayer = { play: jest.fn(), remove: jest.fn(), listener: null };
        players.push(p);
        return {
            play: p.play,
            remove: p.remove,
            addListener: (_event: string, cb: StatusListener) => { p.listener = cb; },
        };
    }),
}));

jest.mock("@/assets/sounds/rest_timer_done.wav", () => 1, { virtual: true });
jest.mock("@/src/utils/logger", () => ({ __esModule: true, default: { warn: jest.fn() } }));
jest.mock("../restTimerNotifications", () => ({ shouldPlayTimerSound: jest.fn(async () => true) }));

describe("playTimerChimeIfEnabled", () => {
    beforeEach(() => {
        players.length = 0;
        jest.useFakeTimers();
    });

    it("releases the player (and its media session) once the chime finishes", async () => {
        await playTimerChimeIfEnabled();
        expect(players).toHaveLength(1);
        expect(players[0].play).toHaveBeenCalled();
        expect(players[0].remove).not.toHaveBeenCalled();

        players[0].listener?.({ didJustFinish: true });
        expect(players[0].remove).toHaveBeenCalledTimes(1);

        jest.runAllTimers();
        expect(players[0].remove).toHaveBeenCalledTimes(1);
    });

    it("releases the player after a fallback delay if it never reports finishing", async () => {
        await playTimerChimeIfEnabled();
        jest.advanceTimersByTime(5000);
        expect(players[0].remove).toHaveBeenCalledTimes(1);
    });

    it("uses a fresh player per chime and frees the previous one", async () => {
        await playTimerChimeIfEnabled();
        await playTimerChimeIfEnabled();
        expect(players).toHaveLength(2);
        expect(players[0].remove).toHaveBeenCalledTimes(1);
        expect(players[1].remove).not.toHaveBeenCalled();

        // A late "finished" from the old player must not free the new one.
        players[0].listener?.({ didJustFinish: true });
        expect(players[1].remove).not.toHaveBeenCalled();
    });
});
