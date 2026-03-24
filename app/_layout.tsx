import { Stack } from "expo-router";
import { initDB } from "../src/db";
import { ThemeProvider, useThemeColors } from "../src/utils/ThemeProvider";

initDB();

function InnerLayout() {
  const colors = useThemeColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        navigationBarColor: colors.background,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <InnerLayout />
    </ThemeProvider>
  );
}
