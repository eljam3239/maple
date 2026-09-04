/**
 * Errors whose message is safe to show a player.
 *
 * Everything else that escapes a route is treated as a bug: it gets logged
 * server-side and the client is told only that something went wrong. Without
 * this split, a Prisma or connection failure would put its internal message —
 * table names, connection details — straight into an HTTP response.
 *
 * The `code` is what clients should branch on. The message is a readable
 * fallback; the web app translates the code instead.
 */
export type GameErrorCode =
  | "SESSION_NOT_FOUND"
  | "SESSION_COMPLETED"
  | "NO_GUESSES_REMAINING"
  | "CITY_NOT_FOUND"
  | "MISSING_FIELDS";

export class GameError extends Error {
  constructor(
    readonly code: GameErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GameError";
  }
}
