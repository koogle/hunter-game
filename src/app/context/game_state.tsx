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
    const savedState = localStorage.getItem("state");
    return savedState
      ? JSON.parse(savedState)
      : {
          world: {
            map: [],
            quests: [],
            items: [],
            enemies: [],
          },
          player: {
            stats: {
              health: 10,
              stamina: 5,
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
        };
  });

  useEffect(() => {
    // Save to localStorage whenever state changes
    localStorage.setItem("gameState", JSON.stringify(gameState));
  }, [gameState]);

  return (
    <GameStateContext.Provider value={{ gameState, setGameState }}>
      {children}
    </GameStateContext.Provider>
  );
};
