import { Biome, Quest, Item, PlayerStats, Monster } from "./types";

export type WorldState = {
  // Maps to biomes
  map: string[][];
  biomes: Biome[];
  quests: Quest[];
  items: Item[];
  currentMonster?: Monster;
};

export type PlayerState = {
  stats: PlayerStats;
  name: string;
  questProgress: { [questId: string]: boolean };
  location: { x: number; y: number };
  inventory: Item[];
};

export type GameState = {
  state: "login" | "loading" | "main" | "error" | "died" | "won";
  background: string;
  historic_messages: string[];

  world: WorldState;
  player: PlayerState;
  scenario: string;
};
