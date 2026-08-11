import {
  CheckCircle2Icon,
  CheckIcon,
  CircleIcon,
  CopyIcon,
  FileCheck2Icon,
  FolderOpenIcon,
  InfoIcon,
  SearchIcon,
  ShirtIcon,
  UploadIcon,
  XIcon,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { garments } from "@/lib/garments.generated"
import {
  parseGarmentUnlock,
  vehicleQuestGarmentRewards,
  type GarmentDefinition,
  type GarmentUnlockData,
} from "@/lib/garments"

interface GarmentProgressionProps {
  steamId?: string | null
}

const knownGarmentUuids = new Set(garments.map((garment) => garment.uuid))
const trackableGarments = garments.filter(
  (garment) => garment.group !== "Crash Mechanic" && garment.group !== "Mechanic",
)

type GarmentMethodId =
  | "garment_box"
  | "shirts"
  | "builder_quest"
  | "trader"
  | "fixed_location"
  | "story"
  | "challenge"
  | "dlc"
  | "unverified"

const garmentMethods: Array<{
  id: GarmentMethodId
  title: string
  description: string
}> = [
  {
    id: "garment_box",
    title: "Dressbot garment boxes",
    description: "Random individual pieces from Common, Rare, or Epic garment boxes processed by a Dressbot.",
  },
  {
    id: "shirts",
    title: "Shirts & sweaters",
    description: "Standalone tops from the Dressbot garment-box pool, separated from the complete outfit sets.",
  },
  {
    id: "builder_quest",
    title: "Builder quest rewards",
    description: "Fixed pieces awarded by the Duckie, Scrapper, and vehicle builder quests.",
  },
  {
    id: "trader",
    title: "Trader unlocks",
    description: "Purchased from traders or granted by trader progression groups.",
  },
  {
    id: "fixed_location",
    title: "Fixed-location rewards",
    description: "Found in specific reward crates and locations rather than the random Dressbot pool.",
  },
  {
    id: "story",
    title: "Story reward",
    description: "Granted by completing the main story's endgame sequence.",
  },
  {
    id: "challenge",
    title: "Challenge Mode reward",
    description: "Granted for completing the Master Mechanic Trials.",
  },
  {
    id: "dlc",
    title: "Fan Pack garments",
    description: "Account entitlements included with the optional Scrap Mechanic Fan Pack.",
  },
  {
    id: "unverified",
    title: "Source still being verified",
    description: "The current game catalogue contains these garments, but their exact acquisition metadata is bundled or not exposed in readable scripts.",
  },
]

const classicDressbotGroups = new Set([
  "Applicator",
  "Automotive",
  "Delivery",
  "Demolition",
  "Lumberjack",
  "Engineer",
  "Painter",
  "Golf",
  "Farmhand",
  "Technician",
])
const traderGroups = new Set(["Farmer", "Miner", "Dekotora", "Woc"])
const vehicleQuestGarments = new Set(Object.values(vehicleQuestGarmentRewards))

const slotLabels: Record<GarmentDefinition["slot"], string> = {
  torso: "Torso",
  gloves: "Gloves",
  shoes: "Shoes",
  legs: "Pants",
  hat: "Hat",
  backpack: "Backpack",
}

function methodFor(garment: GarmentDefinition): GarmentMethodId {
  if (garment.group === "Duckie" || garment.group === "Scrapper" || vehicleQuestGarments.has(garment.title)) {
    return "builder_quest"
  }
  if (traderGroups.has(garment.group)) return "trader"
  if (garment.group === "Tactical" || garment.title === "Welder Pants") return "fixed_location"
  if (garment.group === "Golden Mechanic") return "story"
  if (garment.group === "Stuntman") return "challenge"
  if (
    garment.group === "Logic Hero" ||
    garment.group === "Brilliant Rider" ||
    garment.title === "Brilliant Rider Sweat" ||
    garment.title === "Baby Woc Sweat"
  ) {
    return "dlc"
  }
  if (classicDressbotGroups.has(garment.group)) return "garment_box"
  if (garment.group === "Shirts & sweaters") return "shirts"
  return "unverified"
}

function displayGroupFor(method: GarmentMethodId, garment: GarmentDefinition): string {
  if (method === "builder_quest" && garment.group === "Shirts & sweaters") return "Cars"
  if (method !== "shirts") return garment.group
  if (garment.title.endsWith("T-Shirt")) return "T-shirts"
  if (garment.title.endsWith("Sweat")) return "Sweaters"
  return "Shirts"
}

function isUnitUnlock(method: GarmentMethodId): boolean {
  return method === "story" || method === "challenge" || method === "dlc"
}

function unlockHint(method: GarmentMethodId, group: string): string {
  if (method === "builder_quest") {
    if (group === "Duckie") {
      return "The six early builder quests award one Duckie piece each: Crowbar, Compass, Garden, Nice House, Sledgehammer, and Baguette."
    }
    if (group === "Scrapper") {
      return "The six Scrapper builder quests award the Shoes, Pants, Jacket, Gloves, Backpack, and Hat in that order."
    }
    return "Your First Car, Your Work Car, and Your Nice Car award the Wow, Rock, and Fantastic T-shirts respectively."
  }
  if (method === "trader") {
    if (group === "Farmer") return "Purchase the individual Farmer pieces from the Hideout Trader."
    if (group === "Miner" || group === "Dekotora") return `Purchase the individual ${group} pieces from the Mininghub Trader.`
    return "The Hideout Trader progression grants the individual Woc pieces across its later progression groups."
  }
  if (method === "fixed_location") {
    if (group === "Tactical") {
      return "Find the six fixed Tactical reward crates across the Mining Hub, underground stations and caves, and the Hay Bale Labyrinth. Each crate contains one piece."
    }
    return "The Welder Pants are inside a fixed balloon reward crate at the large ruin in the starting area."
  }
  if (method === "story") return "The complete Golden Mechanic set is granted together during the main story's endgame sequence."
  if (method === "challenge") return "The complete Stuntman set is granted together for completing the Master Mechanic Trials in Challenge Mode."
  if (method === "dlc") return "These garments are granted together as account entitlements when the Scrap Mechanic Fan Pack is owned."
  return "The garment exists in the current game catalogue, but its exact unlock source is not exposed in the readable game scripts yet."
}

export function GarmentProgression({ steamId }: GarmentProgressionProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const unlockBufferRef = useRef<ArrayBuffer | undefined>(undefined)
  const [unlockData, setUnlockData] = useState<GarmentUnlockData>()
  const [fileName, setFileName] = useState<string>()
  const [error, setError] = useState<string>()
  const [dragging, setDragging] = useState(false)
  const [pathCopied, setPathCopied] = useState(false)
  const [missingOnly, setMissingOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const query = searchQuery.trim().toLocaleLowerCase()
  const accountPath = `%APPDATA%\\Axolot Games\\Scrap Mechanic\\User\\User_${steamId ?? "<SteamID>"}`

  const copyAccountPath = async () => {
    try {
      await navigator.clipboard.writeText(accountPath)
    } catch {
      const textarea = document.createElement("textarea")
      textarea.value = accountPath
      textarea.style.position = "fixed"
      textarea.style.opacity = "0"
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      textarea.remove()
    }
    setPathCopied(true)
  }

  const openFile = async (file?: File) => {
    if (!file) return
    setError(undefined)
    try {
      const buffer = await file.arrayBuffer()
      const parsed = parseGarmentUnlock(buffer, knownGarmentUuids, steamId)
      unlockBufferRef.current = buffer
      setUnlockData(parsed)
      setFileName(file.name)
    } catch (reason) {
      setUnlockData(undefined)
      unlockBufferRef.current = undefined
      setFileName(undefined)
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  useEffect(() => {
    setPathCopied(false)
    if (!unlockBufferRef.current) return
    try {
      setUnlockData(parseGarmentUnlock(unlockBufferRef.current, knownGarmentUuids, steamId))
      setError(undefined)
    } catch (reason) {
      setUnlockData(undefined)
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }, [steamId])

  const recognizedUnlocked = unlockData
    ? trackableGarments.filter((garment) => unlockData.unlocked.has(garment.uuid)).length
    : 0
  const methodSections = useMemo(() => {
    return garmentMethods.map((method) => {
      const grouped = new Map<string, GarmentDefinition[]>()
      for (const garment of trackableGarments) {
        if (methodFor(garment) !== method.id) continue
        const groupTitle = displayGroupFor(method.id, garment)
        const group = grouped.get(groupTitle) ?? []
        group.push(garment)
        grouped.set(groupTitle, group)
      }
      return {
        ...method,
        groups: Array.from(grouped, ([title, items]) => ({ title, items })),
      }
    })
  }, [])
  const visibleMethodSections = methodSections.map((method) => ({
    ...method,
    groups: method.groups.map(({ title, items }) => {
      const unitUnlock = isUnitUnlock(method.id)
      const complete = unlockData
        ? items.every((garment) => unlockData.unlocked.has(garment.uuid))
        : false
      const visibleItems = items.filter((garment) => {
        if (missingOnly && (unitUnlock ? complete : unlockData?.unlocked.has(garment.uuid))) return false
        return !query || `${method.title} ${method.description} ${unlockHint(method.id, title)} ${title} ${garment.title} ${slotLabels[garment.slot]}`
          .toLocaleLowerCase().includes(query)
      })
      return { title, items, visibleItems, unitUnlock }
    }).filter((group) => group.visibleItems.length > 0),
  })).filter((method) => method.groups.length > 0)

  return (
    <div data-testid="garment-progression">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShirtIcon className="size-5 text-primary" />
            <h2 className="font-heading text-xl font-semibold">Garments</h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Garments belong to your Scrap Mechanic account, not to an individual world.
            A save therefore cannot tell us which ones you own.
          </p>
        </div>
        <div className="flex items-baseline gap-2 rounded-xl border bg-card px-4 py-2 shadow-sm">
          <strong className="text-2xl tabular-nums">{unlockData ? recognizedUnlocked : "?"}</strong>
          <span className="text-xs text-muted-foreground">of {trackableGarments.length} unlocked</span>
        </div>
      </div>

      <Card className="mt-5 overflow-hidden" data-garment-file-panel>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                {unlockData ? <FileCheck2Icon className="size-4 text-emerald-400" /> : <FolderOpenIcon className="size-4" />}
                {unlockData ? "Account garment data loaded" : "Load account garment data"}
              </CardTitle>
              <CardDescription className="mt-1 leading-relaxed">
                Find the extensionless file named <code className="rounded bg-muted px-1 py-0.5">unlock</code> in:
              </CardDescription>
              <div className="mt-2 flex items-center gap-1.5 rounded-md bg-muted/65 p-1.5 pl-2.5">
                <code className="min-w-0 flex-1 break-all text-[0.6875rem] text-foreground/85">
                  {accountPath}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => void copyAccountPath()}
                  aria-label="Copy garment account directory path"
                  data-copy-garment-path
                >
                  {pathCopied ? <CheckIcon /> : <CopyIcon />}
                  {pathCopied ? "Copied" : "Copy path"}
                </Button>
              </div>
              {steamId && (
                <p className="mt-1.5 text-[0.6875rem] text-muted-foreground">
                  The account folder was inferred from the host Steam ID in the loaded save.
                </p>
              )}
            </div>
            {unlockData && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={unlockData.checksum === "valid" ? "secondary" : "outline"}>
                  {unlockData.checksum === "valid"
                    ? "Account verified"
                    : unlockData.checksum === "invalid"
                      ? "Account mismatch"
                      : "Checksum not verified"}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                  Replace file
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!unlockData && (
            <button
              type="button"
              className={`grid w-full place-items-center rounded-lg border border-dashed p-6 text-center transition-colors ${dragging ? "border-primary bg-primary/10" : "hover:border-foreground/35 hover:bg-muted/35"}`}
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                void openFile(event.dataTransfer.files[0])
              }}
              data-garment-dropzone
            >
              <UploadIcon className="mb-2 size-6 text-primary" />
              <strong>Choose or drop the unlock file</strong>
              <span className="mt-1 text-xs text-muted-foreground">It is read locally in your browser and never modified or uploaded.</span>
            </button>
          )}
          <input
            ref={inputRef}
            className="hidden"
            type="file"
            onChange={(event) => {
              void openFile(event.target.files?.[0])
              event.target.value = ""
            }}
          />
          {unlockData && (
            <div className="flex flex-wrap items-start justify-between gap-3 text-xs">
              <div>
                <strong>{fileName}</strong>
                <p className="mt-0.5 text-muted-foreground">
                  {unlockData.declaredCount} account records · {recognizedUnlocked} tracked garments
                  {unlockData.unknownUuids.length ? ` · ${unlockData.unknownUuids.length} unknown or modded` : ""}
                </p>
              </div>
              {unlockData.checksum === "invalid" && (
                <p className="flex max-w-md items-start gap-1.5 text-amber-300">
                  <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
                  This file is valid structurally, but its checksum does not match the host account in the loaded save. You may have selected another account's file.
                </p>
              )}
            </div>
          )}
          {error && <p className="mt-3 text-sm text-destructive" role="alert">Could not read garment data: {error}</p>}
        </CardContent>
      </Card>

      {unlockData && (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
            <div className="relative min-w-56 flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search garments or outfits…"
                aria-label="Search garments or outfits"
                className="pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Clear garment search"
                  onClick={() => setSearchQuery("")}
                >
                  <XIcon className="size-4" />
                </button>
              )}
            </div>
            <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/60">
              <span>
                <span className="block text-xs font-medium">Undiscovered only</span>
                <span className="block text-[0.625rem] text-muted-foreground">{trackableGarments.length - recognizedUnlocked} remaining</span>
              </span>
              <Switch checked={missingOnly} onCheckedChange={setMissingOnly} aria-label="Show undiscovered garments only" />
            </label>
          </div>

          <div className="mt-6 space-y-8">
            {visibleMethodSections.map((method) => (
              <section key={method.id} data-garment-method={method.id}>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h3 className="font-heading text-base font-semibold">{method.title}</h3>
                    <p className="text-xs text-muted-foreground">{method.description}</p>
                  </div>
                  <Badge variant="secondary">
                    {method.groups.reduce((count, group) => count + group.items.length, 0)} items
                  </Badge>
                </div>
                <div className={`grid items-start gap-3 ${method.id === "shirts" ? "grid-cols-1" : "md:grid-cols-2"}`}>
                  {method.groups.map(({ title, items, visibleItems, unitUnlock }) => {
                    const unlockedCount = items.filter((garment) => unlockData.unlocked.has(garment.uuid)).length
                    const complete = unlockedCount === items.length
                    const showHint = method.id !== "garment_box" && method.id !== "shirts"
                    return (
                      <Card
                        key={`${method.id}:${title}`}
                        size="sm"
                        className={complete ? "opacity-75" : "ring-foreground/15"}
                        data-garment-group={title}
                        data-unit-unlock={unitUnlock || undefined}
                      >
                        <CardHeader className="border-b">
                          <div className="flex items-start gap-2">
                            {complete
                              ? <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                              : <CircleIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                            <CardTitle className="min-w-0 flex-1">{title}</CardTitle>
                            <Badge variant={complete ? "secondary" : "outline"}>
                              {unitUnlock ? (complete ? "Unlocked" : "Undiscovered") : `${unlockedCount}/${items.length}`}
                            </Badge>
                          </div>
                          {showHint && (
                            <p className="mt-2 rounded-md bg-muted/60 px-2.5 py-2 text-xs leading-relaxed text-muted-foreground">
                              {unlockHint(method.id, title)}
                            </p>
                          )}
                        </CardHeader>
                        <CardContent className="grid gap-1.5">
                          {visibleItems.map((garment) => {
                            const unlocked = unlockData.unlocked.has(garment.uuid)
                            return (
                              <div key={garment.uuid} className="flex items-center gap-2 rounded-md bg-muted/45 px-2.5 py-2" data-garment={garment.uuid}>
                                {!unitUnlock && (unlocked
                                  ? <CheckCircle2Icon className="size-3.5 shrink-0 text-emerald-400" />
                                  : <CircleIcon className="size-3.5 shrink-0 text-muted-foreground" />)}
                                <span className="min-w-0 flex-1 font-medium">{garment.title}</span>
                                <span className="text-[0.625rem] text-muted-foreground">{slotLabels[garment.slot]}</span>
                              </div>
                            )
                          })}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </section>
            ))}
            {!visibleMethodSections.length && (
              <div className="rounded-xl border border-dashed bg-card/60 p-10 text-center">
                <strong>No garments match these filters</strong>
                <p className="mt-1 text-xs text-muted-foreground">Try another search or turn off Undiscovered only.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
