import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setTestMode, isTestModeEnabled } from "@/debug/testModeStore";

type TestModeContextValue = {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  toggle: () => void;
};

const STORAGE_KEY = "ipes6_test_mode";

const TestModeContext = createContext<TestModeContextValue | null>(null);

export function TestModeProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [enabled, setEnabledState] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === null) return isTestModeEnabled();
      return stored === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
    } catch {
      // noop
    }
    setTestMode(enabled);
  }, [enabled]);

  const update = useCallback(
    (value: boolean) => {
      setEnabledState(value);
      queryClient.invalidateQueries();
    },
    [queryClient]
  );

  const toggle = useCallback(() => update(!enabled), [enabled, update]);

  const value = useMemo<TestModeContextValue>(
    () => ({
      enabled,
      setEnabled: update,
      toggle,
    }),
    [enabled, update, toggle]
  );

  return <TestModeContext.Provider value={value}>{children}</TestModeContext.Provider>;
}

export const useTestMode = () => {
  const ctx = useContext(TestModeContext);
  if (!ctx) {
    throw new Error("useTestMode must be used within a TestModeProvider");
  }
  return ctx;
};
