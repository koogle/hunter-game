"use client";

import { useContext } from "react";
import { GameStateContext } from "./context/game_state";
import { LoginScreen } from "@/components/login-screen";
import { MainScreen } from "@/components/main-screen";
import { ErrorScreen } from "@/components/error-screen";
import { LoadingScreen } from "@/components/loading-screen";
import { YouHaveDiedComponent } from "@/components/you-have-died";
import { YouHaveWonComponent } from "@/components/you-have-won";

export const Main = () => {
  const ctx = useContext(GameStateContext);

  if (ctx?.gameState.state === "login" || ctx?.gameState.state == null) {
    return <LoginScreen />;
  } else if (ctx?.gameState.state === "loading") {
    return <LoadingScreen />;
  } else if (ctx?.gameState.state === "main") {
    return <MainScreen />;
  } else if (ctx?.gameState.state === "died") {
    return (
      <YouHaveDiedComponent
        onRestart={() => {
          ctx?.setGameState({
            ...ctx.gameState,
            state: "main",
          });
        }}
        onMainMenu={() => {
          ctx?.setGameState({
            ...ctx.gameState,
            state: "login",
          });
        }}
      />
    );
  } else if (ctx?.gameState.state === "won") {
    return (
      <YouHaveWonComponent
        onPlayAgain={() => {
          ctx?.setGameState({
            ...ctx.gameState,
            state: "main",
          });
        }}
        onMainMenu={() => {
          ctx?.setGameState({
            ...ctx.gameState,
            state: "login",
          });
        }}
      />
    );
  } else {
    return <ErrorScreen message={`Unknown state ${ctx?.gameState.state}`} />;
  }
};
