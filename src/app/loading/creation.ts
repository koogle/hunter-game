"use server";

import { Biome, Monster } from "@/lib/types";
import { createObject } from "./llm";
import { z } from "zod";

interface CreatedBiome {
  name: string;
  description: string;
  dangerous: boolean;
  rarity: string;
}

export async function createBiomes(): Promise<CreatedBiome[]> {
  const jsonSchema = z.object({
    biomes: z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        dangerous: z.boolean(),
        rarity: z.string(),
      })
    ),
  });

  const biomes = await createObject({
    messages: [
      {
        role: "system",
        content:
          "You are a expert Dungeon Master for a text based RPG. You are asked to create a world biomes. There should be biomes that are not dangerous where the player can rest.",
      },
      {
        role: "user",
        content:
          "Create up to 10 biomes that fit a medival middle european fantasy setting. The biomes should have a name, description, rarity and danger level. There should be some biomes that are simple such as forests and some that are more intriguing such as an abonded church or a graveyard.",
      },
    ],
    schema: jsonSchema,
  });
  return biomes.object.biomes;
}

export async function createMonsters(
  biomeName: string,
  biomeDescription: string
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

  const jsonSchema = z.object({
    monsters: z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        attacks: z.array(z.string()),
        items: z.array(itemSchema),
        health: z.number(),
        xp: z.number(),
        gold: z.number(),
        probability: z.number(),
      })
    ),
  });

  const response = await createObject({
    messages: [
      {
        role: "system",
        content:
          "You are a expert Dungeon Master for a text based RPG. You are asked to create monsters for a biome. Assume that the player is level 1 - 10. Try to find a balance between strong and week monster, and have some be very strong and more attack focused and some be more weak.",
      },
      {
        role: "user",
        content: `Create up to 3-5 enemies for the biome with name ${biomeName} and description ${biomeDescription}. Create also items the enemies can drop and a description of attacks they can use.`,
      },
    ],
    schema: jsonSchema,
  });

  return response.object.monsters.map((m) => ({
    ...m,
    id: crypto.randomUUID(),
    items: m.items.map((i) => ({
      ...i,
      id: crypto.randomUUID(),
    })),
  }));
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
  console.log("created map", response.object.map);
  return response.object.map;
}
