// Placeholder screen for the center (+) FAB tab slot.
// This screen is never shown directly — the tab button is replaced
// by a custom CenterFabButton that navigates to /study/add-vocab.
import { useEffect } from "react";
import { useRouter } from "expo-router";

export default function AddScreen() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/study/add-vocab" as any);
  }, []);
  return null;
}
