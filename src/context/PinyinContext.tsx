import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface PinyinContextProps {
  hidePinyin: boolean;
  toggleHidePinyin: () => void;
  setHidePinyin: (val: boolean) => void;
}

const PinyinContext = createContext<PinyinContextProps | undefined>(undefined);

const STORAGE_KEY = "@app_hide_pinyin";

export function PinyinProvider({ children }: { children: React.ReactNode }) {
  const [hidePinyin, setHidePinyinState] = useState<boolean>(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((val) => {
        if (val !== null) {
          setHidePinyinState(val === "true");
        }
      })
      .catch(() => {});
  }, []);

  const setHidePinyin = (val: boolean) => {
    setHidePinyinState(val);
    AsyncStorage.setItem(STORAGE_KEY, val ? "true" : "false").catch(() => {});
  };

  const toggleHidePinyin = () => {
    setHidePinyinState((prev) => {
      const next = !prev;
      AsyncStorage.setItem(STORAGE_KEY, next ? "true" : "false").catch(() => {});
      return next;
    });
  };

  return (
    <PinyinContext.Provider value={{ hidePinyin, toggleHidePinyin, setHidePinyin }}>
      {children}
    </PinyinContext.Provider>
  );
}

export function usePinyin() {
  const context = useContext(PinyinContext);
  if (!context) {
    return {
      hidePinyin: false,
      toggleHidePinyin: () => {},
      setHidePinyin: () => {},
    };
  }
  return context;
}
