"use client";

import { useState, useEffect } from "react";
import { GameSummary, GameState } from "@/types/game";

type ScenarioType = {
  id: string;
  title: string;
  description: string;
};

const predefinedScenarios: ScenarioType[] = [
  {
    id: "fantasy",
    title: "The Lost Kingdom",
    description:
      "A classic fantasy adventure in a medieval realm filled with magic and mystery.",
  },
  {
    id: "scifi",
    title: "Deep Space Expedition",
    description:
      "Explore the unknown reaches of space in this sci-fi adventure.",
  },
];

export default function Home() {
  const [step, setStep] = useState<"start" | "setup" | "game" | "load">(
    "start"
  );
  const [name, setName] = useState("");
  const [scenario, setScenario] = useState("");
  const [customScenario, setCustomScenario] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [showCustom, setShowCustom] = useState(false);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [currentGame, setCurrentGame] = useState<GameState | null>(null);

  useEffect(() => {
    if (step === "load") {
      fetchGames();
    }
  }, [step]);

  const fetchGames = async () => {
    const response = await fetch("/api/games");
    const data = await response.json();
    setGames(data);
  };

  const loadGame = async (id: string) => {
    const response = await fetch(`/api/games/${id}`);
    const game = await response.json();
    setCurrentGame(game);
    setName(game.name);
    setScenario(game.scenario);
    setCustomScenario(game.customScenario || "");
    setMessages(game.messages);
    setStep("game");
  };

  const deleteGame = async (id: string) => {
    await fetch(`/api/games/${id}`, { method: "DELETE" });
    fetchGames();
  };

  const handleStart = () => {
    setStep("setup");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const selectedScenario = customScenario.trim() || scenario;
    if (!selectedScenario) return;

    const response = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        scenario,
        customScenario: customScenario.trim(),
        messages: [
          `Welcome, ${name}!`,
          `Your adventure begins in: ${selectedScenario}`,
        ],
      }),
    });

    const game = await response.json();
    setCurrentGame(game);
    setMessages(game.messages);
    setStep("game");
  };

  return (
    <div className="max-w-2xl mx-auto min-h-screen flex flex-col p-4">
      {step === "start" && (
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
              onClick={handleStart}
              className="px-8 py-4 bg-black text-white border-2 border-white hover:bg-white hover:text-black transition-colors duration-200 text-xl"
            >
              NEW JOURNEY
            </button>
            <button
              onClick={() => setStep("load")}
              className="px-8 py-4 bg-black text-white border-2 border-white hover:bg-white hover:text-black transition-colors duration-200 text-xl"
            >
              LOAD JOURNEY
            </button>
          </div>
        </div>
      )}

      {step === "setup" && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          <h2 className="text-3xl font-bold text-white border-b-2 border-white pb-2">
            Create Your Adventure
          </h2>

          {/* Name Input */}
          <div className="flex flex-col gap-4">
            <label htmlFor="name" className="text-white text-xl">
              What shall we call you, hunter?
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="p-3 bg-black text-white border-2 border-white focus:border-blue-500 outline-none"
              placeholder="Enter your name..."
              autoFocus
            />
          </div>

          {/* Scenario Selection */}
          <div className="flex flex-col gap-4">
            <h3 className="text-xl text-white">Choose Your Reality</h3>
            <div className="grid gap-4">
              {predefinedScenarios.map((scene) => (
                <label
                  key={scene.id}
                  className={`flex flex-col gap-2 p-4 border-2 cursor-pointer ${
                    scenario === scene.title
                      ? "border-blue-500 bg-white/5"
                      : "border-white hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="scenario"
                      value={scene.title}
                      checked={scenario === scene.title}
                      onChange={(e) => {
                        setScenario(e.target.value);
                        setShowCustom(false);
                        setCustomScenario("");
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-xl font-bold text-white">
                      {scene.title}
                    </span>
                  </div>
                  <span className="text-sm text-white/80 pl-7">
                    {scene.description}
                  </span>
                </label>
              ))}

              <label
                className={`flex flex-col gap-2 p-4 border-2 cursor-pointer ${
                  showCustom
                    ? "border-blue-500 bg-white/5"
                    : "border-white hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="scenario"
                    checked={showCustom}
                    onChange={() => {
                      setShowCustom(true);
                      setScenario("");
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-xl font-bold text-white">
                    Custom Scenario
                  </span>
                </div>
                {showCustom && (
                  <textarea
                    value={customScenario}
                    onChange={(e) => setCustomScenario(e.target.value)}
                    className="mt-2 p-3 bg-black text-white border-2 border-white focus:border-blue-500 outline-none min-h-[100px] w-full"
                    placeholder="Describe the world and setting for your adventure..."
                  />
                )}
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={!name.trim() || (!scenario && !customScenario.trim())}
            className="px-6 py-3 bg-black text-white border-2 border-white hover:bg-white hover:text-black transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            BEGIN ADVENTURE
          </button>
        </form>
      )}

      {step === "game" && (
        <>
          <div className="flex-1 border-2 border-white p-4 mb-4 min-h-[400px] bg-black overflow-y-auto">
            {messages.map((msg, i) => (
              <div key={i} className="mb-4 text-white">
                {msg}
              </div>
            ))}
          </div>
        </>
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
    </div>
  );
}
