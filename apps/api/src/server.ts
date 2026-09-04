import "dotenv/config";
import Fastify from "fastify";
import { evaluateGuess } from "./services/guess";
import { createPlayer, getOrCreateSession } from "./services/session";
import { listCities } from "./services/cities";


const app = Fastify();

app.get("/", async () => {
  return { status: "maple-map API running" };
});

app.listen({ port: 3000 }, () => {
  console.log("API running on port 3000");
});

app.get("/cities", async (req, res) => {
  try {
    const cities = await listCities();
    res.send(cities);
  } catch (err: any) {
    res.status(500).send({ error: err.message });
  }
});

app.post("/player", async (req, res) => {
  try {
    const player = await createPlayer();
    res.send(player);
  } catch (err: any) {
    res.status(500).send({ error: err.message });
  }
});

app.post("/session", async (req, res) => {
  try {
    const { playerId } = req.body as { playerId?: string };

    if (!playerId) {
      return res.status(400).send({ error: "Missing playerId" });
    }

    const session = await getOrCreateSession(playerId);
    res.send(session);
  } catch (err: any) {
    res.status(500).send({ error: err.message });
  }
});

app.post("/guess", async (req, res) => {
  try {
    const { sessionId, cityId, city } = req.body as {
      sessionId?: string;
      cityId?: number;
      city?: string;
    };

    if (!sessionId || (cityId === undefined && !city)) {
      return res.status(400).send({ error: "Missing sessionId or city" });
    }

    const result = await evaluateGuess(sessionId, { cityId, cityName: city });

    res.send(result);

  } catch (err: any) {
    res.status(400).send({ error: err.message });
  }
});

