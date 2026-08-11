import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { CheckIcon, CopyIcon, FolderOpenIcon, Maximize2Icon, MinusIcon, PlusIcon, UserRoundIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MarkerIcon, markerIconComponent } from "@/components/marker-icon"
import { markerHoverLabel } from "@/lib/markers"
import type {
  Atlas,
  CustomMarker,
  MarkerFocus,
  MarkerTarget,
  MapStats,
  Player,
  PoiMarker,
  WorldModel,
} from "@/lib/types"

interface MapViewportProps {
  atlas?: Atlas
  model?: WorldModel
  players: Player[]
  poiMarkers: PoiMarker[]
  customMarkers: CustomMarker[]
  focus?: MarkerFocus
  selectedKey?: string
  alwaysShowLabels: boolean
  showRoadNetwork: boolean
  placingCustomMarker: boolean
  onFile(file?: File): void
  onOpenFile(): void
  onPlaceCustomMarker(worldX: number, worldY: number): void
  onSelectMarker(target: MarkerTarget): void
  onStats(stats?: MapStats): void
}

interface Transform {
  scale: number
  x: number
  y: number
}

interface MapLevel {
  canvas: HTMLCanvasElement
  scale: number
}

interface MapContextMenu {
  x: number
  y: number
  worldX: number
  worldY: number
}

function roadConnections(mask: string, rotation: number): number[] {
  const maskEdges = [0, 3, 2, 1]
  const activeEdges = [...mask].reduce<number[]>(
    (result, bit, edge) => bit === "1" ? [...result, edge] : result,
    [],
  )
  const isCorner = activeEdges.length === 2 &&
    (activeEdges[0] - activeEdges[1] + 4) % 4 !== 2
  const isTJunction = activeEdges.length === 3
  return activeEdges.map((edge) => {
    const mappedEdge = maskEdges[edge]
    const reflectedEdge = isTJunction
      ? (mappedEdge + 2) % 4
      : isCorner && (mappedEdge === 0 || mappedEdge === 2)
        ? 2 - mappedEdge
        : mappedEdge
    return (reflectedEdge - rotation + 4) % 4
  })
}

export function MapViewport({
  atlas,
  model,
  players,
  poiMarkers,
  customMarkers,
  focus,
  selectedKey,
  alwaysShowLabels,
  showRoadNetwork,
  placingCustomMarker,
  onFile,
  onOpenFile,
  onPlaceCustomMarker,
  onSelectMarker,
  onStats,
}: MapViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldLevelsRef = useRef<MapLevel[]>([])
  const transformRef = useRef<Transform>({ scale: 1, x: 0, y: 0 })
  const appliedScaleRef = useRef<number | null>(null)
  const transformFrameRef = useRef<number | null>(null)
  const pointerRef = useRef<{
    id: number
    button: number
    x: number
    y: number
  } | null>(null)
  const [draggingFile, setDraggingFile] = useState(false)
  const [savePathCopied, setSavePathCopied] = useState(false)
  const [missingTiles, setMissingTiles] = useState(0)
  const [zoomPercent, setZoomPercent] = useState(100)
  const [contextMenu, setContextMenu] = useState<MapContextMenu>()
  const saveRootPath = "%APPDATA%\\Axolot Games\\Scrap Mechanic\\User"

  const copySavePath = async () => {
    try {
      await navigator.clipboard.writeText(saveRootPath)
    } catch {
      const textarea = document.createElement("textarea")
      textarea.value = saveRootPath
      textarea.style.position = "fixed"
      textarea.style.opacity = "0"
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      textarea.remove()
    }
    setSavePathCopied(true)
  }

  useEffect(() => {
    if (!contextMenu) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextMenu(undefined)
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [contextMenu])

  const drawViewport = useCallback(() => {
    const viewport = viewportRef.current
    const canvas = canvasRef.current
    const levels = worldLevelsRef.current
    if (!viewport || !canvas || !levels.length) return

    const width = viewport.clientWidth
    const height = viewport.clientHeight
    if (width <= 0 || height <= 0) return
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    const backingWidth = Math.max(1, Math.round(width * pixelRatio))
    const backingHeight = Math.max(1, Math.round(height * pixelRatio))
    if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
      canvas.width = backingWidth
      canvas.height = backingHeight
    }
    const context = canvas.getContext("2d", { alpha: true })
    if (!context) return
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    context.clearRect(0, 0, width, height)

    const { scale, x, y } = transformRef.current
    const world = levels[0].canvas
    const sourceLeft = Math.max(0, -x / scale)
    const sourceTop = Math.max(0, -y / scale)
    const sourceRight = Math.min(world.width, (width - x) / scale)
    const sourceBottom = Math.min(world.height, (height - y) / scale)
    if (sourceRight <= sourceLeft || sourceBottom <= sourceTop) return

    let level = levels[0]
    for (const candidate of levels) {
      if (candidate.scale >= scale) level = candidate
    }
    const sourceWidth = sourceRight - sourceLeft
    const sourceHeight = sourceBottom - sourceTop
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = "low"
    context.drawImage(
      level.canvas,
      sourceLeft * level.scale,
      sourceTop * level.scale,
      sourceWidth * level.scale,
      sourceHeight * level.scale,
      x + sourceLeft * scale,
      y + sourceTop * scale,
      sourceWidth * scale,
      sourceHeight * scale,
    )
  }, [])

  const applyTransform = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    const { scale, x, y } = transformRef.current
    if (scale !== appliedScaleRef.current) {
      map.style.setProperty("--marker-scale", String(1 / scale))
      appliedScaleRef.current = scale
      setZoomPercent(Math.round(scale * 100))
    }
    map.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`
    drawViewport()
  }, [drawViewport])

  const scheduleTransform = useCallback(() => {
    if (transformFrameRef.current !== null) return
    transformFrameRef.current = requestAnimationFrame(() => {
      transformFrameRef.current = null
      applyTransform()
    })
  }, [applyTransform])

  const zoomBy = useCallback((factor: number) => {
    const viewport = viewportRef.current
    if (!model || !viewport) return
    const current = transformRef.current
    const scale = Math.max(0.08, Math.min(8, current.scale * factor))
    const centreX = viewport.clientWidth / 2
    const centreY = viewport.clientHeight / 2
    transformRef.current = {
      scale,
      x: centreX - ((centreX - current.x) * scale) / current.scale,
      y: centreY - ((centreY - current.y) * scale) / current.scale,
    }
    scheduleTransform()
  }, [model, scheduleTransform])

  useEffect(() => () => {
    if (transformFrameRef.current !== null) {
      cancelAnimationFrame(transformFrameRef.current)
    }
  }, [])

  const fitMap = useCallback(() => {
    const viewport = viewportRef.current
    const world = worldLevelsRef.current[0]?.canvas
    if (!model || !viewport || !world || viewport.clientWidth <= 0 || viewport.clientHeight <= 0) return
    const margin = 28
    const scale = Math.min(
      (viewport.clientWidth - margin * 2) / world.width,
      (viewport.clientHeight - margin * 2) / world.height,
      2,
    )
    transformRef.current = {
      scale,
      x: (viewport.clientWidth - world.width * scale) / 2,
      y: (viewport.clientHeight - world.height * scale) / 2,
    }
    scheduleTransform()
  }, [model, scheduleTransform])

  useLayoutEffect(() => {
    if (!model || !atlas) {
      worldLevelsRef.current = []
      setMissingTiles(0)
      return
    }
    const { bounds, cells } = model
    const px = atlas.manifest.pixelsPerCell
    const width = bounds.xMax - bounds.xMin + 1
    const height = bounds.yMax - bounds.yMin + 1
    const canvas = document.createElement("canvas")
    canvas.width = width * px
    canvas.height = height * px
    const context = canvas.getContext("2d", { alpha: false })
    if (!context) throw new Error("This browser does not provide a 2D canvas")
    context.fillStyle = "rgb(38,86,128)"
    context.fillRect(0, 0, canvas.width, canvas.height)
    let missing = 0

    for (const [x, y, uuid, rotation, xOffset, yOffset] of cells) {
      const tile = atlas.manifest.tiles[uuid]
      const destinationX = (x - bounds.xMin) * px
      const destinationY = (bounds.yMax - y) * px
      if (!tile) {
        context.fillStyle = "rgb(150,60,150)"
        context.fillRect(destinationX, destinationY, px, px)
        missing += 1
        continue
      }
      const sourceX = tile.x + xOffset * px
      const sourceY = tile.y + tile.h - (yOffset + 1) * px
      context.save()
      context.translate(destinationX + px / 2, destinationY + px / 2)
      context.rotate((-rotation * Math.PI) / 2)
      context.drawImage(
        atlas.pages[tile.page],
        sourceX,
        sourceY,
        px,
        px,
        -px / 2,
        -px / 2,
        px,
        px,
      )
      context.restore()
    }
    const levels: MapLevel[] = [{ canvas, scale: 1 }]
    let previous = canvas
    for (const scale of [0.5, 0.25, 0.125]) {
      const reduced = document.createElement("canvas")
      reduced.width = Math.max(1, Math.ceil(canvas.width * scale))
      reduced.height = Math.max(1, Math.ceil(canvas.height * scale))
      const reducedContext = reduced.getContext("2d", { alpha: false })
      if (!reducedContext) break
      reducedContext.imageSmoothingEnabled = true
      reducedContext.imageSmoothingQuality = "low"
      reducedContext.drawImage(previous, 0, 0, reduced.width, reduced.height)
      levels.push({ canvas: reduced, scale })
      previous = reduced
    }
    worldLevelsRef.current = levels
    setMissingTiles(missing)
    requestAnimationFrame(fitMap)
  }, [atlas, fitMap, model])

  useEffect(() => {
    if (!model) {
      onStats(undefined)
      return
    }
    onStats({
      width: model.bounds.xMax - model.bounds.xMin + 1,
      height: model.bounds.yMax - model.bounds.yMin + 1,
      missingTiles,
      markerCount: poiMarkers.length + customMarkers.length,
    })
  }, [customMarkers.length, missingTiles, model, onStats, poiMarkers.length])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!focus || !model || !atlas || !viewport) return
    const px = atlas.manifest.pixelsPerCell
    const mapX = (focus.worldX / 64 - model.bounds.xMin) * px
    const mapY = (model.bounds.yMax + 1 - focus.worldY / 64) * px
    const scale = Math.max(transformRef.current.scale, 0.7)
    transformRef.current = {
      scale,
      x: viewport.clientWidth / 2 - mapX * scale,
      y: viewport.clientHeight / 2 - mapY * scale,
    }
    scheduleTransform()
  }, [atlas, focus, model, scheduleTransform])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const observer = new ResizeObserver(() => {
      if (model && viewportRef.current && viewportRef.current.clientWidth > 0 && viewportRef.current.clientHeight > 0) {
        scheduleTransform()
      }
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [model, scheduleTransform])

  const onWheel = (event: React.WheelEvent) => {
    if (!model) return
    event.preventDefault()
    setContextMenu(undefined)
    const viewport = viewportRef.current
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top
    const current = transformRef.current
    const scale = Math.max(
      0.08,
      Math.min(8, current.scale * Math.exp(-event.deltaY * 0.001)),
    )
    transformRef.current = {
      scale,
      x: mouseX - ((mouseX - current.x) * scale) / current.scale,
      y: mouseY - ((mouseY - current.y) * scale) / current.scale,
    }
    scheduleTransform()
  }

  const onPointerDown = (event: React.PointerEvent) => {
    if (!model || (event.button !== 0 && event.button !== 1)) return
    if (event.button === 1) event.preventDefault()
    setContextMenu(undefined)
    pointerRef.current = {
      id: event.pointerId,
      button: event.button,
      x: event.clientX,
      y: event.clientY,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent) => {
    const pointer = pointerRef.current
    if (!pointer || pointer.id !== event.pointerId) return
    if (placingCustomMarker && pointer.button === 0) return
    const current = transformRef.current
    transformRef.current = {
      ...current,
      x: current.x + event.clientX - pointer.x,
      y: current.y + event.clientY - pointer.y,
    }
    pointerRef.current = { ...pointer, x: event.clientX, y: event.clientY }
    scheduleTransform()
  }

  const stopPointer = (event: React.PointerEvent) => {
    if (pointerRef.current?.id === event.pointerId) pointerRef.current = null
  }

  const onPointerUp = (event: React.PointerEvent) => {
    const pointer = pointerRef.current
    if (!pointer || pointer.id !== event.pointerId) return
    pointerRef.current = null
    if (pointer.button !== 0 || !placingCustomMarker || !model || !atlas) return
    const viewport = viewportRef.current
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    const { scale, x, y } = transformRef.current
    const mapX = (event.clientX - rect.left - x) / scale
    const mapY = (event.clientY - rect.top - y) / scale
    const px = atlas.manifest.pixelsPerCell
    onPlaceCustomMarker(
      (mapX / px + model.bounds.xMin) * 64,
      (model.bounds.yMax + 1 - mapY / px) * 64,
    )
  }

  const onContextMenu = (event: React.MouseEvent) => {
    if (!model || !atlas) return
    event.preventDefault()
    const viewport = viewportRef.current
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    const localX = event.clientX - rect.left
    const localY = event.clientY - rect.top
    const { scale, x, y } = transformRef.current
    const mapX = (localX - x) / scale
    const mapY = (localY - y) / scale
    const px = atlas.manifest.pixelsPerCell
    setContextMenu({
      x: Math.max(8, Math.min(localX, viewport.clientWidth - 218)),
      y: Math.max(8, Math.min(localY, viewport.clientHeight - 48)),
      worldX: (mapX / px + model.bounds.xMin) * 64,
      worldY: (model.bounds.yMax + 1 - mapY / px) * 64,
    })
  }

  const px = atlas?.manifest.pixelsPerCell ?? 32
  const roadSegments = useMemo(() => {
    if (!model || !atlas) return []
    const segments: Array<{ cellX: number; cellY: number; x: number; y: number; connections: number[] }> = []
    for (const [x, y, uuid, rotation] of model.cells) {
      const tile = atlas.manifest.tiles[uuid]
      const match = tile?.name.match(/Road\((\d{4})\)/i)
      if (!match) continue
      const segment = {
        cellX: x,
        cellY: y,
        x: (x - model.bounds.xMin) * px,
        y: (model.bounds.yMax - y) * px,
        connections: roadConnections(match[1], rotation),
      }
      segments.push(segment)
    }
    return segments
  }, [atlas, model, px])

  return (
    <main
      ref={viewportRef}
      className={`map-viewport${placingCustomMarker ? " cursor-crosshair" : ""}`}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={stopPointer}
      onContextMenu={onContextMenu}
      onDragEnter={(event) => {
        event.preventDefault()
        setDraggingFile(true)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDraggingFile(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDraggingFile(false)
        onFile(event.dataTransfer.files[0])
      }}
    >
      {!model || !atlas ? (
        <section className={`drop-zone ${draggingFile ? "is-dragging" : ""}`}>
          <Card className="w-[min(40rem,calc(100%-2rem))] border-2 border-dashed border-blue-600/80 bg-card/95 shadow-2xl">
            <CardContent className="grid gap-2 p-8 text-center">
              <strong className="text-xl">Drop a survival save here</strong>
              <span className="text-sm text-muted-foreground">
                or choose its <code>.db</code> file
              </span>
              <Button className="mx-auto mt-2" onClick={onOpenFile}>
                <FolderOpenIcon />
                Choose save file
              </Button>

              <div className="mt-4 rounded-lg border bg-muted/45 p-3 text-left">
                <p className="text-xs font-medium text-foreground">Where are my saves?</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Open this directory, then choose your <code>User_&lt;SteamID&gt;</code> folder and go to <code>Save\Survival</code>.
                </p>
                <div className="mt-2 flex items-center gap-1.5 rounded-md bg-background/70 p-1.5 pl-2.5">
                  <code className="min-w-0 flex-1 break-all text-[0.6875rem] text-foreground/85">
                    {saveRootPath}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={() => void copySavePath()}
                    aria-label="Copy Scrap Mechanic save directory path"
                    data-copy-save-path
                  >
                    {savePathCopied ? <CheckIcon /> : <CopyIcon />}
                    {savePathCopied ? "Copied" : "Copy path"}
                  </Button>
                </div>
                <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-muted-foreground">
                  Paste the copied path into File Explorer's address bar. If several user folders exist, select the one belonging to your Steam account, then choose the save named in the game's Load Game menu.
                </p>
              </div>
              <small className="mt-2 text-muted-foreground">
                Processed locally. Your original save is never modified or uploaded.
              </small>
            </CardContent>
          </Card>
        </section>
      ) : (
        <>
          <canvas ref={canvasRef} className="map-canvas" />
          <div ref={mapRef} className="world-map">
            {showRoadNetwork && roadSegments.length > 0 && (
              <svg
                className="road-network"
                width={(model.bounds.xMax - model.bounds.xMin + 1) * px}
                height={(model.bounds.yMax - model.bounds.yMin + 1) * px}
                viewBox={`0 0 ${(model.bounds.xMax - model.bounds.xMin + 1) * px} ${(model.bounds.yMax - model.bounds.yMin + 1) * px}`}
                aria-label="Experimental road network overlay"
              >
                {roadSegments.map((segment, index) => {
                  const paths: React.ReactNode[] = []
                  const edgePadding = 4
                  const edges = [[px / 2, -edgePadding, px / 2, px / 2], [px + edgePadding, px / 2, px / 2, px / 2], [px / 2, px + edgePadding, px / 2, px / 2], [-edgePadding, px / 2, px / 2, px / 2]]
                  for (const destinationEdge of segment.connections) {
                      const [x1, y1, x2, y2] = edges[destinationEdge]
                      paths.push(<line key={destinationEdge} x1={x1} y1={y1} x2={x2} y2={y2} />)
                  }
                  return (
                    <g key={`${segment.x}:${segment.y}:${index}`} transform={`translate(${segment.x} ${segment.y})`}>
                      {paths}
                    </g>
                  )
                })}
              </svg>
            )}
            <div className={`marker-layer${alwaysShowLabels ? " labels-always-visible" : ""}`}>
            {players.map((player) => (
              <div
                className={`player-marker${player.player_id === 1 ? " host-player" : ""}${selectedKey === `player:${player.player_id}` ? " selected" : ""}`}
                key={`player:${player.player_id}`}
                style={{
                  left: (player.x / 64 - model.bounds.xMin) * px,
                  top: (model.bounds.yMax + 1 - player.y / 64) * px,
                } as React.CSSProperties}
                title={`${player.label}: ${player.x.toFixed(1)}, ${player.y.toFixed(1)}, ${player.z.toFixed(1)}`}
                onPointerDown={(event) => {
                  if (event.button === 0) event.stopPropagation()
                }}
                onClick={() => onSelectMarker({
                  key: `player:${player.player_id}`,
                  worldX: player.x,
                  worldY: player.y,
                })}
              >
                <UserRoundIcon className="player-symbol" />
                <span>{player.label}</span>
              </div>
            ))}
            {poiMarkers.map((marker) => {
              const label = markerHoverLabel(marker)
              return (
                <div
                  className={`poi-marker ${marker.category} ${marker.featureType ?? ""}${markerIconComponent(marker) ? " has-icon" : ""}${marker.warehouseCompleted ? " warehouse-completed" : ""}${marker.questCompleted ? " quest-completed" : ""}${marker.unlocked ? "" : " locked"}${selectedKey === marker.key ? " selected" : ""}`}
                  key={marker.key}
                  style={{
                    left: (marker.worldX / 64 - model.bounds.xMin) * px,
                    top: (model.bounds.yMax + 1 - marker.worldY / 64) * px,
                    "--marker-color": marker.color,
                  } as React.CSSProperties}
                  title={`${label}${marker.unlocked ? "" : " (locked)"}`}
                  onPointerDown={(event) => {
                    if (event.button === 0) event.stopPropagation()
                  }}
                  onClick={() => onSelectMarker(marker)}
                >
                  <MarkerIcon marker={marker} className="marker-symbol" />
                  <span>{label}</span>
                </div>
              )
            })}
            {customMarkers.map((marker) => (
              <div
                className={`poi-marker custom${selectedKey === marker.key ? " selected" : ""}`}
                key={marker.key}
                style={{
                  left: (marker.worldX / 64 - model.bounds.xMin) * px,
                  top: (model.bounds.yMax + 1 - marker.worldY / 64) * px,
                  "--marker-color": marker.color,
                } as React.CSSProperties}
                title={marker.description ? `${marker.label}: ${marker.description}` : marker.label}
                onPointerDown={(event) => {
                  if (event.button === 0) event.stopPropagation()
                }}
                onClick={() => onSelectMarker(marker)}
              >
                <span>{marker.label}</span>
              </div>
            ))}
            </div>
          </div>
          {placingCustomMarker && (
            <div className="pointer-events-none absolute top-3 left-1/2 z-20 -translate-x-1/2 rounded-lg border bg-card/90 px-3 py-1.5 text-xs shadow-md backdrop-blur">
              Click the map to place your marker
            </div>
          )}
          {contextMenu && (
            <div
              className="absolute z-30 min-w-52 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              role="menu"
              aria-label="Map actions"
              onPointerDown={(event) => event.stopPropagation()}
              onContextMenu={(event) => event.preventDefault()}
              data-map-context-menu
            >
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                role="menuitem"
                onClick={() => {
                  const { worldX, worldY } = contextMenu
                  setContextMenu(undefined)
                  onPlaceCustomMarker(worldX, worldY)
                }}
                data-create-custom-marker-here
              >
                <PlusIcon />
                Create custom marker here
              </Button>
            </div>
          )}
          <div
            className="absolute right-3 bottom-3 z-20 flex items-center rounded-lg border bg-card/90 p-0.5 shadow-md backdrop-blur"
            onPointerDown={(event) => event.stopPropagation()}
            data-map-controls
          >
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Zoom out"
              title="Zoom out"
              onClick={() => zoomBy(0.8)}
              data-zoom-out
            >
              <MinusIcon />
            </Button>
            <span
              className="min-w-11 px-1 text-center text-[0.625rem] tabular-nums text-muted-foreground"
              aria-label={`Zoom ${zoomPercent}%`}
              data-zoom-level
            >
              {zoomPercent}%
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Zoom in"
              title="Zoom in"
              onClick={() => zoomBy(1.25)}
              data-zoom-in
            >
              <PlusIcon />
            </Button>
            <div className="mx-0.5 h-4 w-px bg-border" />
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Fit map"
              title="Fit map"
              onClick={fitMap}
              data-fit-map
            >
              <Maximize2Icon />
            </Button>
          </div>
        </>
      )}
    </main>
  )
}
