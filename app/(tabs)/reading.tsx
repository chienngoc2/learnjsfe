import React from "react";
import { Stack } from "expo-router";
import ReadingTranslateWorkspace from "../../components/ReadingTranslateWorkspace";

export default function ReadingScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ReadingTranslateWorkspace />
    </>
  );
}
