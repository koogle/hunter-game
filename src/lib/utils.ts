import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { GameState } from "./state";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatGameState(state: GameState) {
  return `
The player state is:
${JSON.stringify(state.player)}


`;
}
