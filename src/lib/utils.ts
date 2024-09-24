import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import * as yaml from "js-yaml";
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
      const newX = x + dx;
      const newY = y + dy;
      const biomeId = state.world.map[newX][newY];
      const biome = state.world.biomes.find((b) => b.id === biomeId);
      // Check if the new coordinates are within the map boundaries
      if (
        newX >= 0 &&
        newX < mapWidth &&
        newY >= 0 &&
        newY < mapHeight &&
        biome != null
      ) {
        surroundingBiomes[dy + 1][dx + 1] = biome.name;
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

  const gameState = `
The player state is
${yaml.dump(state.player)}

The current biome is
${yaml.dump(currentBiome)}

The biomes around the player looks like this, with the player in the center:
${formattedSurroundingBiomes}

The quests are
${yaml.dump(state.world.quests)}
`;
  console.log(gameState);
  return gameState;
}

export function formatInteractionHistory(
  interactionHistory: { userRequest: string; dmResponse: string }[]
) {
  return interactionHistory
    .map(
      (interaction) =>
        `User: ${interaction.userRequest}\nDM: ${interaction.dmResponse}`
    )
    .join("\n");
}
