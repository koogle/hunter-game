"use client";

import { GameStateContext } from "@/app/context/game_state";
import { setupWorld } from "@/app/loading/client_setup";
import { useContext, useEffect, useRef, useState } from "react";

export function LoadingScreen() {
  const ctx = useContext(GameStateContext);

  const [loadingMessage, setLoadingMessage] = useState(
    "Preparing your adventure"
  );
  const [activeDot, setActiveDot] = useState(0);
  const totalDots = 5;
  const isCreatingWorld = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveDot((prevDot) => (prevDot + 1) % totalDots);
    }, 300);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function setupGame(cancel: AbortController) {
      if (ctx == null || isCreatingWorld.current) {
        return;
      }
      isCreatingWorld.current = true;

      try {
        await setupWorld(
          ctx.gameState,
          ctx.setGameState,
          cancel,
          setLoadingMessage
        );
      } catch (e) {
        console.error(e);
        ctx?.setGameState({
          ...ctx.gameState,
          state: "error",
        });
      }
    }
    const cancel = new AbortController();
    setupGame(cancel);

    return () => {
      cancel.abort();
    };
  }, [ctx]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white text-black font-mono">
      <div className="border border-black p-8 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
        <h1 className="text-4xl font-bold mb-4 text-center">ENDLESS JOURNEY</h1>
        <p className="text-xl mb-8 text-center">{loadingMessage}</p>
        <div
          className="flex justify-center space-x-2"
          aria-live="polite"
          aria-label="Loading"
        >
          {[...Array(totalDots)].map((_, index) => (
            <div
              key={index}
              className={`w-3 h-3 border border-black ${
                index === activeDot ? "bg-black" : "bg-white"
              }`}
              aria-hidden="true"
            ></div>
          ))}
        </div>
      </div>
    </div>
  );
}
