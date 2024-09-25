"use server";

import * as fal from "@fal-ai/serverless-client";

const imageCache = new Map<string, string>();

export async function genBiomeImage(
  name: string,
  description: string
): Promise<string | undefined> {
  // Check if the image for this biome name already exists in the cache
  if (imageCache.has(name)) {
    return imageCache.get(name);
  }

  try {
    imageCache.set(name, "");
    const result: {
      images: {
        url: string;
      }[];
    } = await fal.subscribe("fal-ai/flux/schnell", {
      input: {
        prompt: `Create an image of a biome for the purpose of a text based role playing game in the style of magic the gathering cards. The biome is called ${name} and the description is ${description}`,
      },
      logs: true,
    });

    const imageUrl = result.images[0]["url"];

    // Store the result in the cache
    imageCache.set(name, imageUrl);

    return imageUrl;
  } catch (error) {
    console.error("Error generating biome image:", error);
  }

  return undefined;
}

export async function genMonsterImage(
  name: string,
  description: string
): Promise<string | undefined> {
  // Check if the image for this biome name already exists in the cache
  if (imageCache.has(name)) {
    return imageCache.get(name);
  }

  try {
    imageCache.set(name, "");
    const result: {
      images: {
        url: string;
      }[];
    } = await fal.subscribe("fal-ai/flux/schnell", {
      input: {
        prompt: `Create an image of a monster for the purpose of a text based role playing game in the style of magic the gathering cards. The monster is called ${name} and the description is ${description}`,
      },
      logs: true,
    });

    const imageUrl = result.images[0]["url"];

    // Store the result in the cache
    imageCache.set(name, imageUrl);

    return imageUrl;
  } catch (error) {
    console.error("Error generating monster image:", error);
  }

  return undefined;
}
