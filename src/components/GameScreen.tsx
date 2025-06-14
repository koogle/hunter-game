"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { GameState, GameMessage } from "@/types/game";
import { initWebSocketClient, joinGame, leaveGame, sendPlayerAction, setCallbacks } from "@/lib/websocket-client";

interface GameScreenProps {
  gameState: GameState;
  onGameStateUpdate: (gameState: GameState | ((prev: GameState) => GameState)) => void;
}

export default function GameScreen({ gameState, onGameStateUpdate }: GameScreenProps) {
  const [command, setCommand] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [tempMessage, setTempMessage] = useState<GameMessage | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [gameState.messages]);

  // Set up callbacks for websocket events
  // Stable chunk handler to avoid duplicate listeners
  const handleDMResponseChunk = useCallback((data: string | { chunk: string }) => {
    let chunk = data;
    if (typeof data === "object" && data !== null && "chunk" in data) {
      chunk = data.chunk;
    }
    if (chunk === '__STREAM_START__') {
      setTempMessage({
        role: "assistant",
        content: "", // Start with empty content
        timestamp: new Date().toISOString()
      });
      return;
    }
    if (chunk === '__STREAM_END__') {
      // Do NOT clear tempMessage here. It will be cleared by onGameUpdate
      // or when a new command is submitted.
      return;
    }
    if (typeof chunk !== "string") {
      console.warn("Received non-string chunk, ignoring:", chunk);
      return;
    }
    setTempMessage(prev => {
      const currentContent = prev?.content || "";
      console.log("[GameScreen] handleDMResponseChunk", { chunk, currentContent });
      return {
        role: prev?.role || "assistant",
        timestamp: prev?.timestamp || new Date().toISOString(),
        content: currentContent + chunk
      };
    });
  }, []);

  // Stable game update handler
  const handleGameUpdate = useCallback((updatedGameState: GameState) => {
    onGameStateUpdate(updatedGameState);
    setIsLoading(false);
    setTempMessage(null);
  }, [onGameStateUpdate]);

  const handleSkillCheckNotification = useCallback((request: any) => {
    if (!request.required || !request.stat || !request.difficultyCategory) return;
    const content = `Attempting ${request.stat} check (Difficulty: ${request.difficultyCategory})${request.reason ? ` to ${request.reason}` : ''}...`;
    const skillCheckMsg: GameMessage = {
      role: 'system',
      content,
      type: 'skill-check',
      timestamp: new Date().toISOString(),
    };
    onGameStateUpdate(prev => ({ ...prev, messages: [...prev.messages, skillCheckMsg] }));
  }, [onGameStateUpdate]);

  const handleSkillCheckResult = useCallback((result: any) => {
    if (!result.performed || !result.stat || result.roll === undefined || result.difficulty === undefined) return;
    const outcome = result.success ? 'Success' : 'Failure';
    const content = `Skill Check: ${result.stat.toUpperCase()} (Rolled ${result.roll} vs DC ${result.difficulty}) - ${outcome}!${result.degree ? ` Degree: ${result.degree}.` : ''}${result.reason ? ` (${result.reason})` : ''}`;
    const skillCheckResultMsg: GameMessage = {
      role: 'system',
      content,
      type: 'skill-check',
      timestamp: new Date().toISOString(),
    };
    onGameStateUpdate(prev => ({ ...prev, messages: [...prev.messages, skillCheckResultMsg] }));
  }, [onGameStateUpdate]);

  // Initialize websocket connection
  useEffect(() => {
    if (!gameState || !gameState.id) return;

    // Initialize the websocket client
    initWebSocketClient();

    // Join the game room
    joinGame(gameState.id);

    setCallbacks({
      onDMResponseChunk: handleDMResponseChunk,
      onSkillCheckNotification: handleSkillCheckNotification,
      onSkillCheckResult: handleSkillCheckResult,
      onGameUpdate: handleGameUpdate,
    });

    // Clean up on unmount
    return () => {
      if (gameState.id) {
        leaveGame();
      }
    };
    // Only re-run when game id or stable handlers change
  }, [gameState.id, handleDMResponseChunk, handleGameUpdate, handleSkillCheckNotification, handleSkillCheckResult]);

  const createTextBar = (value: number, max: number, length = 16, filled = "█", empty = "░") => {
    let filledLength = Math.floor((value / max) * length);
    filledLength = Math.max(0, Math.min(length, filledLength));
    const emptyLength = Math.max(0, length - filledLength);
    return `${filled.repeat(filledLength)}${empty.repeat(emptyLength)}`;
  };

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
      setCommand("");

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

    setTempMessage(null); // Clear any previous temp message before sending new command

    // Check for special commands first
    if (handleSpecialCommand(cmd)) {
      return;
    }

    setIsLoading(true);
    setCommand("");

    // Show user message immediately
    const userMessage = {
      role: "user" as const,
      content: `${cmd}`
    };

    // Update local state to show the user message immediately
    onGameStateUpdate({
      ...gameState,
      messages: [...gameState.messages, userMessage]
    });

    try {
      // Send the player action via websocket
      sendPlayerAction(cmd, gameState);

      // The rest of the process will be handled by the websocket callbacks
    } catch (error) {
      console.error("Error processing command:", error);
      setTempMessage({ role: "assistant", content: "An error occurred while processing your action." });
      setIsLoading(false);
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
                    <span>{typeof message.content === "string" ? message.content : JSON.stringify(message.content, null, 2)}</span>
                  </div>
                </div>
              );
            }

            // Handle system messages (errors, skill checks, etc.)
            if (message.role === "system") {
              const getSystemMessageStyle = (type?: string) => {
                switch (type) {
                  case "error":
                    return {
                      labelClass: "text-red-400 font-bold",
                      contentClass: "text-red-300",
                      containerClass: "bg-red-900/20 border border-red-800 p-2 rounded"
                    };
                  case "action-invalid":
                    return {
                      labelClass: "text-orange-400 font-bold",
                      contentClass: "text-orange-300",
                      containerClass: "bg-orange-900/20 border border-orange-800 p-2 rounded"
                    };
                  case "skill-check":
                    return {
                      labelClass: "text-blue-400 font-bold",
                      contentClass: "text-blue-300",
                      containerClass: "bg-blue-900/20 border border-blue-800 p-2 rounded"
                    };
                  case "inventory-change":
                    return {
                      labelClass: "text-purple-400 font-bold",
                      contentClass: "text-purple-300",
                      containerClass: "bg-purple-900/20 border border-purple-800 p-2 rounded"
                    };
                  case "stat-change":
                    return {
                      labelClass: "text-cyan-400 font-bold",
                      contentClass: "text-cyan-300",
                      containerClass: "bg-cyan-900/20 border border-cyan-800 p-2 rounded"
                    };
                  default:
                    return {
                      labelClass: "text-gray-400 font-bold",
                      contentClass: "text-gray-300",
                      containerClass: "bg-gray-900/20 border border-gray-800 p-2 rounded"
                    };
                }
              };

              const style = getSystemMessageStyle(message.type);
              const label = message.type === "error" ? "ERROR:" :
                message.type === "action-invalid" ? "INVALID:" :
                  message.type === "skill-check" ? "SKILL CHECK:" :
                    message.type === "inventory-change" ? "INVENTORY:" :
                      message.type === "stat-change" ? "STATUS:" : "SYSTEM:";

              return (
                <div key={index} className={`mb-4 leading-relaxed ${style.containerClass}`}>
                  <div className="flex items-start gap-2">
                    <span className={style.labelClass}>{label}</span>
                    <span className={style.contentClass}>{typeof message.content === "string" ? message.content : JSON.stringify(message.content, null, 2)}</span>
                  </div>
                  {message.timestamp && (
                    <div className="text-xs text-gray-500 mt-1 ml-2">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <div key={index} className="mb-4 leading-relaxed">
                <div className="flex items-start gap-2">
                  <span className="text-green-500 font-bold">DM:</span>
                  <span>{typeof message.content === "string" ? message.content : JSON.stringify(message.content, null, 2)}</span>
                </div>
                {message.timestamp && (
                  <div className="text-xs text-gray-500 mt-1 ml-2">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                )}
              </div>
            );
          })}
          {/* Display temporary help/reset message */}
          {tempMessage && (
            <div className="mb-4 leading-relaxed">
              <div className="flex items-start gap-2">
                <span className="text-green-500 font-bold">DM:</span>
                <span>{tempMessage.content}</span>
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