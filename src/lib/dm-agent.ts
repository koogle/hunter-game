import { GameState, GameMessage } from "@/types/game";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

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

  public createMessages(gameState: GameState): ChatCompletionMessageParam[] {
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
        })) as ChatCompletionMessageParam[]),
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
        stateChanges: {}
      };
    } catch (error) {
      console.error("Error parsing DM response:", error);
      return {
        message: responseText,
        stateChanges: {}
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

  // Utility method to check if an action is valid in the game context
  public isValidAction(action: string): boolean {
    // List of invalid actions or keywords that should be rejected
    const invalidPatterns = [
      /^help me with my homework/i,
      /^write me an essay/i,
      /^what is your opinion on politics/i,
      /^tell me about the real world/i,
      /^who created you/i,
      /^what is your code/i,
      /^how does this game work/i,
      /^give me admin access/i,
      /^hack the game/i,
      /^cheat code/i
    ];

    return !invalidPatterns.some(pattern => pattern.test(action));
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
