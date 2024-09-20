import { Biome, Quest, Item, Monster, PlayerStats } from "./types";

export type WorldState = {
  // Maps to biomes
  map: string[][];
  biomes: Biome[];
  quests: Quest[];
  items: Item[];
  enemies: Monster[];
};

export type PlayerState = {
  stats: PlayerStats;
  name: string;
  questProgress: { [questId: string]: boolean };
  location: { x: number; y: number };
  inventory: Item[];
};

export type GameState = {
  state: "login" | "loading" | "main" | "error";
  world: WorldState;
  player: PlayerState;
};
