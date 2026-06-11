import { useCallback, useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import type { DragEndEvent } from 'leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Crosshair, Loader2, MapPin } from 'lucide-react'

// ─── Fix Leaflet default icon broken paths in Vite bundlers ────────────────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const HYDERABAD: [number, number] = [17.385, 78.4867]

// ─── Sub-component: keeps the map centered on the active position ──────────────
function MapCenterer({ position }: { position: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(position, map.getZoom(), { animate: true, duration: 1 })
  }, [map, position])
  return null
}

// ─── Sub-component: ResizeObserver so tiles fill the card on resize ────────────
function ResizeHandler() {
  const map = useMap()
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])
  return null
}

// ─── Props ─────────────────────────────────────────────────────────────────────
type FarmMapProps = {
  initialCenter?: [number, number]
  farmName?: string
  onPositionChange?: (pos: [number, number]) => void
}

export function FarmMap({
  initialCenter = HYDERABAD,
  farmName = 'My Farm',
  onPositionChange,
}: FarmMapProps) {
  const [position, setPosition] = useState<[number, number]>(initialCenter)
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const markerRef = useRef<L.Marker | null>(null)

  // ── Auto-detect on mount ─────────────────────────────────────────────────────
  const detectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported by this browser.')
      return
    }
    setLocating(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude]
        setPosition(coords)
        onPositionChange?.(coords)
        setLocating(false)
      },
      (err) => {
        setGeoError(
          err.code === 1
            ? 'Location access denied. Showing default location.'
            : 'Unable to detect location. Showing default.'
        )
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [onPositionChange])

  useEffect(() => {
    detectLocation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Draggable marker dragend handler ─────────────────────────────────────────
  const handleDragEnd = useCallback(() => {
    const marker = markerRef.current
    if (!marker) return
    const latlng = marker.getLatLng()
    const coords: [number, number] = [latlng.lat, latlng.lng]
    setPosition(coords)
    onPositionChange?.(coords)
  }, [onPositionChange])

  return (
    <div className="flex h-full flex-col gap-0">
      {/* Map */}
      <div className="relative flex-1 overflow-hidden rounded-2xl">
        <MapContainer
          center={position}
          zoom={14}
          className="h-full w-full"
          style={{ minHeight: '240px', background: '#1a1f2e' }}
          scrollWheelZoom={false}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker
            position={position}
            draggable={true}
            ref={markerRef}
            eventHandlers={{
              dragend: handleDragEnd as (e: DragEndEvent) => void,
            }}
          >
            <Popup>
              <div className="text-sm font-semibold">{farmName}</div>
              <div className="mt-1 text-xs text-gray-500">
                {position[0].toFixed(5)}°N, {position[1].toFixed(5)}°E
              </div>
              <div className="mt-1 text-xs text-gray-400">Drag marker to adjust</div>
            </Popup>
          </Marker>
          <MapCenterer position={position} />
          <ResizeHandler />
        </MapContainer>

        {/* Locating spinner overlay */}
        {locating && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center rounded-2xl bg-black/40 backdrop-blur-sm">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/60 px-4 py-2 text-sm text-white">
              <Loader2 size={16} className="animate-spin text-green-400" />
              Detecting your location…
            </div>
          </div>
        )}
      </div>

      {/* Coordinate readout + controls */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
          <MapPin size={13} className="text-green-400 shrink-0" />
          <span className="font-mono">
            {position[0].toFixed(5)}°N &nbsp;|&nbsp; {position[1].toFixed(5)}°E
          </span>
        </div>

        <button
          type="button"
          onClick={detectLocation}
          disabled={locating}
          className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 transition hover:border-green-500/40 hover:bg-green-500/10 hover:text-white disabled:opacity-50"
        >
          {locating
            ? <Loader2 size={13} className="animate-spin" />
            : <Crosshair size={13} />
          }
          Reset to Current Location
        </button>
      </div>

      {/* Geo error banner */}
      {geoError && (
        <p className="mt-2 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-3 py-1.5 text-xs text-yellow-300">
          {geoError}
        </p>
      )}
    </div>
  )
}
