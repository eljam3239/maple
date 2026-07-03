export interface GuessResponse {
  correct: boolean;
  city: string;
  distanceKm: number;
  direction: string;
  provinceMatch: boolean;
  province: string;
  provinceDistance: number;
  populationHint: "larger" | "smaller" | "equal";
}

