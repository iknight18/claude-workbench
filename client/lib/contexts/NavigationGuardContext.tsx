'use client';

import { createContext, useContext, useRef, useCallback } from 'react';

type GuardFn = () => boolean;

interface NavigationGuardContextValue {
  /** Register a guard. Returns unregister function. */
  setGuard: (guard: GuardFn) => () => void;
  /** Returns true if navigation should be blocked. */
  shouldBlock: () => boolean;
}

const NavigationGuardContext = createContext<NavigationGuardContextValue>({
  setGuard: () => () => {},
  shouldBlock: () => false,
});

export function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  const guardRef = useRef<GuardFn | null>(null);

  const setGuard = useCallback((guard: GuardFn) => {
    guardRef.current = guard;
    return () => {
      guardRef.current = null;
    };
  }, []);

  const shouldBlock = useCallback(() => {
    return guardRef.current ? guardRef.current() : false;
  }, []);

  return (
    <NavigationGuardContext.Provider value={{ setGuard, shouldBlock }}>
      {children}
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard() {
  return useContext(NavigationGuardContext);
}
