import {
  CheckCircle2Icon,
  CircleIcon,
  EyeIcon,
  InfoIcon,
  ListChecksIcon,
  MapPinIcon,
  SearchIcon,
  ShirtIcon,
  XIcon,
} from "lucide-react"
import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import {
  blockSchematicGroups,
  blockSchematics,
  fixedSchematics,
  schematicSources,
  type BlockSchematicGroup,
  type SchematicSource,
  type SchematicSourceKind,
} from "@/lib/schematics"
import { schematicBoxRecipes } from "@/lib/schematic-box-recipes"
import { GarmentProgression } from "@/components/garment-progression"
import type { WorldModel } from "@/lib/types"

interface SchematicProgressionProps {
  model?: WorldModel
  spoilerConsent: boolean
  onOpenSave(): void
  onAcceptSpoilers(): void
  onBackToMap(): void
  questMarkerIds: ReadonlySet<string>
  onShowQuestOnMap(quest: string): void
}

type SchematicView = "parts" | "blocks" | "garments"

const sections: Array<{
  kind: SchematicSourceKind
  title: string
  description: string
}> = [
  {
    kind: "story",
    title: "Story progression",
    description: "Fixed rewards from main-quest milestones.",
  },
  {
    kind: "growlab",
    title: "Growlabs",
    description: "The guaranteed schematic in each Growlab reward crate.",
  },
  {
    kind: "side_quest",
    title: "Side quests",
    description: "Schematics granted for completing builder side quests.",
  },
]

function SourceCard({
  source,
  unlockedRecipes,
  activeQuests,
  completedQuests,
  missingOnly,
  query,
  questMarkerIds,
  onShowQuestOnMap,
}: {
  source: SchematicSource
  unlockedRecipes: ReadonlySet<string>
  activeQuests: ReadonlySet<string>
  completedQuests: ReadonlySet<string>
  missingOnly: boolean
  query: string
  questMarkerIds: ReadonlySet<string>
  onShowQuestOnMap(quest: string): void
}) {
  const sourceMatches = `${source.title} ${source.instruction}`
    .toLocaleLowerCase()
    .includes(query)
  const visibleSchematics = source.schematics.filter((schematic) => {
    const unlocked = unlockedRecipes.has(schematic.uuid)
    if (missingOnly && unlocked) return false
    return !query || sourceMatches || schematic.title.toLocaleLowerCase().includes(query)
  })
  if (!visibleSchematics.length) return null

  const complete = source.schematics.every((schematic) =>
    unlockedRecipes.has(schematic.uuid),
  )
  const questActive = Boolean(source.quest && activeQuests.has(source.quest))
  const questComplete = Boolean(source.quest && completedQuests.has(source.quest))

  return (
    <Card
      size="sm"
      className={complete ? "opacity-75" : "ring-foreground/15"}
      data-schematic-source={source.id}
      data-unlocked={complete}
    >
      <CardHeader className="border-b">
        <div className="flex min-w-0 items-start gap-2">
          {complete ? (
            <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-400" />
          ) : (
            <CircleIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <CardTitle>{source.title}</CardTitle>
              {questComplete ? (
                <Badge variant="secondary">Quest complete</Badge>
              ) : questActive ? (
                <Badge variant="outline">Quest active</Badge>
              ) : null}
            </div>
            <CardDescription className="mt-1 text-xs leading-relaxed">
              {source.instruction}
            </CardDescription>
            {source.quest && questMarkerIds.has(source.quest) && (
              <Button
                variant="link"
                size="xs"
                className="mt-1 h-auto px-0 text-xs"
                onClick={() => onShowQuestOnMap(source.quest!)}
                data-show-quest-on-map={source.quest}
              >
                <MapPinIcon />
                Show quest on map
              </Button>
            )}
          </div>
          <Badge variant={complete ? "secondary" : "outline"}>
            {complete ? "Unlocked" : "Undiscovered"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-1.5">
        {visibleSchematics.map((schematic) => (
          <div
            key={schematic.uuid}
            className="rounded-md bg-muted/45 px-2.5 py-2 font-medium"
            data-schematic={schematic.uuid}
          >
            {schematic.title}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function BlockGroupCard({
  group,
  unlockedRecipes,
  query,
}: {
  group: BlockSchematicGroup
  unlockedRecipes: ReadonlySet<string>
  query: string
}) {
  const complete = group.schematics.every((schematic) =>
    unlockedRecipes.has(schematic.uuid),
  )
  const groupMatches = group.title.toLocaleLowerCase().includes(query)
  const visibleSchematics = group.schematics.filter((schematic) =>
    !query || groupMatches || schematic.title.toLocaleLowerCase().includes(query),
  )

  return (
    <Card
      size="sm"
      className={complete ? "opacity-75" : "ring-foreground/15"}
      data-block-schematic-group={group.id}
      data-unlocked={complete}
    >
      <CardHeader className="border-b">
        <div className="flex items-center gap-2">
          {complete ? (
            <CheckCircle2Icon className="size-4 shrink-0 text-emerald-400" />
          ) : (
            <CircleIcon className="size-4 shrink-0 text-muted-foreground" />
          )}
          <CardTitle>{group.title}</CardTitle>
          <Badge className="ml-auto" variant={complete ? "secondary" : "outline"}>
            {complete ? "Unlocked" : "Undiscovered"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-1.5">
        {visibleSchematics.map((schematic) => (
          <div
            key={schematic.uuid}
            className="w-full rounded-md bg-muted/45 px-2.5 py-2 font-medium"
            data-block-schematic={schematic.uuid}
          >
            {schematic.title}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function SchematicProgression({
  model,
  spoilerConsent,
  onOpenSave,
  onAcceptSpoilers,
  onBackToMap,
  questMarkerIds,
  onShowQuestOnMap,
}: SchematicProgressionProps) {
  const [schematicView, setSchematicView] = useState<SchematicView>("parts")
  const [missingOnly, setMissingOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const query = searchQuery.trim().toLocaleLowerCase()
  const unlockedRecipes = useMemo(
    () => new Set(model?.progression.unlockedRecipes ?? []),
    [model?.progression.unlockedRecipes],
  )
  const activeQuests = useMemo(
    () => new Set(model?.progression.activeQuests ?? []),
    [model?.progression.activeQuests],
  )
  const completedQuests = useMemo(
    () => new Set(model?.progression.completedQuests ?? []),
    [model?.progression.completedQuests],
  )
  const unlockedPartCount = fixedSchematics.filter((schematic) =>
    unlockedRecipes.has(schematic.uuid),
  ).length
  const unlockedBlockCount = blockSchematics.filter((schematic) =>
    unlockedRecipes.has(schematic.uuid),
  ).length
  const unlockedSchematicBoxCount = schematicBoxRecipes.filter((uuid) =>
    unlockedRecipes.has(uuid),
  ).length
  const catalogue = schematicView === "parts" ? fixedSchematics : blockSchematics
  const unlockedCount = schematicView === "parts" ? unlockedPartCount : unlockedBlockCount
  const missingCount = catalogue.length - unlockedCount
  const hostSteamId = model?.players.find((player) => player.player_id === 1)?.steam_id

  if (!model && schematicView !== "garments") {
    return (
      <main className="grid h-full min-h-0 place-items-center bg-muted/20 p-6">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <ListChecksIcon className="mx-auto mb-1 size-8 text-primary" />
            <CardTitle>Open a survival save to track schematics</CardTitle>
            <CardDescription>
              The save is decoded locally and never modified or uploaded.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap justify-center gap-2">
            <Button onClick={onOpenSave}>Open save</Button>
            <Button variant="outline" onClick={() => setSchematicView("garments")}>
              <ShirtIcon />
              Track account garments
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (!spoilerConsent) {
    return (
      <main className="grid h-full min-h-0 place-items-center bg-muted/20 p-6">
        <Card className="w-full max-w-lg" data-progression-spoiler-prompt>
          <CardHeader>
            <EyeIcon className="mb-1 size-7 text-amber-300" />
            <CardTitle>Reveal progression details?</CardTitle>
            <CardDescription className="leading-relaxed">
              These views list rewards you have not unlocked and explain how to obtain
              them. That can reveal upcoming progression, quest rewards, locations,
              and item names.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-xs text-muted-foreground">
              {model
                ? "Your choice is remembered for this save. The save itself is never modified."
                : "This choice applies to the current browser session. No game files are modified."}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={onBackToMap}>
                Back to map
              </Button>
              <Button onClick={onAcceptSpoilers} data-accept-progression-spoilers>
                Show progression spoilers
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    )
  }

  const visibleSources = schematicSources.filter((source) =>
    source.schematics.some((schematic) => {
      if (missingOnly && unlockedRecipes.has(schematic.uuid)) return false
      return !query || `${source.title} ${source.instruction} ${schematic.title}`
        .toLocaleLowerCase().includes(query)
    }),
  )
  const visibleBlockGroups = blockSchematicGroups.filter((group) => {
    const complete = group.schematics.every((schematic) =>
      unlockedRecipes.has(schematic.uuid),
    )
    if (missingOnly && complete) return false
    return !query || group.title.toLocaleLowerCase().includes(query) ||
      group.schematics.some((schematic) =>
        schematic.title.toLocaleLowerCase().includes(query),
      )
  })

  return (
    <main className="h-full min-h-0 overflow-hidden bg-muted/20" data-testid="schematic-progression">
      <ScrollArea className="h-full">
        <div className="mx-auto w-full max-w-6xl p-5 lg:p-7">
          <nav
            className="mb-5 inline-flex items-center rounded-lg border bg-card p-0.5 shadow-sm"
            aria-label="Progression categories"
          >
            <Button
              variant={schematicView === "parts" ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={schematicView === "parts"}
              onClick={() => {
                setSchematicView("parts")
                setSearchQuery("")
              }}
              data-schematic-view="parts"
            >
              Part schematics
              <Badge variant="outline">{unlockedPartCount}/{fixedSchematics.length}</Badge>
            </Button>
            <Button
              variant={schematicView === "blocks" ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={schematicView === "blocks"}
              onClick={() => {
                setSchematicView("blocks")
                setSearchQuery("")
              }}
              data-schematic-view="blocks"
            >
              Block schematics
              <Badge variant="outline">{unlockedBlockCount}/{blockSchematics.length}</Badge>
            </Button>
            <Button
              variant={schematicView === "garments" ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={schematicView === "garments"}
              onClick={() => {
                setSchematicView("garments")
                setSearchQuery("")
              }}
              data-schematic-view="garments"
            >
              <ShirtIcon />
              Garments
            </Button>
          </nav>
          {schematicView === "garments" ? (
            <GarmentProgression steamId={hostSteamId} />
          ) : (
          <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <ListChecksIcon className="size-5 text-primary" />
                <h2 className="font-heading text-xl font-semibold">
                  {schematicView === "parts" ? "Part schematics" : "Block schematics"}
                </h2>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {schematicView === "parts"
                  ? "Quest and progression rewards only. Random schematic boxes and recipes learned by scanning ordinary parts are intentionally omitted."
                  : "Break the special reward container in each Growlab to unlock its block bundle. Bundles unlock in Growlab order."}
              </p>
              {schematicView === "parts" && (
                <p className="mt-2 flex max-w-2xl items-start gap-1.5 text-xs text-muted-foreground">
                  <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
                  Known game anomaly: the Toilet, Bathtub, and Fridge appear in the
                  Craftbot, but cannot currently be unlocked.
                </p>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <div className="flex items-baseline gap-2 rounded-xl border bg-card px-4 py-2 shadow-sm">
                <strong className="text-2xl tabular-nums">{unlockedCount}</strong>
                <span className="text-xs text-muted-foreground">
                  of {catalogue.length} unlocked
                </span>
              </div>
              <div className="rounded-xl border bg-card px-4 py-2 shadow-sm" data-schematic-box-counter>
                <div className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
                  Schematic boxes
                </div>
                <strong className="tabular-nums">
                  {unlockedSchematicBoxCount}/{schematicBoxRecipes.length}
                </strong>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
            <div className="relative min-w-56 flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={schematicView === "parts"
                  ? "Search part schematics or quests…"
                  : "Search block schematics or Growlabs…"}
                aria-label={schematicView === "parts"
                  ? "Search part schematics or quests"
                  : "Search block schematics or Growlabs"}
                className="pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
                data-schematic-search
              />
              {searchQuery && (
                <button
                  type="button"
                  className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Clear schematic search"
                  onClick={() => setSearchQuery("")}
                >
                  <XIcon className="size-4" />
                </button>
              )}
            </div>
            <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/60">
              <span>
                <span className="block text-xs font-medium">Undiscovered only</span>
                <span className="block text-[0.625rem] text-muted-foreground">
                  {missingCount} remaining
                </span>
              </span>
              <Switch
                checked={missingOnly}
                onCheckedChange={setMissingOnly}
                aria-label="Show undiscovered schematics only"
                data-missing-schematics-only
              />
            </label>
          </div>

          <div className="mt-6 space-y-8">
            {schematicView === "parts" ? (
              <>
                {sections.map((section) => {
                  const sources = visibleSources.filter((source) => source.kind === section.kind)
                  if (!sources.length) return null
                  return (
                    <section key={section.kind} data-schematic-section={section.kind}>
                      <div className="mb-3 flex items-end justify-between gap-3">
                        <div>
                          <h3 className="font-heading text-base font-semibold">{section.title}</h3>
                          <p className="text-xs text-muted-foreground">{section.description}</p>
                        </div>
                        <Badge variant="secondary">
                          {sources.length} {sources.length === 1 ? "group" : "groups"}
                        </Badge>
                      </div>
                      <div className="grid items-start gap-3 md:grid-cols-2">
                        {sources.map((source) => (
                          <SourceCard
                            key={source.id}
                            source={source}
                            unlockedRecipes={unlockedRecipes}
                            activeQuests={activeQuests}
                            completedQuests={completedQuests}
                            missingOnly={missingOnly}
                            query={query}
                            questMarkerIds={questMarkerIds}
                            onShowQuestOnMap={onShowQuestOnMap}
                          />
                        ))}
                      </div>
                    </section>
                  )
                })}
                {!visibleSources.length && (
                  <div className="rounded-xl border border-dashed bg-card/60 p-10 text-center">
                    <CheckCircle2Icon className="mx-auto size-8 text-emerald-400" />
                    <strong className="mt-2 block">
                      {query ? "No part schematics match that search" : "All fixed part schematics are unlocked"}
                    </strong>
                    <p className="mt-1 text-xs text-muted-foreground">
              {query ? "Try a schematic or quest name." : "Turn off Undiscovered only to review completed rewards."}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                {visibleBlockGroups.length > 0 && (
                  <section data-schematic-section="blocks">
                    <div className="mb-3 flex items-end justify-between gap-3">
                      <div>
                        <h3 className="font-heading text-base font-semibold">Growlab block bundles</h3>
                        <p className="text-xs text-muted-foreground">
                          One compact bundle per special reward container.
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {visibleBlockGroups.length} {visibleBlockGroups.length === 1 ? "Growlab" : "Growlabs"}
                      </Badge>
                    </div>
                    <div className="grid items-start gap-3 md:grid-cols-2">
                      {visibleBlockGroups.map((group) => (
                        <BlockGroupCard
                          key={group.id}
                          group={group}
                        unlockedRecipes={unlockedRecipes}
                          query={query}
                        />
                      ))}
                    </div>
                  </section>
                )}
                {!visibleBlockGroups.length && (
                  <div className="rounded-xl border border-dashed bg-card/60 p-10 text-center">
                    <CheckCircle2Icon className="mx-auto size-8 text-emerald-400" />
                    <strong className="mt-2 block">
                      {query ? "No block schematics match that search" : "All block schematics are unlocked"}
                    </strong>
                    <p className="mt-1 text-xs text-muted-foreground">
              {query ? "Try a block or Growlab name." : "Turn off Undiscovered only to review the Growlab bundles."}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
          </>
          )}
        </div>
      </ScrollArea>
    </main>
  )
}
