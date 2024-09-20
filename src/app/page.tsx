import { GameStateProvider } from "./context/game_state";
import { Main } from "./main";

export default function Page() {
  return (
    <GameStateProvider>
      <main className="h-full w-full items-center">
        <Main />
      </main>
    </GameStateProvider>
  );
}
