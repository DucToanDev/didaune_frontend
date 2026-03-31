import { Place, PlaceHour } from '../models/app.models';

export const DEFAULT_PLACE_IMAGE =
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=300';

export function getSuggestedHours(place: Place): string {
  const firstHour = place.hours.find((hour) => hasOpenTimes(hour));

  if (!firstHour) {
    return 'Chưa cập nhật';
  }

  return firstHour.times[0] ?? 'Chưa cập nhật';
}

function hasOpenTimes(hour: PlaceHour): boolean {
  return Array.isArray(hour.times) && hour.times.length > 0;
}
