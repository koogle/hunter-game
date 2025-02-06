export type GameState = {
  id: string;
  name: string;
  scenario: string;
  customScenario?: string;
  messages: string[];
  createdAt: string;
  lastUpdatedAt: string;
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
