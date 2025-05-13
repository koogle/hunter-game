"use client";

import { useEffect, useRef, useState } from "react";
import { GameState } from "@/types/game";

interface GameScreenProps {
  gameState: GameState;
  onGameStateUpdate: (gameState: GameState) => void;
}

export default function GameScreen({ gameState, onGameStateUpdate }: GameScreenProps) {
  const [command, setCommand] = useState("");
  const [cursorVisible, setCursorVisible] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [gameState.messages]);

  const createTextBar = (value: number, max: number, length = 16, filled = "█", empty = "░") => {
    const filledLength = Math.floor((value / max) * length);
    return `${filled.repeat(filledLength)}${empty.repeat(length - filledLength)}`;
  };

  const handleCommand = async (cmd: string) => {
    if (!cmd.trim()) return;

    try {
      const response = await fetch(`/api/games/${gameState.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: cmd }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error("Failed to send message:", {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        return;
      }

      if (!response.body) {
        console.error("Response body is null");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              if (line === "data: [DONE]") {
                continue;
              }
              const data = JSON.parse(line.slice(6));
              if (data.choices?.[0]?.delta?.content) {
                // Handle streaming content if needed
              }
            } catch (e) {
              console.error("Error parsing SSE data:", e);
            }
          }
        }
      }

      // Refresh the game state after the message is processed
      const updatedGameResponse = await fetch(`/api/games/${gameState.id}`);
      if (!updatedGameResponse.ok) {
        console.error("Failed to fetch updated game state:", {
          status: updatedGameResponse.status,
          statusText: updatedGameResponse.statusText
        });
        return;
      }

      const updatedGame = await updatedGameResponse.json();
      onGameStateUpdate(updatedGame);
    } catch (error) {
      console.error("Error processing command:", error);
      // Add the command to the game state as a user message even if it failed
      const userMessage = {
        role: "user" as const,
        content: cmd
      };
      onGameStateUpdate({
        ...gameState,
        messages: [...gameState.messages, userMessage]
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && command.trim()) {
      handleCommand(command.trim());
      setCommand("");
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
          {gameState.messages.map((message, index) => (
            <div key={index} className="mb-2 leading-relaxed">
              {message.content}
            </div>
          ))}
          <div ref={logEndRef}></div>
        </div>
        <div className="border-t-2 border-green-500 p-2 flex gap-2 bg-black">
          <span className="mr-2 text-xl text-green-500">&gt;</span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`mr-2 flex-1 bg-transparent border-none outline-none focus:ring-0 text-green-400 text-xl placeholder:text-green-200 ${!command.trim() ? 'blink-slow' : ''}`}
            aria-label="Command input"
            placeholder="What do you want to do..."
          />
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
          <div className="border-t-2 border-green-500 pt-4 mt-4">
            <div className="mb-2 text-xl">INVENTORY</div>
            <ul className="list-none pl-2">
              {gameState.inventory?.length > 0 ? (
                gameState.inventory.map((item, index) => (
                  <li key={index} className="mb-1">{item.name} {item.quantity > 1 ? `(${item.quantity})` : ''}</li>
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