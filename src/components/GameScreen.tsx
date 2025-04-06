import { useState, useRef, useEffect } from "react";
import { GameState, GameMessage } from "@/types/game";

interface GameScreenProps {
  gameState: GameState;
  onCommand: (command: string) => void;
}

export default function GameScreen({ gameState, onCommand }: GameScreenProps) {
  const [input, setInput] = useState("");
  const [cursorVisible, setCursorVisible] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (gameState && gameState.messages && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [gameState?.messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && input.trim()) {
      onCommand(input.trim());
      setInput("");
    }
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground crt-effect scanlines">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {gameState?.messages.map((message: GameMessage, index) => (
          <div
            key={index}
            className={`font-pixel text-lg ${
              message.role === "user" ? "text-primary" : "text-foreground"
            }`}
          >
            {message.content}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t border-primary">
        <div className="flex items-center space-x-2">
          <span className="text-primary font-pixel">&gt;</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent border-none outline-none text-primary font-pixel"
            placeholder="Enter command..."
          />
          <span className={`text-primary font-pixel ${cursorVisible ? "opacity-100" : "opacity-0"}`}>
            _
          </span>
        </div>
      </div>
    </div>
  );
} 