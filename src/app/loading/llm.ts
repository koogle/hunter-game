"use server";

import { CoreMessage, generateObject, Schema } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { GameStateChange } from "@/lib/types";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

const model = openai("gpt-4o");

export async function createObject<OBJECT>({
  messages,
  schema,
  temperature = 0.1,
}: {
  messages: CoreMessage[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: z.Schema<OBJECT, z.ZodTypeDef, any> | Schema<OBJECT>;
  temperature?: number;
}) {
  return generateObject({
    temperature,
    model,
    schema,
    messages,
  });
}

export async function processCommand(
  formattedGameState: string,
  formattedInteractionHistory: string,
  userRequest: string
): Promise<GameStateChange> {
  const resp = await generateObject({
    model,
    schema: z.object({
      actionCategory: z.enum([
        "move",
        "interact",
        "ask",
        "itemInteraction",
        "fight",
        "craft",
        "other",
        "levelup",
      ]),
      dmAnswer: z.string(),
      monsterAction: z.string().optional(),
      reasoning: z.array(z.string()),
    }),
    messages: [
      {
        role: "system",
        content: `You are an expert dungeon master in a text based role playing game. The current state of the game is
${formattedGameState}

You are given an interaction by the user and you have to compute what is changing about the game and give the user a description of the change.
The user can move north, south, east, west.
The user can take items that are in the same biome as them.
The user can fight monsters that are in the same biome as them.
The user can interact with objects that are in the same biome as them.
The user can ask about the player stats.
The user can ask about the quests.
The user can ask about the items.
The user can ask about the biome they are in.
The user should not be able to get more health than their max health except for temporary one round very special occasions.
If the user is fighting a monster, then they can only take actions related to the fight. They cannot move to other biomes or move left or right.
If they are fighting a monster they can use their tools and interact with the monster.
The fight with the monster are turn based and you should emulate the monster behaviour with its different attacks and narrate the fight.
The monsters can flee or stay their ground.
The user can attempt to flee the monster. If they are successful in fleeing they will move from the biome to another biome and the fight is over.
If they are not successful in fleeing the monster will attack the user and the user takes damage.
If the user has lost all their health they are defeated and the game is over.
The user can ask questions at any time of the game without the story moving forward.
The monster will attack the user after the user's turn. Return both a response for the user action and the monster action.
If the user wins against a monster the monster drops loot, experience and potentially gold.
If the user earns enough experience they level up and their stats increase. The stats should increase based on their previous actions.

Ensure that the user does not perform illegal actions or breaks the game.
Be flexible to typos and other mispellings and assume the user is typing as fast as they can.
Mirror the tone of a magic the gathering cards.
Do not be patronizing and do not be too wordy.
If the user asks about what they can do give them a short list of actions they can take.`,
      },
      {
        role: "user",
        content: `The interaction history is:
${formattedInteractionHistory}`,
      },
      {
        role: "user",
        content: `The user request is: '${userRequest}'`,
      },
    ],
    experimental_telemetry: {
      isEnabled: true,
      metadata: {
        "x-request-id": "123",
      },
    },
  });

  console.log(resp.object);
  console.log(resp.object.actionCategory);

  const baseSchema = z.object({
    actionCategory: z.enum([
      "move",
      "interact",
      "ask",
      "itemInteraction",
      "fight",
      "craft",
      "other",
      "levelup",
    ]),
  });

  const moveSchema = baseSchema.extend({
    actionCategory: z.literal("move"),
    playerLocationChange: z.object({
      direction: z.enum([
        "north",
        "south",
        "east",
        "west",
        "southwest",
        "southeast",
        "northwest",
        "northeast",
      ]),
    }),
  });

  const interactSchema = baseSchema.extend({
    actionCategory: z.literal("interact"),
    questChange: z
      .object({
        questName: z.string().optional(),
        descriptionChange: z.string().optional(),
        isCompleted: z.boolean().optional(),
      })
      .optional(),
    itemChanges: z
      .array(
        z.object({
          itemAction: z.enum(["add", "remove", "change"]),
          itemName: z.string(),
          descriptionChange: z.string().optional(),
          dropRate: z.number().optional(),
          requirements: z
            .object({
              strength: z.number().optional(),
              dexterity: z.number().optional(),
              intelligence: z.number().optional(),
            })
            .optional(),
          damage: z.string().optional(),
        })
      )
      .optional(),
  });

  const itemInteractionSchema = baseSchema.extend({
    actionCategory: z.literal("itemInteraction"),
    itemChanges: z
      .array(
        z.object({
          itemAction: z.enum(["add", "remove", "change"]),
          itemName: z.string(),
          descriptionChange: z.string().optional(),
          dropRate: z.number().optional(),
          requirements: z
            .object({
              strength: z.number().optional(),
              dexterity: z.number().optional(),
              intelligence: z.number().optional(),
            })
            .optional(),
          damage: z.string().optional(),
        })
      )
      .optional(),
  });

  const fightSchema = baseSchema.extend({
    actionCategory: z.literal("fight"),
    playerStatsChange: z
      .object({
        health: z.number().optional(),
        luck: z.number().optional(),
        xp: z.number().optional(),
        hasDied: z.boolean().optional(),
        hasWon: z.boolean().optional(),
        gold: z.number().optional(),
      })
      .optional(),
    monsterChange: z
      .object({
        healthChange: z.number().optional(),
        isDefeated: z.boolean().optional(),
        hasUserFled: z.boolean().optional(),
      })
      .optional(),
  });

  const levelupSchema = baseSchema.extend({
    actionCategory: z.literal("levelup"),
    playerStatsChange: z.object({
      health: z.number().optional(),
      magic: z.number().optional(),
      strength: z.number().optional(),
      dexterity: z.number().optional(),
      intelligence: z.number().optional(),
      luck: z.number().optional(),
      level: z.number(),
      xp: z.number().optional(),
    }),
  });

  const otherSchema = baseSchema.extend({
    actionCategory: z.literal("other"),
    playerStatsChange: z
      .object({
        health: z.number().optional(),
        magic: z.number().optional(),
        strength: z.number().optional(),
        dexterity: z.number().optional(),
        intelligence: z.number().optional(),
        luck: z.number().optional(),
        level: z.number().optional(),
        xp: z.number().optional(),
      })
      .optional(),
    questChange: z
      .object({
        questName: z.string().optional(),
        descriptionChange: z.string().optional(),
        isCompleted: z.boolean().optional(),
      })
      .optional(),
    monsterChange: z
      .object({
        healthChange: z.number().optional(),
        isDefeated: z.boolean().optional(),
        hasUserFled: z.boolean().optional(),
      })
      .optional(),
    itemChanges: z
      .array(
        z.object({
          itemAction: z.enum(["add", "remove", "change"]),
          itemName: z.string(),
          descriptionChange: z.string().optional(),
          dropRate: z.number().optional(),
          requirements: z
            .object({
              strength: z.number().optional(),
              dexterity: z.number().optional(),
              intelligence: z.number().optional(),
            })
            .optional(),
          damage: z.string().optional(),
        })
      )
      .optional(),
  });

  const stateChangeSchema = z.discriminatedUnion("actionCategory", [
    moveSchema,
    interactSchema,
    itemInteractionSchema,
    fightSchema,
    levelupSchema,
    otherSchema,
  ]);

  const stateChangeResponse = await generateObject({
    model,
    schema: stateChangeSchema,
    messages: [
      {
        role: "system",
        content: `You are an expert dungeon master in a text based role playing game. The current state of the game is
\`\`\`
${formattedGameState}
\`\`\`

You are given an interaction by the user and the answer from a Dungeon Master and you are to compute the necessary changes to the game state.
For example,
 - if the user picks up or changes an item or even many items
 - if the user moves
 - if the user completes a quest
 - if the user levels up or their attributes change based on interaction with the world
 - if the user is fighting a monster and the monster is defeated
 - if the user is fighting a monster and the monster flees
 - if the user is fighting a monster and the monster is inflicting damage on the user or vice versa
 - if the user is fleeing a fight
`,
      },
      {
        role: "user",
        content: `The interaction history is:
${formattedInteractionHistory}`,
      },
      {
        role: "user",
        content: `The user request was: '${userRequest}'
The category of action the Dungeon Master chose was: '${resp.object.actionCategory}'
If the action is a move then only compute the move. If the user is fighting then only compute the fight.

If the user is crafting then only compute the crafting etc.

The Dungeon Master answer was: '${resp.object.dmAnswer}'

If the user is fighting a monster, then the monster action is: '${resp.object.monsterAction}'
`,
      },
    ],
    experimental_telemetry: {
      isEnabled: true,
      metadata: {
        "x-request-id": "123",
      },
    },
  });

  return {
    ...stateChangeResponse.object,
    actionCategory: resp.object.actionCategory,
    dmAnswer: resp.object.dmAnswer + (resp.object.monsterAction || ""),
  };
}
