import "dotenv/config";
import Fastify from "fastify";
import { getOrCreateDailyPuzzle } from "./services/puzzle";

const app = Fastify();

app.get("/", async () => {
  return { status: "maple-map API running" };
});

app.listen({ port: 3000 }, () => {
  console.log("API running on port 3000");
});

app.get("/puzzle/today", async (req, res) => {
  const puzzle = await getOrCreateDailyPuzzle();

  res.send({
    date: puzzle.date,
    // DO NOT send city name to client
    puzzleId: puzzle.cityId,
  });
});

