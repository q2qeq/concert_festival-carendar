import raw from '../data/venues.json';

export interface VenueFood {
  name: string;
  desc: string;
}

export interface VenueInfo {
  address?: string;
  transit?: string[];
  parking?: string;
  nearbyFood?: VenueFood[];
  tip?: string;
}

const venues = raw as Record<string, VenueInfo>;

// Looks up shared transit/parking/food info by exact venue name. Multiple events
// at the same physical venue (e.g. two festivals both at 임진각 평화누리) reuse one
// entry here instead of repeating researched transit details per event.
export function getVenueInfo(venueName: string): VenueInfo | undefined {
  return venues[venueName];
}
