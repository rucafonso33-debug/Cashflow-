import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("finances.db");

// Initialize database for Forecast App
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    current_balance REAL DEFAULT 0,
    weekly_spending_estimate REAL DEFAULT 0,
    safety_threshold REAL DEFAULT 1000,
    is_couple_mode INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS incomes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    amount REAL,
    day_of_month INTEGER,
    owner TEXT
  );

  CREATE TABLE IF NOT EXISTS fixed_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    amount REAL,
    day_of_month INTEGER
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT,
    amount REAL,
    date TEXT
  );

  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    target_amount REAL,
    target_date TEXT,
    is_completed INTEGER DEFAULT 0
  );

  INSERT OR IGNORE INTO settings (id, current_balance, weekly_spending_estimate, safety_threshold, is_couple_mode) 
  VALUES (1, 0, 0, 1000, 1);
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Settings API
  app.get("/api/settings", (req, res) => {
    const settings = db.prepare("SELECT * FROM settings WHERE id = 1").get();
    res.json(settings);
  });

  app.post("/api/settings", (req, res) => {
    const { current_balance, weekly_spending_estimate, safety_threshold, is_couple_mode } = req.body;
    db.prepare(`
      UPDATE settings SET 
        current_balance = ?, 
        weekly_spending_estimate = ?, 
        safety_threshold = ?, 
        is_couple_mode = ? 
      WHERE id = 1
    `).run(current_balance, weekly_spending_estimate, safety_threshold, is_couple_mode ? 1 : 0);
    res.json({ success: true });
  });

  // Incomes API
  app.get("/api/incomes", (req, res) => {
    const incomes = db.prepare("SELECT * FROM incomes").all();
    res.json(incomes);
  });

  app.post("/api/incomes", (req, res) => {
    const { name, amount, day_of_month, owner } = req.body;
    const info = db.prepare("INSERT INTO incomes (name, amount, day_of_month, owner) VALUES (?, ?, ?, ?)").run(name, amount, day_of_month, owner);
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/incomes/:id", (req, res) => {
    const { name, amount, day_of_month, owner } = req.body;
    db.prepare("UPDATE incomes SET name = ?, amount = ?, day_of_month = ?, owner = ? WHERE id = ?").run(name, amount, day_of_month, owner, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/incomes/:id", (req, res) => {
    db.prepare("DELETE FROM incomes WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Fixed Expenses API
  app.get("/api/fixed-expenses", (req, res) => {
    const expenses = db.prepare("SELECT * FROM fixed_expenses").all();
    res.json(expenses);
  });

  app.post("/api/fixed-expenses", (req, res) => {
    const { name, amount, day_of_month } = req.body;
    const info = db.prepare("INSERT INTO fixed_expenses (name, amount, day_of_month) VALUES (?, ?, ?)").run(name, amount, day_of_month);
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/fixed-expenses/:id", (req, res) => {
    const { name, amount, day_of_month } = req.body;
    db.prepare("UPDATE fixed_expenses SET name = ?, amount = ?, day_of_month = ? WHERE id = ?").run(name, amount, day_of_month, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/fixed-expenses/:id", (req, res) => {
    db.prepare("DELETE FROM fixed_expenses WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Events API
  app.get("/api/events", (req, res) => {
    const events = db.prepare("SELECT * FROM events ORDER BY date ASC").all();
    res.json(events);
  });

  app.post("/api/events", (req, res) => {
    const { description, amount, date } = req.body;
    const info = db.prepare("INSERT INTO events (description, amount, date) VALUES (?, ?, ?)").run(description, amount, date);
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/events/:id", (req, res) => {
    const { description, amount, date } = req.body;
    db.prepare("UPDATE events SET description = ?, amount = ?, date = ? WHERE id = ?").run(description, amount, date, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/events/:id", (req, res) => {
    db.prepare("DELETE FROM events WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Goals API
  app.get("/api/goals", (req, res) => {
    const goals = db.prepare("SELECT * FROM goals ORDER BY target_date ASC").all();
    res.json(goals.map(g => ({ ...g, is_completed: !!g.is_completed })));
  });

  app.post("/api/goals", (req, res) => {
    const { name, target_amount, target_date } = req.body;
    const info = db.prepare("INSERT INTO goals (name, target_amount, target_date) VALUES (?, ?, ?)").run(name, target_amount, target_date);
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/goals/:id", (req, res) => {
    const { name, target_amount, target_date, is_completed } = req.body;
    db.prepare("UPDATE goals SET name = ?, target_amount = ?, target_date = ?, is_completed = ? WHERE id = ?").run(name, target_amount, target_date, is_completed ? 1 : 0, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/goals/:id", (req, res) => {
    db.prepare("DELETE FROM goals WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
