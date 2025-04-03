import { useState, useRef, useEffect } from "react";
import { GameState } from "@/types/game";

type GameScreenProps = {
  currentGame: GameState;
  setCurrentGame: (game: GameState) => void;
};

export default function GameScreen({ currentGame, setCurrentGame }: GameScreenProps) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentGame && currentGame.messages.length > 0) {
      setMessages(
        currentGame.messages.map((msg, i) => ({
          role: i % 2 === 0 ? "user" : "assistant",
          content: msg,
        }))
      );
    }
  }, [currentGame]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);
    setStreamingText("");

    // Add user message to the chat
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);

    try {
      const response = await fetch(`/api/games/${currentGame.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = new TextDecoder().decode(value);
        const lines = text.split("\n").filter((line) => line.trim() !== "");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || "";
              fullResponse += content;
              setStreamingText(fullResponse);
            } catch (e) {
              console.error("Failed to parse chunk:", e);
            }
          }
        }
      }

      // Add the complete assistant message to the chat
      setMessages(prev => [...prev, { role: "assistant", content: fullResponse }]);
      setStreamingText("");

      // Update the game state
      const gameResponse = await fetch(`/api/games/${currentGame.id}`);
      const updatedGame = await gameResponse.json();
      setCurrentGame(updatedGame);
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex-1 border-2 border-white p-4 mb-4 min-h-[400px] bg-black overflow-y-auto">
        <div className="space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`text-white ${
                msg.role === "assistant" ? "opacity-80" : ""
              }`}
            >
              <span className="font-bold">
                {msg.role === "assistant" ? "DM: " : "You: "}
              </span>
              <span className="whitespace-pre-wrap">{msg.content}</span>
            </div>
          ))}
          {(isLoading || streamingText) && (
            <div className="text-white opacity-80">
              <span className="font-bold">DM: </span>
              <span className="whitespace-pre-wrap">
                {streamingText}
                {isLoading && <span className="animate-pulse">▋</span>}
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 p-3 bg-black text-white border-2 border-white focus:border-blue-500 outline-none"
          placeholder="What would you like to do?"
          disabled={isLoading}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (input.trim()) {
                handleSubmit(e);
              }
            }
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-6 py-3 bg-black text-white border-2 border-white hover:bg-white hover:text-black transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="animate-pulse">Thinking...</span>
          ) : (
            "Send"
          )}
        </button>
      </form>
    </>
  );
} 