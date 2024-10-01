"use client";

import { useContext, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { GameStateContext } from "@/app/context/game_state";

export function LoginScreen() {
  const ctx = useContext(GameStateContext);
  const [playerName, setPlayerName] = useState("");
  const [scenario, setScenario] = useState("");
  const [customScenario, setCustomScenario] = useState("");

  const handleStart = () => {
    const selectedScenario = scenario === "custom" ? customScenario : scenario;
    ctx?.setGameState({
      ...ctx.gameState,
      player: {
        ...ctx.gameState.player,
        name: playerName,
      },
      scenario: selectedScenario,
    });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-white text-black font-mono p-4">
      <Card className="w-[350px] bg-white border-black border rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            ENDLESS JOURNEY
          </CardTitle>
          <CardDescription className="text-center text-gray-600">
            Embark on an infinite adventure
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Enter your name"
              className="bg-white border-black border text-black placeholder-gray-500 rounded-none focus:ring-2 focus:ring-black"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="scenario">Scenario</Label>
            <Select onValueChange={setScenario}>
              <SelectTrigger className="bg-white border-black border text-black rounded-none focus:ring-2 focus:ring-black">
                <SelectValue placeholder="Select a scenario" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="middle-earth">Middle Earth</SelectItem>
                <SelectItem value="cyberpunk">
                  Neon Dystopian Cyberpunk
                </SelectItem>
                <SelectItem value="space-opera">Sci-Fi Space Opera</SelectItem>
                <SelectItem value="custom">Write Your Own</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {scenario === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="custom-scenario">Custom Scenario</Label>
              <Input
                id="custom-scenario"
                type="text"
                placeholder="Describe your scenario"
                className="bg-white border-black border text-black placeholder-gray-500 rounded-none focus:ring-2 focus:ring-black"
                value={customScenario}
                onChange={(e) => setCustomScenario(e.target.value)}
              />
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button
            className="w-full bg-black text-white hover:bg-gray-800 rounded-none font-bold"
            onClick={handleStart}
          >
            BEGIN JOURNEY
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
