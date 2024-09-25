import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import * as yaml from "js-yaml";
import { GameState } from "./state";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatGameState(state: GameState) {
  const biome = state.world.biomes.find(
    (b) =>
      b.id === state.world.map[state.player.location.y][state.player.location.x]
  );

  const playerX = state.player.location.x;
  const playerY = state.player.location.y;

  const surroundingBiomes = [
    [
      state.world.map[playerY - 1]?.[playerX - 1],
      state.world.map[playerY - 1]?.[playerX],
      state.world.map[playerY - 1]?.[playerX + 1],
    ],
    [
      state.world.map[playerY]?.[playerX - 1],
      "<Player>",
      state.world.map[playerY]?.[playerX + 1],
    ],
    [
      state.world.map[playerY + 1]?.[playerX - 1],
      state.world.map[playerY + 1]?.[playerX],
      state.world.map[playerY + 1]?.[playerX + 1],
    ],
  ];

  const biomes = surroundingBiomes.map((biome) => {
    return biome.map((b) => {
      if (b === "<Player>") {
        return "<Player>";
      }
      return (
        state.world.biomes.find((biome) => biome.id === b)?.name ??
        "<< Unavailable >>"
      );
    });
  });

  const gameState = `
The player state is ${yaml.dump(state.player)}
The coordinates of the player are X:${state.player.location.x} Y:${
    state.player.location.y
  }
The X coordinate is for West to East movement
and Y is for North to South movement

The map around the player is:
        N
  ${biomes[0].join("\t\t|\t\t")}
W ${biomes[1].join("\t\t|\t\t")} E
  ${biomes[2].join("\t\t|\t\t")}
        S   

The player is currently in the ${yaml.dump(
    biome?.name
  )} biome with the description
${biome?.description}
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
