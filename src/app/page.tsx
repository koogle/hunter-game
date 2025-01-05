"use client";

import { useState, useEffect } from "react";
import {
  GameState,
  ScenarioType,
  loadGameState,
  updateGameState,
} from "@/lib/gameState";
import { DebugModal } from "@/components/DebugModal";

const SCENARIO_DEFAULTS = {
  "medieval-fantasy":
    "A high fantasy world with magic, dragons, and epic quests in a medieval setting.",
  "space-opera":
    "A vast interstellar civilization with advanced technology, alien species, and epic space adventures.",
  custom: "",
} as const;

export default function Home() {
  const [gameState, setGameState] = useState<GameState>({
    playerName: "",
    scenarioType: "medieval-fantasy",
    scenarioDescription: SCENARIO_DEFAULTS["medieval-fantasy"],
  });
  const [isDebugOpen, setIsDebugOpen] = useState(false);

  useEffect(() => {
    const savedState = loadGameState();
    setGameState(savedState);
  }, []);

  const handleStateUpdate = (updates: Partial<GameState>) => {
    const newState = updateGameState(updates);
    setGameState(newState);
  };

  const handleScenarioTypeChange = (type: ScenarioType) => {
    handleStateUpdate({
      scenarioType: type,
      scenarioDescription: SCENARIO_DEFAULTS[type],
    });
  };

  return (
    <>
      <div className="min-h-screen p-4 max-w-2xl mx-auto">
        <main>
          <h1 className="text-2xl mb-4">Interactive RPG System</h1>

          <div className="space-y-4">
            <div>
              <label htmlFor="playerName" className="block mb-2">
                Character Name:
              </label>
              <input
                type="text"
                id="playerName"
                value={gameState.playerName}
                onChange={(e) =>
                  handleStateUpdate({ playerName: e.target.value })
                }
                className="w-full p-2 border rounded"
              />
            </div>

            <div>
              <label htmlFor="scenarioType" className="block mb-2">
                Choose Your Scenario:
              </label>
              <select
                id="scenarioType"
                value={gameState.scenarioType}
                onChange={(e) =>
                  handleScenarioTypeChange(e.target.value as ScenarioType)
                }
                className="w-full p-2 border rounded"
              >
                <option value="medieval-fantasy">Medieval Fantasy</option>
                <option value="space-opera">Space Opera</option>
                <option value="custom">Custom Scenario</option>
              </select>
            </div>

            <div>
              <label htmlFor="scenario" className="block mb-2">
                Scenario Description:
              </label>
              <textarea
                id="scenario"
                value={gameState.scenarioDescription}
                onChange={(e) =>
                  handleStateUpdate({ scenarioDescription: e.target.value })
                }
                disabled={gameState.scenarioType !== "custom"}
                className="w-full p-2 border rounded h-32 disabled:bg-gray-100 disabled:text-gray-700"
              />
            </div>
          </div>
        </main>
      </div>

      <button
        onClick={() => setIsDebugOpen(true)}
        className="fixed bottom-4 right-4 bg-gray-200 hover:bg-gray-300 rounded px-3 py-2 text-sm"
        title="Show Game State"
      >
        Game State
      </button>

      <DebugModal
        isOpen={isDebugOpen}
        onClose={() => setIsDebugOpen(false)}
        gameState={gameState}
      />
    </>
  );
}
