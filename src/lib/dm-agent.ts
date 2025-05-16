import { GameState } from "@/types/game";
import { z } from 'zod';
import OpenAI from "openai";

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

// Types for structured output from the DM
export interface SkillCheckRequest {
  required: boolean;
  stat?: 'strength' | 'dexterity' | 'intelligence' | 'luck';
  difficulty?: number;
  reason?: string;
}

export interface SkillCheckResult {
  performed: boolean;
  stat?: 'strength' | 'dexterity' | 'intelligence' | 'luck';
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

  // Use LLM to judge if action is valid in the current RPG context
  public async isValidAction(
    action: string,
    gameState: GameState,
    openaiService: any
  ): Promise<boolean> {
    const schema = z.object({
      valid: z.boolean(),
      reason: z.string().optional()
    });
    const prompt = `Given the following player action: "${action}", and the current RPG game state: ${JSON.stringify(gameState)}, judge if this is a valid in-character action for a text adventure RPG. Do not allow meta-questions, out-of-character, or game-breaking actions.`;
    const messages = [
      { role: 'system', content: 'You are an expert RPG game master.' },
      { role: 'user', content: prompt }
    ];
    const response = await openaiService.createStructuredChatCompletion(messages, schema, { model: 'gpt-4o', temperature: 0 });
    return (await response).valid === true;
  }

  // Step 2: Ask LLM if a skill check is needed
  public async getSkillCheckRequest(
    action: string,
    gameState: GameState,
    openaiService: any
  ): Promise<SkillCheckRequest> {
    const schema = z.object({
      required: z.boolean(),
      stat: z.enum(['strength', 'dexterity', 'intelligence', 'luck']).optional(),
      difficulty: z.number().int().min(1).max(20).optional(),
      reason: z.string().optional()
    });
    const prompt = `Given the following player action: "${action}", and the available stats: strength, dexterity, intelligence, luck, decide if a skill check is required. Only suggest a skill check if it makes sense in context. If so, pick the most appropriate stat and a difficulty (1-20).`;
    const messages = [
      { role: 'system', content: 'You are an expert RPG game master.' },
      { role: 'user', content: prompt }
    ];
    return openaiService.createStructuredChatCompletion(messages, schema, { model: 'gpt-4o', temperature: 0 });
  }

  // Step 3: Perform the skill check
  public performSkillCheck(
    stat: 'strength' | 'dexterity' | 'intelligence' | 'luck',
    difficulty: number,
    gameState: GameState
  ): SkillCheckResult {
    const statValue = gameState.stats[stat];
    const roll = Math.ceil(Math.random() * 12);
    const total = statValue + roll;
    const success = total >= difficulty;
    const degree = total - difficulty;
    return {
      performed: true,
      stat,
      roll,
      statValue,
      difficulty,
      total,
      success,
      degree
    };
  }

  // Step 4: LLM generates long answer (with skill check result if applicable)
  public async getLongAnswer(
    action: string,
    gameState: GameState,
    skillCheckResult: SkillCheckResult | null,
    openaiService: any
  ): Promise<string> {
    let prompt = `Player action: "${action}"\n`;
    if (skillCheckResult && skillCheckResult.performed) {
      prompt += `Skill check performed: ${skillCheckResult.stat} (value: ${skillCheckResult.statValue}) + d12 roll (${skillCheckResult.roll}) vs difficulty ${skillCheckResult.difficulty}. Result: ${skillCheckResult.success ? 'Success' : 'Failure'} (degree: ${skillCheckResult.degree}).\n`;
    }
    prompt += `Game state: ${JSON.stringify(gameState)}\nDM Notes: ${JSON.stringify(this.notes)}\nProvide a detailed narrative of what happens next, taking into account quests, world state, and DM plans. Do not output any status changes yet.`;
    const messages = [
      { role: 'system', content: 'You are a creative RPG game master.' },
      { role: 'user', content: prompt }
    ];
    return openaiService.createChatCompletion(messages, { model: 'gpt-4', temperature: 0.8 });
  }

  // Step 5: LLM parses for state changes and short answer
  public async getDiffAndShortAnswer(
    longAnswer: string,
    gameState: GameState,
    openaiService: any
  ): Promise<DMResponse> {
    // Zod schema for DMResponse
    const DMResponseSchema = z.object({
      message: z.string(),
      stateChanges: z.object({
        inventoryChanges: z.object({
          add: z.array(z.object({
            name: z.string(),
            quantity: z.number().int().min(1),
            description: z.string().optional()
          })).optional(),
          remove: z.array(z.object({
            name: z.string(),
            quantity: z.number().int().min(1)
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
          questId: z.string(),
          status: z.enum(["active", "completed", "failed"])
        })).optional(),
        dmNotesUpdates: z.object({
          worldState: z.string().optional(),
          playerAssessment: z.string().optional(),
          hiddenObjectives: z.array(z.string()).optional(),
          plotHooks: z.array(z.string()).optional(),
          keyLocations: z.record(z.string()).optional(),
          keyCharacters: z.record(z.string()).optional()
        }).optional()
      }),
      shortAnswer: z.string()
    });
    const prompt = `Given the following DM narrative:\n${longAnswer}\n\nBased on this, generate:\n1. A JSON diff for changes to stats, inventory, and quests (do not invent new stats, only update existing ones).\n2. A short answer for the user (preferably one sentence, or a short paragraph if needed).`;
    const messages = [
      { role: 'system', content: 'You are a precise RPG game master.' },
      { role: 'user', content: prompt }
    ];
    return openaiService.createStructuredChatCompletion(messages, DMResponseSchema, { model: 'gpt-4o', temperature: 0 });
  }

  // Main DM agent loop
  public async processPlayerAction(
    action: string,
    gameState: GameState,
    openaiService: any
  ): Promise<{
    skillCheckRequest: SkillCheckRequest;
    skillCheckResult: SkillCheckResult | null;
    longAnswer: string;
    dmResponse: DMResponse;
  }> {
    // Step 1: Validate action
    if (!await this.isValidAction(action, gameState, openaiService)) {
      throw new Error('Invalid action. Please try a different command.');
    }
    // Step 2: LLM - should we do a skill check?
    const skillCheckRequest = await this.getSkillCheckRequest(action, gameState, openaiService);
    let skillCheckResult: SkillCheckResult | null = null;
    if (skillCheckRequest.required && skillCheckRequest.stat && skillCheckRequest.difficulty) {
      skillCheckResult = this.performSkillCheck(skillCheckRequest.stat, skillCheckRequest.difficulty, gameState);
    }
    // Step 3: LLM - generate long answer (with skill check result if any)
    const longAnswer = await this.getLongAnswer(action, gameState, skillCheckResult, openaiService);
    // Step 4: LLM - parse for diff and short answer
    const dmResponse = await this.getDiffAndShortAnswer(longAnswer, gameState, openaiService);
    // Step 5: Error handling for malformed output is in each step
    return { skillCheckRequest, skillCheckResult, longAnswer, dmResponse };
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



  // Get the JSON schema for the DM response
  public getResponseSchema(): object {
    return {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The narrative response to the player"
        },
        stateChanges: {
          type: "object",
          properties: {
            inventoryChanges: {
              type: "object",
              properties: {
                add: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      quantity: { type: "integer", minimum: 1 },
                      description: { type: "string" }
                    },
                    required: ["name", "quantity"]
                  }
                },
                remove: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      quantity: { type: "integer", minimum: 1 }
                    },
                    required: ["name", "quantity"]
                  }
                }
              }
            },
            statChanges: {
              type: "object",
              properties: {
                health: { type: "integer" },
                mana: { type: "integer" },
                experience: { type: "integer" },
                strength: { type: "integer" },
                dexterity: { type: "integer" },
                intelligence: { type: "integer" },
                luck: { type: "integer" }
              }
            },
            questUpdates: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  questId: { type: "string" },
                  status: { type: "string", enum: ["active", "completed", "failed"] }
                },
                required: ["questId", "status"]
              }
            },
            dmNotesUpdates: {
              type: "object",
              properties: {
                worldState: { type: "string" },
                playerAssessment: { type: "string" },
                hiddenObjectives: {
                  type: "array",
                  items: { type: "string" }
                },
                plotHooks: {
                  type: "array",
                  items: { type: "string" }
                },
                keyLocations: {
                  type: "object",
                  additionalProperties: { type: "string" }
                },
                keyCharacters: {
                  type: "object",
                  additionalProperties: { type: "string" }
                }
              }
            }
          },
          required: ["message"]
        }
      },
      required: ["message", "stateChanges"]
    };
  }
}
