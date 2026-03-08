import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Mock database for stability
  let settings = {
    current_balance: 0,
    weekly_spending_estimate: 0,
    safety_threshold: 1000,
    is_couple_mode: true,
    currency: 'CHF',
    remittance_currency: 'EUR',
    exchange_rate: 1.05
  };
  let incomes = [];
  let expenses = [];
  let events = [];
  let goals = [];

  // API Routes
  app.get("/api/settings", (req, res) => res.json(settings));
  app.post("/api/settings", (req, res) => {
    settings = { ...settings, ...req.body };
    res.json({ success: true });
  });

  app.get("/api/incomes", (req, res) => res.json(incomes));
  app.post("/api/incomes", (req, res) => {
    const newItem = { id: Date.now(), ...req.body };
    incomes.push(newItem);
    res.json(newItem);
  });
  app.delete("/api/incomes/:id", (req, res) => {
    incomes = incomes.filter(i => i.id != req.params.id);
    res.json({ success: true });
  });

  app.get("/api/fixed-expenses", (req, res) => res.json(expenses));
  app.post("/api/fixed-expenses", (req, res) => {
    const newItem = { id: Date.now(), ...req.body };
    expenses.push(newItem);
    res.json(newItem);
  });
  app.delete("/api/fixed-expenses/:id", (req, res) => {
    expenses = expenses.filter(e => e.id != req.params.id);
    res.json({ success: true });
  });

  app.get("/api/events", (req, res) => res.json(events));
  app.post("/api/events", (req, res) => {
    const newItem = { id: Date.now(), ...req.body };
    events.push(newItem);
    res.json(newItem);
  });
  app.delete("/api/events/:id", (req, res) => {
    events = events.filter(e => e.id != req.params.id);
    res.json({ success: true });
  });

  app.get("/api/goals", (req, res) => res.json(goals));
  app.post("/api/goals", (req, res) => {
    const newItem = { id: Date.now(), ...req.body };
    goals.push(newItem);
    res.json(newItem);
  });
  app.delete("/api/goals/:id", (req, res) => {
    goals = goals.filter(g => g.id != req.params.id);
    res.json({ success: true });
  });

  // Vite middleware for development
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> FULL SERVER LISTENING ON PORT ${PORT} <<<`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
