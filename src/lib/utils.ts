import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import * as yaml from "js-yaml";
import { GameState } from "./state";
import { GameStateChange } from "./types";

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

export function processGameStateChange(
  gameStateChange: GameStateChange,
  gameState: GameState,
  setGameState: (gameState: GameState) => void
) {
  const state = { ...gameState };

  if (gameStateChange.itemChange != null) {
    switch (gameStateChange.itemChange.itemAction) {
      case "add":
        state.player.inventory.push({
          id: crypto.randomUUID(),
          name: gameStateChange.itemChange.itemName,
          description: gameStateChange.itemChange.descriptionChange ?? "",
          dropRate: gameStateChange.itemChange.dropRate ?? 0,
          requirements: {
            strength: gameStateChange.itemChange.requirements?.strength ?? 0,
            dexterity: gameStateChange.itemChange.requirements?.dexterity ?? 0,
            intelligence:
              gameStateChange.itemChange.requirements?.intelligence ?? 0,
          },
          damage: gameStateChange.itemChange.damage ?? "",
        });
        break;
      case "remove":
        state.player.inventory = state.player.inventory.filter(
          (item) => item.name !== gameStateChange.itemChange?.itemName
        );
        break;
      case "change":
        state.player.inventory = state.player.inventory.map((item) => {
          if (item.name === gameStateChange.itemChange?.itemName) {
            return {
              ...item,
              description:
                gameStateChange.itemChange.descriptionChange ??
                item.description,
              dropRate: gameStateChange.itemChange.dropRate ?? item.dropRate,
              requirements: {
                strength:
                  gameStateChange.itemChange.requirements?.strength ??
                  item.requirements.strength,
                dexterity:
                  gameStateChange.itemChange.requirements?.dexterity ??
                  item.requirements.dexterity,
                intelligence:
                  gameStateChange.itemChange.requirements?.intelligence ??
                  item.requirements.intelligence,
              },
              damage: gameStateChange.itemChange.damage ?? item.damage,
            };
          }
          return item;
        });
        break;
    }
  }

  const questChange = gameStateChange.questChange;
  if (questChange != null) {
    const quest = state.world.quests.find(
      (q) => q.name === questChange.questName
    );
    if (quest != null) {
      state.player.questProgress[quest.id] = questChange.isCompleted ?? false;

      quest.isCompleted = questChange.isCompleted ?? false;
      quest.description = questChange.descriptionChange ?? quest.description;
    }
  }

  if (gameStateChange.locationChange != null) {
    state.player.location.x = Math.min(
      Math.max(
        0,
        state.player.location.x +
          (gameStateChange.locationChange.xRelativeChange ?? 0)
      ),
      state.world.map.length - 1
    );
    state.player.location.y = Math.min(
      Math.max(
        0,
        state.player.location.y +
          (gameStateChange.locationChange.yRelativeChange ?? 0)
      ),
      state.world.map[0].length - 1
    );
  }

  if (gameStateChange.playerStatsChange != null) {
    state.player.stats = {
      ...state.player.stats,
      ...gameStateChange.playerStatsChange,
    };
  }

  setGameState(state);
}
