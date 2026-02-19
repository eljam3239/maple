export interface GuessResponse {
  correct: boolean;
  distanceKm: number;
  direction: string;
  provinceMatch: boolean;
  populationHint: "larger" | "smaller" | "equal";
}

