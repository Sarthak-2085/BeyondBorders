export const nav = [
  ["Overview", "/"],
  ["Explore", "/explore/"],
  ["Countries", "/countries/"],
  ["Education", "/universities/"],
  ["Study Planner", "/planner/"],
  ["Intelligence", "/intelligence/"],
];
export const tools = [
  ["Universities", "/universities/"],
  ["Disciplines", "/courses/"],
  ["Scholarships", "/scholarships/"],
  ["Visa guides", "/visa/"],
  ["Cost calculator", "/costs/"],
  ["Shortlist", "/shortlist/"],
];
export const disciplines = [
  "Computer Science",
  "Business and Management",
  "Engineering",
  "Medicine and Healthcare",
  "Social Sciences",
  "Arts and Humanities",
  "Natural Sciences",
  "Law",
];
export const regions: Record<string, [number, number]> = {
  IND: [22.6, 79],
  USA: [38, -99],
  GBR: [53, -2],
  DEU: [51, 10],
  CAN: [56, -102],
  AUS: [-25, 134],
  FRA: [47, 2],
  CHN: [34, 105],
  JPN: [36, 138],
  BRA: [-12, -49],
  KOR: [36, 128],
  NZL: [-41, 174],
  ITA: [43, 12],
  RUS: [59, 88],
  ESP: [40, -3],
  NLD: [52, 5],
  IDN: [-3, 116],
  MYS: [4, 102],
  TUR: [39, 35],
  ZAF: [-28, 25],
  NGA: [9, 8],
  NPL: [28, 84],
  VNM: [16, 108],
  MAR: [31, -7],
  PAK: [31, 70],
  BGD: [24, 90],
  IRN: [32, 53],
  EGY: [27, 30],
};
export function country(code: string) {
  try {
    return (
      new Intl.DisplayNames(["en"], { type: "region" }).of(
        iso2[code] || code,
      ) || code
    );
  } catch {
    return code;
  }
}
export const iso2: Record<string, string> = {
  WLD: "001",
  IND: "IN",
  USA: "US",
  GBR: "GB",
  DEU: "DE",
  CAN: "CA",
  AUS: "AU",
  FRA: "FR",
  CHN: "CN",
  JPN: "JP",
  BRA: "BR",
  KOR: "KR",
  NZL: "NZ",
  ITA: "IT",
  RUS: "RU",
  ESP: "ES",
  NLD: "NL",
  IDN: "ID",
  MYS: "MY",
  TUR: "TR",
  ZAF: "ZA",
  NGA: "NG",
  NPL: "NP",
  VNM: "VN",
  MAR: "MA",
  PAK: "PK",
  BGD: "BD",
  IRN: "IR",
  EGY: "EG",
};
