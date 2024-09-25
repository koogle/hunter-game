"use client";

import { GameState } from "@/lib/state";
import { Monster } from "@/lib/types";
import { createBiomes, createMonsters } from "./creation";

function randomInt(min: number, max: number) {
  return min + Math.round(Math.random() * (max - min));
}

export const setupWorld = async (
  baseGameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  cancel: AbortController,
  setMessage: (message: string) => void
) => {
  const gameState: GameState = { ...baseGameState };

  const numberOfBiomes = randomInt(5, 12);
  setMessage(`Creating ${numberOfBiomes} biomes...`);
  const rawBiomes = await createBiomes(numberOfBiomes);

  setMessage("Populating biomes...");

  await Promise.all(
    (rawBiomes || []).map(
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
        console.log(biome.name, monsters);

        gameState.world.biomes.push({
          id: crypto.randomUUID(),
          name: biome.name,
          description: biome.description,
          monsters: monsters,
          imageUrl: "",
        });
      }
    )
  );

  setMessage("Laying out the world...");
  const mapSize = 10;

  gameState.world.map = []; /* await createMap(
    gameState.world.biomes,
    gameState.world.biomes.map((biome) => biome.monsters.length > 0),
    gameState.world.biomes.map((biome) => biome.name),
    mapSize
  );
  */
  for (let rowIndex = 0; rowIndex < mapSize; rowIndex++) {
    const row: string[] = [];

    for (let colIndex = 0; colIndex < mapSize; colIndex++) {
      row.push(
        gameState.world.biomes[
          Math.floor(Math.random() * gameState.world.biomes.length)
        ].id
      );
    }
    gameState.world.map.push(row);
  }

  setMessage("Ready, putting you in the game...");

  gameState.state = "main";
  gameState.player.location.x = 5;
  gameState.player.location.y = 5;

  setGameState({ ...gameState });
};
