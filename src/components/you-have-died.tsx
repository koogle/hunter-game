"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface YouHaveDiedProps {
  onRestart: () => void;
  onMainMenu: () => void;
}

export function YouHaveDiedComponent({
  onRestart,
  onMainMenu,
}: YouHaveDiedProps) {
  const [showOptions, setShowOptions] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowOptions(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white font-mono p-4">
      <h1 className="text-6xl font-bold mb-8 animate-pulse">YOU HAVE DIED</h1>

      {showOptions && (
        <div className="space-y-4 animate-fade-in">
          <p className="text-xl mb-8 text-center">
            Your journey has come to an end.
          </p>
          <div className="flex flex-col space-y-4">
            <Button
              onClick={onRestart}
              className="w-full bg-white text-black border border-white hover:bg-gray-200 rounded-none"
            >
              Restart Journey
            </Button>
            <Button
              onClick={onMainMenu}
              className="w-full bg-black text-white border border-white hover:bg-gray-800 rounded-none"
            >
              Return to Main Menu
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
