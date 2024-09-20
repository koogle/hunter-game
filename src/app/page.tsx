"use client";

import { LoginScreen } from "@/components/login-screen";
import { GameStateProvider } from "./context/game_state";
// import ApiKeyToggle from "./components/ApiKeyToggle";

export default function Home() {
  return (
    <GameStateProvider>
      <main className="h-full w-full items-center">
        <LoginScreen />
      </main>
    </GameStateProvider>
  );
}
