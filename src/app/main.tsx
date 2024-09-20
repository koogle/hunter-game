import { useContext } from "react";
import { GameStateContext } from "./context/game_state";
import { LoginScreen } from "@/components/login-screen";
import { MainScreen } from "@/components/main-screen";

export const Main = () => {
  const ctx = useContext(GameStateContext);

  if (ctx?.gameState.state === "login") {
    return <LoginScreen />;
  } else if (ctx?.gameState.state === "loading") {
    return <LoginScreen />;
  } else if (ctx?.gameState.state === "main") {
    return <MainScreen />;
  } else {
    return <div>Error</div>;
  }
};
