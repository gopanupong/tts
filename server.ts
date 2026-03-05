import express from "express";
import path from "path";
import pkg from "pg";
const { Pool } = pkg;
import { google } from "googleapis";

const app = express();
const PORT = 3000;

// Health check route
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    isVercel: !!process.env.VERCEL,
    hasDb: !!db,
    isPostgres,
    env: process.env.NODE_ENV
  });
});

// Database Setup
let db: any;
let isPostgres = false;

// Initialize Database Connection
const startDb = async () => {
  if (process.env.DATABASE_URL) {
    try {
      const pool = new Pool({
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
      // Dynamic import for better-sqlite3 to avoid issues on Vercel
      const Database = (await import("better-sqlite3")).default;
      db = new Database("tasks.db");
      console.log("Using SQLite Database (Local fallback)");
    } catch (err: any) {
      console.error("SQLite Initialization Error:", err.message);
    }
  } else {
    console.log("Running on Vercel without DATABASE_URL. Using Google Sheets as primary storage.");
  }
};

let initPromise: Promise<void> | null = null;

// Call startDb and then initDb sequentially
const initializeApp = async () => {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      await startDb();
      await initDb();
      await loadTokensFromDb();
      console.log("Initialization complete");
    } catch (err) {
      console.error("Initialization failed:", err);
      initPromise = null; // Allow retry
      throw err;
    }
  })();
  return initPromise;
};

// Start initialization but don't block top-level
initializeApp().catch(err => console.error("Top-level init failed:", err));

// Google OAuth Setup Helper
const getGoogleConfig = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI;
  const sheetId = process.env.GOOGLE_SHEET_ID || "18sH1NT08cVRCKJpXGFkWlaaAp8PFRgUZmbElX3osr_Y";

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

// In-memory token storage (loaded from DB on startup)
let googleTokens: any = null;

// Helper to load tokens from DB
const loadTokensFromDb = async () => {
  if (!db) {
    if (process.env.VERCEL) {
      console.warn("WARNING: Running on Vercel without a DATABASE_URL. Google Sheets connection will not persist across requests.");
    }
    return;
  }
  try {
    let result;
    if (isPostgres) {
      result = await db.query("SELECT value FROM settings WHERE key = $1", ["google_tokens"]);
      if (result.rows.length > 0) {
        googleTokens = JSON.parse(result.rows[0].value);
        console.log("Google tokens loaded from PostgreSQL");
      }
    } else {
      result = db.prepare("SELECT value FROM settings WHERE key = ?").get("google_tokens");
      if (result) {
        googleTokens = JSON.parse(result.value);
        console.log("Google tokens loaded from SQLite");
      }
    }
  } catch (err) {
    console.error("Failed to load tokens from DB:", err);
  }
};

// Helper to save tokens to DB
const saveTokensToDb = async (tokens: any) => {
  if (!db) return;
  try {
    const tokensStr = JSON.stringify(tokens);
    if (isPostgres) {
      await db.query(
        "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        ["google_tokens", tokensStr]
      );
    } else {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run("google_tokens", tokensStr);
    }
    googleTokens = tokens;
    console.log("Google tokens saved to DB");
  } catch (err) {
    console.error("Failed to save tokens to DB:", err);
  }
};

app.use(express.json());

// Middleware to ensure DB is initialized for all API routes
app.use("/api", async (req, res, next) => {
  try {
    await initializeApp();
    next();
  } catch (err) {
    next(err);
  }
});

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
    await db.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
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
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
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

// Helper to sync to Google Sheets after any change
const syncToSheetsInternal = async () => {
  if (!googleTokens) {
    console.log("Sync skipped: No Google tokens available");
    return;
  }
  const { sheetId } = getGoogleConfig();
  if (!sheetId) {
    console.log("Sync skipped: No Sheet ID configured");
    return;
  }

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
    } else {
      // If no DB, we can't do a full sync from DB to Sheets
      // We rely on individual endpoints to update Sheets directly
      console.log("Sync: No database, skipping full overwrite from DB");
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
      console.log("No database connection, returning empty tasks");
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
    console.error("API Error (/api/tasks):", error);
    res.status(500).json({ 
      error: error.message || "Unknown server error",
      details: error.toString()
    });
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
    let saved = false;
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
      saved = true;
    }

    // If Google is connected, we can also write directly to Sheets for immediate update
    if (googleTokens) {
      const { sheetId } = getGoogleConfig();
      const client = getOAuth2Client();
      client.setCredentials(googleTokens);
      const sheets = google.sheets({ version: "v4", auth: client });
      
      if (db) {
        await syncToSheetsInternal();
      } else {
        // No DB mode: Update directly in Sheets
        console.log("Saving directly to Sheets (No DB mode)");
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: "Sheet1!A2:O",
        });
        let rows = response.data.values || [];
        const taskArray = [
          taskData.id, taskData.name, taskData.unit, taskData.responsible, 
          taskData.frequency, taskData.type, taskData.priority, 
          taskData.plannedDate, taskData.actualDate, taskData.status, 
          taskData.detailedSteps, taskData.remarks, taskData.sourceTaskId, 
          taskData.sourceTaskName, taskData.createdAt
        ];
        
        const existingIndex = rows.findIndex(r => r[0] === taskData.id);
        if (existingIndex >= 0) {
          rows[existingIndex] = taskArray;
        } else {
          rows.unshift(taskArray); // Add to top
        }
        
        const values = [
          ["ID", "Name", "Unit", "Responsible", "Frequency", "Type", "Priority", "Planned Date", "Actual Date", "Status", "Update ขั้นตอนการดำเนินงานอย่างละเอียดว่าถึงขึ้นตอนใด", "Remarks", "Source Task ID", "Source Task Name", "Created At"],
          ...rows
        ];
        
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: "Sheet1!A1",
          valueInputOption: "RAW",
          requestBody: { values }
        });
      }
      saved = true;
    }
    
    if (!saved) {
      throw new Error("No database or Google Sheets connection available to save task. Please set DATABASE_URL or connect Google Sheets.");
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
    let saved = false;
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
      saved = true;
    }
    
    if (googleTokens) {
      if (db) {
        await syncToSheetsInternal();
      } else {
        // No DB mode: Fetch, merge, and write back
        console.log("Batch saving directly to Sheets (No DB mode)");
        const { sheetId } = getGoogleConfig();
        const client = getOAuth2Client();
        client.setCredentials(googleTokens);
        const sheets = google.sheets({ version: "v4", auth: client });

        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: "Sheet1!A2:O",
        });
        let rows = response.data.values || [];
        
        for (const task of tasks) {
          const taskArray = [
            task.id, task.name || "", task.unit || "", task.responsible || "", 
            task.frequency || "", task.type || "งาน routine", task.priority || "3 ปกติ", 
            task.plannedDate || "", task.actualDate || "", task.status || "รอดำเนินการ", 
            task.detailedSteps || "", task.remarks || "", task.sourceTaskId || null, 
            task.sourceTaskName || null, task.createdAt || now
          ];
          const existingIndex = rows.findIndex(r => r[0] === task.id);
          if (existingIndex >= 0) {
            rows[existingIndex] = taskArray;
          } else {
            rows.unshift(taskArray);
          }
        }

        const values = [
          ["ID", "Name", "Unit", "Responsible", "Frequency", "Type", "Priority", "Planned Date", "Actual Date", "Status", "Update ขั้นตอนการดำเนินงานอย่างละเอียดว่าถึงขึ้นตอนใด", "Remarks", "Source Task ID", "Source Task Name", "Created At"],
          ...rows
        ];
        
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: "Sheet1!A1",
          valueInputOption: "RAW",
          requestBody: { values }
        });
      }
      saved = true;
    }

    if (!saved) {
      throw new Error("No database or Google Sheets connection available to save tasks.");
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("Batch Save Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/tasks/:id", async (req, res) => {
  const { id } = req.params;
  try {
    let deleted = false;
    if (db) {
      if (isPostgres) {
        await db.query("DELETE FROM tasks WHERE id = $1", [id]);
      } else {
        db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
      }
      deleted = true;
    }
    
    if (googleTokens) {
      if (db) {
        await syncToSheetsInternal();
      } else {
        // No DB mode: Fetch, filter, and write back
        console.log("Deleting directly from Sheets (No DB mode)");
        const { sheetId } = getGoogleConfig();
        const client = getOAuth2Client();
        client.setCredentials(googleTokens);
        const sheets = google.sheets({ version: "v4", auth: client });

        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: "Sheet1!A2:O",
        });
        let rows = response.data.values || [];
        const filteredRows = rows.filter(r => r[0] !== id);
        
        if (rows.length !== filteredRows.length) {
          const values = [
            ["ID", "Name", "Unit", "Responsible", "Frequency", "Type", "Priority", "Planned Date", "Actual Date", "Status", "Update ขั้นตอนการดำเนินงานอย่างละเอียดว่าถึงขึ้นตอนใด", "Remarks", "Source Task ID", "Source Task Name", "Created At"],
            ...filteredRows
          ];
          
          await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: "Sheet1!A1",
            valueInputOption: "RAW",
            requestBody: { values }
          });
        }
      }
      deleted = true;
    }

    if (!deleted) {
      throw new Error("No database or Google Sheets connection available to delete task.");
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/logs", async (req, res) => {
  const { employeeId, action, details, timestamp } = req.body;
  try {
    let logged = false;
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
      logged = true;
    }
    
    if (googleTokens) {
      if (db) {
        await syncToSheetsInternal();
      } else {
        // No DB mode: Append to Sheet2
        console.log("Logging directly to Sheets (No DB mode)");
        const { sheetId } = getGoogleConfig();
        const client = getOAuth2Client();
        client.setCredentials(googleTokens);
        const sheets = google.sheets({ version: "v4", auth: client });

        // Check if Sheet2 exists
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const sheet2 = spreadsheet.data.sheets?.find(s => s.properties?.title === "Sheet2");
        if (!sheet2) {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: sheetId,
            requestBody: {
              requests: [{ addSheet: { properties: { title: "Sheet2" } } }]
            }
          });
          // Add headers
          await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: "Sheet2!A1",
            valueInputOption: "RAW",
            requestBody: { values: [["Timestamp", "Employee ID", "Action", "Details"]] }
          });
        }

        await sheets.spreadsheets.values.append({
          spreadsheetId: sheetId,
          range: "Sheet2!A1",
          valueInputOption: "RAW",
          requestBody: { values: [[timestamp, employeeId, action, details]] }
        });
      }
      logged = true;
    }

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
      // Removed prompt: "consent" to avoid repeated consent screens
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
    await saveTokensToDb(tokens);
    
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
            function handleSuccess() {
              if (window.opener) {
                window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, '*');
                setTimeout(() => window.close(), 1000);
              } else {
                window.location.href = '/';
              }
            }
            setTimeout(handleSuccess, 1500);
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
    configured: hasConfig,
    persisted: !!db
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
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.error("Failed to load Vite:", err);
    }
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

// Catch-all error handler for Express (Must be after all routes)
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Unhandled Express Error:", err);
  if (!res.headersSent) {
    res.status(500).json({
      error: "Internal Server Error",
      message: err.message,
      details: err.toString(),
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

startServer();

export default app;
