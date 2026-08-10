import type { Atlas, AtlasManifest } from "@/lib/types"

let pendingAtlas: Promise<Atlas> | undefined

export function loadAtlas(): Promise<Atlas> {
  pendingAtlas ??= load()
  return pendingAtlas
}

async function load(): Promise<Atlas> {
  const response = await fetch("assets/tilepack/manifest.json")
  if (!response.ok) {
    throw new Error(`Tile manifest returned ${response.status}`)
  }
  const manifest = (await response.json()) as AtlasManifest
  const pages = await Promise.all(
    manifest.pages.map(async (name) => {
      const image = new Image()
      image.src = `assets/tilepack/${name}`
      await image.decode()
      return image
    }),
  )
  return { manifest, pages }
}
