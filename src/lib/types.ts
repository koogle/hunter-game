export type Biome = {
  id: string;
  name: string;
  description: string;
  enemies: Enemy[];
};

export type Quest = {
  id: string;
  name: string;
  description: string;
  isCompleted: boolean;
};

export type Item = {
  id: string;
  name: string;
  description: string;
  dropRate: number;
  requirements: {
    strength: number;
    dexterity: number;
    intelligence: number;
  };
  stats: {
    damage: number;
    staminaCost: number;
  };
};

export type Enemy = {
  id: string;
  name: string;
  health: number;
  attacks: EnemyAttack[];
  xp: number;
  gold: number;
  items: Item[];
};

export type EnemyAttack = {
  name: string;
  damage: number;
  cost: number;
};

export type PlayerStats = {
  level: number;
  health: number;
  stamina: number;
  magic: number;
  strength: number;
  dexterity: number;
  intelligence: number;
  luck: number;
};
