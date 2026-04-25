export async function detectCityFromGeolocation(): Promise<string> {
  if (!navigator.geolocation) return 'Hyderabad'

  const coords = await new Promise<GeolocationPosition | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      {
        enableHighAccuracy: false,
        timeout: 12_000,
        maximumAge: 60_000,
      },
    )
  })

  if (!coords) return 'Hyderabad'

  const { latitude, longitude } = coords.coords
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    const data = (await res.json()) as {
      address?: {
        city?: string
        town?: string
        village?: string
        county?: string
        state_district?: string
      }
    }
    const city =
      data.address?.city ||
      data.address?.town ||
      data.address?.village ||
      data.address?.county ||
      data.address?.state_district
    return city || 'Hyderabad'
  } catch {
    return 'Hyderabad'
  }
}

export function getSoilProfile(city: string): string {
  const cityLower = city.toLowerCase()
  if (['hyderabad', 'ranga reddy', 'medchal', 'nalgonda', 'suryapet'].some(c => cityLower.includes(c))) {
    return 'Red Chalka'
  } else if (['khammam', 'adilabad', 'karimnagar', 'warangal'].some(c => cityLower.includes(c))) {
    return 'Black Regur'
  }
  return 'Red Sandy Loam'
}
