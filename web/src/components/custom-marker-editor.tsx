import { useState } from "react"
import { MapPinIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import type { CustomMarker } from "@/lib/types"

const markerColors = [
  "#f43f5e",
  "#f59e0b",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
]

interface CustomMarkerEditorProps {
  marker?: CustomMarker
  position: Pick<CustomMarker, "worldX" | "worldY">
  onCancel(): void
  onSave(values: Pick<CustomMarker, "label" | "description" | "color">): void
}

export function CustomMarkerEditor({
  marker,
  position,
  onCancel,
  onSave,
}: CustomMarkerEditorProps) {
  const [label, setLabel] = useState(marker?.label ?? "")
  const [description, setDescription] = useState(marker?.description ?? "")
  const [color, setColor] = useState(marker?.color ?? "#ec4899")

  return (
    <aside
      className="flex min-h-0 w-80 flex-col border-l bg-card"
      aria-label={marker ? "Edit custom marker" : "Create custom marker"}
      data-custom-marker-editor
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-lg text-white shadow-sm"
          style={{ backgroundColor: color }}
        >
          <MapPinIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-sm font-semibold">
            {marker ? "Edit custom marker" : "New custom marker"}
          </h2>
          <p className="text-[10px] text-muted-foreground">
            {position.worldX.toFixed(1)}, {position.worldY.toFixed(1)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Cancel marker editing"
          title="Cancel"
          onClick={onCancel}
        >
          <XIcon />
        </Button>
      </div>
      <Separator />

      <form
        className="flex min-h-0 flex-1 flex-col p-4"
        onSubmit={(event) => {
          event.preventDefault()
          const trimmedLabel = label.trim()
          if (!trimmedLabel) return
          onSave({ label: trimmedLabel, description: description.trim(), color })
        }}
      >
        <label className="grid gap-1.5 text-xs font-medium">
          Name
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Marker name"
            maxLength={80}
            autoFocus
            required
            data-custom-marker-name
          />
        </label>

        <label className="mt-4 grid gap-1.5 text-xs font-medium">
          Notes
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Optional details about this marker"
            maxLength={500}
            rows={5}
            className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            data-custom-marker-description
          />
        </label>

        <fieldset className="mt-4">
          <legend className="text-xs font-medium">Color</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {markerColors.map((option) => (
              <button
                key={option}
                type="button"
                className="size-6 rounded-full border-2 border-card shadow-sm outline-none ring-offset-2 ring-offset-card focus-visible:ring-2 focus-visible:ring-ring"
                style={{
                  backgroundColor: option,
                  boxShadow: option === color ? "0 0 0 2px var(--ring)" : undefined,
                }}
                aria-label={`Use color ${option}`}
                aria-pressed={option === color}
                onClick={() => setColor(option)}
                data-custom-marker-color={option}
              />
            ))}
          </div>
        </fieldset>

        <div className="mt-auto flex justify-end gap-2 pt-6">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={!label.trim()} data-save-custom-marker>
            {marker ? "Save changes" : "Create marker"}
          </Button>
        </div>
      </form>
    </aside>
  )
}
