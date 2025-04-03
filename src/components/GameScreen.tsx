import { useState } from "react";
import { useChat, Message as ChatMessage } from "ai/react";
import { GameState } from "@/types/game";

type GameScreenProps = {
  currentGame: GameState;
  setMessages: (messages: ChatMessage[]) => void;
  setCurrentGame: (game: GameState) => void;
};

export default function GameScreen({ currentGame, setMessages, setCurrentGame }: GameScreenProps) {
  const [streamingText, setStreamingText] = useState("");

  const {
    messages: chatMessages,
    input: chatInput,
    handleInputChange,
    handleSubmit: handleChatSubmit,
    isLoading: isChatLoading,
  } = useChat({
    api: currentGame ? `/api/games/${currentGame.id}/message` : undefined,
    id: currentGame?.id,
    initialMessages: [],
    onResponse: async (response) => {
      setStreamingText("");
      const reader = response.body?.getReader();
      if (!reader) return;

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
              setStreamingText((prev: string) => prev + content);
            } catch (e) {
              console.error("Failed to parse chunk:", e);
            }
          }
        }
      }
    },
    onFinish: async (message: ChatMessage) => {
      setStreamingText("");
      if (currentGame) {
        const response = await fetch(`/api/games/${currentGame.id}`);
        const updatedGame = await response.json();
        setCurrentGame(updatedGame);
      }
    },
  });

  return (
    <>
      <div className="flex-1 border-2 border-white p-4 mb-4 min-h-[400px] bg-black overflow-y-auto">
        <div className="space-y-4">
          {chatMessages.map((message) => (
            <div
              key={message.id}
              className={`text-white ${
                message.role === "assistant" ? "opacity-80" : ""
              }`}
            >
              <span className="font-bold">
                {message.role === "assistant" ? "DM: " : "You: "}
              </span>
              <span className="whitespace-pre-wrap">{message.content}</span>
            </div>
          ))}
          {(isChatLoading || streamingText) && (
            <div className="text-white opacity-80">
              <span className="font-bold">DM: </span>
              <span className="whitespace-pre-wrap">
                {streamingText}
                {isChatLoading && <span className="animate-pulse">▋</span>}
              </span>
            </div>
          )}
        </div>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!chatInput.trim()) return;

          try {
            await handleChatSubmit(e);
          } catch (error) {
            console.error("Failed to send message:", error);
          }
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={chatInput}
          onChange={handleInputChange}
          className="flex-1 p-3 bg-black text-white border-2 border-white focus:border-blue-500 outline-none"
          placeholder="What would you like to do?"
          disabled={isChatLoading}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (chatInput.trim()) {
                handleChatSubmit(e);
              }
            }
          }}
        />
        <button
          type="submit"
          disabled={isChatLoading || !chatInput.trim()}
          className="px-6 py-3 bg-black text-white border-2 border-white hover:bg-white hover:text-black transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isChatLoading ? (
            <span className="animate-pulse">Thinking...</span>
          ) : (
            "Send"
          )}
        </button>
      </form>
    </>
  );
} 