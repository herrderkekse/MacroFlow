import { Stack } from "expo-router";
import { initDB } from "../src/db";

initDB();

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
