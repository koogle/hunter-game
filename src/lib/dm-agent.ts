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

  /**
   * Combined validity and skill check in a single LLM call
   */
  public async validateAndCheckSkill(
    action: string,
    gameState: GameState,
    openaiService: OpenAIService
  ): Promise<{ 
    valid: boolean; 
    reason: string | null; 
    skillCheck: SkillCheckRequest | undefined 
  }> {
    console.log("[DM] validateAndCheckSkill called", { action, gameState });
    
    const schema = z.object({
      valid: z.boolean(),
      invalidReason: z.union([z.string(), z.null()]),
      requiresSkillCheck: z.boolean(),
      skillCheckDetails: z.union([
        z.object({
          stat: z.enum(['strength', 'dexterity', 'intelligence', 'luck']),
          difficulty: z.enum(['trivial', 'easy', 'medium', 'hard', 'extreme']),
          reason: z.string()
        }),
        z.null()
      ])
    });
    
    const prompt = `Analyze this player action in an RPG context:
Action: "${action}"
Game State: ${JSON.stringify(gameState)}

Determine:
1. Is this a valid in-character action? (reject meta-questions, out-of-character, or game-breaking actions)
2. If valid, does it require a skill check? If so, which stat and difficulty?

Respond with your analysis.`;
    
    const messages = [
      { role: 'system', content: 'You are an expert RPG game master who evaluates player actions.' },
      { role: 'user', content: prompt }
    ];
    
    const response = await openaiService.createStructuredChatCompletion(messages, schema, { 
      model: SMALL_MODEL, 
      temperature: 0 
    });
    
    console.log("[DM] validateAndCheckSkill response", response);
    
    if (!response) {
      return { valid: false, reason: 'Failed to validate action', skillCheck: undefined };
    }
    
    // Build skill check request if needed
    let skillCheck: SkillCheckRequest | undefined;
    if (response.valid && response.requiresSkillCheck && response.skillCheckDetails) {
      skillCheck = {
        required: true,
        stat: response.skillCheckDetails.stat,
        difficultyCategory: response.skillCheckDetails.difficulty as SkillDifficulty,
        reason: response.skillCheckDetails.reason
      };
    }
    
    return {
      valid: response.valid,
      reason: response.invalidReason,
      skillCheck
    };
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
    narrative: string,
    gameState: GameState,
    openaiService: OpenAIService
  ): Promise<DMResponse> {
    const schema = z.object({
      stateChanges: z.object({
        inventoryChanges: z.object({
          add: z.array(z.object({
            name: z.string(),
            quantity: z.number(),
            description: z.string().optional()
          })).optional(),
          remove: z.array(z.object({
            name: z.string(),
            quantity: z.number()
          })).optional()
        }).optional(),
        statChanges: z.object({
          health: z.number().optional(),
          mana: z.number().optional(),
          experience: z.number().optional(),
          strength: z.number().optional(),
          dexterity: z.number().optional(),
          intelligence: z.number().optional(),
          luck: z.number().optional()
        }).optional(),
        questUpdates: z.array(z.object({
          questId: z.string().optional(),
          status: z.enum(["active", "completed", "failed"]).optional()
        })).optional(),
        dmNotesUpdates: z.object({
          worldState: z.string().optional(),
          playerAssessment: z.string().optional(),
          activeQuests: z.array(z.object({
            id: z.string(),
            name: z.string(),
            description: z.string(),
            objective: z.string(),
            status: z.enum(["active", "completed", "failed"])
          })).optional(),
          hiddenObjectives: z.array(z.string()).optional()
        }).optional()
      })
    });
    
    const prompt = `Analyze this DM narrative response and extract any state changes that occurred:

Narrative: "${narrative}"

Current Game State:
- Health: ${gameState.stats.health}/100
- Mana: ${gameState.stats.mana}/100
- Experience: ${gameState.stats.experience}
- Stats: Str ${gameState.stats.strength}, Dex ${gameState.stats.dexterity}, Int ${gameState.stats.intelligence}, Luck ${gameState.stats.luck}
- Inventory: ${gameState.inventory.map(item => `${item.name} (${item.quantity})`).join(', ') || "Empty"}

Extract any changes to inventory, stats, or quests that are implied or stated in the narrative. Be conservative - only extract changes that are clearly indicated.`;
    
    const messages = [
      { role: 'system', content: 'You are an expert at parsing RPG narratives to extract game state changes. Be conservative and only extract changes that are clearly indicated in the narrative.' },
      { role: 'user', content: prompt }
    ];
    
    const response = await openaiService.createStructuredChatCompletion(messages, schema, { 
      model: SMALL_MODEL, 
      temperature: 0 
    });
    
    if (!response) {
      return {
        message: narrative,
        stateChanges: {}
      };
    }
    
    return {
      message: narrative,
      stateChanges: response.stateChanges || {}
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
6. Prefer to refer to the player as "you" in your responses.
7. Focus on describing what happens narratively - do NOT explicitly list stat changes or inventory updates.

Your role is to narrate the story and describe what the player experiences. Be immersive and descriptive.`;
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
      // Step 1: Combined validation and skill check determination
      const validationResult = await this.validateAndCheckSkill(action, gameState, openaiService);
      
      if (!validationResult.valid) {
        callbacks.onActionValidity?.(validationResult);
        
        // Add error message to game history
        const errorMessage = validationResult.reason || 'Invalid action';
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
          actionValidity: validationResult,
          updatedGame,
        };
      }

      // Step 2: Perform skill check if required
      let skillCheckResult: SkillCheckResult | undefined = undefined;
      if (validationResult.skillCheck && validationResult.skillCheck.required) {
        // Emit skill check notification
        callbacks.onSkillCheckNotification?.(validationResult.skillCheck);
        
        skillCheckResult = this.performSkillCheck(
          validationResult.skillCheck.stat!,
          validationResult.skillCheck.difficultyCategory!,
          gameState
        );
        
        // Emit skill check result immediately
        callbacks.onSkillCheckResult?.(skillCheckResult);
      }

      // Step 3: Generate DM response with streaming (narrative only)
      const response = await this.getStreamingResponse(action, gameState, skillCheckResult, openaiService, callbacks.onStreamChunk);

      // Step 4: Parse for state changes based on the narrative
      const dmResponsePromise = this.parseStateChanges(response, gameState, openaiService);

      // Step 5: Prepare updated messages while parsing happens
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
        content: response, // Use the raw narrative response, not dmResponse.message
        type: 'normal',
        timestamp: new Date().toISOString()
      } as GameMessage);
      
      const updatedGame = this.applyStateChanges({
        ...gameState,
        lastUpdatedAt: new Date().toISOString(),
        messages: updatedMessages
      }, dmResponse);
      
      // Add system messages for state changes after applying them
      const finalMessages = [...updatedGame.messages];
      
      // Add inventory change messages if any
      if (dmResponse.stateChanges.inventoryChanges) {
        const { inventoryChanges } = dmResponse.stateChanges;
        
        // Handle added items
        if (inventoryChanges.add && inventoryChanges.add.length > 0) {
          for (const item of inventoryChanges.add) {
            finalMessages.push({
              role: 'system',
              content: `Inventory Update: Added ${item.quantity}x ${item.name}${item.description ? ` - ${item.description}` : ''}`,
              type: 'inventory-change',
              timestamp: new Date().toISOString()
            } as GameMessage);
          }
        }
        
        // Handle removed items
        if (inventoryChanges.remove && inventoryChanges.remove.length > 0) {
          for (const item of inventoryChanges.remove) {
            finalMessages.push({
              role: 'system',
              content: `Inventory Update: Removed ${item.quantity}x ${item.name}`,
              type: 'inventory-change',
              timestamp: new Date().toISOString()
            } as GameMessage);
          }
        }
      }

      // Add stat change messages if any
      if (dmResponse.stateChanges.statChanges) {
  const statChanges = dmResponse.stateChanges.statChanges;
  const statMessages: string[] = [];

  // Health
  if (statChanges.health !== undefined) {
    const original = gameState.stats.health;
    const changed = Math.max(0, Math.min(100, original + statChanges.health));
    if (changed !== original) {
      const change = statChanges.health > 0 ? `+${statChanges.health}` : `${statChanges.health}`;
      statMessages.push(`Health: ${original} → ${changed} (${change})`);
    }
  }
  // Mana
  if (statChanges.mana !== undefined) {
    const original = gameState.stats.mana;
    const changed = Math.max(0, Math.min(100, original + statChanges.mana));
    if (changed !== original) {
      const change = statChanges.mana > 0 ? `+${statChanges.mana}` : `${statChanges.mana}`;
      statMessages.push(`Mana: ${original} → ${changed} (${change})`);
    }
  }
  // Experience
  if (statChanges.experience !== undefined) {
    const original = gameState.stats.experience;
    const changed = Math.max(0, original + statChanges.experience);
    if (changed !== original) {
      const change = statChanges.experience > 0 ? `+${statChanges.experience}` : `${statChanges.experience}`;
      statMessages.push(`Experience: ${original} → ${changed} (${change})`);
    }
  }
  // Strength
  if (statChanges.strength !== undefined) {
    const original = gameState.stats.strength;
    const changed = Math.max(1, original + statChanges.strength);
    if (changed !== original) {
      const change = statChanges.strength > 0 ? `+${statChanges.strength}` : `${statChanges.strength}`;
      statMessages.push(`Strength: ${original} → ${changed} (${change})`);
    }
  }
  // Dexterity
  if (statChanges.dexterity !== undefined) {
    const original = gameState.stats.dexterity;
    const changed = Math.max(1, original + statChanges.dexterity);
    if (changed !== original) {
      const change = statChanges.dexterity > 0 ? `+${statChanges.dexterity}` : `${statChanges.dexterity}`;
      statMessages.push(`Dexterity: ${original} → ${changed} (${change})`);
    }
  }
  // Intelligence
  if (statChanges.intelligence !== undefined) {
    const original = gameState.stats.intelligence;
    const changed = Math.max(1, original + statChanges.intelligence);
    if (changed !== original) {
      const change = statChanges.intelligence > 0 ? `+${statChanges.intelligence}` : `${statChanges.intelligence}`;
      statMessages.push(`Intelligence: ${original} → ${changed} (${change})`);
    }
  }
  // Luck
  if (statChanges.luck !== undefined) {
    const original = gameState.stats.luck;
    const changed = Math.max(1, original + statChanges.luck);
    if (changed !== original) {
      const change = statChanges.luck > 0 ? `+${statChanges.luck}` : `${statChanges.luck}`;
      statMessages.push(`Luck: ${original} → ${changed} (${change})`);
    }
  }
  // Only show status update if something changed
  if (statMessages.length > 0) {
    finalMessages.push({
      role: 'system',
      content: `Status Update: ${statMessages.join(', ')}`,
      type: 'stat-change',
      timestamp: new Date().toISOString()
    } as GameMessage);
  }
}
      
      // Update the game with final messages
      const finalGame = {
        ...updatedGame,
        messages: finalMessages
      };
      
      return {
        skillCheckRequest: validationResult.skillCheck,
        skillCheckResult,
        dmResponse: {
          ...dmResponse,
          message: response // Ensure the dmResponse contains the narrative
        },
        actionValidity: validationResult,
        updatedGame: finalGame,
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
