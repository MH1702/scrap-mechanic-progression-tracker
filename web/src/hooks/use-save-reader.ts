import { useCallback, useEffect, useRef, useState } from "react"

import type { WorldModel } from "@/lib/types"

type ReaderPhase = "loading" | "ready" | "reading" | "complete" | "error"

interface ReaderState {
  phase: ReaderPhase
  message: string
  model?: WorldModel
}

type WorkerReply =
  | { type: "ready" }
  | { type: "model"; model: WorldModel }
  | { type: "error"; message: string }

export function useSaveReader() {
  const workerRef = useRef<Worker | null>(null)
  const [state, setState] = useState<ReaderState>({
    phase: "loading",
    message: "Loading the local save reader…",
  })

  useEffect(() => {
    const worker = new Worker(new URL("../save-worker.ts", import.meta.url), {
      type: "module",
    })
    workerRef.current = worker
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      if (event.data.type === "ready") {
        setState((current) =>
          current.phase === "loading"
            ? { phase: "ready", message: "Ready — choose or drop a save" }
            : current,
        )
      } else if (event.data.type === "model") {
        setState({
          phase: "complete",
          message: "Map generated locally",
          model: event.data.model,
        })
      } else {
        setState({
          phase: "error",
          message: `Could not read save: ${event.data.message}`,
        })
      }
    }
    worker.onerror = (event) => {
      setState({
        phase: "error",
        message: `Could not start save reader: ${event.message}`,
      })
    }
    return () => {
      workerRef.current = null
      worker.terminate()
    }
  }, [])

  const openFile = useCallback(async (file?: File) => {
    const worker = workerRef.current
    if (!file || !worker) return
    setState((current) => ({
      phase: "reading",
      message: `Reading ${file.name} locally…`,
      model: current.model,
    }))
    try {
      const bytes = await file.arrayBuffer()
      worker.postMessage({ type: "decode", bytes }, [bytes])
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setState({ phase: "error", message: `Could not open file: ${message}` })
    }
  }, [])

  return { ...state, openFile }
}
