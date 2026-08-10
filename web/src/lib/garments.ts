export type GarmentSlot = "torso" | "gloves" | "shoes" | "legs" | "hat" | "backpack"

export interface GarmentDefinition {
  uuid: string
  title: string
  group: string
  slot: GarmentSlot
}

export type UnlockChecksumState = "valid" | "invalid" | "unverified"

export interface GarmentUnlockData {
  version: number
  declaredCount: number
  unlocked: Set<string>
  unknownUuids: string[]
  checksum: UnlockChecksumState
}

const UUID_LENGTH = 16
const HEADER_LENGTH = 12

function uuidFromBytes(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function steamIdBytes(steamId: string): Uint8Array {
  let value: bigint
  try {
    value = BigInt(steamId)
  } catch {
    throw new Error("The loaded save contains an invalid Steam ID.")
  }
  if (value < 0n || value > 0xffffffffffffffffn) {
    throw new Error("The loaded save contains an invalid Steam ID.")
  }
  const bytes = new Uint8Array(8)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number(value & 0xffn)
    value >>= 8n
  }
  return bytes
}

export function parseGarmentUnlock(
  buffer: ArrayBuffer,
  knownUuids: ReadonlySet<string>,
  steamId?: string | null,
): GarmentUnlockData {
  const bytes = new Uint8Array(buffer)
  if (bytes.length < HEADER_LENGTH) throw new Error("This file is too short to be a garment unlock file.")

  const view = new DataView(buffer)
  const version = view.getUint32(0, false)
  const storedChecksum = view.getUint32(4, false)
  const declaredCount = view.getUint32(8, false)
  const expectedLength = HEADER_LENGTH + declaredCount * UUID_LENGTH
  if (version !== 1) throw new Error(`Unsupported garment unlock version ${version}.`)
  if (bytes.length !== expectedLength) {
    throw new Error(`The file declares ${declaredCount} garments but has an unexpected size.`)
  }

  const unlocked = new Set<string>()
  const unknownUuids: string[] = []
  for (let offset = HEADER_LENGTH; offset < bytes.length; offset += UUID_LENGTH) {
    const uuid = uuidFromBytes(bytes.subarray(offset, offset + UUID_LENGTH))
    unlocked.add(uuid)
    if (!knownUuids.has(uuid)) unknownUuids.push(uuid)
  }

  let checksum: UnlockChecksumState = "unverified"
  if (steamId) {
    const checksumInput = new Uint8Array(8 + bytes.length - HEADER_LENGTH)
    checksumInput.set(steamIdBytes(steamId), 0)
    checksumInput.set(bytes.subarray(HEADER_LENGTH), 8)
    checksum = crc32(checksumInput) === storedChecksum ? "valid" : "invalid"
  }

  return { version, declaredCount, unlocked, unknownUuids, checksum }
}
