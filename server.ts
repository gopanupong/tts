import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import path from "path";
import Database from "better-sqlite3";

dotenv.config();

const app = express();
const PORT = 3000;
const db = new Database("tasks.db");

app.use(express.json());

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    name TEXT,
    unit TEXT,
    responsible TEXT,
    frequency TEXT,
    plannedDate TEXT,
    actualDate TEXT,
    delayDays INTEGER,
    status TEXT,
    remarks TEXT
  )
`);

// Migration: Add missing columns if they don't exist
const tableInfo = db.prepare("PRAGMA table_info(tasks)").all() as any[];
const columnNames = tableInfo.map(info => info.name);

if (!columnNames.includes("groupId")) {
  db.exec("ALTER TABLE tasks ADD COLUMN groupId TEXT");
}
if (!columnNames.includes("createdAt")) {
  db.exec("ALTER TABLE tasks ADD COLUMN createdAt TEXT");
}

// API Routes
app.get("/api/tasks", (req, res) => {
  try {
    const tasks = db.prepare("SELECT * FROM tasks ORDER BY createdAt DESC").all();
    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/tasks", (req, res) => {
  const task = req.body;
  try {
    const insert = db.prepare(`
      INSERT OR REPLACE INTO tasks (id, groupId, name, unit, responsible, frequency, plannedDate, actualDate, delayDays, status, remarks, createdAt)
      VALUES (@id, @groupId, @name, @unit, @responsible, @frequency, @plannedDate, @actualDate, @delayDays, @status, @remarks, @createdAt)
    `);
    
    const taskData = {
      id: task.id,
      groupId: task.groupId || null,
      name: task.name || "",
      unit: task.unit || "",
      responsible: task.responsible || "",
      frequency: task.frequency || "",
      plannedDate: task.plannedDate || "",
      actualDate: task.actualDate || "",
      delayDays: task.delayDays || 0,
      status: task.status || "รอดำเนินการ",
      remarks: task.remarks || "",
      createdAt: task.createdAt || new Date().toISOString()
    };

    insert.run(taskData);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Save Task Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/tasks/batch", (req, res) => {
  const { tasks } = req.body;
  if (!Array.isArray(tasks)) {
    return res.status(400).json({ error: "Tasks must be an array" });
  }

  const insert = db.prepare(`
    INSERT INTO tasks (id, groupId, name, unit, responsible, frequency, plannedDate, actualDate, delayDays, status, remarks, createdAt)
    VALUES (@id, @groupId, @name, @unit, @responsible, @frequency, @plannedDate, @actualDate, @delayDays, @status, @remarks, @createdAt)
  `);

  const transaction = db.transaction((taskList) => {
    const now = new Date().toISOString();
    for (const task of taskList) {
      const taskData = {
        id: task.id,
        groupId: task.groupId || null,
        name: task.name || "",
        unit: task.unit || "",
        responsible: task.responsible || "",
        frequency: task.frequency || "",
        plannedDate: task.plannedDate || "",
        actualDate: task.actualDate || "",
        delayDays: task.delayDays || 0,
        status: task.status || "รอดำเนินการ",
        remarks: task.remarks || "",
        createdAt: task.createdAt || now
      };
      insert.run(taskData);
    }
  });

  try {
    transaction(tasks);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Batch Save Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/tasks/:id", (req, res) => {
  const { id } = req.params;
  try {
    db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
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
