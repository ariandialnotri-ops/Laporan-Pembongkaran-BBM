import { useCallback, useEffect, useState } from 'react'

export type QueryState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'error'; data?: undefined; error: Error }
  | { status: 'ready'; data: T; error?: undefined }

/** Minimal async loader: runs `fn` on mount and whenever `reload` is called. */
export function useQuery<T>(fn: () => Promise<T>) {
  const [state, setState] = useState<QueryState<T>>({ status: 'loading' })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    fn().then(
      (data) => alive && setState({ status: 'ready', data }),
      (error: unknown) =>
        alive && setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) }),
    )
    return () => {
      alive = false
    }
  }, [fn, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return [state, reload] as const
}
