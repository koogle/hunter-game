"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Award } from "lucide-react";

interface YouHaveWonProps {
  onPlayAgain: () => void;
  onMainMenu: () => void;
  score?: number;
}

export function YouHaveWonComponent({
  onPlayAgain,
  onMainMenu,
  score,
}: YouHaveWonProps) {
  const [showOptions, setShowOptions] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowOptions(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white text-black font-mono p-4">
      <div className="text-center mb-8">
        <Award className="w-16 h-16 mb-4 mx-auto" />
        <h1 className="text-5xl font-bold">YOU HAVE WON</h1>
      </div>

      {showOptions && (
        <div className="space-y-4 animate-fade-in text-center">
          <p className="text-xl mb-6">
            Congratulations on completing your Endless Journey!
          </p>
          {score !== undefined && (
            <p className="text-2xl font-bold mb-6">Final Score: {score}</p>
          )}
          <div className="flex flex-col items-center space-y-4">
            <Button
              onClick={onPlayAgain}
              className="w-full max-w-xs bg-black text-white border border-black hover:bg-gray-800 rounded-none"
            >
              Play Again
            </Button>
            <Button
              onClick={onMainMenu}
              className="w-full max-w-xs bg-white text-black border border-black hover:bg-gray-200 rounded-none"
            >
              Return to Main Menu
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
