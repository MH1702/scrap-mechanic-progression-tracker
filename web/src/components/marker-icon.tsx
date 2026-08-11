import {
  AtomIcon,
  BananaIcon,
  CastleIcon,
  CarrotIcon,
  CircleUserRoundIcon,
  CircleAlertIcon,
  DropletIcon,
  FlaskConicalIcon,
  ForkliftIcon,
  HammerIcon,
  RocketIcon,
  SproutIcon,
  TractorIcon,
  WarehouseIcon,
  WrenchIcon,
} from "lucide-react"

import type { PoiMarker } from "@/lib/types"

type IconComponent = typeof AtomIcon

export function markerIconComponent(marker: PoiMarker): IconComponent | undefined {
  if (marker.featureType === "chemical_pond") return FlaskConicalIcon
  if (marker.featureType === "oil_pond") return DropletIcon
  if (marker.featureType === "warehouse") return WarehouseIcon
  if (marker.featureType === "schematic_bot") return AtomIcon
  if (marker.featureType === "ruin") return CastleIcon
  if (marker.featureType === "caged_farmer") return CircleUserRoundIcon
  if (marker.category === "main_quest") return CircleAlertIcon
  if (marker.category === "side_quest") return HammerIcon
  if (marker.category === "growlab") return SproutIcon
  if (marker.category !== "location") return undefined

  if (marker.poiType === 101 || marker.poiType === 105) return RocketIcon
  if (marker.poiType === 109 || marker.poiType === 124) return WrenchIcon
  if (marker.poiType === 110) return CarrotIcon
  if (marker.poiType === 111) return BananaIcon
  if (marker.poiType === 104) return ForkliftIcon
  if (marker.poiType === 102) return TractorIcon
  return undefined
}

export function markerIconColor(marker: PoiMarker): string {
  return marker.featureType === "oil_pond" ? "#f4f6f5" : marker.color
}

export function MarkerIcon({
  marker,
  className,
}: {
  marker: PoiMarker
  className?: string
}) {
  const Icon = markerIconComponent(marker)
  if (!Icon) return null
  return <Icon className={className} style={{ color: markerIconColor(marker) }} />
}
