export type SortDir = 'asc' | 'desc'

/** Higher is a better record, so a descending sort puts the best mark first. */
export function recordScore (record: string) {
  const [w, l, t] = record.split('-').map(Number)
  if (!Number.isFinite(w)) return null
  return w * 10000 - (l || 0) * 100 - (t || 0)
}

export function useColumnSort (initialKey = '', initialDir: SortDir = 'desc') {
  const sortKey = ref(initialKey)
  const sortDir = ref<SortDir>(initialDir)

  function toggle (key: string, first: SortDir = 'desc') {
    if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
    else {
      sortKey.value = key
      sortDir.value = first
    }
  }

  function sortBy<T> (rows: T[], value: (row: T) => string | number | null | undefined) {
    if (!sortKey.value) return rows
    const dir = sortDir.value === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const av = value(a)
      const bv = value(b)
      const aMissing = av == null || av === ''
      const bMissing = bv == null || bv === ''
      if (aMissing && bMissing) return 0
      if (aMissing) return 1
      if (bMissing) return -1
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir
    })
  }

  return { sortKey, sortDir, toggle, sortBy }
}
