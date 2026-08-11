export type MarkerMode = "unlocked" | "all"
export type PoiCategory = "location" | "main_quest" | "side_quest" | "growlab" | "world_feature" | "beacon"
export type WorldFeatureType = "chemical_pond" | "oil_pond" | "warehouse" | "schematic_bot" | "ruin" | "caged_farmer"
export type MarkerCategory = "players" | PoiCategory

export type WorldCell = [
  x: number,
  y: number,
  uuid: string,
  rotation: number,
  xOffset: number,
  yOffset: number,
]

export interface Bounds {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

export interface Player {
  player_id: number
  steam_id: string | null
  world_id: number
  label: string
  x: number
  y: number
  z: number
}

export interface ProgressionState {
  activeQuests: string[]
  completedQuests: string[]
  unlockedLogs: string[]
  unlockedPoiTypes: number[]
  completedGrowlabs?: number[]
  unlockedRecipes: string[]
}

export interface WorldModel {
  bounds: Bounds
  seed: number | null
  cells: WorldCell[]
  players: Player[]
  beacons: Beacon[]
  warehouses: WarehouseState[]
  progression: ProgressionState
  game: { gametick: number | null }
}

export interface Beacon {
  id: number
  world_id: number
  label: string
  x: number
  y: number
  z: number
  icon_index: number
  color_index: number
  color: string
}

export interface WarehouseState {
  index: number
  world_id: number
  zero_cell_x: number
  zero_cell_y: number
  levels: number
  destroyed: boolean
  console_destroyed: boolean
  is_quest_warehouse: boolean
}

export interface PoiDefinition {
  poiType: number
  label: string
  category: PoiCategory
  featureType?: WorldFeatureType
  color: string
  quest: string | null
  log: string | null
  detail: string | null
  localX: number
  localY: number
}

export interface AtlasTile {
  page: number
  x: number
  y: number
  w: number
  h: number
  cellsX: number
  cellsY: number
  name: string
  biome: string
  markers?: PoiDefinition[]
}

export interface AtlasManifest {
  pixelsPerCell: number
  pages: string[]
  tiles: Record<string, AtlasTile>
}

export interface Atlas {
  manifest: AtlasManifest
  pages: HTMLImageElement[]
}

export interface MapStats {
  width: number
  height: number
  missingTiles: number
  markerCount: number
}

export interface PoiMarker extends PoiDefinition {
  key: string
  tileUuid: string
  unlocked: boolean
  worldX: number
  worldY: number
  warehouseCompleted?: boolean
  questCompleted?: boolean
  questRewards?: Array<{
    uuid: string
    title: string
  }>
  questCosmeticRewards?: string[]
  growlabEndRewardCompleted?: boolean
  growlabEndReward?: {
    uuid: string
    title: string
  }
  growlabBlockSchematics?: Array<{
    uuid: string
    title: string
  }>
  growlabBlockSchematicsUnlocked?: boolean
  growlabCompletedSteps?: number
  growlabTotalSteps?: number
  growlabCompleted?: boolean
}

export interface MarkerTarget {
  key: string
  worldX: number
  worldY: number
}

export interface CustomMarker extends MarkerTarget {
  label: string
  description: string
  color: string
}

export interface MarkerFocus extends MarkerTarget {
  request: number
}
