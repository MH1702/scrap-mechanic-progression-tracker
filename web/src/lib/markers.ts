import type { Atlas, MarkerMode, PoiMarker, WorldModel } from "@/lib/types"

function worldPoint(
  cellX: number,
  cellY: number,
  rotation: number,
  localX: number,
  localY: number,
): [number, number] {
  if (rotation === 1) return [(cellX + 1) * 64 - localY, cellY * 64 + localX]
  if (rotation === 2) {
    return [(cellX + 1) * 64 - localX, (cellY + 1) * 64 - localY]
  }
  if (rotation === 3) return [cellX * 64 + localY, (cellY + 1) * 64 - localX]
  return [cellX * 64 + localX, cellY * 64 + localY]
}

function tileOrigin(
  cellX: number,
  cellY: number,
  rotation: number,
  xOffset: number,
  yOffset: number,
): [number, number] {
  if (rotation === 1) return [cellX + yOffset, cellY - xOffset]
  if (rotation === 2) return [cellX + xOffset, cellY + yOffset]
  if (rotation === 3) return [cellX - yOffset, cellY + xOffset]
  return [cellX - xOffset, cellY - yOffset]
}

export function markerLabel(marker: PoiMarker): string {
  return marker.detail ? `${marker.label} · ${marker.detail}` : marker.label
}

export function markerHoverLabel(marker: PoiMarker): string {
  const label = markerLabel(marker)
  if (marker.category === "main_quest") return `Main Quest: ${label}`
  if (marker.category === "side_quest") return `Side Quest: ${label}`
  return label
}

export function collectPoiMarkers(
  model: WorldModel | undefined,
  atlas: Atlas | undefined,
  mode: MarkerMode,
): PoiMarker[] {
  if (!model || !atlas) return []
  const unlockedTypes = new Set(model.progression?.unlockedPoiTypes ?? [])
  const quests = new Set([
    ...(model.progression?.activeQuests ?? []),
    ...(model.progression?.completedQuests ?? []),
  ])
  const logs = new Set(model.progression?.unlockedLogs ?? [])
  const result: PoiMarker[] = []
  for (const beacon of model.beacons ?? []) {
    result.push({
      key: `beacon:${beacon.id}`,
      tileUuid: "",
      poiType: 0,
      label: beacon.label,
      category: "beacon",
      color: beacon.color,
      quest: null,
      log: null,
      detail: null,
      localX: 0,
      localY: 0,
      unlocked: true,
      worldX: beacon.x,
      worldY: beacon.y,
    })
  }
  const seenPlacements = new Set<string>()
  for (const [x, y, uuid, rotation, xOffset, yOffset] of model.cells) {
    const definitions = atlas.manifest.tiles[uuid]?.markers ?? []
    if (definitions.length === 0) continue
    const [originX, originY] = tileOrigin(
      x, y, rotation, xOffset, yOffset,
    )
    const placementKey = `${uuid}:${originX}:${originY}:${rotation}`
    if (seenPlacements.has(placementKey)) continue
    seenPlacements.add(placementKey)
    for (const definition of definitions) {
      const questUnlocked = Boolean(
        definition.quest && quests.has(definition.quest),
      )
      const placeUnlocked =
        unlockedTypes.has(definition.poiType) ||
        Boolean(definition.log && logs.has(definition.log))
      const isQuest =
        definition.category === "main_quest" ||
        definition.category === "side_quest"
      const isWorldFeature = definition.category === "world_feature"
      const isLorenzoShip =
        definition.poiType === 105 && definition.category === "location"
      const unlocked = isLorenzoShip
        ? questUnlocked
        : isWorldFeature ||
          (definition.poiType === 101 && definition.category === "location") ||
          (isQuest ? questUnlocked : placeUnlocked || questUnlocked)
      if (mode === "unlocked" && !unlocked) continue
      const [worldX, worldY] = worldPoint(
        originX,
        originY,
        rotation,
        definition.localX,
        definition.localY,
      )
      result.push({
        ...definition,
        key: `poi:${definition.poiType}:${definition.category}:${definition.featureType ?? definition.label}:${originX}:${originY}:${definition.localX}:${definition.localY}:${uuid}`,
        tileUuid: uuid,
        unlocked,
        worldX,
        worldY,
      })
    }
  }
  return result
}
