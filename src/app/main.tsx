"use client";

import { useContext } from "react";
import { GameStateContext } from "./context/game_state";
import { LoginScreen } from "@/components/login-screen";
import { MainScreen } from "@/components/main-screen";
import { ErrorScreenComponent } from "@/components/error-screen";

export const Main = () => {
  const ctx = useContext(GameStateContext);

  if (ctx?.gameState.state === "login" || ctx?.gameState.state == null) {
    return <LoginScreen />;
  } else if (ctx?.gameState.state === "loading") {
    return <LoginScreen />;
  } else if (ctx?.gameState.state === "main") {
    return <MainScreen />;
  } else {
    return (
      <ErrorScreenComponent message={`Unknown state ${ctx?.gameState.state}`} />
    );
  }
};
