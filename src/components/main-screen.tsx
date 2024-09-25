"use client";

import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GameStateContext } from "@/app/context/game_state";
import { GameState } from "@/lib/state";
import { Biome, GameStateChange } from "@/lib/types";
import { Button } from "./ui/button";
import {
  formatGameState,
  formatInteractionHistory,
  processGameStateChange,
} from "@/lib/utils";
import { processCommand } from "@/app/loading/llm";
import { genBiomeImage } from "@/app/loading/fal";
import { Loading } from "./ui/loading";

export function MainScreen() {
  const ctx = useContext(GameStateContext);

  if (ctx == null) {
    return <div>Loading...</div>;
  }

  return (
    <LoadedMainScreen
      gameState={ctx.gameState}
      setGameState={ctx.setGameState}
    />
  );
}

export function LoadedMainScreen({
  gameState,
  setGameState,
}: {
  gameState: GameState;
  setGameState: (gameState: GameState) => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [interactionHistory, setInteractionHistory] = useState<
    { userRequest: string; dmResponse: string }[]
  >([]);
  const [monsterText, setMonsterText] = useState("");
  const biomeId =
    gameState.world.map[gameState.player.location.y][
      gameState.player.location.x
    ];

  const biomesById = useMemo(() => {
    const map: { [id: string]: Biome } = {};
    gameState.world.biomes.forEach((b) => (map[b.id] = b));
    return map;
  }, [gameState.world.biomes]);
  const biome = biomesById[biomeId];
  const [command, setCommand] = useState("");
  const [gameText, setGameText] = useState("");

  const handleCommand = useCallback(
    async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        setIsLoading(true);

        const gameStateChange = await processCommand(
          formatGameState(gameState),
          formatInteractionHistory(interactionHistory),
          command
        );

        setGameText(`> ${command}\n\n${gameStateChange.dmAnswer}`);
        setCommand("");
        processGameStateChange(gameStateChange, gameState, setGameState);
        setInteractionHistory((prevHistory) => {
          const newHistory = [
            ...prevHistory,
            { userRequest: command, dmResponse: gameStateChange.dmAnswer },
          ];
          return newHistory.slice(-10);
        });
        setIsLoading(false);
      }
    },
    [command, gameState, interactionHistory, setGameState]
  );

  const updateImage = useCallback(
    (image: string | undefined) => {
      const state = { ...gameState };
      const biome = state.world.biomes.find((b) => b.id === biomeId);
      if (biome != null) {
        biome.imageUrl = image;
        setGameState(state);
      }
    },
    [biomeId, gameState, setGameState]
  );

  return (
    <div className="flex flex-col h-screen bg-white text-black font-mono p-4 space-y-4">
      <div className="flex flex-1 space-x-4">
        <div className="flex-1 border border-black p-4 overflow-auto">
          <div className="flex flex-col gap-2">
            <p>
              You are in the <b>{biome?.name}</b>
            </p>
            <p>{biome?.description}</p>
            {gameText.length > 0 && (
              <div className="flex w-full border-t border-black"></div>
            )}
            {gameState.world.currentMonster != null && (
              <div>
                You are being attacked by a{" "}
                <b>{gameState.world.currentMonster.name}!</b>
                <p>{gameState.world.currentMonster.description}</p>
              </div>
            )}
            {isLoading ? (
              <Loading />
            ) : (
              <p className="whitespace-pre-line">{gameText}</p>
            )}
          </div>
        </div>
        <div className="flex flex-col w-96 space-y-4">
          <div className="border border-black p-2 h-64">
            <div className="w-full h-full bg-gray-200">
              <GeneratedImage biome={biome} updateImage={updateImage} />
            </div>
          </div>
          <Tabs defaultValue="inventory" className="border h-full border-black">
            <TabsList className="w-full grid grid-cols-[1fr_1fr_auto]">
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
              <TabsTrigger
                value="config"
                className="data-[state=active]:bg-black data-[state=active]:text-white w-8"
              >
                ⋮
              </TabsTrigger>
            </TabsList>
            <TabsContent value="inventory" className="p-4">
              <Inventory />
            </TabsContent>
            <TabsContent value="stats" className="p-4">
              <Stats />
            </TabsContent>
            <TabsContent value="config" className="p-4">
              <Config />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <Input
        type="text"
        placeholder="What are you doing..."
        value={isLoading ? "" : command}
        disabled={isLoading}
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

const Config = () => {
  const ctx = useContext(GameStateContext);

  return (
    <div className="flex-col flex w-full">
      <Button onClick={() => ctx?.clearGameState()}>Clear local storage</Button>
    </div>
  );
};

const GeneratedImage = ({
  biome,
  updateImage,
}: {
  biome: Biome | undefined;
  updateImage: (image: string | undefined) => void;
}) => {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const generateImage = async () => {
      if (
        isLoading ||
        biome == null ||
        (biome.imageUrl != null && biome.imageUrl.length > 0)
      ) {
        return;
      }
      setIsLoading(true);
      if (biome != null) {
        const url = await genBiomeImage(biome.name, biome.description);
        if (url != null) {
          updateImage(url);
        }
        setIsLoading(false);
      }
    };

    generateImage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biome]);

  return (
    <div className="w-full h-full">
      {isLoading ? (
        <div className="w-full h-full flex items-center justify-center">
          <Loading />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={biome?.imageUrl}
          alt={`Biome: ${biome?.name}`}
          className="w-full h-full object-cover"
        />
      )}
    </div>
  );
};
