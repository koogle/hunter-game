"use client";

import { GameState } from "@/lib/state";
import { Monster } from "@/lib/types";
import { createBiomes, createMap, createMonsters } from "./creation";
import { randomInt } from "crypto";

export const setupWorld = async (
  baseGameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  cancel: AbortController,
  setMessage: (message: string) => void
) => {
  const gameState: GameState = { ...baseGameState };

  const numberOfBiomes = randomInt(3, 8);
  setMessage(`Creating ${numberOfBiomes} biomes...`);
  const rawBiomes = await createBiomes(numberOfBiomes);

  setMessage("Populating biomes...");

  await Promise.all(
    rawBiomes.map(
      async (biome: {
        name: string;
        description: string;
        dangerous: boolean;
      }) => {
        const numberOfMonsters = randomInt(1, 5);
        let monsters: Monster[] = [];
        if (biome.dangerous) {
          monsters = await createMonsters(
            biome.name,
            biome.description,
            numberOfMonsters
          );
        }
        console.log(monsters);

        gameState.world.biomes.push({
          id: crypto.randomUUID(),
          name: biome.name,
          description: biome.description,
          enemies: monsters,
          imageUrl: "",
        });
      }
    )
  );
  setMessage("Laying out the world...");
  const mapSize = 10;

  gameState.world.map = await createMap(
    gameState.world.biomes,
    rawBiomes.map((biome) => biome.dangerous),
    rawBiomes.map((biome) => biome.rarity),
    mapSize
  );
  setMessage("Ready, putting you in the game...");

  gameState.state = "main";
  gameState.player.location.x = 5;
  gameState.player.location.y = 5;

  setGameState({ ...gameState });
};
