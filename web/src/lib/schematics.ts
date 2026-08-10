export type SchematicSourceKind = "story" | "growlab" | "side_quest"

export interface SchematicDefinition {
  uuid: string
  title: string
}

export interface SchematicSource {
  id: string
  kind: SchematicSourceKind
  title: string
  quest?: string
  instruction: string
  schematics: SchematicDefinition[]
}

export interface BlockSchematicGroup {
  id: string
  title: string
  schematics: SchematicDefinition[]
}

const item = (uuid: string, title: string): SchematicDefinition => ({ uuid, title })

// Derived from the schematic rewards in sob_quests.sobset and the fixed
// Warehouse/Growlab unlocks in RecipeManager.lua and survival_constants.lua.
// Random schematic-box rewards and ordinary scan-a-part recipes are excluded.
export const schematicSources: SchematicSource[] = [
  {
    id: "quest_mystery_call",
    kind: "story",
    title: "A Stranger in Need",
    quest: "quest_mystery_call",
    instruction: "Complete the main quest “A Stranger in Need”.",
    schematics: [
      item("5eb8975b-0acf-43a7-ab4e-62ce661c0df7", "Respawn Bed"),
      item("3e10ef67-383a-4b60-aa5b-b1173134e437", "Saw Blade"),
    ],
  },
  {
    id: "quest_build_watchtower",
    kind: "story",
    title: "Home is Where Your Couch Is",
    quest: "quest_build_watchtower",
    instruction: "Complete the main quest “Home is Where Your Couch Is”.",
    schematics: [
      item("c5ea0c2f-185b-48d6-b4df-45c386a575cc", "Spud Gun"),
      item("056e5ff1-f030-40df-946a-b830bf494c92", "Gas Container"),
    ],
  },
  {
    id: "quest_warehouse_destruction",
    kind: "story",
    title: "Wonk-Y Business",
    quest: "quest_warehouse_destruction",
    instruction: "Complete “Wonk-Y Business” or claim the Warehouse balloon-crate reward.",
    schematics: [
      item("9b9c0a82-a9bf-41d4-a599-58182f162058", "Plasma Drill Level 1"),
    ],
  },
  {
    id: "quest_rebuild_watchtower",
    kind: "story",
    title: "Built to Last",
    quest: "quest_rebuild_watchtower",
    instruction: "Complete the main quest “Built to Last”.",
    schematics: [
      item("d2fab7ef-21db-4681-a22a-cd4f278fc355", "Fire Extinguisher"),
    ],
  },
  ...[
    ["growlab_1", "Growlab 1", "e9efc008-8fae-4391-9ad1-6a62dbab5760", "Large Chest"],
    ["growlab_2", "Growlab 2", "98a85002-3b45-4fe8-b2fb-390a9953e877", "Beehive"],
    ["growlab_3", "Growlab 3", "479e8131-cc76-48e1-9979-8053a7295d1f", "Freezer"],
    ["growlab_4", "Growlab 4", "f6250bf4-9726-406f-a29a-945c06e460e5", "Spud Shotgun"],
    ["growlab_5", "Growlab 5", "df8528ed-15ad-4a39-a33a-698880684001", "Thruster Level 1"],
    ["growlab_6", "Growlab 6", "9601f2ca-9552-48b0-afc1-b0f200461114", "XXL Chest"],
    ["growlab_7", "Growlab 7", "78677314-1885-4c9e-87ee-04cdc929b0dc", "Fireworks"],
  ].map(([id, title, uuid, schematicTitle]) => ({
    id,
    kind: "growlab" as const,
    title,
    instruction: `Clear ${title} and claim its balloon-crate reward.`,
    schematics: [item(uuid, schematicTitle)],
  })),
  {
    id: "quest_build_wochouse",
    kind: "side_quest",
    title: "Home is Where the Woc Is",
    quest: "quest_build_wochouse",
    instruction: "Complete the side quest “Home is Where the Woc Is”.",
    schematics: [
      item("ab835444-a6b3-41b4-bf37-207031c5ff8d", "Door Handle"),
      item("3c0cf002-905f-45bc-84ef-b4fbb4549a63", "Modular Sofa"),
      item("2fa43c38-9a66-4c03-a159-756a0c8b0078", "Modular Sofa Armrest"),
    ],
  },
  {
    id: "quest_build_cardboardpoop",
    kind: "side_quest",
    title: "Cardboard Munchies",
    quest: "quest_build_cardboardpoop",
    instruction: "Complete the side quest “Cardboard Munchies”.",
    schematics: [
      item("e96e15d9-0997-4ed6-8c75-751848fb8edd", "Bonsai Tree"),
      item("682538ac-7a45-4f56-b500-ec5d3d5f3eb7", "Flytrap Plant"),
    ],
  },
  {
    id: "quest_build_totebotkey",
    kind: "side_quest",
    title: "Just a bot in a Cage",
    quest: "quest_build_totebotkey",
    instruction: "Complete the side quest “Just a bot in a Cage”.",
    schematics: [
      item("03ae13a9-65a9-4c2f-8640-8235a8d9ed05", "Green Totebot Statue"),
      item("85771e42-fbb3-49f5-ab99-85167623deeb", "Blue Totebot Statue"),
      item("17371481-da9e-4bc1-bbbd-438109aad552", "Yellow Totebot Statue"),
      item("9d6992f4-8a1a-40c2-8be3-adfce6e4cfed", "Red Totebot Statue"),
    ],
  },
  {
    id: "quest_build_cornheart",
    kind: "side_quest",
    title: "Heart of Corn",
    quest: "quest_build_cornheart",
    instruction: "Complete the side quest “Heart of Corn”.",
    schematics: [
      item("63910258-85da-45eb-8108-bb5c489695a0", "Ivy Pipe Straight"),
      item("f57e4a93-f61b-4418-83c1-3d8cbcd6322a", "Ivy Pipe bend"),
      item("20d4a103-c842-40d7-9df8-0ba0f9000752", "Ivy Pipe T"),
      item("64401599-2a38-4d83-93f9-a76b137c9574", "Lattice Panel"),
    ],
  },
  {
    id: "quest_build_cozybed",
    kind: "side_quest",
    title: "Home is Where You go to Bed",
    quest: "quest_build_cozybed",
    instruction: "Complete the side quest “Home is Where You go to Bed”.",
    schematics: [
      item("4beb69d3-ede9-434e-9535-62e7677f6982", "Lowrider Plaque"),
      item("cb40d51e-86dc-4bf4-999a-879dbfe91e4b", "Wire Wheel"),
      item("8b4bd31f-cb1e-42ae-ac33-b2f951609bd2", "Wind Shield"),
      item("eb3d3125-d022-4624-a8bc-55b085ef8bd2", "Car Front Panel"),
      item("02e1af8e-090f-432f-9ad4-1bb41add0d4b", "Car Back Panel"),
      item("6b19e80c-dbc3-4a84-be37-54646f39f23d", "Car Bumper"),
      item("ea42ac82-47cc-4e13-889c-de38f8478b91", "Back Mirror"),
      item("e858c1d5-8b16-4749-9119-b77e904520ac", "Side Mirror"),
    ],
  },
  {
    id: "quest_build_xylophone",
    kind: "side_quest",
    title: "Make Some Noise",
    quest: "quest_build_xylophone",
    instruction: "Complete the side quest “Make Some Noise”.",
    schematics: [
      item("4f9d4c7b-c9fe-4f95-a36a-8f22654d14f5", "Synth"),
      item("18321228-7164-4dfd-928f-fa86bad31ba1", "Computer"),
    ],
  },
  {
    id: "quest_build_beesuit",
    kind: "side_quest",
    title: "Bee Like Me",
    quest: "quest_build_beesuit",
    instruction: "Complete the side quest “Bee Like Me”.",
    schematics: [
      item("30d3d0fe-a96a-4804-a0bd-8f01cf674adb", "Male Mechanic Statue"),
      item("0db3e749-adf2-4ba5-bb37-1cebcfb59cb2", "Female Mechanic Statue"),
      item("488dfd3c-eb6b-4663-90b1-add00b1c2700", "Maintenance Ship Statue"),
    ],
  },
  {
    id: "quest_build_bigfan",
    kind: "side_quest",
    title: "If You Can't Take the Heat…",
    quest: "quest_build_bigfan",
    instruction: "Complete the side quest “If You Can't Take the Heat…”.",
    schematics: [
      item("34081f36-2cca-47aa-b252-7d49a685e759", "Gold Platinum Bearing"),
    ],
  },
  {
    id: "quest_build_carousel",
    kind: "side_quest",
    title: "Round She Goes",
    quest: "quest_build_carousel",
    instruction: "Complete the side quest “Round She Goes”.",
    schematics: [item("e8d88e1f-7025-4911-8d8a-d77574343632", "Beach Ball")],
  },
  {
    id: "quest_build_catapult",
    kind: "side_quest",
    title: "Onwards and Upwards",
    quest: "quest_build_catapult",
    instruction: "Complete the side quest “Onwards and Upwards”.",
    schematics: [item("17c301ae-1d51-445c-9c72-6f40ec386dba", "Anvil")],
  },
  {
    id: "quest_build_crowbar",
    kind: "side_quest",
    title: "Cageball Rock",
    quest: "quest_build_crowbar",
    instruction: "Complete the side quest “Cageball Rock”.",
    schematics: [item("198c8b79-1f02-49fc-aacf-f8cacca7a3a7", "Safe")],
  },
  {
    id: "quest_build_compass",
    kind: "side_quest",
    title: "Any Which Way but Home",
    quest: "quest_build_compass",
    instruction: "Complete the side quest “Any Which Way but Home”.",
    schematics: [item("84050f02-448f-4cc0-93b8-82876368ada6", "Coffee Pot")],
  },
  {
    id: "quest_build_garden",
    kind: "side_quest",
    title: "Now the Flowers Will Grow",
    quest: "quest_build_garden",
    instruction: "Complete the side quest “Now the Flowers Will Grow”.",
    schematics: [item("bd77f76a-6c47-4107-ba4a-c340e89ad516", "Fountain")],
  },
  {
    id: "quest_build_sawbladearm",
    kind: "side_quest",
    title: "Timber!",
    quest: "quest_build_sawbladearm",
    instruction: "Complete the side quest “Timber!”.",
    schematics: [item("72045c19-fa44-4ce9-9f99-e9541e5a4d46", "Bottle Garden")],
  },
  {
    id: "quest_build_popcorn",
    kind: "side_quest",
    title: "The Pop Don't Stop",
    quest: "quest_build_popcorn",
    instruction: "Complete the side quest “The Pop Don't Stop”.",
    schematics: [item("cbd2c2d3-ea26-4805-b9fe-5694f89f162f", "Woc Picture")],
  },
  {
    id: "quest_build_musicbox",
    kind: "side_quest",
    title: "Itty Bitty Ditty",
    quest: "quest_build_musicbox",
    instruction: "Complete the side quest “Itty Bitty Ditty”.",
    schematics: [item("61b0abe1-817d-416a-b49d-443b2ec13b6e", "Lava Lamp")],
  },
  {
    id: "quest_build_nicehouse",
    kind: "side_quest",
    title: "A Place to Dump Your Scrap",
    quest: "quest_build_nicehouse",
    instruction: "Complete the side quest “A Place to Dump Your Scrap”.",
    schematics: [
      item("e5e81f70-6477-4099-ad77-76bf6a4f364f", "Table Lamp"),
      item("c2e6c7f6-6519-4e79-813d-354cc63080a8", "Bowl"),
    ],
  },
  {
    id: "quest_build_sledgehammer",
    kind: "side_quest",
    title: "Every Bot Looks Like a Nail",
    quest: "quest_build_sledgehammer",
    instruction: "Complete the side quest “Every Bot Looks Like a Nail”.",
    schematics: [
      item("cd5cf990-a08e-4e0b-9824-334fe13bf379", "Bowling Ball"),
      item("9c051125-517d-4852-9bb9-2e77f8bea55f", "Pin"),
    ],
  },
  {
    id: "quest_build_steelbridge",
    kind: "side_quest",
    title: "Building Bridges",
    quest: "quest_build_steelbridge",
    instruction: "Complete the side quest “Building Bridges”.",
    schematics: [
      item("4e9c67f9-602f-4df5-bcf6-939dcb18d010", "Farmbot Statue"),
    ],
  },
  {
    id: "quest_build_baguette",
    kind: "side_quest",
    title: "The Important Meal",
    quest: "quest_build_baguette",
    instruction: "Complete the side quest “The Important Meal”.",
    schematics: [
      item("3082a130-f1e4-4a7f-9856-7129f969564c", "Gas Stove"),
      item("d48dc62b-ae26-4b0d-bc15-939f835ae19b", "Kitchen Pot"),
    ],
  },
]

export const fixedSchematics = schematicSources.flatMap((source) =>
  source.schematics.map((schematic) => ({ ...schematic, source })),
)

// RewardLockerBase.lua unlocks the first bundle below which is still missing.
// In normal progression the one special reward locker in each Growlab therefore
// maps these bundles to Growlabs 1–7 in order.
export const blockSchematicGroups: BlockSchematicGroup[] = [
  {
    id: "growlab_1_blocks",
    title: "Growlab 1",
    schematics: [
      item("4aa2a6f0-65a4-42e3-bf96-7dec62570e0b", "Net Block"),
      item("ea6864db-bb4f-4a89-b9ec-977849b6713a", "Punched Steel Block"),
    ],
  },
  {
    id: "growlab_2_blocks",
    title: "Growlab 2",
    schematics: [
      item("628b2d61-5ceb-43e9-8334-a4135566df7a", "Plastic Block"),
      item("f406bf6e-9fd5-4aa0-97c1-0b3c2118198e", "Bubble Plastic Block"),
    ],
  },
  {
    id: "growlab_3_blocks",
    title: "Growlab 3",
    schematics: [
      item("749f69e0-56c9-488c-adf6-66c58531818f", "Glass Tile Block"),
      item("09ca2713-28ee-4119-9622-e85490034758", "Barrier Block"),
    ],
  },
  {
    id: "growlab_4_blocks",
    title: "Growlab 4",
    schematics: [
      item("8ca49bff-eeef-4b43-abd0-b527a567f1b7", "Tile Block"),
      item("920b40c8-6dfc-42e7-84e1-d7e7e73128f6", "Restroom Block"),
      item("0603b36e-0bdb-4828-b90c-ff19abcdfe34", "Brick Block"),
    ],
  },
  {
    id: "growlab_5_blocks",
    title: "Growlab 5",
    schematics: [
      item("cd0eff89-b693-40ee-bd4c-3500b23df44e", "Concrete Slab Block"),
      item("a479066d-4b03-46b5-8437-e99fec3f43ee", "Striped Net Block"),
      item("b4fa180c-2111-4339-b6fd-aed900b57093", "Square Mesh Block"),
    ],
  },
  {
    id: "growlab_6_blocks",
    title: "Growlab 6",
    schematics: [
      item("f7d4bfed-1093-49b9-be32-394c872a1ef4", "Diamond Plate Block"),
      item("25a5ffe7-11b1-4d3e-8d7a-48129cbaf05e", "Extruded Metal Block"),
      item("3e3242e4-1791-4f70-8d1d-0ae9ba3ee94c", "Aluminum Block"),
    ],
  },
  {
    id: "growlab_7_blocks",
    title: "Growlab 7",
    schematics: [
      item("d740a27d-cc0f-4866-9e07-6a5c516ad719", "Worn Metal Block"),
      item("220b201e-aa40-4995-96c8-e6007af160de", "Rusted Metal Block"),
      item("f5ceb7e3-5576-41d2-82d2-29860cf6e20e", "Cracked Concrete Block"),
      item("b145d9ae-4966-4af6-9497-8fca33f9aee3", "Plaster Block"),
      item("9be6047c-3d44-44db-b4b9-9bcf8a9aab20", "Insulation Block"),
      item("e981c337-1c8a-449c-8602-1dd990cbba3a", "Painted Wall Block"),
    ],
  },
]

export const blockSchematics = blockSchematicGroups.flatMap((group) =>
  group.schematics.map((schematic) => ({ ...schematic, group })),
)
