import { promises as fs } from "fs";
import path from "path";
import { GameState, GameSummary } from "@/types/game";

const GAMES_DIR = path.join(process.cwd(), "data/games");

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
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  static async updateGame(
    id: string,
    updates: Partial<GameState>
  ): Promise<GameState | null> {
    const game = await this.getGame(id);
    if (!game) return null;

    const updatedGame: GameState = {
      ...game,
      ...updates,
      id: game.id, // Ensure ID cannot be changed
      lastUpdatedAt: new Date().toISOString(),
    };

    await fs.writeFile(
      path.join(GAMES_DIR, `${id}.json`),
      JSON.stringify(updatedGame, null, 2)
    );

    return updatedGame;
  }

  static async deleteGame(id: string): Promise<boolean> {
    try {
      await fs.unlink(path.join(GAMES_DIR, `${id}.json`));
      return true;
    } catch (error) {
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
    } catch (error) {
      console.error("Failed to list games:", error);
      return [];
    }
  }
}
