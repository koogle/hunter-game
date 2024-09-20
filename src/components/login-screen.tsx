"use client";

import { useState } from "react";
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

export function LoginScreen() {
  const [playerName, setPlayerName] = useState("");

  return (
    <div className="flex items-center justify-center min-h-screen bg-white text-black font-mono">
      <Card className="w-[350px] bg-white border-black border-[1px] rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            ENDLESS JOURNEY
          </CardTitle>
          <CardDescription className="text-center text-gray-600">
            Embark on an infinite adventure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            type="text"
            placeholder="Enter your name"
            className="bg-white border-black border-[1px] text-black placeholder-gray-500 rounded-none focus:ring-2 focus:ring-black"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />
        </CardContent>
        <CardFooter>
          <Button
            className="w-full bg-black text-white hover:bg-gray-800 rounded-none font-bold"
            onClick={() => {}}
          >
            BEGIN JOURNEY
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
