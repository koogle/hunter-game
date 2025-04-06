"use client";

import { useState, useEffect } from "react";
import { GameSummary, GameState } from "@/types/game";
import StartScreen from "@/components/StartScreen";
import GameScreen from "@/components/GameScreen";
import SetupScreen from "@/components/SetupScreen";


export default function Home() {
  const [step, setStep] = useState<"start" | "setup" | "game" | "load">("start");
  const [isLoading, setIsLoading] = useState(true);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [currentGame, setCurrentGame] = useState<GameState | null>(null);

  const fetchGames = async () => {
    const response = await fetch("/api/games");
    const data = await response.json();
    setGames(data);
    return data;
  };

  const loadLastGame = async () => {
    try {
      const games = await fetchGames();
      if (games.length > 0) {
        const lastGame = games[games.length - 1];
        await loadGame(lastGame.id);
      } else {
        setStep("start");
      }
    } catch (error) {
      console.error("Failed to load last game:", error);
      setStep("start");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLastGame();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step === "load") {
      fetchGames();
    }
  }, [step]);

  const loadGame = async (id: string) => {
    const response = await fetch(`/api/games/${id}`);
    const game = await response.json();
    setCurrentGame(game);
    setStep("game");
  };

  const deleteGame = async (id: string) => {
    await fetch(`/api/games/${id}`, { method: "DELETE" });
    fetchGames();
  };

  const handleStart = () => {
    setStep("setup");
  };

  const handleSetupSubmit = async (name: string, scenario: string, customScenario: string) => {
    const selectedScenario = customScenario || scenario;
    if (!selectedScenario) return;

    const response = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        scenario,
        customScenario,
        messages: [
          `Welcome, ${name}!`,
          `Your adventure begins in: ${selectedScenario}`,
        ],
      }),
    });

    const game = await response.json();
    setCurrentGame(game);
    setStep("game");
  };

  return (
    <div className="max-w-6xl mx-auto min-h-screen flex flex-col p-4">
      {isLoading ? (
        <div className="flex items-center justify-center h-screen">
          <div className="text-white text-xl">Loading your adventure...</div>
        </div>
      ) : (
        <>
          {step === "start" && (
            <StartScreen onStart={handleStart} onLoad={() => setStep("load")} />
          )}

          {step === "setup" && (
            <SetupScreen onSubmit={handleSetupSubmit} />
          )}

          {step === "game" && currentGame && (
            <GameScreen
              gameState={currentGame}
              onGameStateUpdate={setCurrentGame}
            />
          )}

          {step === "load" && (
            <div className="flex flex-col gap-6">
              <h2 className="text-3xl font-bold text-white border-b-2 border-white pb-2">
                Your Journeys
              </h2>
              {games.length === 0 ? (
                <p className="text-white text-xl">No saved journeys found.</p>
              ) : (
                <div className="grid gap-4">
                  {games.map((game) => (
                    <div
                      key={game.id}
                      className="border-2 border-white p-4 flex justify-between items-center"
                    >
                      <div>
                        <h3 className="text-xl text-white font-bold">
                          {game.name}
                        </h3>
                        <p className="text-white/80">{game.scenario}</p>
                        <p className="text-sm text-white/60">
                          Last played:{" "}
                          {new Date(game.lastUpdatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => loadGame(game.id)}
                          className="px-4 py-2 bg-black text-white border-2 border-white hover:bg-white hover:text-black transition-colors duration-200"
                        >
                          Continue
                        </button>
                        <button
                          onClick={() => deleteGame(game.id)}
                          className="px-4 py-2 bg-black text-white border-2 border-red-500 hover:bg-red-500 hover:text-white transition-colors duration-200"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setStep("start")}
                className="px-6 py-3 bg-black text-white border-2 border-white hover:bg-white hover:text-black transition-colors duration-200"
              >
                Back
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
