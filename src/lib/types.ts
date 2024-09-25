export type Biome = {
  id: string;
  name: string;
  description: string;
  enemies: Monster[];
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
};

export type PlayerStats = {
  level: number;
  health: number;
  magic: number;
  strength: number;
  dexterity: number;
  intelligence: number;
  luck: number;
};

export interface GameStateChange {
  actionCategory: "move" | "interact" | "ask" | "take" | "fight" | "craft";
  dmAnswer: string;
  reasoning: string[];
  locationChange?: {
    xRelativeChange?: number;
    yRelativeChange?: number;
  };
  questChange?: {
    questName: string;
    descriptionChange?: string;
    isCompleted?: boolean;
  };
  itemChange?: {
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
  };
  playerStatsChange?: {
    health?: number;
    magic?: number;
    strength?: number;
    dexterity?: number;
    intelligence?: number;
    luck?: number;
  };
}
