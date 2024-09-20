"use client";

import { useContext, useState } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GameStateContext } from "@/app/context/game_state";

export function MainScreen() {
  const [command, setCommand] = useState("");
  const [gameText, setGameText] = useState(".");

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
          <p>{gameText}</p>
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
      <div className="border border-black p-2">
        <Input
          type="text"
          placeholder="Enter your command..."
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleCommand}
          className="bg-white border-none text-black placeholder-gray-500 focus:ring-0"
        />
      </div>
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
