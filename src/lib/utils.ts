import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { GameState } from "./state";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatGameState(state: GameState) {
  const currentBiome =
    state.world.map[state.player.location.x][state.player.location.y];

  const mapWidth = state.world.map.length;
  const mapHeight = state.world.map[0].length;
  const { x, y } = state.player.location;

  const surroundingBiomes = [];

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue; // Skip the current location

      const newX = x + dx;
      const newY = y + dy;

      // Check if the new coordinates are within the map boundaries
      if (newX >= 0 && newX < mapWidth && newY >= 0 && newY < mapHeight) {
        surroundingBiomes.push(
          state.world.biomes.find(
            (biome) => biome.name === state.world.map[newX][newY]
          )
        );
      }
    }
  }

  return `
The player state is
${JSON.stringify(state.player)}

The current biome is
${JSON.stringify(currentBiome)}

The surrounding biomes are
${JSON.stringify(surroundingBiomes)}

The quests are
${JSON.stringify(state.world.quests)}
`;
}
