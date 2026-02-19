export function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

function toRad(deg: number) {
  return deg * (Math.PI / 180);
}

export function getDirection(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): string {
  const dLon = lon2 - lon1;
  const dLat = lat2 - lat1;

  const angle = Math.atan2(dLon, dLat) * (180 / Math.PI);

  const directions = ["N","NE","E","SE","S","SW","W","NW"];
  const index = Math.round(angle / 45) & 7;

  return directions[index];
}
