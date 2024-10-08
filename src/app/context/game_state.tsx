"use client";

import { GameState } from "@/lib/state";
import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";

export const GameStateContext = createContext<
  | {
      gameState: GameState;
      setGameState: React.Dispatch<React.SetStateAction<GameState>>;
      clearGameState: () => void;
    }
  | undefined
>(undefined);

const LOCAL_STORAGE_KEY = "HUNTER_GAME_STATE";

export const GameStateProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isReady, setIsReady] = useState(false);
  const defaultState: GameState = useMemo(
    () => ({
      world: {
        map: [],
        quests: [],
        items: [],
        enemies: [],
        biomes: [],
      },
      player: {
        stats: {
          health: 10,
          magic: 5,
          strength: 5,
          dexterity: 5,
          intelligence: 5,
          level: 1,
          luck: 5,
          gold: 0,
          xp: 0,
        },
        name: "",
        questProgress: {},
        location: { x: 0, y: 0 },
        inventory: [],
      },
      state: "login",
    }),
    []
  );

  const [gameState, setGameState] = useState<GameState>(() => {
    // Only access localStorage on the client side

    return defaultState;
  });

  // Doing this with use effect to avoid hydration errors
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedState = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedState != null) {
        setGameState(JSON.parse(savedState));
      }
    }
    setIsReady(true);
  }, []);

  useEffect(() => {
    // Save to localStorage whenever state changes (client-side only)
    if (typeof window !== "undefined" && isReady) {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gameState));
    }
  }, [gameState, isReady]);

  const clearGameState = useCallback(() => {
    setGameState({ ...defaultState });
  }, [defaultState]);

  return (
    <GameStateContext.Provider
      value={{ gameState, setGameState, clearGameState }}
    >
      {children}
    </GameStateContext.Provider>
  );
};
