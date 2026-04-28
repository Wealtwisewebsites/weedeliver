import { createServer } from "http";
import app from "./app.js";
import { setupSocket } from "./socket.js";

const PORT = parseInt(process.env.PORT || "3000");

const httpServer = createServer(app);
const io = setupSocket(httpServer);

// Make io accessible from routes via app.get("io")
app.set("io", io);

httpServer.listen(PORT, () => {
  console.log(`
  🌿 WeeDeliver API Server
  ────────────────────────
  HTTP:   http://localhost:${PORT}
  WS:     ws://localhost:${PORT}
  Health: http://localhost:${PORT}/api/health
  ────────────────────────
  `);
});
