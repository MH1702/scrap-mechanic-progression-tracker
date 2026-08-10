/// <reference lib="webworker" />

// Pyodide's supported worker entry point is a remote ES module.
// @ts-expect-error TypeScript does not resolve declarations from remote URLs.
import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v314.0.2/full/pyodide.mjs"

const PYODIDE_BASE = "https://cdn.jsdelivr.net/pyodide/v314.0.2/full/"
const scope = self as unknown as DedicatedWorkerGlobalScope

interface PyodideRuntime {
  FS: {
    writeFile(path: string, data: Uint8Array): void
    unlink(path: string): void
  }
  globals: {
    set(name: string, value: unknown): void
    delete(name: string): void
  }
  unpackArchive(data: ArrayBuffer, format: string, options: { extractDir: string }): void
  runPython(source: string): string
}

let pyodide: PyodideRuntime
const ready = (async () => {
  pyodide = (await loadPyodide({ indexURL: PYODIDE_BASE })) as PyodideRuntime
  const bundleUrl = new URL("../python/progression-tracker.zip", scope.location.href)
  const bundle = await fetch(bundleUrl)
  if (!bundle.ok) {
    throw new Error(`Could not load parser bundle (${bundle.status})`)
  }
  pyodide.unpackArchive(await bundle.arrayBuffer(), "zip", {
    extractDir: "/smmap_app",
  })
  pyodide.runPython("import sys; sys.path.insert(0, '/smmap_app')")
  scope.postMessage({ type: "ready" })
})().catch((error: unknown) => {
  scope.postMessage({ type: "error", message: String(error) })
})

scope.onmessage = async (event: MessageEvent<{ type: string; bytes: ArrayBuffer }>) => {
  if (event.data.type !== "decode") return
  try {
    await ready
    const path = "/tmp/dropped-save.db"
    pyodide.FS.writeFile(path, new Uint8Array(event.data.bytes))
    try {
      pyodide.globals.set("save_path", path)
      const json = pyodide.runPython(
        "from progression_tracker.web_model import decode_json\ndecode_json(save_path)",
      )
      scope.postMessage({ type: "model", model: JSON.parse(json) })
    } finally {
      pyodide.globals.delete("save_path")
      try {
        pyodide.FS.unlink(path)
      } catch {
        // The temporary in-memory copy is already absent.
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    scope.postMessage({ type: "error", message })
  }
}
