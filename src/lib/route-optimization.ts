// Haversine formula — straight-line distance between two GPS points
export function calculateDistanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function formatDistanceKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

export interface Locatable {
  id: string
  lat?: number | null
  lng?: number | null
}

export interface RouteStop<T extends Locatable> {
  item: T
  distanceFromPrevKm: number | null
  hasLocation: boolean
}

// Nearest-neighbor greedy algorithm.
// Deliveries without lat/lng are appended at the end unchanged.
export function optimizeRoute<T extends Locatable>(
  items: T[],
  startLat: number,
  startLng: number,
): RouteStop<T>[] {
  const withGps = items.filter(d => d.lat != null && d.lng != null)
  const noGps   = items.filter(d => d.lat == null || d.lng == null)

  const result: RouteStop<T>[] = []
  const pool = [...withGps]
  let curLat = startLat
  let curLng = startLng

  while (pool.length > 0) {
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < pool.length; i++) {
      const d = calculateDistanceKm(curLat, curLng, pool[i].lat!, pool[i].lng!)
      if (d < bestDist) { bestDist = d; bestIdx = i }
    }
    const [chosen] = pool.splice(bestIdx, 1)
    result.push({ item: chosen, distanceFromPrevKm: bestDist, hasLocation: true })
    curLat = chosen.lat!
    curLng = chosen.lng!
  }

  for (const d of noGps) {
    result.push({ item: d, distanceFromPrevKm: null, hasLocation: false })
  }

  return result
}

export function totalRouteKm(stops: RouteStop<Locatable>[]): number {
  return stops.reduce((s, stop) => s + (stop.distanceFromPrevKm ?? 0), 0)
}
