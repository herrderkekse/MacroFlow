import { useAppStore } from "@/src/shared/store/useAppStore";
import { darkColors, lightColors, type ThemeColors } from "@/src/utils/theme";
import React, { createContext, useContext, useEffect, useMemo } from "react";
import { Appearance, useColorScheme } from "react-native";

const ThemeContext = createContext<ThemeColors>(lightColors);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const systemScheme = useColorScheme();
    const appearanceMode = useAppStore((s) => s.appearanceMode);

    const colors = useMemo(() => {
        if (appearanceMode === "system") {
            return systemScheme === "dark" ? darkColors : lightColors;
        }
        return appearanceMode === "dark" ? darkColors : lightColors;
    }, [appearanceMode, systemScheme]);

    // Native surfaces (alerts, pickers, the keyboard) take their theme from the
    // platform, so the in-app choice is handed down to it as well. (Not
    // available on web, where only the screen gallery runs.)
    useEffect(() => {
        Appearance.setColorScheme?.(appearanceMode === "system" ? "unspecified" : appearanceMode);
    }, [appearanceMode]);

    return (
        <ThemeContext.Provider value={colors}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useThemeColors(): ThemeColors {
    return useContext(ThemeContext);
}

export function useIsDark(): boolean {
    const systemScheme = useColorScheme();
    const appearanceMode = useAppStore((s) => s.appearanceMode);
    if (appearanceMode === "system") return systemScheme === "dark";
    return appearanceMode === "dark";
}
