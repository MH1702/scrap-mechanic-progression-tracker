import {
  ChevronRightIcon,
  AtomIcon,
  CastleIcon,
  CircleUserRoundIcon,
  DropletIcon,
  EyeIcon,
  EyeOffIcon,
  FlaskConicalIcon,
  HouseIcon,
  MapPinIcon,
  PlusIcon,
  SearchIcon,
  TractorIcon,
  UserRoundIcon,
  WarehouseIcon,
  XIcon,
} from "lucide-react"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { MarkerIcon } from "@/components/marker-icon"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { markerHoverLabel, markerLabel } from "@/lib/markers"
import type {
  CustomMarker,
  MarkerTarget,
  MarkerMode,
  PoiMarker,
  WorldFeatureType,
  WorldModel,
} from "@/lib/types"

interface MarkerSidebarProps {
  model?: WorldModel
  markers: PoiMarker[]
  customMarkers: CustomMarker[]
  hiddenMarkerKeys: ReadonlySet<string>
  selectedKey?: string
  alwaysShowLabels: boolean
  showRoadNetwork: boolean
  markerMode: MarkerMode
  placingCustomMarker: boolean
  onSelect(target: MarkerTarget): void
  onAlwaysShowLabelsChange(value: boolean): void
  onShowRoadNetworkChange(value: boolean): void
  onMarkerModeChange(value: MarkerMode): void
  onToggleCustomMarkerPlacement(): void
  onToggleCategory(keys: string[]): void
  onToggleMarker(key: string): void
}

const groups = [
  { category: "location", label: "Locations" },
  { category: "growlab", label: "Growlabs" },
  { category: "main_quest", label: "Main Quests" },
] as const

const worldFeatureTypes: Array<{
  type: WorldFeatureType
  label: string
  color: string
  icon: typeof DropletIcon
}> = [
  { type: "chemical_pond", label: "Chemical Ponds", color: "#ff5ca8", icon: FlaskConicalIcon },
  { type: "oil_pond", label: "Oil Ponds", color: "#111111", icon: DropletIcon },
  { type: "warehouse", label: "Warehouses", color: "#788cff", icon: WarehouseIcon },
  { type: "schematic_bot", label: "Schematic Bots", color: "#35d9f2", icon: AtomIcon },
  { type: "ruin", label: "Ruins", color: "#c78b5b", icon: CastleIcon },
  { type: "caged_farmer", label: "Caged Farmers", color: "#e6a34a", icon: CircleUserRoundIcon },
  { type: "farm", label: "Farm Tiles", color: "#82b950", icon: TractorIcon },
  { type: "scrap_village", label: "Scrap Villages", color: "#d9854f", icon: HouseIcon },
]

// GenericBuilderQuest.lua explicitly identifies these six quests as the
// Scrapper's chain. The Farmer list follows the requester names in the English
// quest localization; unusual requesters and standalone builds fall into Misc.
const sideQuestGroups = [
  {
    key: "scrapper",
    label: "Scrapper quests",
    quests: new Set([
      "quest_build_bigfan",
      "quest_build_carousel",
      "quest_build_catapult",
      "quest_build_musicbox",
      "quest_build_sawbladearm",
      "quest_build_steelbridge",
    ]),
  },
  {
    key: "farmer",
    label: "Farmer quests",
    quests: new Set([
      "quest_build_baguette",
      "quest_build_beesuit",
      "quest_build_compass",
      "quest_build_cozybed",
      "quest_build_crowbar",
      "quest_build_garden",
      "quest_build_nicehouse",
      "quest_build_popcorn",
      "quest_build_sledgehammer",
      "quest_build_wochouse",
      "quest_build_xylophone",
    ]),
  },
  { key: "misc", label: "Misc", quests: null },
] as const

// Campaign order from the game's main quest chain. Quests whose destinations
// exist only in underground/interior worlds are intentionally absent.
const mainQuestProgression = [
  ["quest_tutorial", ["Crashed Ship", "Crashed Tower"]],
  ["quest_mechanicstation", ["Mechanic Station 1"]],
  ["quest_mystery_call", ["Trader's Hideout", "Autumn Ruins"]],
  ["quest_feed_the_farmers", ["Vegetable Packing Station", "Trader's Hideout"]],
  ["quest_clear_minidungeon", ["Growlab 1"]],
  ["quest_build_watchtower", ["Watchtower"]],
  ["quest_find_recording", ["Burial Site"]],
  ["quest_clear_warehouse", ["Warehouse"]],
  ["quest_save_watchtower", ["Watchtower"]],
  ["quest_rebuild_watchtower", ["Watchtower"]],
  ["quest_find_excavation", ["Excavation Bridge", "Excavation Elevator"]],
  ["quest_bosstrain", ["Boss Mountain", "Crashed Ship"]],
  ["quest_endgame", ["Lorenzo's Ship"]],
] as const

const mainQuestRanks: ReadonlyMap<string, number> = new Map(
  mainQuestProgression.map(([quest], index) => [quest, index]),
)
const mainQuestDestinationRanks: ReadonlyMap<string, number> = new Map(
  mainQuestProgression.flatMap(([quest, destinations]) =>
    destinations.map((destination, index) => [`${quest}:${destination}`, index] as const),
  ),
)

// Location entries follow Survival/Logs/log_entries.json. Both mechanic
// stations share one logbook entry, so their in-world numbering breaks the tie.
// Lorenzo's Ship is a map POI but not a normal location entry in that list.
const locationPoiOrder = [101, 124, 109, 104, 110, 111, 102, 105]
const locationPoiRanks = new Map(
  locationPoiOrder.map((poiType, index) => [poiType, index]),
)

function sortMarkers(markers: PoiMarker[]): PoiMarker[] {
  return markers.sort((left, right) => {
    if (left.category === "location" && right.category === "location") {
      const locationOrder =
        (locationPoiRanks.get(left.poiType) ?? Number.MAX_SAFE_INTEGER) -
        (locationPoiRanks.get(right.poiType) ?? Number.MAX_SAFE_INTEGER)
      if (locationOrder !== 0) return locationOrder
    }
    if (left.category === "main_quest" && right.category === "main_quest") {
      const questOrder =
        (mainQuestRanks.get(left.quest ?? "") ?? Number.MAX_SAFE_INTEGER) -
        (mainQuestRanks.get(right.quest ?? "") ?? Number.MAX_SAFE_INTEGER)
      if (questOrder !== 0) return questOrder
      const destinationOrder =
        (mainQuestDestinationRanks.get(`${left.quest}:${left.detail}`) ?? Number.MAX_SAFE_INTEGER) -
        (mainQuestDestinationRanks.get(`${right.quest}:${right.detail}`) ?? Number.MAX_SAFE_INTEGER)
      if (destinationOrder !== 0) return destinationOrder
    }
    return left.label.localeCompare(right.label, undefined, { numeric: true })
  })
}

function markerSearchText(marker: PoiMarker): string {
  return [
    markerHoverLabel(marker),
    marker.category.replaceAll("_", " "),
    marker.quest,
  ].filter(Boolean).join(" ").toLocaleLowerCase()
}

export function MarkerSidebar({
  model,
  markers,
  customMarkers,
  hiddenMarkerKeys,
  selectedKey,
  alwaysShowLabels,
  showRoadNetwork,
  markerMode,
  placingCustomMarker,
  onSelect,
  onAlwaysShowLabelsChange,
  onShowRoadNetworkChange,
  onMarkerModeChange,
  onToggleCustomMarkerPlacement,
  onToggleCategory,
  onToggleMarker,
}: MarkerSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
  const searching = normalizedQuery.length > 0
  const filteredPlayers = (model?.players ?? []).filter((player) =>
    !searching || `player ${player.label}`.toLocaleLowerCase().includes(normalizedQuery),
  )
  const filteredMarkers = markers.filter((marker) =>
    !searching || markerSearchText(marker).includes(normalizedQuery),
  )
  const filteredCustomMarkers = customMarkers.filter((marker) =>
    !searching || `${marker.label} ${marker.description} custom marker`
      .toLocaleLowerCase().includes(normalizedQuery),
  )
  const sideQuestMarkers = sortMarkers(filteredMarkers.filter(
    (marker) => marker.category === "side_quest",
  ))
  const beaconMarkers = sortMarkers(filteredMarkers.filter(
    (marker) => marker.category === "beacon",
  ))
  const allWorldFeatureMarkers = markers.filter(
    (marker) => marker.category === "world_feature",
  )
  const matchingWorldFeatureTypes = worldFeatureTypes.filter(({ type }) =>
    !searching || filteredMarkers.some(
      (marker) => marker.category === "world_feature" && marker.featureType === type,
    ),
  )
  const searchResultCount = filteredPlayers.length + filteredMarkers.length + filteredCustomMarkers.length
  const allMarkerKeys = [
    ...(model?.players ?? []).map((player) => `player:${player.player_id}`),
    ...markers.map((marker) => marker.key),
    ...customMarkers.map((marker) => marker.key),
  ]
  const allVisible = allMarkerKeys.length > 0 && allMarkerKeys.every(
    (key) => !hiddenMarkerKeys.has(key),
  )

  return (
    <aside
      className="flex min-h-0 w-76 flex-col border-r bg-card"
      data-testid="marker-sidebar"
    >
      <div className="px-4 py-3">
        <div className="flex items-center gap-2">
          <MapPinIcon className="size-4 text-muted-foreground" />
          <h2 className="font-heading text-sm font-medium">Map markers</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Select a marker to locate it on the map.
        </p>
        {model && (
          <>
            <div className="relative mt-3">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search markers…"
                aria-label="Search markers"
                className="pr-8 pl-8 text-xs [&::-webkit-search-cancel-button]:hidden"
                data-marker-search
              />
              {searchQuery && (
                <button
                  type="button"
                  className="absolute top-1/2 right-1.5 grid size-5 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Clear marker search"
                  onClick={() => setSearchQuery("")}
                >
                  <XIcon className="size-3.5" />
                </button>
              )}
            </div>
            <div className="mt-2 space-y-0.5" data-marker-preferences>
              <div className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/60">
                <span className="min-w-0">
                  <span className="block text-xs font-medium">Always show labels</span>
                  <span className="block text-[0.625rem] text-muted-foreground">
                    Otherwise labels appear on hover.
                  </span>
                </span>
                <Switch
                  checked={alwaysShowLabels}
                  onCheckedChange={onAlwaysShowLabelsChange}
                  aria-label="Always show labels"
                  data-label-visibility
                />
              </div>
              <div
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/60"
              >
                <span className="min-w-0">
                  <span className="block text-xs font-medium">Show road network</span>
                  <span className="block text-[0.625rem] text-muted-foreground">
                    Experimental tile-based visualization.
                  </span>
                </span>
                <Switch
                  checked={showRoadNetwork}
                  onCheckedChange={onShowRoadNetworkChange}
                  aria-label="Show road network"
                  data-road-network
                />
              </div>
              <div
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/60"
                data-marker-mode={markerMode}
              >
                <span className="min-w-0">
                  <span className="block text-xs font-medium">Show undiscovered markers</span>
                  <span className="block text-[0.625rem] text-muted-foreground">
                    May reveal locations and quests.
                  </span>
                </span>
                <Switch
                  checked={markerMode === "all"}
                  onCheckedChange={(checked) => onMarkerModeChange(
                    checked ? "all" : "unlocked",
                  )}
                  aria-label="Show undiscovered markers"
                  data-marker-mode-control
                />
              </div>
            </div>
          </>
        )}
      </div>
      <Separator />

      {!model ? (
        <div className="px-4 py-6 text-sm text-muted-foreground">
          Load a survival save to see its markers.
        </div>
      ) : (
        <>
          <div className="grid gap-2 px-3 py-2">
            <Button
              variant={placingCustomMarker ? "secondary" : "outline"}
              className="w-full justify-start"
              onClick={onToggleCustomMarkerPlacement}
              data-add-custom-marker
            >
              {placingCustomMarker ? <XIcon /> : <PlusIcon />}
              {placingCustomMarker ? "Cancel marker placement" : "Add custom marker"}
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-start"
              disabled={allMarkerKeys.length === 0}
              onClick={() => onToggleCategory(allMarkerKeys)}
              data-global-visibility
            >
              {allVisible ? <EyeOffIcon /> : <EyeIcon />}
              {allVisible ? "Hide all markers" : "Show all markers"}
            </Button>
          </div>
          <Separator />
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-5 p-3">
            {(!searching || filteredPlayers.length > 0) && <MarkerGroup
              title="Players"
              count={filteredPlayers.length}
              visibility={groupVisibility(
                filteredPlayers.map((player) => `player:${player.player_id}`),
                hiddenMarkerKeys,
              )}
              onToggle={() => onToggleCategory(
                filteredPlayers.map((player) => `player:${player.player_id}`),
              )}
              forceExpanded={searching}
            >
              {filteredPlayers.map((player) => {
                const key = `player:${player.player_id}`
                return (
                  <MarkerRow
                    key={key}
                    active={selectedKey === key}
                    color="#e45343"
                    icon={<UserRoundIcon className="size-3.5" />}
                    label={player.label}
                    detail={`${player.x.toFixed(0)}, ${player.y.toFixed(0)}`}
                    visible={!hiddenMarkerKeys.has(key)}
                    onClick={() => onSelect({
                      key,
                      worldX: player.x,
                      worldY: player.y,
                    })}
                    onToggle={() => onToggleMarker(key)}
                  />
                )
              })}
            </MarkerGroup>}

            {(!searching || beaconMarkers.length > 0) && <MarkerGroup
              title="Beacons"
              count={beaconMarkers.length}
              defaultCollapsed
              visibility={groupVisibility(
                beaconMarkers.map((marker) => marker.key),
                hiddenMarkerKeys,
              )}
              onToggle={() => onToggleCategory(
                beaconMarkers.map((marker) => marker.key),
              )}
              forceExpanded={searching}
            >
              {beaconMarkers.length === 0 ? (
                <p className="px-2 py-2 text-[0.625rem] text-muted-foreground">
                  No placed in-game Beacons found in this world.
                </p>
              ) : beaconMarkers.map((marker) => (
                <MarkerRow
                  key={marker.key}
                  active={selectedKey === marker.key}
                  color={marker.color}
                  label={marker.label}
                  detail={marker.detail ?? undefined}
                  visible={!hiddenMarkerKeys.has(marker.key)}
                  onClick={() => onSelect(marker)}
                  onToggle={() => onToggleMarker(marker.key)}
                />
              ))}
            </MarkerGroup>}

            {(!searching || filteredCustomMarkers.length > 0) && <MarkerGroup
              title="Custom Markers"
              count={filteredCustomMarkers.length}
              visibility={groupVisibility(
                filteredCustomMarkers.map((marker) => marker.key),
                hiddenMarkerKeys,
              )}
              onToggle={() => onToggleCategory(
                filteredCustomMarkers.map((marker) => marker.key),
              )}
              forceExpanded={searching}
            >
              {filteredCustomMarkers.length === 0 ? (
                <p className="px-2 py-2 text-[0.625rem] text-muted-foreground">
                  Add a marker, then click its position on the map.
                </p>
              ) : filteredCustomMarkers.map((marker) => (
                <MarkerRow
                  key={marker.key}
                  active={selectedKey === marker.key}
                  color={marker.color}
                  label={marker.label}
                  detail={marker.description || undefined}
                  visible={!hiddenMarkerKeys.has(marker.key)}
                  onClick={() => onSelect(marker)}
                  onToggle={() => onToggleMarker(marker.key)}
                />
              ))}
            </MarkerGroup>}

            {(!searching || matchingWorldFeatureTypes.length > 0) && <MarkerGroup
              title="World Features"
              count={allWorldFeatureMarkers.length}
              visibility={groupVisibility(
                allWorldFeatureMarkers.map((marker) => marker.key),
                hiddenMarkerKeys,
              )}
              onToggle={() => onToggleCategory(
                allWorldFeatureMarkers.map((marker) => marker.key),
              )}
              forceExpanded={searching}
            >
              {matchingWorldFeatureTypes.map((feature) => {
                const FeatureIcon = feature.icon
                const items = allWorldFeatureMarkers.filter(
                  (marker) => marker.featureType === feature.type,
                )
                if (items.length === 0) return null
                const keys = items.map((marker) => marker.key)
                const visibility = groupVisibility(keys, hiddenMarkerKeys)
                return (
                  <MarkerRow
                    key={feature.type}
                    active={false}
                    color={feature.color}
                    icon={<FeatureIcon
                      className="size-2.5"
                      style={{ color: feature.type === "oil_pond" ? "#f4f6f5" : feature.color }}
                    />}
                    label={feature.label}
                    detail={`${items.length} marker${items.length === 1 ? "" : "s"}`}
                    visible={visibility !== "none"}
                    onClick={() => onToggleCategory(keys)}
                    onToggle={() => onToggleCategory(keys)}
                  />
                )
              })}
            </MarkerGroup>}

            {groups.map((group) => {
              const items = sortMarkers(filteredMarkers.filter(
                (marker) => marker.category === group.category,
              ))
              if (searching && items.length === 0) return null
              return (
                <MarkerGroup
                  key={group.category}
                  title={group.label}
                  count={items.length}
                  defaultCollapsed={group.category === "main_quest"}
                  visibility={groupVisibility(
                    items.map((marker) => marker.key),
                    hiddenMarkerKeys,
                  )}
                  onToggle={() => onToggleCategory(
                    items.map((marker) => marker.key),
                  )}
                  forceExpanded={searching}
                >
                  {items.map((marker) => (
                    <MarkerRow
                      key={marker.key}
                      active={selectedKey === marker.key}
                      color={marker.color}
                      icon={<MarkerIcon marker={marker} className="size-2.5" />}
                      label={markerLabel(marker)}
                      detail={marker.unlocked ? undefined : "Undiscovered"}
                      locked={!marker.unlocked}
                      visible={!hiddenMarkerKeys.has(marker.key)}
                      onClick={() => onSelect(marker)}
                      onToggle={() => onToggleMarker(marker.key)}
                    />
                  ))}
                </MarkerGroup>
              )
            })}

            {(!searching || sideQuestMarkers.length > 0) && <MarkerGroup
              title="Side Quests"
              count={sideQuestMarkers.length}
              visibility={groupVisibility(
                sideQuestMarkers.map((marker) => marker.key),
                hiddenMarkerKeys,
              )}
              onToggle={() => onToggleCategory(
                sideQuestMarkers.map((marker) => marker.key),
              )}
              forceExpanded={searching}
            >
              <div className="space-y-3">
                {sideQuestGroups.map((group) => {
                  const claimedByEarlierGroup = (marker: PoiMarker) =>
                    sideQuestGroups.slice(0, -1).some(
                      (candidate) => candidate.quests?.has(marker.quest ?? ""),
                    )
                  const items = group.quests
                    ? sideQuestMarkers.filter((marker) =>
                        group.quests.has(marker.quest ?? ""),
                      )
                    : sideQuestMarkers.filter((marker) => !claimedByEarlierGroup(marker))
                  if (items.length === 0) return null
                  return (
                    <SideQuestGroup
                      key={group.key}
                      groupKey={group.key}
                      title={group.label}
                      count={items.length}
                      visibility={groupVisibility(
                        items.map((marker) => marker.key),
                        hiddenMarkerKeys,
                      )}
                      onToggle={() => onToggleCategory(
                        items.map((marker) => marker.key),
                      )}
                      forceExpanded={searching}
                    >
                      <div className="space-y-0.5 border-l border-border/70 pl-1">
                        {items.map((marker) => (
                          <MarkerRow
                            key={marker.key}
                            active={selectedKey === marker.key}
                            color={marker.color}
                            icon={<MarkerIcon marker={marker} className="size-2.5" />}
                            label={markerLabel(marker)}
                            detail={marker.unlocked ? undefined : "Undiscovered"}
                            locked={!marker.unlocked}
                            visible={!hiddenMarkerKeys.has(marker.key)}
                            onClick={() => onSelect(marker)}
                            onToggle={() => onToggleMarker(marker.key)}
                          />
                        ))}
                      </div>
                    </SideQuestGroup>
                  )
                })}
              </div>
            </MarkerGroup>}
            {searching && searchResultCount === 0 && (
              <div className="px-2 py-8 text-center text-xs text-muted-foreground">
                No markers match “{searchQuery.trim()}”.
              </div>
            )}
            </div>
          </ScrollArea>
        </>
      )}
    </aside>
  )
}

type GroupVisibility = "all" | "some" | "none"

function groupVisibility(
  keys: string[],
  hiddenMarkerKeys: ReadonlySet<string>,
): GroupVisibility {
  const shown = keys.filter((key) => !hiddenMarkerKeys.has(key)).length
  if (shown === 0) return "none"
  if (shown === keys.length) return "all"
  return "some"
}

function MarkerGroup({
  title,
  count,
  visibility,
  onToggle,
  defaultCollapsed = false,
  forceExpanded = false,
  children,
}: {
  title: string
  count: number
  visibility: GroupVisibility
  onToggle(): void
  defaultCollapsed?: boolean
  forceExpanded?: boolean
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(() => defaultCollapsed || visibility === "none")
  const allVisible = visibility === "all"
  const expanded = forceExpanded || !collapsed

  return (
    <section data-marker-group={title}>
      <div className="mb-1 flex items-center gap-1">
        <Button
          variant="ghost"
          size="xs"
          className="h-auto min-w-0 flex-1 justify-start px-1.5 py-1.5 text-muted-foreground disabled:opacity-100"
          disabled={forceExpanded}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${title}`}
          title={forceExpanded ? "Expanded while searching" : `${collapsed ? "Expand" : "Collapse"} ${title}`}
          onClick={() => setCollapsed((current) => !current)}
          data-category-foldout={title}
        >
          <ChevronRightIcon
            className={`transition-transform ${expanded ? "rotate-90" : ""}`}
          />
          <h3 className="truncate text-[0.6875rem] font-semibold tracking-wider uppercase">
            {title}
          </h3>
          <span className="ml-auto text-[0.6875rem] tabular-nums">{count}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          role="checkbox"
          aria-checked={visibility === "some" ? "mixed" : visibility === "all"}
          aria-label={`${allVisible ? "Hide all" : "Show all"} ${title}`}
          title={`${allVisible ? "Hide all" : "Show all"} ${title}`}
          onClick={onToggle}
          data-category-visibility={title}
          data-visibility-state={visibility}
        >
          {visibility === "none" ? (
            <EyeOffIcon />
          ) : (
            <EyeIcon className={visibility === "some" ? "opacity-60" : ""} />
          )}
        </Button>
      </div>
      {expanded && (
        <div className="space-y-0.5">{children}</div>
      )}
    </section>
  )
}

function SideQuestGroup({
  groupKey,
  title,
  count,
  visibility,
  onToggle,
  forceExpanded = false,
  children,
}: {
  groupKey: string
  title: string
  count: number
  visibility: GroupVisibility
  onToggle(): void
  forceExpanded?: boolean
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(() => visibility === "none")
  const allVisible = visibility === "all"
  const expanded = forceExpanded || !collapsed

  return (
    <section data-side-quest-group={groupKey}>
      <div className="mb-1 flex items-center gap-1">
        <Button
          variant="ghost"
          size="xs"
          className="h-auto min-w-0 flex-1 justify-start px-1.5 py-1 text-muted-foreground disabled:opacity-100"
          disabled={forceExpanded}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${title}`}
          title={forceExpanded ? "Expanded while searching" : `${collapsed ? "Expand" : "Collapse"} ${title}`}
          onClick={() => setCollapsed((current) => !current)}
          data-category-foldout={title}
        >
          <ChevronRightIcon
            className={`transition-transform ${expanded ? "rotate-90" : ""}`}
          />
          <h4 className="truncate text-[0.625rem] font-semibold">{title}</h4>
          <span className="ml-auto text-[0.625rem] tabular-nums">{count}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          role="checkbox"
          aria-checked={visibility === "some" ? "mixed" : visibility === "all"}
          aria-label={`${allVisible ? "Hide all" : "Show all"} ${title}`}
          title={`${allVisible ? "Hide all" : "Show all"} ${title}`}
          onClick={onToggle}
          data-category-visibility={title}
          data-visibility-state={visibility}
        >
          {visibility === "none" ? (
            <EyeOffIcon />
          ) : (
            <EyeIcon className={visibility === "some" ? "opacity-60" : ""} />
          )}
        </Button>
      </div>
      {expanded && children}
    </section>
  )
}

function MarkerRow({
  active,
  color,
  detail,
  icon,
  label,
  locked,
  onClick,
  onToggle,
  visible,
}: {
  active: boolean
  color: string
  detail?: string
  icon?: React.ReactNode
  label: string
  locked?: boolean
  onClick(): void
  onToggle(): void
  visible: boolean
}) {
  return (
    <div
      className={`flex items-center rounded-lg ${active ? "bg-accent text-accent-foreground" : ""} ${visible ? "" : "opacity-60"}`}
      data-marker-label={label}
      data-marker-visible={visible ? "true" : "false"}
    >
      <Button
        variant="ghost"
        className="h-auto min-w-0 flex-1 justify-start gap-2.5 px-2 py-2 text-left"
        onClick={onClick}
      >
        <span
          className="grid size-4 shrink-0 place-items-center rounded-full"
          style={icon ? {
            backgroundColor: `color-mix(in srgb, ${color} 25%, #101512)`,
            boxShadow: `inset 0 0 0 1.5px ${color}`,
          } : { backgroundColor: color }}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">{label}</span>
          {detail && (
            <span className="flex items-center gap-1 text-[0.625rem] text-muted-foreground">
              {detail}
            </span>
          )}
        </span>
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        className="mr-1"
        role="checkbox"
        aria-checked={visible}
        aria-label={`${visible ? "Hide" : "Show"} ${label}`}
        title={`${visible ? "Hide" : "Show"} ${label}`}
        onClick={onToggle}
        data-marker-visibility={label}
      >
        {visible ? <EyeIcon /> : <EyeOffIcon />}
      </Button>
    </div>
  )
}
