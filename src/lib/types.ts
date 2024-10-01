export type Biome = {
  id: string;
  name: string;
  description: string;
  monsters: Monster[];
  imageUrl?: string;
};

export type Quest = {
  id: string;
  name: string;
  description: string;
  isCompleted: boolean;
};

export type Item = {
  id: string;
  name: string;
  description: string;
  dropRate: number;
  requirements: {
    strength: number;
    dexterity: number;
    intelligence: number;
  };
  damage: string;
};

export type Monster = {
  id: string;
  name: string;
  description: string;
  health: number;
  attacks: string[];
  xp: number;
  gold: number;
  items: Item[];
  probability: number;
  imageUrl?: string;
};

export type PlayerStats = {
  level: number;
  health: number;
  maxHealth: number;
  magic: number;
  strength: number;
  dexterity: number;
  intelligence: number;
  luck: number;
  xp: number;
  gold: number;
};

export interface GameStateChange {
  actionCategory: "move" | "interact" | "ask" | "take" | "fight" | "craft";
  dmAnswer: string;
  playerLocationChange?: {
    direction?:
      | "north"
      | "south"
      | "east"
      | "west"
      | "southwest"
      | "southeast"
      | "northwest"
      | "northeast";
  };
  questChange?: {
    questName?: string;
    descriptionChange?: string;
    isCompleted?: boolean;
  };
  monsterChange?: {
    healthChange?: number;
    isDefeated?: boolean;
  };
  itemChanges?: {
    itemAction?: "add" | "remove" | "change";
    itemName: string;
    descriptionChange?: string;
    dropRate?: number;
    requirements?: {
      strength?: number;
      dexterity?: number;
      intelligence?: number;
    };
    damage?: string;
  }[];

  playerStatsChange?: {
    health?: number;
    maxHealth?: number;
    level?: number;
    magic?: number;
    gold?: number;
    strength?: number;
    dexterity?: number;
    intelligence?: number;
    luck?: number;
    xp?: number;
    hasDied?: boolean;
    hasWon?: boolean;
  };
}
