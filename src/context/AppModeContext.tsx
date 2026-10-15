import { createContext, ReactNode, useContext, useState } from 'react';

export type AppMode = 'scada' | 'de';

interface AppModeContextType {
  mode: AppMode | null;
  chooseMode: (m: AppMode, remember: boolean) => void;
  switchMode: () => void;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);
const KEY = 'gridx-mode';

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AppMode | null>(() => {
    try {
      const v = localStorage.getItem(KEY);
      return v === 'scada' || v === 'de' ? v : null;
    } catch {
      return null;
    }
  });

  const chooseMode = (m: AppMode, remember: boolean) => {
    try {
      if (remember) localStorage.setItem(KEY, m);
      else localStorage.removeItem(KEY);
    } catch { /* ignore */ }
    setMode(m);
  };

  // Going back to the chooser also forgets a remembered choice.
  const switchMode = () => {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    setMode(null);
  };

  return (
    <AppModeContext.Provider value={{ mode, chooseMode, switchMode }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  const ctx = useContext(AppModeContext);
  if (!ctx) throw new Error('useAppMode must be used within an AppModeProvider');
  return ctx;
}
