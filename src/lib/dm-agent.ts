import { GameState } from "@/types/game";
import { z } from 'zod';
import OpenAI from "openai";
import OpenAIService from "./openai-service";

// Types for DM's internal state
export interface DMNotes {
  worldState: string;
  hiddenObjectives: string[];
  activeQuests: {
    id: string;
    name: string;
    description: string;
    objective: string;
    status: "active" | "completed" | "failed";
  }[];
  playerAssessment: string;
  keyLocations: { [key: string]: string };
  keyCharacters: { [key: string]: string };
  plotHooks: string[];
}

const SMALL_MODEL = 'o4-mini-2025-04-16';
const BIG_MODEL = 'gpt-4.1-2025-04-14';


// Types for structured output from the DM
export type SkillDifficulty = "easy" | "somewhat easy" | "medium" | "hard" | "very hard" | "extremely hard";

export interface SkillCheckRequest {
  required: boolean;
  stat: 'strength' | 'dexterity' | 'intelligence' | 'luck' | null;
  difficultyCategory: SkillDifficulty | null;
  reason: string | null;
}

export interface SkillCheckResult {
  performed: boolean;
  stat?: 'strength' | 'dexterity' | 'intelligence' | 'luck' | null;
  roll?: number;
  statValue?: number;
  difficulty?: number;
  total?: number;
  success?: boolean;
  degree?: number;
  reason?: string;
}

export interface DMResponse {
  message: string;
  stateChanges: {
    inventoryChanges?: {
      add?: { name: string; quantity: number; description?: string }[];
      remove?: { name: string; quantity: number }[];
    };
    statChanges?: {
      health?: number;
      mana?: number;
      experience?: number;
      strength?: number;
      dexterity?: number;
      intelligence?: number;
      luck?: number;
    };
    questUpdates?: {
      questId?: string;
      status?: "active" | "completed" | "failed";
    }[];
    dmNotesUpdates?: Partial<DMNotes>;
  };
  shortAnswer: string;
}


export class DungeonMaster {
  private notes: DMNotes;

  constructor(gameState: GameState) {
    // Initialize DM notes based on the game scenario
    this.notes = this.initializeNotes(gameState);
  }

  /**
   * Run both validity and skill check in parallel, but only await skill check if valid.
   * Returns: { valid, reason, skillCheck }
   */
  public async precheckAction(
    action: string,
    gameState: GameState,
    openaiService: OpenAIService
  ): Promise<{ valid: boolean; reason: string | null; skillCheck: SkillCheckRequest | null }> {
    const validityPromise = this.isValidAction(action, gameState, openaiService);
    const skillCheckPromise = this.getSkillCheckRequest(action, gameState, openaiService);
    const validity = await validityPromise;
    let skillCheck: SkillCheckRequest | null = null;
    if (validity.valid) {
      skillCheck = await skillCheckPromise;
    }
    return { valid: validity.valid, reason: validity.reason, skillCheck };
  }

  public async isValidAction(
    action: string,
    gameState: GameState,
    openaiService: OpenAIService
  ): Promise<{ valid: boolean; reason: string | null }> {
    console.log("[DM] isValidAction called", { action, gameState });
    const schema = z.object({
      valid: z.boolean(),
      reason: z.union([z.string(), z.null()])
    });
    const prompt = `Given the following player action: "${action}", and the current RPG game state: ${JSON.stringify(gameState)}, judge if this is a valid in-character action for a text adventure RPG. Do not allow meta-questions, out-of-character, or game-breaking actions.`;
    const messages = [
      { role: 'system', content: 'You are an expert RPG game master.' },
      { role: 'user', content: prompt }
    ];
    console.log("[DM] isValidAction prompt", prompt);
    const response = await openaiService.createStructuredChatCompletion(messages, schema, { model: SMALL_MODEL, temperature: 0 });
    console.log("[DM] isValidAction response", response);
    return { valid: response.valid === true, reason: response.reason ?? null };
  }

  public async getSkillCheckRequest(
    action: string,
    gameState: GameState,
    openaiService: OpenAIService
  ): Promise<SkillCheckRequest> {
    console.log("[DM] getSkillCheckRequest called", { action, gameState });
    const schema = z.object({
      required: z.boolean(),
      stat: z.union([z.enum(['strength', 'dexterity', 'intelligence', 'luck']), z.null()]),
      difficultyCategory: z.union([
        z.enum(["easy", "somewhat easy", "medium", "hard", "very hard", "extremely hard"]),
        z.null()
      ]),
      reason: z.union([z.string(), z.null()])
    });
    const prompt = `Given the following player action: "${action}", and the available stats: strength, dexterity, intelligence, luck, decide if a skill check is required. Only suggest a skill check if it makes sense in context. If so, pick the most appropriate stat and a difficulty category from: easy, somewhat easy, medium, hard, very hard, extremely hard.`;
    const messages = [
      { role: 'system', content: 'You are an expert RPG game master.' },
      { role: 'user', content: prompt }
    ];
    console.log("[DM] getSkillCheckRequest prompt", prompt);
    const response = await openaiService.createStructuredChatCompletion(messages, schema, { model: SMALL_MODEL, temperature: 0 });
    console.log("[DM] getSkillCheckRequest response", response);
    return response;
  }

  // Step 3: Perform the skill check
  public performSkillCheck(
    stat: 'strength' | 'dexterity' | 'intelligence' | 'luck',
    difficultyCategory: SkillDifficulty,
    gameState: GameState
  ): SkillCheckResult {
    console.log("[DM] performSkillCheck called", { stat, difficultyCategory, gameState });
    const statValue = gameState.stats[stat];
    const roll = Math.ceil(Math.random() * 12);
    // Map difficulty category to a numeric offset
    const base = 8; // average check
    const categoryOffsets: Record<SkillDifficulty, number> = {
      easy: -3,
      "somewhat easy": -1,
      medium: 0,
      hard: 2,
      "very hard": 4,
      "extremely hard": 6
    };
    const difficulty = base + categoryOffsets[difficultyCategory];
    const total = statValue + roll;
    // Never guarantee success/failure, always possible to roll a 1 or 12
    const success = total >= difficulty;
    const degree = total - difficulty;
    const result = {
      performed: true,
      stat,
      roll,
      statValue,
      difficultyCategory,
      difficulty,
      total,
      success,
      degree
    };
    console.log("[DM] performSkillCheck result", result);
    return result;
  }

  // Step 4: LLM generates DM's internal monologue and player-facing response
  public async getResponse(
    action: string,
    gameState: GameState,
    skillCheckResult: SkillCheckResult | null,
    openaiService: OpenAIService
  ): Promise<string> {
    console.log("[DM] getMonologueAndResponse called", { action, gameState, skillCheckResult });
    let prompt = `Player action: "${action}"\n`;
    if (skillCheckResult && skillCheckResult.performed) {
      prompt += `Skill check performed: ${skillCheckResult.stat} (value: ${skillCheckResult.statValue}) + d12 roll (${skillCheckResult.roll}) vs difficulty ${skillCheckResult.difficulty}. Result: ${skillCheckResult.success ? 'Success' : 'Failure'} (degree: ${skillCheckResult.degree}).\n`;
    }
    prompt += `Game state: ${JSON.stringify(gameState)}\nDM Notes: ${JSON.stringify(this.notes)}\n\nPlease do the following:\n1. Write the DM's internal monologue (thoughts, reasoning, world logic, NPC motivations, etc.) about what happens next, based on the action, game state, and DM notes.\n2. Then, write the DM's response to the player (what the player hears or sees).\n\nFormat your output as JSON with two fields: { "monologue": string, "response": string }`;
    const messages = [
      { role: 'system', content: 'You are a creative RPG game master.' },
      { role: 'user', content: prompt }
    ];
    console.log("[DM] getMonologueAndResponse prompt", prompt);
    const schema = z.object({
      monologue: z.string(),
      response: z.string()
    });
    const result = await openaiService.createStructuredChatCompletion(messages, schema, { model: BIG_MODEL, temperature: 0.5 });
    console.log("[DM] getMonologueAndResponse response", result);
    return result.response;
  }

  // Step 5: LLM parses for state changes and short answer
  public async getDiffAndShortAnswer(
    longAnswer: string,
    gameState: GameState,
    openaiService: OpenAIService
  ): Promise<DMResponse> {
    console.log("[DM] getDiffAndShortAnswer called", { longAnswer, gameState });

    const stats = ["health", "mana", "experience", "strength", "dexterity", "intelligence", "luck"] as const;
    const statChanges: Record<string, number> = {};

    // Helper to ask if a stat should change
    const shouldChangeStat = async (stat: string) => {
      const prompt = `Given this DM narrative:\n${longAnswer}\n\nShould the player's ${stat} change as a result of this action? Answer "yes" or "no" only.`;
      const schema = z.object({ change: z.enum(["yes", "no"]) });
      const messages = [
        { role: 'system', content: 'You are a precise RPG game master.' },
        { role: 'user', content: prompt }
      ];
      const res = await openaiService.createStructuredChatCompletion(messages, schema, { model: SMALL_MODEL, temperature: 0 });
      return res.change === "yes";
    };

    // Helper to get the new value for a stat
    const getStatChange = async (stat: string) => {
      const prompt = `Given this DM narrative:\n${longAnswer}\n\nWhat should the player's ${stat} be after this action? Return an integer between 0 and 100. Do not exceed these bounds.`;
      const schema = z.object({ value: z.number().int() });
      const messages = [
        { role: 'system', content: 'You are a precise RPG game master.' },
        { role: 'user', content: prompt }
      ];
      const res = await openaiService.createStructuredChatCompletion(messages, schema, { model: SMALL_MODEL, temperature: 0 });
      return res.value;
    };

    // Parallel check for all stats
    const statChangeChecks = stats.map(async (stat) => {
      if (await shouldChangeStat(stat)) {
        const newValue = await getStatChange(stat);
        statChanges[stat] = newValue;
      }
    });

    // Inventory: ask if it should change
    let inventoryChanges: {
      action: "add" | "remove";
      name: string;
      quantity: number;
      description?: string | undefined;
    }[] | null = null;
    const shouldChangeInventory = async () => {
      const prompt = `Given this DM narrative:\n${longAnswer}\n\nShould the player's inventory change as a result of this action? Answer "yes" or "no" only.`;
      const schema = z.object({ change: z.enum(["yes", "no"]) });
      const messages = [
        { role: 'system', content: 'You are a precise RPG game master.' },
        { role: 'user', content: prompt }
      ];
      const res = await openaiService.createStructuredChatCompletion(messages, schema, { model: SMALL_MODEL, temperature: 0 });
      return res.change === "yes";
    };

    const getInventoryChange = async () => {
      const prompt = `Given this DM narrative:\n${longAnswer}\n\nDescribe the inventory changes (add/remove) as a JSON array of objects with { action: "add"|"remove", name: string, quantity: number (this has to be minimum 1 but should reflect the added or removed number of items), description?: string }.`;
      const schema = z.object({
        changes: z.array(z.object({
          action: z.enum(["add", "remove"]),
          name: z.string(),
          quantity: z.number().int(),
          description: z.string().optional()
        }))
      });
      const messages = [
        { role: 'system', content: 'You are a precise RPG game master.' },
        { role: 'user', content: prompt }
      ];
      const res = await openaiService.createStructuredChatCompletion(messages, schema, { model: SMALL_MODEL, temperature: 0 });
      return res.changes;
    };

    const inventoryCheck = async () => {
      if (await shouldChangeInventory()) {
        inventoryChanges = await getInventoryChange();
      }
    };

    let shortAnswer = "";
    const getShortAnswer = async () => {
      const prompt = `Given this DM narrative:\n${longAnswer}\n\nWrite a short answer for the user. Aim for one or two sentences but if more happens aim for a paragraph.`;
      const schema = z.object({ shortAnswer: z.string() });
      const messages = [
        { role: 'system', content: 'You are a precise RPG game master.' },
        { role: 'user', content: prompt }
      ];
      const res = await openaiService.createStructuredChatCompletion(messages, schema, { model: SMALL_MODEL, temperature: 0 });
      shortAnswer = res.shortAnswer;
    };

    await Promise.all([...statChangeChecks, inventoryCheck(), getShortAnswer()]);

    // Merge changes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stateChanges: any = {};
    if (Object.keys(statChanges).length > 0) {
      stateChanges.statChanges = statChanges;
    }
    if (inventoryChanges) {
      stateChanges.inventoryChanges = inventoryChanges;
    }

    // Compose DMResponse
    return {
      message: longAnswer,
      stateChanges,
      shortAnswer,
    };
  }

  // Main DM agent loop
  public async processPlayerAction(
    action: string,
    gameState: GameState,
    openaiService: OpenAIService
  ): Promise<{
    skillCheckRequest: SkillCheckRequest | null;
    skillCheckResult: SkillCheckResult | null;
    dmResponse: DMResponse;
    actionValidity: { valid: boolean; reason: string | null };
  }> {
    console.log("[DM] processPlayerAction called", { action, gameState });

    const validityPromise = this.isValidAction(action, gameState, openaiService);
    const skillCheckPromise = this.getSkillCheckRequest(action, gameState, openaiService);

    const validity = await validityPromise;
    let skillCheck: SkillCheckRequest | null = null;
    if (!validity.valid) {

      return {
        skillCheckRequest: null,
        skillCheckResult: null,

        dmResponse: {
          shortAnswer: validity.reason || 'Invalid action',
          message: '',
          stateChanges: {},
        },
        actionValidity: { valid: validity.valid, reason: validity.reason }
      };
    } else {
      skillCheck = await skillCheckPromise;
    }

    let skillCheckResult: SkillCheckResult | null = null;
    if (skillCheck && skillCheck.required) {
      skillCheckResult = this.performSkillCheck(
        skillCheck.stat!,
        skillCheck.difficultyCategory!,
        gameState
      );
    }

    // Step 3: LLM generates DM's internal monologue and player-facing response
    const response = await this.getResponse(action, gameState, skillCheckResult, openaiService);
    // Step 4: LLM - parse for diff and short answer, using the DM's response to the player
    const dmResponse = await this.getDiffAndShortAnswer(response, gameState, openaiService);
    // Step 5: Error handling for malformed output is in each step
    return {
      skillCheckRequest: skillCheck,
      skillCheckResult,

      dmResponse,
      actionValidity: { valid: validity.valid, reason: validity.reason }
    };
  }

  private initializeNotes(gameState: GameState): DMNotes {
    // Create initial DM notes based on the game scenario
    return {
      worldState: `World based on scenario: ${gameState.customScenario || gameState.scenario}`,
      hiddenObjectives: [
        "Guide player to discover the main quest",
        "Create challenging but fair encounters",
        "Adapt the world based on player choices"
      ],
      activeQuests: [
        {
          id: "main-quest",
          name: "The Beginning",
          description: "Start your adventure and discover your purpose",
          objective: "Explore the surroundings and find a lead",
          status: "active"
        }
      ],
      playerAssessment: "New player, assessing play style",
      keyLocations: {},
      keyCharacters: {},
      plotHooks: []
    };
  }

  public getNotes(): DMNotes {
    return this.notes;
  }

  public updateNotes(updates: Partial<DMNotes>): void {
    this.notes = { ...this.notes, ...updates };
  }

  public createSystemPrompt(gameState: GameState): string {
    const { notes } = this;

    return `You are a game master (DM) in a text adventure RPG. The game is set in: ${gameState.customScenario || gameState.scenario}. The player's name is ${gameState.name}.

GAME STATE:
- Player Health: ${gameState.stats.health}/100
- Player Mana: ${gameState.stats.mana}/100
- Player Experience: ${gameState.stats.experience}/100
- Player Stats: Str ${gameState.stats.strength}, Dex ${gameState.stats.dexterity}, Int ${gameState.stats.intelligence}, Luck ${gameState.stats.luck}
- Inventory: ${gameState.inventory.map(item => `${item.name} (${item.quantity})`).join(', ') || "Empty"}

DM NOTES (HIDDEN FROM PLAYER):
${notes.worldState}

Active Quests:
${notes.activeQuests.map(q => `- ${q.name}: ${q.objective} (${q.status})`).join('\n')}

Hidden Objectives:
${notes.hiddenObjectives.join('\n')}

Player Assessment:
${notes.playerAssessment}

INSTRUCTIONS:
1. You are a DM with your own agenda and goals for the player.
2. Make the game challenging but fair.
3. Push back against players who try to break the game or act unrealistically.
4. Maintain a consistent world and narrative.
5. Actions should have consequences.

When responding to the player, follow this process:
1. Validate if the action is valid in an RPG context (reject meta-game questions or out-of-character requests).
2. Generate a response with appropriate narrative.
3. Determine any changes to game state (inventory, stats, quests).

Your response must be in JSON format according to the provided schema.`;
  }

  public createMessages(gameState: GameState): OpenAI.Chat.ChatCompletionCreateParams[] {
    const systemPrompt = this.createSystemPrompt(gameState);

    return [
      {
        role: "system",
        content: systemPrompt,
      },
      ...(gameState.messages
        .filter(msg => msg.content !== undefined && msg.content !== null && msg.content.trim() !== "")
        .map(msg => ({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
        })) as OpenAI.Chat.ChatCompletionMessage[]),
    ];
  }

  public parseResponse(responseText: string): DMResponse {
    try {
      // Extract JSON from markdown code block if present
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);

      if (jsonMatch && jsonMatch[1]) {
        return JSON.parse(jsonMatch[1]) as DMResponse;
      }

      // If no JSON found, return just the message
      return {
        message: responseText,
        stateChanges: {},
        shortAnswer: responseText
      };
    } catch (error) {
      console.error("Error parsing DM response:", error);
      return {
        message: responseText,
        stateChanges: {},
        shortAnswer: responseText
      };
    }
  }

  public applyStateChanges(gameState: GameState, response: DMResponse): GameState {
    console.log("[DM] applyStateChanges called", { gameState, response });
    const updatedGame = { ...gameState };
    const { stateChanges } = response;

    // Apply inventory changes
    if (stateChanges.inventoryChanges) {
      // Add items
      if (stateChanges.inventoryChanges.add && stateChanges.inventoryChanges.add.length > 0) {
        for (const itemToAdd of stateChanges.inventoryChanges.add) {
          const existingItemIndex = updatedGame.inventory.findIndex(
            item => item.name.toLowerCase() === itemToAdd.name.toLowerCase()
          );

          if (existingItemIndex >= 0) {
            // Update existing item
            updatedGame.inventory[existingItemIndex].quantity += itemToAdd.quantity;
          } else {
            // Add new item
            updatedGame.inventory.push({
              name: itemToAdd.name,
              quantity: itemToAdd.quantity,
              description: itemToAdd.description
            });
          }
        }
      }

      // Remove items
      if (stateChanges.inventoryChanges.remove && stateChanges.inventoryChanges.remove.length > 0) {
        for (const itemToRemove of stateChanges.inventoryChanges.remove) {
          const existingItemIndex = updatedGame.inventory.findIndex(
            item => item.name.toLowerCase() === itemToRemove.name.toLowerCase()
          );

          if (existingItemIndex >= 0) {
            // Reduce quantity
            updatedGame.inventory[existingItemIndex].quantity -= itemToRemove.quantity;

            // Remove item if quantity is 0 or less
            if (updatedGame.inventory[existingItemIndex].quantity <= 0) {
              updatedGame.inventory.splice(existingItemIndex, 1);
            }
          }
        }
      }
    }

    // Apply stat changes
    if (stateChanges.statChanges) {
      const stats = stateChanges.statChanges;

      if (stats.health !== undefined) {
        updatedGame.stats.health = Math.max(0, Math.min(100, updatedGame.stats.health + stats.health));
      }

      if (stats.mana !== undefined) {
        updatedGame.stats.mana = Math.max(0, Math.min(100, updatedGame.stats.mana + stats.mana));
      }

      if (stats.experience !== undefined) {
        updatedGame.stats.experience = Math.max(0, updatedGame.stats.experience + stats.experience);
      }

      if (stats.strength !== undefined) {
        updatedGame.stats.strength = Math.max(1, updatedGame.stats.strength + stats.strength);
      }

      if (stats.dexterity !== undefined) {
        updatedGame.stats.dexterity = Math.max(1, updatedGame.stats.dexterity + stats.dexterity);
      }

      if (stats.intelligence !== undefined) {
        updatedGame.stats.intelligence = Math.max(1, updatedGame.stats.intelligence + stats.intelligence);
      }

      if (stats.luck !== undefined) {
        updatedGame.stats.luck = Math.max(1, updatedGame.stats.luck + stats.luck);
      }
    }

    // Update DM notes
    if (stateChanges.dmNotesUpdates) {
      this.updateNotes(stateChanges.dmNotesUpdates);
    }

    return updatedGame;
  }



  // Get the Zod schema for the DM response
  public getResponseSchema(): z.ZodType {
    const DMResponseSchema = z.object({
      message: z.string(),
      stateChanges: z.object({
        inventoryChanges: z.union([
          z.object({
            add: z.union([
              z.array(z.object({
                name: z.string(),
                quantity: z.union([z.number().int(), z.null()]),
                description: z.union([z.string(), z.null()])
              })),
              z.null()
            ]),
            remove: z.union([
              z.array(z.object({
                name: z.string(),
                quantity: z.union([z.number().int(), z.null()]) // must be >= 1
              })),
              z.null()
            ])
          }),
          z.null()
        ]),
        statChanges: z.union([
          z.object({
            health: z.union([z.number(), z.null()]),
            mana: z.union([z.number(), z.null()]),
            experience: z.union([z.number(), z.null()]),
            strength: z.union([z.number(), z.null()]),
            dexterity: z.union([z.number(), z.null()]),
            intelligence: z.union([z.number(), z.null()]),
            luck: z.union([z.number(), z.null()])
          }),
          z.null()
        ]),
        questUpdates: z.union([
          z.array(z.object({
            questId: z.string(),
            status: z.enum(["active", "completed", "failed"])
          })),
          z.null()
        ]),
        dmNotesUpdates: z.union([
          z.object({
            worldState: z.union([z.string(), z.null()]),
            playerAssessment: z.union([z.string(), z.null()]),
            hiddenObjectives: z.union([z.array(z.string()), z.null()]),
            plotHooks: z.union([z.array(z.string()), z.null()]),
            keyLocations: z.union([z.record(z.string()), z.null()]),
            keyCharacters: z.union([z.record(z.string()), z.null()])
          }),
          z.null()
        ])
      }),
      shortAnswer: z.string()
    });
    return DMResponseSchema;
  }
}
