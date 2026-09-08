import "dotenv/config";
import { buildApp } from "./app";

const PORT = Number(process.env.PORT ?? 3000);
// Containers route to the pod's own address, so binding to localhost would make
// the service unreachable from outside it.
const HOST = process.env.HOST ?? "0.0.0.0";

async function start() {
  // Routes and plugins must all be registered before listen(): Fastify closes
  // registration once the server is ready.
  const app = await buildApp();
  await app.listen({ port: PORT, host: HOST });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
