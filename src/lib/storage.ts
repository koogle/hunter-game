import { promises as fs } from "fs";
import path from "path";
import { GameState, GameSummary } from "@/types/game";

const GAMES_DIR = path.join(process.cwd(), "data/games");


export const DEFAULT_STATS = {
  health: 100,
  mana: 100,
  experience: 0,
  strength: 5,
  intelligence: 5,
  dexterity: 5,
  luck: 1,
};


export function normalizeGameState(gameState: GameState): GameState {
  if (!gameState) return gameState;

  // Clone the game state to avoid mutations
  const normalizedState = { ...gameState };

  // Initialize stats with defaults if missing
  if (!normalizedState.stats) {
    normalizedState.stats = { ...DEFAULT_STATS };
  } else {
    // Ensure all stats exist with at least 0 value
    normalizedState.stats = {
      health: normalizedState.stats.health ?? DEFAULT_STATS.health,
      mana: normalizedState.stats.mana ?? DEFAULT_STATS.mana,
      experience: normalizedState.stats.experience ?? DEFAULT_STATS.experience,
      strength: normalizedState.stats.strength ?? DEFAULT_STATS.strength,
      intelligence: normalizedState.stats.intelligence ?? DEFAULT_STATS.intelligence,
      dexterity: normalizedState.stats.dexterity ?? DEFAULT_STATS.dexterity,
      luck: normalizedState.stats.luck ?? DEFAULT_STATS.luck,
    };
  }

  // Initialize inventory if missing
  if (!normalizedState.inventory || !Array.isArray(normalizedState.inventory)) {
    normalizedState.inventory = [];
  }

  // Initialize playerNotes if missing
  if (normalizedState.playerNotes == null) {
    normalizedState.playerNotes = "";
  }

  return normalizedState;
}

export class GameStorage {
  static async init() {
    try {
      await fs.mkdir(GAMES_DIR, { recursive: true });
    } catch (error) {
      console.error("Failed to initialize game storage:", error);
    }
  }

  static async createGame(
    gameState: Omit<GameState, "id" | "createdAt" | "lastUpdatedAt">
  ): Promise<GameState> {
    await this.init();

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const game: GameState = {
      ...gameState,
      id,
      createdAt: now,
      lastUpdatedAt: now,
    };

    await fs.writeFile(
      path.join(GAMES_DIR, `${id}.json`),
      JSON.stringify(game, null, 2)
    );

    return game;
  }

  static async getGame(id: string): Promise<GameState | null> {
    try {
      const content = await fs.readFile(
        path.join(GAMES_DIR, `${id}.json`),
        "utf-8"
      );
      const gameState = JSON.parse(content);
      return normalizeGameState(gameState);
    } catch {
      return null;
    }
  }

  static async updateGame(
    id: string,
    updates: Partial<GameState>
  ): Promise<GameState | null> {
    const game = await this.getGame(id);
    if (!game) return null;

    // Ensure messages are properly merged and not overwritten
    let mergedMessages = game.messages || [];
    if (updates.messages) {
      // If updates contain messages, merge them with existing messages
      // This ensures we don't lose message history
      mergedMessages = updates.messages;
    }

    const updatedGame: GameState = normalizeGameState({
      ...game,
      ...updates,
      messages: mergedMessages, // Use the merged messages
      id: game.id, // Ensure ID cannot be changed
      lastUpdatedAt: new Date().toISOString(),
    });

    // Save the game state to disk
    try {
      await fs.writeFile(
        path.join(GAMES_DIR, `${id}.json`),
        JSON.stringify(updatedGame, null, 2)
      );
      console.log(`[Storage] Game ${id} updated successfully`);
    } catch (error) {
      console.error(`[Storage] Error updating game ${id}:`, error);
      throw error;
    }

    return updatedGame;
  }

  static async deleteGame(id: string): Promise<boolean> {
    try {
      await fs.unlink(path.join(GAMES_DIR, `${id}.json`));
      return true;
    } catch {
      return false;
    }
  }

  static async listGames(): Promise<GameSummary[]> {
    await this.init();

    try {
      const files = await fs.readdir(GAMES_DIR);
      const games = await Promise.all(
        files
          .filter((file) => file.endsWith(".json"))
          .map(async (file) => {
            const content = await fs.readFile(
              path.join(GAMES_DIR, file),
              "utf-8"
            );
            const game: GameState = JSON.parse(content);
            return {
              id: game.id,
              name: game.name,
              scenario: game.customScenario || game.scenario,
              lastUpdatedAt: game.lastUpdatedAt,
            };
          })
      );

      return games.sort(
        (a, b) =>
          new Date(b.lastUpdatedAt).getTime() -
          new Date(a.lastUpdatedAt).getTime()
      );
    } catch {
      console.error("Failed to list games:");
      return [];
    }
  }
}
