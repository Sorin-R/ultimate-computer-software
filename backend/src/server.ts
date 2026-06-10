import cluster from "cluster";
import { cpus } from "os";
import app from "./app";
import { env } from "./config/env";

const WORKERS = parseInt(process.env.WORKERS || String(cpus().length), 10);

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} starting ${WORKERS} workers (${cpus().length} CPUs)`);

  for (let i = 0; i < WORKERS; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code) => {
    console.log(`Worker ${worker.process.pid} exited (${code}). Restarting...`);
    cluster.fork();
  });
} else {
  app.listen(env.PORT, () => {
    console.log(`Worker ${process.pid} running on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });
}
