'use client'

import { useEffect, useRef } from 'react'

interface Marker {
  lat: number
  lng: number
  title?: string
  popup?: string
  color?: 'blue' | 'red' | 'green' | 'orange'
}

interface LeafletMapProps {
  center?: [number, number]
  zoom?: number
  markers?: Marker[]
  className?: string
  height?: string
}

export function LeafletMap({ center, zoom = 13, markers = [], className = '', height = '300px' }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<unknown>(null)

  useEffect(() => {
    if (!containerRef.current) return
    if (mapRef.current) return

    const initMap = async () => {
      const L = (await import('leaflet')).default

      // Inject leaflet CSS once
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link')
        link.id = 'leaflet-css'
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
      }

      // Fix default marker icons
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const validMarkers = markers.filter(m => m.lat && m.lng)
      const mapCenter: [number, number] = center ?? (validMarkers[0] ? [validMarkers[0].lat, validMarkers[0].lng] : [41.33, 19.83])

      const map = L.map(containerRef.current!, { center: mapCenter, zoom })
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      const colorMap: Record<string, string> = {
        blue: '#2563eb', red: '#dc2626', green: '#16a34a', orange: '#d97706',
      }

      for (const m of validMarkers) {
        const color = colorMap[m.color ?? 'blue'] ?? colorMap.blue
        const icon = L.divIcon({
          html: `<div style="background:${color};width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
          className: '',
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        })
        const marker = L.marker([m.lat, m.lng], { icon }).addTo(map)
        if (m.popup || m.title) {
          marker.bindPopup(m.popup ?? m.title ?? '')
        }
        if (m.title) marker.bindTooltip(m.title)
      }

      if (validMarkers.length > 1) {
        const bounds = L.latLngBounds(validMarkers.map(m => [m.lat, m.lng]))
        map.fitBounds(bounds, { padding: [20, 20] })
      }
    }

    initMap().catch(console.error)

    return () => {
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove()
        mapRef.current = null
      }
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={containerRef} className={`rounded-lg overflow-hidden ${className}`} style={{ height }} />
  )
}
