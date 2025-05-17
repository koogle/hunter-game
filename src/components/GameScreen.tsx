"use client";

import { useEffect, useRef, useState } from "react";
import { GameState, GameMessage } from "@/types/game";

interface GameScreenProps {
  gameState: GameState;
  onGameStateUpdate: (gameState: GameState) => void;
}

export default function GameScreen({ gameState, onGameStateUpdate }: GameScreenProps) {
  const [command, setCommand] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [gameState.messages]);

  const createTextBar = (value: number, max: number, length = 16, filled = "█", empty = "░") => {
    const filledLength = Math.floor((value / max) * length);
    return `${filled.repeat(filledLength)}${empty.repeat(length - filledLength)}`;
  };

  const [streamedResponse, setStreamedResponse] = useState("");
  const [lastCommand, setLastCommand] = useState("");

  const [tempMessage, setTempMessage] = useState<GameMessage | null>(null);

  // Handle special commands like <help> and <reset>
  const handleSpecialCommand = (cmd: string): boolean => {

    if (cmd.toLowerCase() === "<help>") {
      const helpMessage: GameMessage = {
        role: "assistant",
        content: `HUNTER - Text Adventure Game Help

Basic Commands:
- Type natural language commands to interact with the game world (e.g., "look around", "talk to the merchant", "pick up the sword")
- Use <help> to display this help message
- Use <reset> to reset your character while keeping the same scenario

Game Stats:
- Health (HP): Your life force. Reaches 0 and you die.
- Mana (MP): Magic energy for casting spells.
- Experience (XP): Gained by completing quests and defeating enemies.
- Strength (STR): Affects physical damage and carrying capacity.
- Dexterity (DEX): Affects accuracy, dodging, and movement.
- Intelligence (INT): Affects magic power and skill learning.
- Luck (LCK): Affects critical hits, item discovery, and random events.

Tips:
- Explore your surroundings thoroughly
- Talk to NPCs for quests and information
- Manage your inventory and resources carefully
- Pay attention to your character stats when attempting difficult actions`
      };

      // Set the temporary message instead of updating game state
      setTempMessage(helpMessage);

      return true;
    }

    // Reset command
    if (cmd.toLowerCase() === "<reset>") {
      const resetMessage: GameMessage = {
        role: "assistant",
        content: "Game state has been reset. Your character stats and inventory have been restored to their initial values, but the scenario remains the same."
      };

      // Set the temporary message
      setTempMessage(resetMessage);

      // Create a reset game state without adding messages
      const resetGame: GameState = {
        ...gameState,
        // Keep the existing messages instead of replacing them
        messages: [],
        stats: {
          health: 100,
          mana: 100,
          experience: 0,
          strength: 10,
          dexterity: 10,
          intelligence: 10,
          luck: 10
        },
        inventory: [],
        lastUpdatedAt: new Date().toISOString()
      };

      // Update the game state
      onGameStateUpdate(resetGame);

      // Save the reset state to the server
      fetch(`/api/games/${gameState.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resetGame),
      }).catch(error => {
        console.error("Failed to save reset game state:", error);
      });

      return true;
    }

    return false;
  };

  const handleCommand = async (cmd: string) => {
    if (!cmd.trim()) return;

    // Clear any temporary message when user enters a new command
    setTempMessage(null);

    setLastCommand(cmd);
    setStreamedResponse("");

    // Check for special commands first
    if (handleSpecialCommand(cmd)) {
      return;
    }

    const userMessage = {
      role: "user" as const,
      content: `${cmd}`
    };
    onGameStateUpdate({
      ...gameState,
      messages: [...gameState.messages, userMessage]
    });

    setIsLoading(true);
    setCommand("");

    try {
      // Step 1: Precheck for validity and skill check
      const precheckResponse = await fetch(`/api/games/${gameState.id}/message/precheck`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: cmd, gameState }),
      });
      const precheck = await precheckResponse.json();
      if (!precheck.valid) {
        setTempMessage({ role: "assistant", content: precheck.reason || "That action is not allowed." });
        return;
      }
      // If skill check required, show progress message
      if (precheck.skillCheck && precheck.skillCheck.required) {
        setTempMessage({ role: "assistant", content: `Skill check in progress... (${precheck.skillCheck.stat?.toUpperCase()} vs ${precheck.skillCheck.difficulty})` });
      }
      // Step 2: Resolve the action (with skillCheck info if needed)
      const resolveResponse = await fetch(`/api/games/${gameState.id}/message/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: cmd, skillCheck: precheck.skillCheck, gameState }),
      });
      if (!resolveResponse.ok) {
        const errorData = await resolveResponse.json().catch(() => null);
        setTempMessage({ role: "assistant", content: errorData?.error || "Failed to process action." });
        return;
      }
      const data = await resolveResponse.json();
      // Show skill check result if present
      let skillCheckMsg: GameMessage | null = null;
      if (data.skillCheckResult && data.skillCheckResult.performed) {
        skillCheckMsg = {
          role: "assistant",
          content: `Skill Check Result: ${data.skillCheckResult.stat?.toUpperCase()} (${data.skillCheckResult.statValue}) + d12 (${data.skillCheckResult.roll}) vs ${data.skillCheckResult.difficulty} → ${data.skillCheckResult.success ? "SUCCESS" : "FAILURE"} (Δ${data.skillCheckResult.degree})${data.skillCheckResult.reason ? ": " + data.skillCheckResult.reason : ""}`
        };
      }
      const assistantMessage: GameMessage = {
        role: "assistant",
        content: data.shortAnswer || data.message || "(No response)"
      };
      // Append the skill check result if any, then the DM's response
      const newMessages = skillCheckMsg
        ? [...gameState.messages, { role: "user" as const, content: cmd }, skillCheckMsg, assistantMessage]
        : [...gameState.messages, { role: "user" as const, content: cmd }, assistantMessage];
      // Use updatedGame from the response
      if (data.updatedGame) {
        onGameStateUpdate(data.updatedGame);
      } else {
        // fallback: update messages only
        onGameStateUpdate({
          ...gameState,
          messages: newMessages
        });
      }
    } catch (error) {
      console.error("Error processing command:", error);
      setTempMessage({ role: "assistant", content: "An error occurred while processing your action." });
    } finally {
      setIsLoading(false);
      setStreamedResponse("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && command.trim()) {
      handleCommand(command.trim());
    }
  };

  return (
    <div className="font-vt323 text-green-400 w-full h-[80vh] flex flex-col md:flex-row gap-4 scanlines">
      <div className="flex-1 flex flex-col border-2 w-[800px] border-green-500 overflow-hidden shadow-[0_0_10px_rgba(0,255,0,0.3)]">
        <div className="border-b-2 border-green-500 p-2 text-center relative bg-black">
          <div className="text-center text-2xl glitch-text">HUNTER</div>
          <div className="text-center text-green-300 mt-1 text-lg">{gameState.scenario}</div>
        </div>
        <div
          className="flex-1 p-4 overflow-y-auto bg-black text-green-400 whitespace-pre-wrap terminal-text"
          style={{
            textShadow: "0 0 5px rgba(0,255,0,0.5)",
          }}
        >
          {gameState.messages.map((message, index) => {
            if (message.role === "user") {
              return (
                <div key={index} className="mb-4 leading-relaxed">
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-400 font-bold">You:</span>
                    <span>{message.content}</span>
                  </div>
                </div>
              );
            }
            // Try to parse DM message as JSON
            let parsed: any = null;
            try {
              parsed = typeof message.content === 'string' ? JSON.parse(message.content) : null;
            } catch (e) {
              parsed = null;
            }
            if (parsed && typeof parsed === 'object' && parsed.narrative) {
              return (
                <div key={index} className="mb-4 leading-relaxed">
                  <div className="flex items-start gap-2">
                    <span className="text-green-500 font-bold">DM:</span>
                    <span className="whitespace-pre-line">{typeof parsed.narrative === 'string' ? parsed.narrative : String(parsed.narrative)}</span>
                  </div>
                </div>
              );
            } else {
              // fallback: show as plain text
              return (
                <div key={index} className="mb-4 leading-relaxed">
                  <div className="flex items-start gap-2">
                    <span className="text-green-500 font-bold">DM:</span>
                    <span>{message.content}</span>
                  </div>
                </div>
              );
            }
          })}
          {/* Display temporary help/reset message */}
          {tempMessage && (
            <div className="mb-4 leading-relaxed bg-black/50 border border-green-800 p-2 rounded">
              <div className="flex items-start gap-2">
                <span className="text-green-500 font-bold">DM:</span>
                <span>{tempMessage.content}</span>
              </div>

            </div>
          )}
          {isLoading && streamedResponse && (
            <div className="mb-4 leading-relaxed">
              <div className="flex items-start gap-2">
                <span className="text-green-500 font-bold">DM:</span>
                <span>{streamedResponse}</span>
              </div>
            </div>
          )}
          <div ref={logEndRef}></div>
        </div>
        <div className="border-t-2 border-green-500 p-2 flex gap-2 bg-black">
          {!isLoading && <span className="mx-2 text-lg text-green-500">&gt;</span>}
          {!isLoading && <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`mr-2 flex-1 bg-transparent border-none outline-none focus:ring-0 text-green-400 text-xl placeholder:text-gray-400 ${!command.trim() ? 'blink-slow' : ''}`}
            aria-label="Command input"
            placeholder="What do you want to do..."
            disabled={isLoading}
          />}
          {isLoading && (
            <div className="mx-2 text-green-500 text-lg animate-pulse">Processing...</div>
          )}
        </div>
      </div>
      <div className="md:w-72 border-2 border-green-500 flex flex-col shadow-[0_0_10px_rgba(0,255,0,0.3)]">
        <div className="border-b-2 border-green-500 p-2 text-center bg-black">
          <div className="text-xl">CHARACTER</div>
        </div>
        <div className="p-4 flex-1 overflow-y-auto bg-black">

          <div className="mb-4 border border-green-800 p-2 bg-black/50">
            <div className="mb-1 flex justify-between">
              <span>HP:</span>
              <span>{gameState.stats.health}/100</span>
            </div>
            <div className="font-mono text-lg overflow-hidden">{createTextBar(gameState.stats.health, 100)}</div>
          </div>
          <div className="mb-4 border border-green-800 p-2 bg-black/50">
            <div className="mb-1 flex justify-between">
              <span>MP:</span>
              <span>{gameState.stats.mana}/100</span>
            </div>
            <div className="font-mono text-lg overflow-hidden">{createTextBar(gameState.stats.mana, 100)}</div>
          </div>
          <div className="mb-4 border border-green-800 p-2 bg-black/50">
            <div className="mb-1 flex justify-between">
              <span>XP:</span>
              <span>{gameState.stats.experience}/100</span>
            </div>
            <div className="font-mono text-lg overflow-hidden">{createTextBar(gameState.stats.experience, 100)}</div>
          </div>


          <div className="mb-4 border border-green-800 p-2 bg-black/50">
            <div className="text-center mb-2 text-green-300">ATTRIBUTES</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex justify-between">
                <span>STR:</span>
                <span>{gameState.stats.strength}</span>
              </div>
              <div className="flex justify-between">
                <span>DEX:</span>
                <span>{gameState.stats.dexterity}</span>
              </div>
              <div className="flex justify-between">
                <span>INT:</span>
                <span>{gameState.stats.intelligence}</span>
              </div>
              <div className="flex justify-between">
                <span>LCK:</span>
                <span>{gameState.stats.luck}</span>
              </div>
            </div>
          </div>

          {/* 
          {activeQuests.length > 0 && (
            <div className="mb-4 border border-green-800 p-2 bg-black/50">
              <div className="text-center mb-2 text-green-300">ACTIVE QUESTS</div>
              <ul className="list-none pl-0">
                {activeQuests.map((quest, index) => (
                  <li key={index} className="mb-2">
                    <div className="text-yellow-400">{quest.name}</div>
                    <div className="text-xs text-gray-400">{quest.description}</div>
                    <div className="mt-1 font-mono text-xs">{createTextBar(quest.progress, 100, 10)}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}Quests Section */}

          {/* Inventory Section */}
          <div className="border-t-2 border-green-500 pt-4 mt-4">
            <div className="mb-2 text-xl text-center text-green-300">INVENTORY</div>
            <ul className="list-none pl-2">
              {gameState.inventory?.length > 0 ? (
                gameState.inventory.map((item, index) => (
                  <li key={index} className="mb-2">
                    <div className="flex justify-between">
                      <span className="text-yellow-400">{item.name}</span>
                      {item.quantity > 1 && <span className="text-gray-400">{item.quantity}</span>}
                    </div>
                    {item.description && <div className="text-xs text-gray-400">{item.description}</div>}
                  </li>
                ))
              ) : (
                <li className="text-gray-400 italic">No items in inventory</li>
              )}
            </ul>
          </div>
        </div>
        <div className="border-t-2 border-green-500 p-2 text-center bg-black">
          <div className="text-sm">{"Type <help> for commands"}</div>
        </div>
      </div>
    </div>
  );
} 