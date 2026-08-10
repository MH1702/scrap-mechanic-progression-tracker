import { useEffect, useRef, useState } from "react"
import { CrosshairIcon, MapPinIcon, PencilIcon, Trash2Icon, UserRoundIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MarkerIcon, markerIconColor, markerIconComponent } from "@/components/marker-icon"
import { Separator } from "@/components/ui/separator"
import { markerHoverLabel } from "@/lib/markers"
import type { Atlas, CustomMarker, MarkerTarget, Player, PoiMarker } from "@/lib/types"

interface MarkerDetailsSidebarProps {
  atlas?: Atlas
  marker?: PoiMarker
  customMarker?: CustomMarker
  player?: Player
  onClose(): void
  onDeleteCustomMarker?(key: string): void
  onEditCustomMarker?(key: string): void
  onSelect(target: MarkerTarget): void
}

const categoryLabels = {
  location: "Location",
  growlab: "Growlab",
  main_quest: "Main Quest",
  side_quest: "Side Quest",
  world_feature: "World Feature",
  beacon: "Beacon",
} as const

export function MarkerDetailsSidebar({
  atlas,
  marker,
  customMarker,
  player,
  onClose,
  onDeleteCustomMarker,
  onEditCustomMarker,
  onSelect,
}: MarkerDetailsSidebarProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => setConfirmingDelete(false), [customMarker?.key])

  if (!marker && !customMarker && !player) return null

  const target: MarkerTarget = marker ?? customMarker ?? {
    key: `player:${player!.player_id}`,
    worldX: player!.x,
    worldY: player!.y,
  }
  const title = marker ? markerHoverLabel(marker) : customMarker?.label ?? player!.label
  const color = marker?.color ?? customMarker?.color ?? "#e45343"

  return (
    <aside
      className="flex min-h-0 w-80 flex-col border-l bg-card"
      aria-label="Marker details"
      data-marker-details
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span
          className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border-2 text-white shadow-sm"
          style={marker && markerIconComponent(marker) ? {
            borderColor: markerIconColor(marker),
            backgroundColor: `color-mix(in srgb, ${marker.color} 25%, #101512)`,
          } : { borderColor: color, backgroundColor: color }}
        >
          {marker && markerIconComponent(marker)
            ? <MarkerIcon marker={marker} className="size-4" />
            : marker || customMarker
              ? <MapPinIcon className="size-4" />
              : <UserRoundIcon className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-sm font-semibold leading-snug">{title}</h2>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge variant="secondary">
              {marker ? categoryLabels[marker.category] : customMarker ? "Custom Marker" : "Player"}
            </Badge>
            {marker && marker.category !== "world_feature" && marker.category !== "beacon" && (
              <Badge variant={marker.unlocked ? "outline" : "secondary"}>
                {marker.unlocked ? "Unlocked" : "Undiscovered"}
              </Badge>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Close marker details"
          title="Close"
          onClick={onClose}
          data-close-marker-details
        >
          <XIcon />
        </Button>
      </div>
      <Separator />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {marker && atlas && marker.tileUuid && (
          <figure className="mb-4">
            <MarkerTilePreview atlas={atlas} marker={marker} />
            <figcaption className="mt-1.5 text-[0.625rem] text-muted-foreground">
              Top-down sample of the surrounding world tile
            </figcaption>
          </figure>
        )}

        {customMarker?.description && (
          <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed">
            {customMarker.description}
          </p>
        )}

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
          {marker?.detail && (
            <>
              <dt className="text-muted-foreground">
                {marker.category.endsWith("quest")
                  ? "Destination"
                  : marker.category === "world_feature"
                    ? "Details"
                    : marker.category === "beacon"
                      ? "Appearance"
                    : "Area"}
              </dt>
              <dd className="text-right font-medium">{marker.detail}</dd>
            </>
          )}
          {marker?.featureType === "warehouse" && (
            <>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="text-right font-medium">
                {marker.warehouseCompleted ? "Completed / exploded" : "Uncompleted"}
              </dd>
            </>
          )}
          <dt className="text-muted-foreground">World X</dt>
          <dd className="text-right font-mono">{target.worldX.toFixed(1)}</dd>
          <dt className="text-muted-foreground">World Y</dt>
          <dd className="text-right font-mono">{target.worldY.toFixed(1)}</dd>
          {player && (
            <>
              <dt className="text-muted-foreground">World Z</dt>
              <dd className="text-right font-mono">{player.z.toFixed(1)}</dd>
            </>
          )}
        </dl>

        <div className="mt-5 grid gap-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onSelect(target)}
            data-center-selected-marker
          >
            <CrosshairIcon />
            Center on map
          </Button>
          {customMarker && onEditCustomMarker && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => onEditCustomMarker(customMarker.key)}
              data-edit-custom-marker
            >
              <PencilIcon />
              Edit marker
            </Button>
          )}
          {customMarker && onDeleteCustomMarker && !confirmingDelete && (
            <Button
              variant="ghost"
              className="w-full text-destructive hover:text-destructive"
              onClick={() => setConfirmingDelete(true)}
              data-delete-custom-marker
            >
              <Trash2Icon />
              Delete marker
            </Button>
          )}
          {customMarker && onDeleteCustomMarker && confirmingDelete && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3" data-confirm-delete-custom-marker>
              <p className="text-xs">Delete “{customMarker.label}”?</p>
              <div className="mt-2 flex justify-end gap-2">
                <Button variant="ghost" size="xs" onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" size="xs" onClick={() => onDeleteCustomMarker(customMarker.key)}>
                  Delete
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

function MarkerTilePreview({ atlas, marker }: { atlas: Atlas; marker: PoiMarker }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const tile = atlas.manifest.tiles[marker.tileUuid]
    if (!canvas || !tile) return
    const context = canvas.getContext("2d")
    if (!context) return
    context.fillStyle = "rgb(38,86,128)"
    context.fillRect(0, 0, canvas.width, canvas.height)
    const scale = Math.min(canvas.width / tile.w, canvas.height / tile.h)
    const width = tile.w * scale
    const height = tile.h * scale
    context.drawImage(
      atlas.pages[tile.page],
      tile.x,
      tile.y,
      tile.w,
      tile.h,
      (canvas.width - width) / 2,
      (canvas.height - height) / 2,
      width,
      height,
    )
  }, [atlas, marker])

  return (
    <canvas
      ref={canvasRef}
      width={560}
      height={260}
      className="aspect-[14/6.5] w-full rounded-lg border bg-muted object-cover shadow-inner"
      data-marker-preview
    />
  )
}
