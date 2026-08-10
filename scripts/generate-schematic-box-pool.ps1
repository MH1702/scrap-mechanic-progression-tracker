param(
    [Parameter(Mandatory = $true)]
    [string] $GameRoot
)

$ErrorActionPreference = "Stop"

function Read-SmJson([string] $Path) {
    # Several game JSON files contain JavaScript-style comments.
    $text = (Get-Content -LiteralPath $Path -Raw) -replace '(?m)//.*$', ''
    return $text | ConvertFrom-Json
}

function Add-Uuid([System.Collections.Generic.HashSet[string]] $Set, [object] $Value) {
    if ($null -ne $Value -and "$Value" -match '^[0-9a-fA-F-]{36}$') {
        [void] $Set.Add("$Value".ToLowerInvariant())
    }
}

$survivalRoot = Join-Path $GameRoot "Survival"
$itemsLua = Get-Content -LiteralPath (Join-Path $survivalRoot "Scripts/game/survival_items.lua") -Raw
$itemUuids = @{}
[regex]::Matches(
    $itemsLua,
    '(?<name>[A-Za-z0-9_]+)\s*=\s*sm\.uuid\.new\(\s*"(?<uuid>[0-9a-fA-F-]{36})"'
) | ForEach-Object {
    $itemUuids[$_.Groups['name'].Value] = $_.Groups['uuid'].Value.ToLowerInvariant()
}

$candidates = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$recipeMap = Read-SmJson (Join-Path $survivalRoot "CraftingRecipes/craftbot/craftbot.json")
foreach ($recipeSet in $recipeMap.PSObject.Properties) {
    if ($recipeSet.Name -eq "craftbot_core") { continue }
    $relativePath = $recipeSet.Value -replace '^\$SURVIVAL_DATA/', ''
    $recipes = Read-SmJson (Join-Path $survivalRoot $relativePath)
    foreach ($recipe in $recipes) {
        [void] $candidates.Add("$($recipe.itemId)".ToLowerInvariant())
    }
}
$sawtableRecipes = Read-SmJson (Join-Path $survivalRoot "CraftingRecipes/sawtable.json")
foreach ($recipe in $sawtableRecipes) {
    [void] $candidates.Add("$($recipe.itemId)".ToLowerInvariant())
}

$parts = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
@(
    (Join-Path $GameRoot "Data/Objects/Database/ShapeSets"),
    (Join-Path $survivalRoot "Objects/Database/ShapeSets")
) | ForEach-Object {
    Get-ChildItem -LiteralPath $_ -Recurse -Filter "*.shapeset" | ForEach-Object {
        $shapeSet = Read-SmJson $_.FullName
        $shapeSet.partList | ForEach-Object { Add-Uuid $parts $_.uuid }
    }
}

$excluded = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$coreRecipes = Read-SmJson (Join-Path $survivalRoot "CraftingRecipes/craftbot/craftbot_core.json")
foreach ($recipe in $coreRecipes) {
    Add-Uuid $excluded $recipe.itemId
}

$recipeManagerLua = Get-Content -LiteralPath (Join-Path $survivalRoot "Scripts/game/managers/RecipeManager.lua") -Raw
$defaultItemsMatch = [regex]::Match(
    $recipeManagerLua,
    'local DefaultUnlockedItems\s*=\s*\{(?<items>[\s\S]*?)\n\}'
)
[regex]::Matches($defaultItemsMatch.Groups['items'].Value, 'ITEMS\.(?<name>[A-Za-z0-9_]+)') |
    ForEach-Object { Add-Uuid $excluded $itemUuids[$_.Groups['name'].Value] }

$questSet = Read-SmJson (Join-Path $survivalRoot "ScriptableObjects/scriptableObjectSets/sob_quests.sobset")
$questSet.scriptableObjectList | ForEach-Object {
    $_.data.rewards | Where-Object type -eq "schematic" | ForEach-Object {
        Add-Uuid $excluded $itemUuids[$_.name]
    }
}

$constantsLua = Get-Content -LiteralPath (Join-Path $survivalRoot "Scripts/game/survival_constants.lua") -Raw
$growlabRewards = [regex]::Match(
    $constantsLua,
    'POI_TYPE_TO_GROWLAB_BALLOONCRATE_REWARD\s*=\s*\{(?<items>[\s\S]*?)\n\}'
)
[regex]::Matches($growlabRewards.Groups['items'].Value, 'ITEMS\.(?<name>[A-Za-z0-9_]+)') |
    ForEach-Object { Add-Uuid $excluded $itemUuids[$_.Groups['name'].Value] }

@(
    "obj_interactive_plasmadrill_lvl1",
    "obj_resource_refinedcoralium",
    "obj_resource_refinednimbolium",
    "obj_resource_refinedlemonium",
    "obj_resource_refinedsapphire",
    "obj_resource_refinedcrystal"
) | ForEach-Object { Add-Uuid $excluded $itemUuids[$_] }

@("hideout.json", "mininghubTrader.json") | ForEach-Object {
    $traderRecipes = Read-SmJson (Join-Path $survivalRoot "CraftingRecipes/$_")
    $traderRecipes | Where-Object schematic | ForEach-Object {
        Add-Uuid $excluded $_.itemId
    }
}

$tradeGroups = Read-SmJson (Join-Path $survivalRoot "ScriptJsonFiles/Trader/trader.tradegroup")
$tradeGroups.questGroups | ForEach-Object {
    $_.rewards | Where-Object unlockCraftBot | ForEach-Object {
        Add-Uuid $excluded $_.item
    }
}

$pool = @(
    $candidates |
        Where-Object { $parts.Contains($_) -and -not $excluded.Contains($_) } |
        Sort-Object
)

if ($pool.Count -eq 0) {
    throw "No eligible recipes found (candidates: $($candidates.Count), parts: $($parts.Count), excluded: $($excluded.Count)). Check the game path and data format."
}

$lines = @(
    "// Generated from Scrap Mechanic's RecipeManager and crafting recipe data."
    "// These are the part recipes eligible for random schematic-box unlocks."
    "export const schematicBoxRecipes = ["
) + ($pool | ForEach-Object { "  `"$_`"," }) + @(
    "] as const"
    ""
)

$outputPath = Join-Path $PSScriptRoot "../web/src/lib/schematic-box-recipes.ts"
$lines | Set-Content -LiteralPath $outputPath -Encoding utf8
Write-Host "Wrote $($pool.Count) schematic-box recipes to $outputPath"
