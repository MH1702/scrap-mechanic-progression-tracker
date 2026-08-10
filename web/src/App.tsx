import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ExternalLinkIcon, HeartIcon, ListChecksIcon, MapIcon, UploadIcon, XIcon } from "lucide-react"

import { MapViewport } from "@/components/map-viewport"
import { CustomMarkerEditor } from "@/components/custom-marker-editor"
import { MarkerDetailsSidebar } from "@/components/marker-details-sidebar"
import { MarkerSidebar } from "@/components/marker-sidebar"
import { SchematicProgression } from "@/components/schematic-progression"
import { Button } from "@/components/ui/button"
import { useSaveReader } from "@/hooks/use-save-reader"
import { loadAtlas } from "@/lib/atlas"
import { collectPoiMarkers } from "@/lib/markers"
import type {
  Atlas,
  CustomMarker,
  MarkerFocus,
  MarkerMode,
  MarkerTarget,
  MapStats,
  PoiMarker,
  WorldModel,
} from "@/lib/types"

const MARKER_MODE_STORAGE_PREFIX = "sm-progression-tracker:marker-mode:v2:"
const CUSTOM_MARKERS_STORAGE_PREFIX = "sm-progression-tracker:custom-markers:v1:"
const PROGRESSION_SPOILER_STORAGE_PREFIX = "sm-progression-tracker:progression-spoilers:v1:"
const PROJECT_REPOSITORY_URL = "https://github.com/MH1702/scrap-mechanic-progression-tracker"

interface MarkerPreference {
  mode: MarkerMode
  spoilerConsent: boolean
}

type MarkerModePrompt = "initial" | "confirm-all"
type AppView = "map" | "progression"

function worldFingerprint(model: WorldModel): string {
  let hash = 0xcbf29ce484222325n
  const update = (value: unknown) => {
    for (const character of String(value)) {
      hash ^= BigInt(character.charCodeAt(0))
      hash = BigInt.asUintN(64, hash * 0x100000001b3n)
    }
  }
  update(model.seed)
  update(`${model.bounds.xMin},${model.bounds.xMax},${model.bounds.yMin},${model.bounds.yMax}`)
  for (const cell of model.cells) update(cell.join(","))
  return hash.toString(16).padStart(16, "0")
}

const markerModeStorageKey = (model: WorldModel) =>
  `${MARKER_MODE_STORAGE_PREFIX}${worldFingerprint(model)}`

const customMarkersStorageKey = (model: WorldModel) =>
  `${CUSTOM_MARKERS_STORAGE_PREFIX}${worldFingerprint(model)}`

const progressionSpoilerStorageKey = (model: WorldModel) =>
  `${PROGRESSION_SPOILER_STORAGE_PREFIX}${worldFingerprint(model)}`

function storedMarkerPreference(key: string): MarkerPreference | undefined {
  try {
    const value = localStorage.getItem(key)
    if (!value) return undefined
    const parsed = JSON.parse(value) as Partial<MarkerPreference>
    if (parsed.mode !== "all" && parsed.mode !== "unlocked") return undefined
    if (typeof parsed.spoilerConsent !== "boolean") return undefined
    return { mode: parsed.mode, spoilerConsent: parsed.spoilerConsent }
  } catch {
    return undefined
  }
}

function storedCustomMarkers(key: string): CustomMarker[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is CustomMarker => {
      if (!value || typeof value !== "object") return false
      const marker = value as Partial<CustomMarker>
      return typeof marker.key === "string" && marker.key.startsWith("custom:") &&
        typeof marker.label === "string" && typeof marker.description === "string" &&
        typeof marker.color === "string" && typeof marker.worldX === "number" &&
        Number.isFinite(marker.worldX) && typeof marker.worldY === "number" &&
        Number.isFinite(marker.worldY)
    })
  } catch {
    return []
  }
}

export function App() {
  const inputRef = useRef<HTMLInputElement>(null)
  const devSaveRequested = useRef(false)
  const visibilityModelRef = useRef<WorldModel | undefined>(undefined)
  const markerModeStorageKeyRef = useRef<string | undefined>(undefined)
  const customMarkersStorageKeyRef = useRef<string | undefined>(undefined)
  const progressionSpoilerStorageKeyRef = useRef<string | undefined>(undefined)
  const reader = useSaveReader()
  const [atlas, setAtlas] = useState<Atlas>()
  const [atlasError, setAtlasError] = useState<string>()
  const [appView, setAppView] = useState<AppView>("map")
  const [aboutOpen, setAboutOpen] = useState(false)
  const [markerMode, setMarkerMode] = useState<MarkerMode>("unlocked")
  const [stats, setStats] = useState<MapStats>()
  const [selectedKey, setSelectedKey] = useState<string>()
  const [focus, setFocus] = useState<MarkerFocus>()
  const [alwaysShowLabels, setAlwaysShowLabels] = useState(false)
  const [spoilerConsent, setSpoilerConsent] = useState(false)
  const [progressionSpoilerConsent, setProgressionSpoilerConsent] = useState(false)
  const [markerModePrompt, setMarkerModePrompt] = useState<MarkerModePrompt>()
  const [customMarkers, setCustomMarkers] = useState<CustomMarker[]>([])
  const [placingCustomMarker, setPlacingCustomMarker] = useState(false)
  const [customMarkerDraft, setCustomMarkerDraft] = useState<Pick<CustomMarker, "worldX" | "worldY">>()
  const [editingCustomMarkerKey, setEditingCustomMarkerKey] = useState<string>()
  const [hiddenMarkerKeys, setHiddenMarkerKeys] = useState<Set<string>>(
    () => new Set(),
  )

  useEffect(() => {
    let current = true
    loadAtlas().then(
      (loaded) => current && setAtlas(loaded),
      (error: unknown) => {
        if (!current) return
        setAtlasError(error instanceof Error ? error.message : String(error))
      },
    )
    return () => {
      current = false
    }
  }, [])

  useEffect(() => {
    if (!aboutOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAboutOpen(false)
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [aboutOpen])

  useEffect(() => {
    if (!import.meta.env.DEV || reader.phase !== "ready" || devSaveRequested.current) {
      return
    }
    devSaveRequested.current = true
    void fetch("/__smpt/dev-save", { cache: "no-store" }).then(async (response) => {
      if (response.status === 404) return
      if (!response.ok) {
        throw new Error(`Development save request failed (${response.status})`)
      }
      const encodedName = response.headers.get("X-SMPT-Filename")
      const name = encodedName ? decodeURIComponent(encodedName) : "development-save.db"
      const file = new File([await response.blob()], name, {
        type: "application/x-sqlite3",
      })
      await reader.openFile(file)
    }).catch((error: unknown) => {
      console.warn("Could not auto-load the local development save", error)
    })
  }, [reader.phase, reader.openFile])

  const allMarkers = useMemo(
    () => collectPoiMarkers(reader.model, atlas, "all"),
    [reader.model, atlas],
  )
  const markers = useMemo(
    () => collectPoiMarkers(reader.model, atlas, markerMode),
    [reader.model, atlas, markerMode],
  )

  useEffect(() => {
    if (!reader.model || !atlas || visibilityModelRef.current === reader.model) {
      return
    }
    visibilityModelRef.current = reader.model
    const storageKey = markerModeStorageKey(reader.model)
    markerModeStorageKeyRef.current = storageKey
    const customStorageKey = customMarkersStorageKey(reader.model)
    customMarkersStorageKeyRef.current = customStorageKey
    const progressionStorageKey = progressionSpoilerStorageKey(reader.model)
    progressionSpoilerStorageKeyRef.current = progressionStorageKey
    try {
      setProgressionSpoilerConsent(
        localStorage.getItem(progressionStorageKey) === "accepted",
      )
    } catch {
      setProgressionSpoilerConsent(false)
    }
    setCustomMarkers(storedCustomMarkers(customStorageKey))
    setPlacingCustomMarker(false)
    setCustomMarkerDraft(undefined)
    setEditingCustomMarkerKey(undefined)
    setSelectedKey(undefined)
    const savedPreference = storedMarkerPreference(storageKey)
    setMarkerMode(savedPreference?.mode ?? "unlocked")
    setSpoilerConsent(savedPreference?.spoilerConsent ?? false)
    setMarkerModePrompt(savedPreference ? undefined : "initial")
    const defaultHiddenKeys = collectPoiMarkers(reader.model, atlas, "all")
      .filter((marker) =>
        marker.category === "main_quest" || marker.category === "beacon",
      )
      .map((marker) => marker.key)
    setHiddenMarkerKeys(new Set(defaultHiddenKeys))
  }, [atlas, reader.model])

  const saveMarkerPreference = useCallback((mode: MarkerMode, consent: boolean) => {
    setMarkerMode(mode)
    setSpoilerConsent(consent)
    const storageKey = markerModeStorageKeyRef.current
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          mode,
          spoilerConsent: consent,
        } satisfies MarkerPreference))
      } catch {
        // The preference remains active for this session if storage is unavailable.
      }
    }
    setMarkerModePrompt(undefined)
  }, [])

  const requestMarkerMode = useCallback((mode: MarkerMode) => {
    if (mode === "all" && !spoilerConsent) {
      setMarkerModePrompt("confirm-all")
      return
    }
    saveMarkerPreference(mode, spoilerConsent)
  }, [saveMarkerPreference, spoilerConsent])

  const acceptProgressionSpoilers = useCallback(() => {
    setProgressionSpoilerConsent(true)
    const storageKey = progressionSpoilerStorageKeyRef.current
    if (!storageKey) return
    try {
      localStorage.setItem(storageKey, "accepted")
    } catch {
      // Consent remains active for this session if storage is unavailable.
    }
  }, [])

  const persistCustomMarkers = useCallback((next: CustomMarker[]) => {
    setCustomMarkers(next)
    const storageKey = customMarkersStorageKeyRef.current
    if (!storageKey) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      // Custom markers remain available for this session if storage is unavailable.
    }
  }, [])

  const saveCustomMarker = useCallback((values: Pick<CustomMarker, "label" | "description" | "color">) => {
    if (editingCustomMarkerKey) {
      const next = customMarkers.map((marker) =>
        marker.key === editingCustomMarkerKey ? { ...marker, ...values } : marker,
      )
      persistCustomMarkers(next)
      setSelectedKey(editingCustomMarkerKey)
      setEditingCustomMarkerKey(undefined)
      return
    }
    if (!customMarkerDraft) return
    const marker: CustomMarker = {
      key: `custom:${crypto.randomUUID()}`,
      ...customMarkerDraft,
      ...values,
    }
    persistCustomMarkers([...customMarkers, marker])
    setCustomMarkerDraft(undefined)
    setSelectedKey(marker.key)
  }, [customMarkerDraft, customMarkers, editingCustomMarkerKey, persistCustomMarkers])

  const deleteCustomMarker = useCallback((key: string) => {
    persistCustomMarkers(customMarkers.filter((marker) => marker.key !== key))
    setSelectedKey(undefined)
    setEditingCustomMarkerKey(undefined)
  }, [customMarkers, persistCustomMarkers])

  const selectedMarker = allMarkers.find((marker) => marker.key === selectedKey)
  const visibleMarkers = useMemo(() => {
    const visible = markers.filter((marker: PoiMarker) =>
      !hiddenMarkerKeys.has(marker.key),
    )
    if (
      selectedMarker &&
      !hiddenMarkerKeys.has(selectedMarker.key) &&
      !visible.some((marker) => marker.key === selectedMarker.key)
    ) {
      visible.push(selectedMarker)
    }
    return visible
  }, [hiddenMarkerKeys, markers, selectedMarker])
  const visiblePlayers = useMemo(
    () => (reader.model?.players ?? []).filter((player) =>
      !hiddenMarkerKeys.has(`player:${player.player_id}`),
    ),
    [hiddenMarkerKeys, reader.model?.players],
  )
  const visibleCustomMarkers = useMemo(
    () => customMarkers.filter((marker) => !hiddenMarkerKeys.has(marker.key)),
    [customMarkers, hiddenMarkerKeys],
  )
  const selectedCustomMarker = customMarkers.find((marker) => marker.key === selectedKey)
  const selectedPlayer = reader.model?.players.find(
    (player) => `player:${player.player_id}` === selectedKey,
  )
  const editingCustomMarker = customMarkers.find(
    (marker) => marker.key === editingCustomMarkerKey,
  )
  const showMarkerDetails = Boolean(selectedMarker || selectedCustomMarker || selectedPlayer)
  const showCustomMarkerEditor = Boolean(customMarkerDraft || editingCustomMarker)
  const showRightSidebar = showMarkerDetails || showCustomMarkerEditor

  const toggleCategory = useCallback((keys: string[]) => {
    setHiddenMarkerKeys((current) => {
      const next = new Set(current)
      const allShown = keys.every((key) => !current.has(key))
      for (const key of keys) {
        if (allShown) next.add(key)
        else next.delete(key)
      }
      return next
    })
  }, [])

  const toggleMarker = useCallback((key: string) => {
    setHiddenMarkerKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const selectMarker = useCallback((target: MarkerTarget) => {
    setPlacingCustomMarker(false)
    setCustomMarkerDraft(undefined)
    setEditingCustomMarkerKey(undefined)
    setSelectedKey(target.key)
    setFocus((current) => ({
      ...target,
      request: (current?.request ?? 0) + 1,
    }))
  }, [])

  const questMarkerIds = useMemo(
    () => new Set(allMarkers.flatMap((marker) => marker.quest ? [marker.quest] : [])),
    [allMarkers],
  )

  const showQuestOnMap = useCallback((quest: string) => {
    const marker = allMarkers.find((candidate) => candidate.quest === quest)
    if (!marker) return
    setHiddenMarkerKeys((current) => {
      if (!current.has(marker.key)) return current
      const next = new Set(current)
      next.delete(marker.key)
      return next
    })
    setAppView("map")
    selectMarker(marker)
  }, [allMarkers, selectMarker])

  const toggleCustomMarkerPlacement = useCallback(() => {
    setPlacingCustomMarker((current) => !current)
    setCustomMarkerDraft(undefined)
    setEditingCustomMarkerKey(undefined)
    setSelectedKey(undefined)
  }, [])

  const placeCustomMarker = useCallback((worldX: number, worldY: number) => {
    setPlacingCustomMarker(false)
    setSelectedKey(undefined)
    setCustomMarkerDraft({ worldX, worldY })
  }, [])

  const onStats = useCallback((next?: MapStats) => setStats(next), [])
  const status = atlasError
    ? `Could not load map atlas: ${atlasError}`
    : reader.model && !atlas
      ? "Loading map atlas…"
      : reader.message

  const worldInfo = reader.model && stats
    ? `${stats.width} × ${stats.height} cells · seed ${reader.model.seed ?? "?"} · ${reader.model.players.length} player${reader.model.players.length === 1 ? "" : "s"} · ${stats.markerCount} map markers${stats.missingTiles ? ` · ${stats.missingTiles} unknown tiles` : ""}`
    : "No save loaded"

  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto] bg-background text-foreground">
      <header className="z-30 flex items-center justify-between gap-4 border-b bg-card/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-semibold tracking-tight">Scrap Mechanic Progression Tracker &amp; Map Viewer</h1>
          <p className="truncate text-xs text-muted-foreground" data-testid="status">
            {status}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <nav className="flex items-center rounded-lg border bg-muted/35 p-0.5" aria-label="Primary views">
            <Button
              variant={appView === "map" ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={appView === "map"}
              onClick={() => setAppView("map")}
              data-app-view="map"
            >
              <MapIcon />
              <span className="hidden sm:inline">Map</span>
            </Button>
            <Button
              variant={appView === "progression" ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={appView === "progression"}
              onClick={() => setAppView("progression")}
              data-app-view="progression"
            >
              <ListChecksIcon />
              <span className="hidden sm:inline">Progression</span>
            </Button>
          </nav>
          <Button
            variant="outline"
            disabled={reader.phase === "reading"}
            onClick={() => inputRef.current?.click()}
          >
            <UploadIcon data-icon="inline-start" />
            <span className="hidden sm:inline">Open save</span>
            <span className="sm:hidden">Open</span>
          </Button>
          <input
            ref={inputRef}
            className="hidden"
            type="file"
            accept=".db,application/x-sqlite3"
            onChange={(event) => {
              void reader.openFile(event.target.files?.[0])
              event.target.value = ""
            }}
          />
        </div>
      </header>

      <div className="grid min-h-0">
        <div
          className={`col-start-1 row-start-1 grid min-h-0 ${showRightSidebar ? "grid-cols-[19rem_minmax(0,1fr)_20rem]" : "grid-cols-[19rem_minmax(0,1fr)]"} ${appView === "map" ? "" : "invisible pointer-events-none"}`}
          aria-hidden={appView !== "map"}
        >
          <MarkerSidebar
            model={reader.model}
            markers={markers}
            customMarkers={customMarkers}
            hiddenMarkerKeys={hiddenMarkerKeys}
            selectedKey={selectedKey}
            alwaysShowLabels={alwaysShowLabels}
            markerMode={markerMode}
            placingCustomMarker={placingCustomMarker}
            onSelect={selectMarker}
            onAlwaysShowLabelsChange={setAlwaysShowLabels}
            onMarkerModeChange={requestMarkerMode}
            onToggleCustomMarkerPlacement={toggleCustomMarkerPlacement}
            onToggleCategory={toggleCategory}
            onToggleMarker={toggleMarker}
          />
          <MapViewport
            atlas={atlas}
            model={reader.model}
            players={visiblePlayers}
            poiMarkers={visibleMarkers}
            customMarkers={visibleCustomMarkers}
            focus={focus}
            selectedKey={selectedKey}
            alwaysShowLabels={alwaysShowLabels}
            placingCustomMarker={placingCustomMarker}
            onFile={(file) => void reader.openFile(file)}
            onOpenFile={() => inputRef.current?.click()}
            onPlaceCustomMarker={placeCustomMarker}
            onSelectMarker={selectMarker}
            onStats={onStats}
          />
          {showCustomMarkerEditor ? (
            <CustomMarkerEditor
              key={editingCustomMarker?.key ?? `draft:${customMarkerDraft!.worldX}:${customMarkerDraft!.worldY}`}
              marker={editingCustomMarker}
              position={editingCustomMarker ?? customMarkerDraft!}
              onCancel={() => {
                setCustomMarkerDraft(undefined)
                setEditingCustomMarkerKey(undefined)
              }}
              onSave={saveCustomMarker}
            />
          ) : showMarkerDetails && (
            <MarkerDetailsSidebar
              atlas={atlas}
              marker={selectedMarker}
              customMarker={selectedCustomMarker}
              player={selectedPlayer}
              onClose={() => setSelectedKey(undefined)}
              onDeleteCustomMarker={deleteCustomMarker}
              onEditCustomMarker={setEditingCustomMarkerKey}
              onSelect={selectMarker}
            />
          )}
        </div>
        <div
          className={`col-start-1 row-start-1 h-full min-h-0 overflow-hidden ${appView === "progression" ? "" : "invisible pointer-events-none"}`}
          aria-hidden={appView !== "progression"}
        >
          <SchematicProgression
            model={reader.model}
            spoilerConsent={progressionSpoilerConsent}
            onOpenSave={() => inputRef.current?.click()}
            onAcceptSpoilers={acceptProgressionSpoilers}
            onBackToMap={() => setAppView("map")}
            questMarkerIds={questMarkerIds}
            onShowQuestOnMap={showQuestOnMap}
          />
        </div>
      </div>

      <footer className="z-30 flex items-center justify-between gap-4 border-t bg-card px-4 py-2 text-xs text-muted-foreground">
        <span className="truncate">{worldInfo}</span>
        <button
          type="button"
          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setAboutOpen(true)}
          data-about-trigger
        >
          Made with
          <HeartIcon className="size-3.5 fill-rose-500 text-rose-500" aria-label="love" />
          by MH1702
        </button>
      </footer>

      {aboutOpen && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-black/45 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAboutOpen(false)
          }}
          data-about-dialog
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-title"
            className="relative w-full max-w-lg rounded-xl border bg-card p-6 shadow-2xl"
          >
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-3 right-3"
              aria-label="Close about dialog"
              autoFocus
              onClick={() => setAboutOpen(false)}
            >
              <XIcon />
            </Button>
            <div className="pr-8">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-rose-400">
                Made with <HeartIcon className="size-3.5 fill-current" /> by MH1702
              </p>
              <h2 id="about-title" className="font-heading text-xl font-semibold">
                Thanks for checking out my project!
              </h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              This project is a small labor of love for fellow Scrap Mechanics: a convenient way to explore your world, find what you are missing, and satisfy your inner completionist.
            </p>

            <div className="mt-5 rounded-lg border bg-muted/35 p-4">
              <h3 className="font-heading text-sm font-semibold">Attribution</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                The map-reading foundation comes from
                {" "}<a className="font-medium text-foreground underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground" href="https://github.com/parrotlive/ScrapMap" target="_blank" rel="noreferrer">ScrapMap by parrotlive</a>,
                whose original work made this map viewer possible. ScrapMap is included as a vendored dependency under its MIT license.
              </p>
            </div>

            <div className="mt-3 rounded-lg border bg-muted/35 p-4">
              <h3 className="font-heading text-sm font-semibold">Disclaimer</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                This is an independent fan-made tool and is not affiliated with or endorsed by Axolot Games. Scrap Mechanic and its related names and assets belong to their respective owners.
              </p>
            </div>

            <div className="mt-5 flex justify-end">
              {PROJECT_REPOSITORY_URL ? (
                <Button onClick={() => window.open(PROJECT_REPOSITORY_URL, "_blank", "noopener,noreferrer")}>
                  GitHub repository
                  <ExternalLinkIcon />
                </Button>
              ) : (
                <Button variant="outline" disabled>
                  GitHub repository coming soon
                </Button>
              )}
            </div>
          </section>
        </div>
      )}

      {markerModePrompt && reader.model && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 backdrop-blur-[2px]"
          data-marker-mode-prompt
          data-prompt-kind={markerModePrompt}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="marker-mode-title"
            className="w-full max-w-md rounded-xl border bg-card p-5 shadow-2xl"
          >
            <h2 id="marker-mode-title" className="font-heading text-lg font-semibold">
              {markerModePrompt === "initial"
                ? "How much do you want the map to reveal?"
                : "Do you want to see everything?"}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {markerModePrompt === "initial"
                ? "The tracker can follow your in-game progress or include locations and quests you have not discovered yet. Your choice is remembered for this save and can be changed later."
                : "Showing undiscovered markers may spoil locations and quests you have not encountered. Continuing records your consent for this save, so you will not be asked again."}
            </p>
            <p className="mt-3 text-[0.6875rem] text-muted-foreground">
              This affects only what the map can display. Your save is never modified.
            </p>
            {markerModePrompt === "initial" ? (
              <div className="mt-5 grid gap-2">
                <Button
                  variant="outline"
                  className="h-auto whitespace-normal py-2.5"
                  onClick={() => saveMarkerPreference("all", true)}
                  data-marker-mode-choice="all"
                >
                  I want to see everything
                </Button>
                <Button
                  variant="secondary"
                  className="h-auto whitespace-normal py-2.5"
                  autoFocus
                  onClick={() => saveMarkerPreference("unlocked", false)}
                  data-marker-mode-choice="unlocked"
                >
                  I only want to see what I have unlocked
                </Button>
              </div>
            ) : (
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setMarkerModePrompt(undefined)}
                  data-marker-mode-cancel
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => saveMarkerPreference("all", true)}
                  data-marker-mode-choice="all"
                >
                  I want to see everything
                </Button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
