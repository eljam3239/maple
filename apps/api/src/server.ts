import "dotenv/config";
import Fastify from "fastify";
import { getOrCreateDailyPuzzle } from "./services/puzzle";
import { evaluateGuess } from "./services/guess";
import { createSession } from "./services/session";


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

app.post("/session", async (req, res) => {
  try {
    const session = await createSession();
    res.send(session);
  } catch (err: any) {
    res.status(500).send({ error: err.message });
  }
});

app.post("/guess", async (req, res) => {
  try {
    const { sessionId, city } = req.body as { sessionId?: string; city?: string };

    if (!sessionId || !city) {
      return res.status(400).send({ error: "Missing sessionId or city" });
    }

    const result = await evaluateGuess(sessionId, city);

    res.send(result);

  } catch (err: any) {
    res.status(400).send({ error: err.message });
  }
});

