"use client";

import { GameStateContext } from "@/app/context/game_state";
import { Button } from "@/components/ui/button";
import { useContext } from "react";

interface ErrorScreenProps {
  message: string;
  onRetry?: () => void;
  onMainMenu?: () => void;
}

export function ErrorScreen({
  message,
  onRetry,
  onMainMenu,
}: ErrorScreenProps) {
  const ctx = useContext(GameStateContext);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white text-black font-mono p-4">
      <div className="border border-black p-8 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] max-w-md w-full">
        <h1 className="text-4xl font-bold mb-4 text-center">ERROR</h1>
        <p className="text-xl mb-8 text-center break-words">{message}</p>
        <div className="flex flex-col space-y-4">
          {onRetry && (
            <Button
              onClick={onRetry}
              className="w-full bg-white text-black border border-black hover:bg-gray-100 rounded-none"
            >
              Retry
            </Button>
          )}

          {!onMainMenu && (
            <Button
              onClick={() => ctx?.clearGameState()}
              className="w-full bg-black text-white hover:bg-gray-800 rounded-none"
            >
              Clear state
            </Button>
          )}
          {!onMainMenu && (
            <Button
              onClick={onMainMenu}
              className="w-full bg-black text-white hover:bg-gray-800 rounded-none"
            >
              Return to Main Menu
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
