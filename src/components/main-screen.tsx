"use client";

import { useContext, useState } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GameStateContext } from "@/app/context/game_state";
import { GameState } from "@/lib/state";

export function MainScreen() {
  const ctx = useContext(GameStateContext);

  if (ctx == null) {
    return <div>Loading...</div>;
  }

  return <LoadedMainScreen gameState={ctx.gameState} />;
}

export function LoadedMainScreen({ gameState }: { gameState: GameState }) {
  const biomeId =
    gameState.world.map[gameState.player.location.y][
      gameState.player.location.x
    ];
  const biome = gameState.world.biomes.find((biome) => biome.id === biomeId);

  const [command, setCommand] = useState("");
  // const [gameText, setGameText] = useState(".");

  const handleCommand = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // Process the command here
      setGameText(`You tried to ${command}. Nothing happens... yet.`);
      setCommand("");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white text-black font-mono p-4 space-y-4">
      <div className="flex flex-1 space-x-4">
        <div className="flex-1 border border-black p-4 overflow-auto">
          <p>
            You are in the <b>{biome?.name}</b>
          </p>
          <p>{biome?.description}</p>
        </div>
        <div className="flex flex-col w-64 space-y-4">
          <div className="border border-black p-4 h-48">
            <div className="w-full h-32 bg-gray-200 mt-2"></div>
          </div>
          <Tabs defaultValue="inventory" className="border h-full border-black">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger
                value="inventory"
                className="data-[state=active]:bg-black data-[state=active]:text-white"
              >
                Inventory
              </TabsTrigger>
              <TabsTrigger
                value="stats"
                className="data-[state=active]:bg-black data-[state=active]:text-white"
              >
                Stats
              </TabsTrigger>
            </TabsList>
            <TabsContent value="inventory" className="p-4">
              <Inventory />
            </TabsContent>
            <TabsContent value="stats" className="p-4">
              <Stats />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <Input
        type="text"
        placeholder="Enter your command..."
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        onKeyDown={handleCommand}
        className="bg-white border-black border-[1px] text-black placeholder-gray-500 rounded-none focus:ring-2 focus:ring-black"
      />
    </div>
  );
}

const Inventory = () => {
  const ctx = useContext(GameStateContext);
  const inventory = ctx?.gameState.player.inventory;

  if (inventory === undefined || inventory.length === 0) {
    return <p>Inventory is empty</p>;
  }

  return (
    <div>
      {inventory.map((item) => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  );
};

const Stats = () => {
  const ctx = useContext(GameStateContext);
  const stats = ctx?.gameState.player.stats;

  function capitalize(attribute: string): string {
    return attribute.charAt(0).toUpperCase() + attribute.slice(1);
  }

  return (
    <ul className="space-y-2">
      <li className="flex justify-between items-center border-b border-black last:border-b-0 py-2">
        <span className="font-bold">Level</span>
        <span className="font-bold">{stats?.level}</span>
      </li>
      {Object.entries(stats || {})
        .filter(([attribute]) => attribute !== "level")
        .map(([attribute, value], index) => (
          <li
            key={index}
            className="flex justify-between items-center border-b border-black last:border-b-0 py-2"
          >
            <span className="font-bold">{capitalize(attribute)}</span>
            <span>{value}</span>
          </li>
        ))}
    </ul>
  );
};
