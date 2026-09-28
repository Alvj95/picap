import { useCallback, useEffect, useState } from 'react'
import type { AppData } from '../types'

const KEY = 'turnos-handling:v1'

export const emptyData = (): AppData => ({
  version: 1,
  profile: { name: '', employeeId: '', schedulingEmail: '' },
  shifts: [],
  roster: [],
  rosterName: '',
  rosterImportedAt: null,
  swaps: [],
  incoming: [],
})

/** Validates a backup or stored blob, filling any missing field with defaults. */
export function reviveData(raw: unknown): AppData {
  if (!raw || typeof raw !== 'object' || (raw as AppData).version !== 1) throw new Error('Archivo de copia no válido.')
  const data = { ...emptyData(), ...(raw as AppData) }
  return {
    ...data,
    profile: { ...emptyData().profile, ...data.profile },
    // Before the coworker/scheduling flow, "aceptado" meant the change was already applied.
    swaps: data.swaps.map((s) => ({
      ...s,
      answeredAt: s.answeredAt ?? null,
      reply: s.reply ?? '',
      emailedAt: s.emailedAt ?? null,
      status: (s.status as string) === 'aceptado' ? 'aprobado' : s.status,
    })),
  }
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? reviveData(JSON.parse(raw)) : emptyData()
  } catch {
    return emptyData()
  }
}

/**
 * All app state, persisted on the device. This is the single place to swap in a shared
 * backend later (so coworkers see the same roster and swap requests).
 */
export function useAppData() {
  const [data, setData] = useState<AppData>(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      // Storage full or blocked (private mode): the app keeps working for this session.
    }
  }, [data])

  const update = useCallback((fn: (d: AppData) => AppData) => setData((d) => fn(d)), [])
  return [data, update] as const
}

export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Opens the native share sheet when available, WhatsApp otherwise. */
export async function shareText(text: string) {
  if (navigator.share) {
    try {
      await navigator.share({ text })
      return
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
}
