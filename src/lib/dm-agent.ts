import { GameState, GameMessage } from "@/types/game";
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
}


export class DungeonMaster {
  private notes: DMNotes;

  constructor(gameState: GameState) {
    // Initialize DM notes based on the game scenario
    this.notes = this.initializeNotes(gameState);
  }

  private initializeNotes(gameState: GameState): DMNotes {
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



  /**
   * Run both validity and skill check in parallel, but only await skill check if valid.
   * Returns: { valid, reason, skillCheck }
   */
  public async precheckAction(
    action: string,
    gameState: GameState,
    openaiService: OpenAIService
  ): Promise<{ valid: boolean; reason: string | null; skillCheck: SkillCheckRequest | undefined }> {
    const validityPromise = this.isValidAction(action, gameState, openaiService);
    const skillCheckPromise = this.getSkillCheckRequest(action, gameState, openaiService);
    const validity = await validityPromise;
    let skillCheck: SkillCheckRequest | undefined;
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
    return { valid: response?.valid === true, reason: response?.reason ?? null };
  }

  public async getSkillCheckRequest(
    action: string,
    gameState: GameState,
    openaiService: OpenAIService
  ): Promise<SkillCheckRequest | undefined> {
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

  // Step 4: LLM generates only the player-facing response
  public async getResponse(
    action: string,
    gameState: GameState,
    skillCheckResult: SkillCheckResult | undefined,
    openaiService: OpenAIService
  ): Promise<string> {
    console.log("[DM] getResponse called", { action, gameState, skillCheckResult });
    let prompt = `Player action: "${action}"\n`;
    if (skillCheckResult && skillCheckResult.performed) {
      prompt += `Skill check performed: ${skillCheckResult.stat} (value: ${skillCheckResult.statValue}) + d12 roll (${skillCheckResult.roll}) vs difficulty ${skillCheckResult.difficulty}. Result: ${skillCheckResult.success ? 'Success' : 'Failure'} (degree: ${skillCheckResult.degree}).\n`;
    }
    prompt += `Game state: ${JSON.stringify(gameState)}\nDM Notes: ${JSON.stringify(this.notes)}\n\nWrite the DM's response to the player (what the player hears or sees). Be concise.`;
    const messages = [
      { role: 'system', content: 'You are a creative RPG game master.' },
      { role: 'user', content: prompt }
    ];
    console.log("[DM] getResponse prompt", prompt);
    // Only expect a single string back
    const schema = z.object({ response: z.string() });
    const result = await openaiService.createStructuredChatCompletion(messages, schema, { model: BIG_MODEL, temperature: 0.5, max_tokens: 300 });
    console.log("[DM] getResponse response", result);
    return result?.response ?? "";
  }

  // Step 5: Parse DM response for state changes
  public async parseStateChanges(
    longAnswer: string,
    gameState: GameState,
    openaiService: OpenAIService
  ): Promise<DMResponse> {
    console.log("[DM] parseStateChanges called", { longAnswer, gameState });

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
      const res = await openaiService.createStructuredChatCompletion(messages, schema, { model: BIG_MODEL, temperature: 0 });
      if (!res) {
        throw new Error("Failed to get shouldChangeStat result");
      }
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
      const res = await openaiService.createStructuredChatCompletion(messages, schema, { model: BIG_MODEL, temperature: 0 });
      return res?.value;
    };

    // Parallel check for all stats
    const statChangeChecks = stats.map(async (stat) => {
      if (await shouldChangeStat(stat)) {
        const newValue = await getStatChange(stat);
        if (newValue !== undefined) {
          statChanges[stat] = newValue;
        }
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
      const res = await openaiService.createStructuredChatCompletion(messages, schema, { model: BIG_MODEL, temperature: 0 });
      return res?.change === "yes";
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
      const res = await openaiService.createStructuredChatCompletion(messages, schema, { model: BIG_MODEL, temperature: 0 });
      return res?.changes || [];
    };

    const inventoryCheck = async () => {
      if (await shouldChangeInventory()) {
        inventoryChanges = await getInventoryChange();
      }
    };

    await Promise.all([statChangeChecks, inventoryCheck()]);

    const stateChanges: DMResponse["stateChanges"] = {};

    if (Object.keys(statChanges).length > 0) {
      stateChanges.statChanges = statChanges;
    }
    if (inventoryChanges) {
      stateChanges.inventoryChanges = inventoryChanges;
    }
    return {
      message: longAnswer,
      stateChanges,
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
6. **Prefer to refer to the player as "you" in your responses, but you may occasionally use their name for variety and immersion.**
7. **Any changes to the world state (including player stats, inventory, quests, or any other aspect of the game) MUST be clearly and explicitly spelled out in your answer to the user. Do not imply or leave changes ambiguous. If there are no changes, state that explicitly.**

When responding to the player, follow this process:
1. Validate if the action is valid in an RPG context (reject meta-game questions or out-of-character requests).
2. Generate a response with appropriate narrative.
3. Determine any changes to game state (inventory, stats, quests, etc.) and clearly list them in your response.

Your response must be in JSON format according to the provided schema.`;
  }

  public createMessages(gameState: GameState): OpenAI.Chat.ChatCompletionMessageParam[] {
    const systemPrompt = this.createSystemPrompt(gameState);

    return [
      {
        role: "system",
        content: systemPrompt,
      },
      ...(gameState.messages
        .filter(msg => {
          // Only include user and assistant messages, exclude system messages
          // System messages are for UI display only (errors, skill checks, etc.)
          return (msg.role === "user" || msg.role === "assistant") &&
                 msg.content !== undefined && 
                 msg.content !== null && 
                 msg.content.trim() !== "";
        })
        .map(msg => ({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
        })) as OpenAI.Chat.ChatCompletionMessageParam[]),
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

      };
    } catch (error) {
      console.error("Error parsing DM response:", error);
      return {
        message: responseText,
        stateChanges: {},

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

  // New method for handling real-time streaming interactions
  public async processActionWithStreaming(
    action: string,
    gameState: GameState,
    callbacks: {
      onSkillCheckNotification?: (request: SkillCheckRequest) => void;
      onSkillCheckResult?: (result: SkillCheckResult) => void;
      onStreamChunk?: (chunk: string) => void;
      onActionValidity?: (validity: { valid: boolean; reason: string | null }) => void;
      onError?: (message: string) => void;
    }
  ): Promise<{
    skillCheckRequest: SkillCheckRequest | undefined;
    skillCheckResult: SkillCheckResult | undefined;
    dmResponse: DMResponse;
    actionValidity: { valid: boolean; reason: string | null };
    updatedGame: GameState;
  }> {
    const openaiService = OpenAIService.getInstance();
    
    try {
      // Step 1: Check if action is valid
      const actionValidity = await this.isValidAction(action, gameState, openaiService);

      if (!actionValidity.valid) {
        callbacks.onActionValidity?.(actionValidity);
        
        // Add error message to game history
        const errorMessage = actionValidity.reason || 'Invalid action';
        const updatedMessages = [
          ...gameState.messages,
          { role: 'user', content: action } as GameMessage,
          { 
            role: 'system', 
            content: errorMessage,
            type: 'action-invalid',
            timestamp: new Date().toISOString()
          } as GameMessage,
        ];
        
        const updatedGame = {
          ...gameState,
          messages: updatedMessages,
          lastUpdatedAt: new Date().toISOString()
        };
        
        return {
          skillCheckRequest: undefined,
          skillCheckResult: undefined,
          dmResponse: {
            message: errorMessage,
            stateChanges: {},
          },
          actionValidity,
          updatedGame,
        };
      }

      // Step 2: Get skill check request if needed
      const skillCheckRequest = await this.getSkillCheckRequest(action, gameState, openaiService);

      // Emit skill check notification immediately if required
      if (skillCheckRequest && skillCheckRequest.required) {
        callbacks.onSkillCheckNotification?.(skillCheckRequest);
      }

      // Step 3: Perform skill check if required
      let skillCheckResult: SkillCheckResult | undefined = undefined;
      if (skillCheckRequest && skillCheckRequest.required) {
        skillCheckResult = this.performSkillCheck(
          skillCheckRequest.stat!,
          skillCheckRequest.difficultyCategory!,
          gameState
        );
        
        // Emit skill check result immediately
        callbacks.onSkillCheckResult?.(skillCheckResult);
      }

      // Step 4: Generate DM response with streaming
      const response = await this.getStreamingResponse(action, gameState, skillCheckResult, openaiService, callbacks.onStreamChunk);

      // Step 5: Parse for state changes and short answer (in parallel)
      const dmResponsePromise = this.parseStateChanges(response, gameState, openaiService);

      // Step 6: Prepare updated messages while parsing happens
      const updatedMessages = [
        ...gameState.messages,
        { role: 'user', content: action, timestamp: new Date().toISOString() } as GameMessage,
      ];

      // Add skill check message if performed
      if (skillCheckResult && skillCheckResult.performed) {
        updatedMessages.push({
          role: 'system',
          content: `Skill Check Result: ${skillCheckResult.stat?.toUpperCase()} (${skillCheckResult.statValue}) + d12 (${skillCheckResult.roll}) vs difficulty ${skillCheckResult.difficulty} → ${skillCheckResult.success ? 'SUCCESS' : 'FAILURE'} (Δ${skillCheckResult.degree})${skillCheckResult.reason ? ': ' + skillCheckResult.reason : ''}`,
          type: 'skill-check',
          timestamp: new Date().toISOString()
        } as GameMessage);
      }

      // Wait for parsing to complete
      const dmResponse = await dmResponsePromise;

      // Add DM response
      updatedMessages.push({
        role: 'assistant',
        content: dmResponse.message,
        type: 'normal',
        timestamp: new Date().toISOString()
      } as GameMessage);

      const updatedGame = this.applyStateChanges({
        ...gameState,
        lastUpdatedAt: new Date().toISOString(),
        messages: updatedMessages
      }, dmResponse);

      return {
        skillCheckRequest,
        skillCheckResult,
        dmResponse,
        actionValidity,
        updatedGame,
      };
    } catch (error) {
      console.error('Error processing player action with streaming:', error);
      const errorMessage = 'Failed to process player action';
      callbacks.onError?.(errorMessage);
      
      // Add error message to game history even when there's an exception
      const updatedMessages = [
        ...gameState.messages,
        { role: 'user', content: action, timestamp: new Date().toISOString() } as GameMessage,
        { 
          role: 'system', 
          content: errorMessage,
          type: 'error',
          timestamp: new Date().toISOString()
        } as GameMessage,
      ];
      
      const updatedGameWithError = {
        ...gameState,
        messages: updatedMessages,
        lastUpdatedAt: new Date().toISOString()
      };
      
      return {
        skillCheckRequest: undefined,
        skillCheckResult: undefined,
        dmResponse: {
          message: errorMessage,
          stateChanges: {},
        },
        actionValidity: { valid: false, reason: errorMessage },
        updatedGame: updatedGameWithError,
      };
    }
  }

  // Helper method for streaming DM response
  private async getStreamingResponse(
    action: string,
    gameState: GameState,
    skillCheckResult: SkillCheckResult | undefined,
    openaiService: OpenAIService,
    onStreamChunk?: (chunk: string) => void
  ): Promise<string> {
    const messages = this.createMessages(gameState);
    
    // Add the player action
    messages.push({ role: 'user', content: action });
    
    // Add skill check context if available
    if (skillCheckResult && skillCheckResult.performed) {
      const skillCheckContext = `Skill Check Result: ${skillCheckResult.stat?.toUpperCase()} (${skillCheckResult.statValue}) + d12 (${skillCheckResult.roll}) vs difficulty ${skillCheckResult.difficulty}. Result: ${skillCheckResult.success ? 'Success' : 'Failure'} (degree: ${skillCheckResult.degree}).\n`;
      messages.push({ role: 'system', content: `The player just performed a skill check with the following result: ${skillCheckContext}. Incorporate this result into your response naturally.` });
    }

    try {
      const stream = await openaiService.createStreamingChatCompletion(messages, {
        model: BIG_MODEL,
        temperature: 0.7,
        max_tokens: 1000
      });

      let fullResponse = '';
      
      // Emit stream start notification
      onStreamChunk?.('__STREAM_START__');
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          onStreamChunk?.(content);
        }
      }
      
      // Emit stream end notification
      onStreamChunk?.('__STREAM_END__');
      
      return fullResponse;
    } catch (error) {
      console.error('Error streaming DM response:', error);
      throw error;
    }
  }
}
