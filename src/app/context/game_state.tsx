"use client";

import { GameState } from "@/lib/state";
import React, { createContext, useState, useEffect } from "react";

export const GameStateContext = createContext<
  | {
      gameState: GameState;
      setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    }
  | undefined
>(undefined);

export const GameStateProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [gameState, setGameState] = useState<GameState>(() => {
    // Default state
    const defaultState: GameState = {
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
        },
        name: "",
        questProgress: {},
        location: { x: 0, y: 0 },
        inventory: [],
      },
      state: "login",
    };

    // Only access localStorage on the client side
    if (typeof window !== "undefined") {
      const savedState = window.localStorage.getItem("state");
      return savedState ? JSON.parse(savedState) : defaultState;
    }

    return defaultState;
  });

  useEffect(() => {
    console.log("updating save state", window.localStorage);

    // Save to localStorage whenever state changes (client-side only)
    if (typeof window !== "undefined") {
      window.localStorage.setItem("gameState", JSON.stringify(gameState));
    }
  }, [gameState]);

  return (
    <GameStateContext.Provider value={{ gameState, setGameState }}>
      {children}
    </GameStateContext.Provider>
  );
};
