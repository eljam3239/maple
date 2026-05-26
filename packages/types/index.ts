export interface GuessResponse {
  correct: boolean;
  distanceKm: number;
  direction: string;
  provinceMatch: boolean;
  province: string;
  provinceDistance: number;
  populationHint: "larger" | "smaller" | "equal";
}

