import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import path from "path";
import Database from "better-sqlite3";
import pg from "pg";
import { google } from "googleapis";

dotenv.config();

const app = express();
const PORT = 3000;

// Google OAuth Setup Helper
const getGoogleConfig = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI;
  const sheetId = process.env.GOOGLE_SHEET_ID || "18sHlNTO8cVRCKJpXGFkWlaaAp8PFRgUZmbElX3osr_Y";

  const redirectUri = googleRedirectUri || 
    (appUrl ? `${appUrl.replace(/\/$/, "")}/auth/google/callback` : null);

  return {
    clientId,
    clientSecret,
    redirectUri,
    sheetId,
    hasConfig: !!clientId && !!clientSecret && !!redirectUri
  };
};

const getOAuth2Client = () => {
  const { clientId, clientSecret, redirectUri, hasConfig } = getGoogleConfig();

  if (!hasConfig) {
    if (!clientId) throw new Error("ไม่พบ GOOGLE_CLIENT_ID ในระบบ (กรุณาตั้งค่าใน Environment Variables / Secrets)");
    if (!clientSecret) throw new Error("ไม่พบ GOOGLE_CLIENT_SECRET ในระบบ");
    if (!redirectUri) throw new Error("ไม่พบ Redirect URI (กรุณาตั้งค่า APP_URL หรือ GOOGLE_REDIRECT_URI)");
  }

  return new google.auth.OAuth2(clientId!, clientSecret!, redirectUri!);
};

// In-memory token storage (for demo purposes)
let googleTokens: any = null;

// Database Setup
let db: any;
let isPostgres = false;

if (process.env.DATABASE_URL) {
  try {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
    });
    db = pool;
    isPostgres = true;
    console.log("Using PostgreSQL Database");
  } catch (err: any) {
    console.error("PostgreSQL Connection Error:", err.message);
  }
} else if (!process.env.VERCEL) {
  try {
    db = new Database("tasks.db");
    console.log("Using SQLite Database (Local fallback)");
  } catch (err: any) {
    console.error("SQLite Initialization Error:", err.message);
  }
} else {
  console.log("Running on Vercel without DATABASE_URL. Using Google Sheets as primary storage.");
}

app.use(express.json());

// Initialize Database Schema
const initDb = async () => {
  if (!db) return;
  if (isPostgres) {
    await db.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        groupId TEXT,
        name TEXT,
        unit TEXT,
        responsible TEXT,
        frequency TEXT,
        type TEXT,
        priority TEXT,
        plannedDate TEXT,
        actualDate TEXT,
        delayDays INTEGER,
        status TEXT,
        detailedSteps TEXT,
        remarks TEXT,
        sourceTaskId TEXT,
        sourceTaskName TEXT,
        createdAt TEXT
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        employeeId TEXT,
        action TEXT,
        details TEXT,
        timestamp TEXT
      )
    `);
    // Migration: Add detailedSteps if it doesn't exist
    try {
      await db.query("ALTER TABLE tasks ADD COLUMN detailedSteps TEXT");
    } catch (e) {}
    try {
      await db.query("ALTER TABLE tasks ADD COLUMN sourceTaskId TEXT");
    } catch (e) {}
    try {
      await db.query("ALTER TABLE tasks ADD COLUMN sourceTaskName TEXT");
    } catch (e) {}
    try {
      await db.query("ALTER TABLE tasks ADD COLUMN type TEXT");
    } catch (e) {}
    try {
      await db.query("ALTER TABLE tasks ADD COLUMN priority TEXT");
    } catch (e) {}
  } else {
    db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        groupId TEXT,
        name TEXT,
        unit TEXT,
        responsible TEXT,
        frequency TEXT,
        type TEXT,
        priority TEXT,
        plannedDate TEXT,
        actualDate TEXT,
        delayDays INTEGER,
        status TEXT,
        detailedSteps TEXT,
        remarks TEXT,
        sourceTaskId TEXT,
        sourceTaskName TEXT,
        createdAt TEXT
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employeeId TEXT,
        action TEXT,
        details TEXT,
        timestamp TEXT
      )
    `);
    // Migration: Add detailedSteps if it doesn't exist
    try {
      db.exec("ALTER TABLE tasks ADD COLUMN detailedSteps TEXT");
    } catch (e) {}
    try {
      db.exec("ALTER TABLE tasks ADD COLUMN sourceTaskId TEXT");
    } catch (e) {}
    try {
      db.exec("ALTER TABLE tasks ADD COLUMN sourceTaskName TEXT");
    } catch (e) {}
    try {
      db.exec("ALTER TABLE tasks ADD COLUMN type TEXT");
    } catch (e) {}
    try {
      db.exec("ALTER TABLE tasks ADD COLUMN priority TEXT");
    } catch (e) {}
  }
};

initDb().catch(console.error);

// Helper to sync to Google Sheets after any change
const syncToSheetsInternal = async () => {
  if (!googleTokens) return;
  const { sheetId } = getGoogleConfig();
  if (!sheetId) return;

  try {
    const client = getOAuth2Client();
    client.setCredentials(googleTokens);
    const sheets = google.sheets({ version: "v4", auth: client });

    let tasks = [];
    let logs = [];
    
    if (db) {
      if (isPostgres) {
        const taskResult = await db.query("SELECT * FROM tasks ORDER BY createdAt DESC");
        tasks = taskResult.rows;
        const logResult = await db.query("SELECT * FROM activity_logs ORDER BY timestamp DESC");
        logs = logResult.rows;
      } else {
        tasks = db.prepare("SELECT * FROM tasks ORDER BY createdAt DESC").all();
        logs = db.prepare("SELECT * FROM activity_logs ORDER BY timestamp DESC").all();
      }
    } else if (googleTokens) {
      // If no DB, we already have the latest in Sheets or we just updated it
      // For now, if no DB, we skip the "fetch from DB then write to Sheets" part
      // and assume the caller handled the Sheets update or we'll fetch from Sheets next time
      return;
    }

    const taskValues = [
      ["ID", "Name", "Unit", "Responsible", "Frequency", "Type", "Priority", "Planned Date", "Actual Date", "Status", "Update ขั้นตอนการดำเนินงานอย่างละเอียดว่าถึงขึ้นตอนใด", "Remarks", "Source Task ID", "Source Task Name", "Created At"],
      ...tasks.map((t: any) => [
        t.id, t.name, t.unit, t.responsible, t.frequency, t.type, t.priority, t.plannedDate, t.actualDate, t.status, t.detailedSteps, t.remarks, t.sourceTaskId, t.sourceTaskName, t.createdAt
      ])
    ];

    const logValues = [
      ["Timestamp", "Employee ID", "Action", "Details"],
      ...logs.map((l: any) => [
        l.timestamp, l.employeeId, l.action, l.details
      ])
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: "Sheet1!A1",
      valueInputOption: "RAW",
      requestBody: { values: taskValues }
    });

    // Check if Sheet2 exists, if not create it
    try {
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
      const sheet2 = spreadsheet.data.sheets?.find(s => s.properties?.title === "Sheet2");
      
      if (!sheet2) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: {
            requests: [{
              addSheet: {
                properties: { title: "Sheet2" }
              }
            }]
          }
        });
      }

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: "Sheet2!A1",
        valueInputOption: "RAW",
        requestBody: { values: logValues }
      });
    } catch (e: any) {
      console.error("Sheet2 sync error:", e.message);
    }
  } catch (err: any) {
    console.error("Auto-sync to Sheets failed:", err.message);
  }
};

// API Routes
app.get("/api/tasks", async (req, res) => {
  try {
    // Try reading from Google Sheets first if connected
    if (googleTokens) {
      const { sheetId } = getGoogleConfig();
      const client = getOAuth2Client();
      client.setCredentials(googleTokens);
      const sheets = google.sheets({ version: "v4", auth: client });
      
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: "Sheet1!A2:O",
        });
        
        const rows = response.data.values;
        if (rows) {
          const tasks = rows.map(row => ({
            id: row[0] || "",
            name: row[1] || "",
            unit: row[2] || "",
            responsible: row[3] || "",
            frequency: row[4] || "",
            type: row[5] || "",
            priority: row[6] || "",
            plannedDate: row[7] || "",
            actualDate: row[8] || "",
            status: row[9] || "",
            detailedSteps: row[10] || "",
            remarks: row[11] || "",
            sourceTaskId: row[12] || "",
            sourceTaskName: row[13] || "",
            createdAt: row[14] || ""
          }));
          return res.json(tasks);
        }
      } catch (sheetErr: any) {
        console.error("Google Sheets Read Error (falling back to DB):", sheetErr.message);
      }
    }

    // Fallback to local DB
    if (!db) {
      return res.json([]);
    }

    let tasks;
    if (isPostgres) {
      const result = await db.query("SELECT * FROM tasks ORDER BY createdAt DESC");
      tasks = result.rows;
    } else {
      tasks = db.prepare("SELECT * FROM tasks ORDER BY createdAt DESC").all();
    }
    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/tasks", async (req, res) => {
  const task = req.body;
  const taskData = {
    id: task.id,
    groupId: task.groupId || null,
    name: task.name || "",
    unit: task.unit || "",
    responsible: task.responsible || "",
    frequency: task.frequency || "",
    type: task.type || "งาน routine",
    priority: task.priority || "3 ปกติ",
    plannedDate: task.plannedDate || "",
    actualDate: task.actualDate || "",
    delayDays: task.delayDays || 0,
    status: task.status || "รอดำเนินการ",
    detailedSteps: task.detailedSteps || "",
    remarks: task.remarks || "",
    sourceTaskId: task.sourceTaskId || null,
    sourceTaskName: task.sourceTaskName || null,
    createdAt: task.createdAt || new Date().toISOString()
  };

  try {
    if (db) {
      if (isPostgres) {
        const query = `
          INSERT INTO tasks (id, groupId, name, unit, responsible, frequency, type, priority, plannedDate, actualDate, delayDays, status, detailedSteps, remarks, sourceTaskId, sourceTaskName, createdAt)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (id) DO UPDATE SET
            groupId = EXCLUDED.groupId,
            name = EXCLUDED.name,
            unit = EXCLUDED.unit,
            responsible = EXCLUDED.responsible,
            frequency = EXCLUDED.frequency,
            type = EXCLUDED.type,
            priority = EXCLUDED.priority,
            plannedDate = EXCLUDED.plannedDate,
            actualDate = EXCLUDED.actualDate,
            delayDays = EXCLUDED.delayDays,
            status = EXCLUDED.status,
            detailedSteps = EXCLUDED.detailedSteps,
            remarks = EXCLUDED.remarks,
            sourceTaskId = EXCLUDED.sourceTaskId,
            sourceTaskName = EXCLUDED.sourceTaskName,
            createdAt = EXCLUDED.createdAt
        `;
        await db.query(query, Object.values(taskData));
      } else {
        const insert = db.prepare(`
          INSERT OR REPLACE INTO tasks (id, groupId, name, unit, responsible, frequency, type, priority, plannedDate, actualDate, delayDays, status, detailedSteps, remarks, sourceTaskId, sourceTaskName, createdAt)
          VALUES (@id, @groupId, @name, @unit, @responsible, @frequency, @type, @priority, @plannedDate, @actualDate, @delayDays, @status, @detailedSteps, @remarks, @sourceTaskId, @sourceTaskName, @createdAt)
        `);
        insert.run(taskData);
      }
    }

    // If Google is connected, we can also write directly to Sheets for immediate update
    if (googleTokens) {
      const { sheetId } = getGoogleConfig();
      const client = getOAuth2Client();
      client.setCredentials(googleTokens);
      const sheets = google.sheets({ version: "v4", auth: client });
      
      // Fetch all tasks and sync (simplest way to ensure order and headers)
      await syncToSheetsInternal();
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error("Save Task Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/tasks/batch", async (req, res) => {
  const { tasks } = req.body;
  if (!Array.isArray(tasks)) {
    return res.status(400).json({ error: "Tasks must be an array" });
  }

  try {
    const now = new Date().toISOString();
    if (db) {
      if (isPostgres) {
        const client = await db.connect();
        try {
          await client.query('BEGIN');
          const query = `
            INSERT INTO tasks (id, groupId, name, unit, responsible, frequency, type, priority, plannedDate, actualDate, delayDays, status, detailedSteps, remarks, sourceTaskId, sourceTaskName, createdAt)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          `;
          for (const task of tasks) {
            const taskData = [
              task.id,
              task.groupId || null,
              task.name || "",
              task.unit || "",
              task.responsible || "",
              task.frequency || "",
              task.type || "งาน routine",
              task.priority || "3 ปกติ",
              task.plannedDate || "",
              task.actualDate || "",
              task.delayDays || 0,
              task.status || "รอดำเนินการ",
              task.detailedSteps || "",
              task.remarks || "",
              task.sourceTaskId || null,
              task.sourceTaskName || null,
              task.createdAt || now
            ];
            await client.query(query, taskData);
          }
          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      } else {
        const insert = db.prepare(`
          INSERT INTO tasks (id, groupId, name, unit, responsible, frequency, type, priority, plannedDate, actualDate, delayDays, status, detailedSteps, remarks, sourceTaskId, sourceTaskName, createdAt)
          VALUES (@id, @groupId, @name, @unit, @responsible, @frequency, @type, @priority, @plannedDate, @actualDate, @delayDays, @status, @detailedSteps, @remarks, @sourceTaskId, @sourceTaskName, @createdAt)
        `);
        const transaction = db.transaction((taskList) => {
          for (const task of taskList) {
            insert.run({
              ...task,
              id: task.id,
              groupId: task.groupId || null,
              name: task.name || "",
              unit: task.unit || "",
              responsible: task.responsible || "",
              frequency: task.frequency || "",
              type: task.type || "งาน routine",
              priority: task.priority || "3 ปกติ",
              plannedDate: task.plannedDate || "",
              actualDate: task.actualDate || "",
              delayDays: task.delayDays || 0,
              status: task.status || "รอดำเนินการ",
              detailedSteps: task.detailedSteps || "",
              remarks: task.remarks || "",
              sourceTaskId: task.sourceTaskId || null,
              sourceTaskName: task.sourceTaskName || null,
              createdAt: task.createdAt || now
            });
          }
        });
        transaction(tasks);
      }
    }
    
    syncToSheetsInternal();
    res.json({ success: true });
  } catch (error: any) {
    console.error("Batch Save Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/tasks/:id", async (req, res) => {
  const { id } = req.params;
  try {
    if (db) {
      if (isPostgres) {
        await db.query("DELETE FROM tasks WHERE id = $1", [id]);
      } else {
        db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
      }
    }
    
    syncToSheetsInternal();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/logs", async (req, res) => {
  const { employeeId, action, details, timestamp } = req.body;
  try {
    if (db) {
      if (isPostgres) {
        await db.query(
          "INSERT INTO activity_logs (employeeId, action, details, timestamp) VALUES ($1, $2, $3, $4)",
          [employeeId, action, details, timestamp]
        );
      } else {
        db.prepare(
          "INSERT INTO activity_logs (employeeId, action, details, timestamp) VALUES (?, ?, ?, ?)"
        ).run(employeeId, action, details, timestamp);
      }
    }
    
    syncToSheetsInternal();
    res.json({ success: true });
  } catch (error: any) {
    console.error("Log Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Google OAuth Routes
app.get("/api/auth/google/url", (req, res) => {
  try {
    const client = getOAuth2Client();
    const scopes = [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.metadata.readonly"
    ];

    const url = client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent"
    });

    res.json({ url });
  } catch (error: any) {
    const msg = error.message || String(error);
    console.error("Google Auth URL Error:", msg);
    res.status(400).json({ error: msg });
  }
});

app.get("/auth/google/callback", async (req, res) => {
  const { code, error } = req.query;
  
  if (error) {
    console.error("Google Auth Callback Error from Google:", error);
    return res.status(400).send(`Authentication failed: ${error}`);
  }

  try {
    const client = getOAuth2Client();
    const { tokens } = await client.getToken(code as string);
    googleTokens = tokens;
    
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Google Auth Success</title>
          <style>
            body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f0fdf4; }
            .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center; }
            h1 { color: #166534; margin-bottom: 0.5rem; }
            p { color: #15803d; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>เชื่อมต่อสำเร็จ!</h1>
            <p>กำลังปิดหน้าต่างนี้และกลับไปยังแอปพลิเคชัน...</p>
            <button onclick="closeWindow()" style="margin-top: 1rem; padding: 0.5rem 1rem; cursor: pointer; background: #166534; color: white; border: none; border-radius: 0.5rem;">ปิดหน้าต่างนี้ทันที</button>
          </div>
          <script>
            function closeWindow() {
              if (window.opener) {
                window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, '*');
                window.close();
              }
            }
            setTimeout(closeWindow, 2000);
          </script>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error("Google Auth Error:", error);
    res.status(500).send("Authentication failed");
  }
});

app.get("/api/google/status", (req, res) => {
  const { hasConfig } = getGoogleConfig();
  res.json({ 
    connected: !!googleTokens,
    configured: hasConfig
  });
});

app.post("/api/google/sheets/sync", async (req, res) => {
  if (!googleTokens) {
    return res.status(401).json({ error: "Google account not connected" });
  }

  const { sheetId } = getGoogleConfig();
  if (!sheetId) {
    return res.status(400).json({ error: "กรุณาตั้งค่า GOOGLE_SHEET_ID ใน Environment Variables" });
  }

  try {
    const client = getOAuth2Client();
    client.setCredentials(googleTokens);
    const sheets = google.sheets({ version: "v4", auth: client });

    // Fetch all tasks from DB
    let tasks;
    let logs;
    if (isPostgres) {
      const taskResult = await db.query("SELECT * FROM tasks ORDER BY createdAt DESC");
      tasks = taskResult.rows;
      const logResult = await db.query("SELECT * FROM activity_logs ORDER BY timestamp DESC");
      logs = logResult.rows;
    } else {
      tasks = db.prepare("SELECT * FROM tasks ORDER BY createdAt DESC").all();
      logs = db.prepare("SELECT * FROM activity_logs ORDER BY timestamp DESC").all();
    }

    // Prepare data for Google Sheets Sheet1 (Tasks)
    const taskValues = [
      ["ID", "Name", "Unit", "Responsible", "Frequency", "Type", "Priority", "Planned Date", "Actual Date", "Status", "Update ขั้นตอนการดำเนินงานอย่างละเอียดว่าถึงขึ้นตอนใด", "Remarks", "Source Task ID", "Source Task Name", "Created At"],
      ...tasks.map((t: any) => [
        t.id, t.name, t.unit, t.responsible, t.frequency, t.type, t.priority, t.plannedDate, t.actualDate, t.status, t.detailedSteps, t.remarks, t.sourceTaskId, t.sourceTaskName, t.createdAt
      ])
    ];

    // Prepare data for Google Sheets Sheet2 (Logs)
    const logValues = [
      ["Timestamp", "Employee ID", "Action", "Details"],
      ...logs.map((l: any) => [
        l.timestamp, l.employeeId, l.action, l.details
      ])
    ];

    // Update Sheet1
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: "Sheet1!A1",
      valueInputOption: "RAW",
      requestBody: { values: taskValues }
    });

    // Check if Sheet2 exists, if not create it
    try {
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
      const sheet2 = spreadsheet.data.sheets?.find(s => s.properties?.title === "Sheet2");
      
      if (!sheet2) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: {
            requests: [{
              addSheet: {
                properties: { title: "Sheet2" }
              }
            }]
          }
        });
      }

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: "Sheet2!A1",
        valueInputOption: "RAW",
        requestBody: { values: logValues }
      });
    } catch (e: any) {
      console.error("Sheet2 sync error:", e.message);
    }

    res.json({ success: true, message: "Sync to Google Sheets successful" });
  } catch (error: any) {
    console.error("Google Sheets Sync Error:", error);
    res.status(500).json({ error: error.message });
  }
});

const __dirname = path.resolve();

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

  // Only listen if not in a serverless environment (like Vercel)
  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
