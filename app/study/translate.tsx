import React from "react";
import { Stack } from "expo-router";
import ReadingTranslateWorkspace from "../../components/ReadingTranslateWorkspace";

export default function TranslateScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ReadingTranslateWorkspace showBackButton />
    </>
  );
}
