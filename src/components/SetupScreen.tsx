import { useState } from "react";

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

type SetupScreenProps = {
  onSubmit: (name: string, scenario: string, customScenario: string) => void;
};

export default function SetupScreen({ onSubmit }: SetupScreenProps) {
  const [name, setName] = useState("");
  const [scenario, setScenario] = useState("");
  const [customScenario, setCustomScenario] = useState("");
  const [generatedDescription, setGeneratedDescription] = useState("");
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [showCustom, setShowCustom] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const selectedScenario = customScenario.trim() || scenario;
    if (!selectedScenario) return;

    onSubmit(name, scenario, customScenario.trim());
  };

  const generateScenarioDescription = async (scenarioTitle: string) => {
    setIsGeneratingDescription(true);
    try {
      const response = await fetch("/api/generate-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: scenarioTitle }),
      });
      const data = await response.json();
      setGeneratedDescription(data.description);
      setCustomScenario(data.description);
    } catch (error) {
      console.error("Failed to generate scenario description:", error);
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  return (
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
                    generateScenarioDescription(e.target.value);
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
                  setGeneratedDescription("");
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
        {isGeneratingDescription && (
          <div className="text-white/80 text-sm">
            Generating a rich description of your scenario...
          </div>
        )}
        {generatedDescription && !showCustom && (
          <div className="mt-4 p-4 bg-white/5 border-2 border-white">
            <h4 className="text-white font-bold mb-2">Suggested Description:</h4>
            <p className="text-white/80">{generatedDescription}</p>
            <button
              type="button"
              onClick={() => {
                setShowCustom(true);
                setCustomScenario(generatedDescription);
              }}
              className="mt-2 px-4 py-2 bg-black text-white border-2 border-white hover:bg-white hover:text-black transition-colors duration-200"
            >
              Use This Description
            </button>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={!name.trim() || (!scenario && !customScenario.trim())}
        className="px-6 py-3 bg-black text-white border-2 border-white hover:bg-white hover:text-black transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        BEGIN ADVENTURE
      </button>
    </form>
  );
} 