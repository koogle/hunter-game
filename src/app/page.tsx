"use client";

import { SetupPage } from "@/components/SetupPage";
import { WorldCreation } from "@/components/WorldCreation";
import { useGameStore } from "@/lib/store";

export default function Home() {
  const { currentStage, playerName, scenarioDescription } = useGameStore();

  const isSetupComplete =
    playerName.trim() !== "" && scenarioDescription.trim() !== "";

  if (!isSetupComplete) {
    return <SetupPage />;
  }

  switch (currentStage) {
    case "world-creation":
      return <WorldCreation />;
    case "playing":
      return (
        <div className="min-h-screen p-4">
          <h1 className="text-2xl mb-4">Welcome back, {playerName}!</h1>
          {/* Game interface will go here */}
          <p>Game interface coming soon...</p>
        </div>
      );
    default:
      return <SetupPage />;
  }
}
