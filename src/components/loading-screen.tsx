"use client";

import { GameStateContext } from "@/app/context/game_state";
import { useContext, useEffect, useState } from "react";

export function LoadingScreenComponent() {
  const ctx = useContext(GameStateContext);
  const [activeDot, setActiveDot] = useState(0);
  const totalDots = 5;

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveDot((prevDot) => (prevDot + 1) % totalDots);
    }, 300);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setTimeout(() => {
      ctx?.setGameState({
        ...ctx.gameState,
        state: "main",
      });
    }, 3000);
  }, [ctx]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white text-black font-mono">
      <div className="border border-black p-8 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
        <h1 className="text-4xl font-bold mb-4 text-center">ENDLESS JOURNEY</h1>
        <p className="text-xl mb-8 text-center">Preparing your adventure</p>
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
