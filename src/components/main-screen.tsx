"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
        <div className="w-64 space-y-4">
          <div className="border border-black p-4 h-48">
            <p className="text-center">Image of the current biome</p>
            {/* Replace this with an actual image component */}
            <div className="w-full h-32 bg-gray-200 mt-2"></div>
          </div>
          <Tabs defaultValue="inventory" className="border border-black">
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
              <p>Your inventory is empty.</p>
            </TabsContent>
            <TabsContent value="stats" className="p-4">
              <p>Health: 100</p>
              <p>Experience: 0</p>
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
