import { useState } from "react";
import { GameSummary } from "@/types/game";

type StartScreenProps = {
  onStart: () => void;
  onLoad: () => void;
};

export default function StartScreen({ onStart, onLoad }: StartScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-8 -mt-16">
      <h1 className="text-5xl font-bold text-white border-b-2 border-white pb-4 text-center">
        Hunter Game
      </h1>
      <p className="text-white text-xl text-center max-w-md mb-8">
        Enter a world where imagination meets artificial intelligence. Your
        journey awaits.
      </p>
      <div className="flex gap-4">
        <button
          onClick={onStart}
          className="px-8 py-4 bg-black text-white border-2 border-white hover:bg-white hover:text-black transition-colors duration-200 text-xl"
        >
          NEW JOURNEY
        </button>
        <button
          onClick={onLoad}
          className="px-8 py-4 bg-black text-white border-2 border-white hover:bg-white hover:text-black transition-colors duration-200 text-xl"
        >
          LOAD JOURNEY
        </button>
      </div>
    </div>
  );
} 