export type Place = {
  name: string;
  country: string;
  lat: number;
  lon: number;
  label?: boolean;
};
export const cities: Place[] = [
  { name: "New Delhi", country: "IND", lat: 28.61, lon: 77.21, label: true },
  { name: "London", country: "GBR", lat: 51.51, lon: -0.13, label: true },
  { name: "Berlin", country: "DEU", lat: 52.52, lon: 13.4 },
  { name: "Paris", country: "FRA", lat: 48.86, lon: 2.35 },
  { name: "Tokyo", country: "JPN", lat: 35.68, lon: 139.69, label: true },
  { name: "Sydney", country: "AUS", lat: -33.87, lon: 151.21 },
  { name: "Toronto", country: "CAN", lat: 43.65, lon: -79.38 },
  { name: "New York", country: "USA", lat: 40.71, lon: -74 },
  { name: "Cape Town", country: "ZAF", lat: -33.92, lon: 18.42, label: true },
  { name: "Singapore", country: "SGP", lat: 1.35, lon: 103.82, label: true },
  { name: "Nairobi", country: "KEN", lat: -1.29, lon: 36.82 },
  { name: "Seoul", country: "KOR", lat: 37.57, lon: 126.98 },
  { name: "São Paulo", country: "BRA", lat: -23.55, lon: -46.63 },
];
export const routes = [
  [0, 1],
  [0, 2],
  [0, 5],
  [0, 6],
  [0, 7],
  [1, 8],
  [2, 10],
  [9, 4],
  [0, 9],
  [1, 7],
  [4, 5],
  [8, 12],
  [3, 9],
  [10, 0],
];
export const rad = Math.PI / 180;
export function unit(lat: number, lon: number) {
  return [
    Math.cos(lat * rad) * Math.sin(lon * rad),
    Math.sin(lat * rad),
    Math.cos(lat * rad) * Math.cos(lon * rad),
  ];
}
export function arc(a: number, b: number, t: number) {
  const p = unit(cities[a].lat, cities[a].lon),
    q = unit(cities[b].lat, cities[b].lon);
  const angle = Math.acos(
    Math.min(
      1,
      p.reduce((v, x, i) => v + x * q[i], 0),
    ),
  );
  const s = Math.sin(angle);
  return p.map(
    (x, i) =>
      ((Math.sin((1 - t) * angle) * x + Math.sin(t * angle) * q[i]) / s) *
      (1 + Math.sin(Math.PI * t) * 0.14),
  );
}
