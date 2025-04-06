export type GameMessage = {
  role: "user" | "assistant";
  content: string;
};

export type GameState = {
  id: string;
  name: string;
  scenario: string;
  customScenario?: string;
  messages: GameMessage[];
  createdAt: string;
  lastUpdatedAt: string;
  stats: {
    health: number;
    mana: number;
    experience: number;
    strength: number;
    dexterity: number;
    intelligence: number;
    luck: number;
  };
  playerNotes: string;
  inventory: {
    name: string;
    quantity: number;
    description?: string;
    requirements?: {
      strength?: number;
      dexterity?: number;
      intelligence?: number;
      luck?: number;
    };
  }[];
};

export type GameSummary = {
  id: string;
  name: string;
  scenario: string;
  lastUpdatedAt: string;
};

export type MessageResponse = {
  message: string;
  game: GameState;
};
