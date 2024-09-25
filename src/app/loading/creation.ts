"use server";

import { Biome, Item, Monster } from "@/lib/types";
import { createObject } from "./llm";
import { z } from "zod";
import { randomInt } from "crypto";

interface CreatedBiome {
  name: string;
  description: string;
  dangerous: boolean;
  rarity: string;
}

export async function createBiomes(
  numberBiomes: number
): Promise<CreatedBiome[]> {
  const jsonSchema = z.object({
    name: z.string(),
    description: z.string(),
    dangerous: z.boolean(),
    rarity: z.string(),
  });
  const biomes: CreatedBiome[] = [];

  for (let index = 0; index < numberBiomes; index++) {
    biomes.push(
      (
        await createObject({
          messages: [
            {
              role: "system",
              content:
                "You are a expert Dungeon Master for a text based RPG. You are asked to create a world biomes. There should be biomes that are not dangerous where the player can rest. Ensure there are more dangerous biomes than not dangerous ones",
            },
            {
              role: "user",
              content: `Create a that fits a medival middle european fantasy setting.
The biome should have a name, description, rarity and danger level.
Biomes can range from mundane to fantastical.

The existing biomes are:
${biomes.map((b) => " - " + b.name).join("\n")}

Do not repeat existing biomes and ensure that the new biome could be placed next to the existing ones.`,
            },
          ],
          schema: jsonSchema,
        })
      ).object
    );
  }

  return biomes;
}

export async function createMonsters(
  biomeName: string,
  biomeDescription: string,
  numberMonsters: number
): Promise<Monster[]> {
  const itemSchema = z.object({
    name: z.string(),
    description: z.string(),
    damage: z.string(),
    dropRate: z.number(),
    requirements: z.object({
      strength: z.number(),
      dexterity: z.number(),
      intelligence: z.number(),
    }),
  });

  const monsterSchema = z.object({
    name: z.string(),
    description: z.string(),
    attacks: z.array(z.string()),
    health: z.number(),
    xp: z.number(),
    gold: z.number(),
    probability: z.number(),
  });

  const rawMonsters: Monster[] = [];

  for (let index = 0; index < numberMonsters; index++) {
    let existingMonsterNames = "";
    if (index > 1) {
      existingMonsterNames =
        "\nThe following monsters already exist in the biome:" +
        rawMonsters.map((m) => m.name).join(",");
    }

    const m = await createObject({
      messages: [
        {
          role: "system",
          content:
            "You are a expert Dungeon Master for a text based RPG. You are asked to create monsters for a biome. Assume that the player is level 1 - 10. Try to find a balance between strong and week monster, and have some be very strong and more attack focused and some be more weak.",
        },
        {
          role: "user",
          content:
            `Create a monster for a biome with name ${biomeName} and description ${biomeDescription}.
Create the monster with a set of attacks.
The probability of encountering the monster should be between 0 and 0.9.
The stronger the monster is the lower the probability of encountering it when being on a biome.` +
            existingMonsterNames,
        },
      ],
      schema: monsterSchema,
    });

    const nItems = randomInt(1, 4);
    const monsterStats = Object.entries(m)
      .map(([key, val]) => key + `:\t` + val.toString())
      .join("\n");

    const items: Item[] = [];
    for (let itemIndex = 0; itemIndex < nItems; itemIndex++) {
      let existingsItems = "";
      if (index > 1) {
        existingsItems =
          "\nThe following items already exist on the monster:" +
          items.map((m) => m.name).join(",");
      }

      const i = await createObject({
        messages: [
          {
            role: "system",
            content:
              "You are a expert Dungeon Master for a text based RPG. You are asked to create monsters for a biome. Assume that the player is level 1 - 10. Try to find a balance between strong and week monster, and have some be very strong and more attack focused and some be more weak.",
          },
          {
            role: "user",
            content:
              `Create an item that would be dropped by monster with the following properites ${monsterStats}
in the biome with name ${biomeName} - ${biomeDescription}.` + existingsItems,
          },
        ],
        schema: itemSchema,
      });

      items.push({ ...i.object, id: crypto.randomUUID() });
    }

    rawMonsters.push({ ...m.object, id: crypto.randomUUID(), items });
  }

  return rawMonsters;
}

export async function createMap(
  biomes: Biome[],
  dangerous: boolean[],
  rarity: string[],
  mapSize: number
): Promise<string[][]> {
  const jsonSchema = z.object({
    map: z.array(z.array(z.string())),
  });

  const response = await createObject({
    messages: [
      {
        role: "system",
        content:
          "You are a expert Dungeon Master for a text based RPG. You are asked to create a map for a world.",
      },
      {
        role: "user",
        content: `Create a map for a world with ${mapSize}x${mapSize} biomes. Give it as an array of array of biome names.
        The biomes are given with their name and description, if they are dangerous and how rare they are. Try to respect how rare they are.
        Try to have the transition on the map be logical

        Biomes:
        ${biomes
          .map(
            (biome, index) =>
              `Name ${biome.name}\nDescription ${biome.description}\nIs dangerous? ${dangerous[index]}\nRarity ${rarity[index]}`
          )
          .join("\n")}.`,
      },
    ],
    schema: jsonSchema,
  });

  return response.object.map;
}
