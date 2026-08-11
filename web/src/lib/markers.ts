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
  const parts = [marker.label, marker.detail]
  if (marker.featureType === "warehouse") {
    parts.push(marker.warehouseCompleted ? "Exploded" : "Uncompleted")
  }
  return parts.filter(Boolean).join(" · ")
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
  const completedQuests = new Set(model.progression?.completedQuests ?? [])
  const completedGrowlabs = new Set(model.progression?.completedGrowlabs ?? [])
  const logs = new Set(model.progression?.unlockedLogs ?? [])
  // POI 109 (the second station) is an artificial map presentation and is
  // often present in the save's POI list from the start. Mirror the actual
  // progression of Station 1 instead of exposing it immediately.
  const mechanicStation1Unlocked =
    unlockedTypes.has(124) || quests.has("quest_mechanicstation")
  const warehouses = new Map(
    (model.warehouses ?? []).map((warehouse) => [
      `${warehouse.zero_cell_x}:${warehouse.zero_cell_y}`,
      warehouse,
    ]),
  )
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
      const isMechanicStation2 =
        definition.poiType === 109 && definition.category === "location"
      const unlocked = isLorenzoShip
        ? questUnlocked
        : isMechanicStation2
          ? mechanicStation1Unlocked
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
      const warehouseCompleted = definition.featureType === "warehouse"
        ? warehouses.get(`${originX}:${originY}`)?.destroyed ?? false
        : undefined
      const questCompleted = (definition.category === "main_quest" || definition.category === "side_quest") && definition.quest
        ? completedQuests.has(definition.quest)
        : undefined
      // Growlab 1 is tied to the minidungeon quest. Keep this separate from
      // `unlocked`: reaching/discovering a growlab is not the same as clearing it.
      const growlabCompleted = definition.category === "growlab"
        ? completedGrowlabs.has(definition.poiType) ||
          Boolean(definition.quest && completedQuests.has(definition.quest))
        : undefined
      result.push({
        ...definition,
        key: `poi:${definition.poiType}:${definition.category}:${definition.featureType ?? definition.label}:${originX}:${originY}:${definition.localX}:${definition.localY}:${uuid}`,
        tileUuid: uuid,
        unlocked,
        worldX,
        worldY,
        warehouseCompleted,
        questCompleted,
        growlabCompleted,
      })
    }
  }
  return result
}
