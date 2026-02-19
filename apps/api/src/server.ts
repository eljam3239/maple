import "dotenv/config";
import Fastify from "fastify";
import { getOrCreateDailyPuzzle } from "./services/puzzle";
import { evaluateGuess } from "./services/guess";


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

app.post("/guess", async (req, res) => {
  try {
    const { guess } = req.body as { guess?: string };

    if (!guess) {
      return res.status(400).send({ error: "Missing guess" });
    }

    const result = await evaluateGuess(guess);

    res.send(result);

  } catch (err: any) {
    res.status(400).send({ error: err.message });
  }
});

