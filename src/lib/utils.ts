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

  const surroundingBiomes = [
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ];

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue; // Skip the current location

      const newX = x + dx;
      const newY = y + dy;

      // Check if the new coordinates are within the map boundaries
      if (newX >= 0 && newX < mapWidth && newY >= 0 && newY < mapHeight) {
        surroundingBiomes[dy + 1][dx + 1] = state.world.map[newX][newY];
      }
    }
  }

  const formattedSurroundingBiomes = `
            N
     ${surroundingBiomes[0][0] || " "} | ${surroundingBiomes[0][1] || " "} | ${
    surroundingBiomes[0][2] || " "
  }
W  ${surroundingBiomes[1][0] || " "} | ${surroundingBiomes[1][1] || " "} | ${
    surroundingBiomes[1][2] || " "
  }  E
     ${surroundingBiomes[2][0] || " "} | ${surroundingBiomes[2][1] || " "} | ${
    surroundingBiomes[2][2] || " "
  }
            S
  `;

  return `
The player state is
${JSON.stringify(state.player)}

The current biome is
${JSON.stringify(currentBiome)}

The map of biomes looks like 
${formattedSurroundingBiomes}

with the player in the center.

The quests are
${JSON.stringify(state.world.quests)}
`;
}
