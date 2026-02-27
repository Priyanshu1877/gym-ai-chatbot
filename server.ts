import express from "express";
import { createServer as createViteServer } from "vite";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import Database from "better-sqlite3";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

declare global {
  namespace Express {
    interface User {
      id: number;
      google_id: string;
      name: string;
      email: string;
      avatar: string;
    }
  }
}

const db = new Database("gym.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT UNIQUE,
    name TEXT,
    email TEXT,
    avatar TEXT
  );

  CREATE TABLE IF NOT EXISTS progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    date TEXT,
    workout_name TEXT,
    calories INTEGER,
    protein INTEGER,
    water INTEGER,
    carbs INTEGER DEFAULT 0,
    fats INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

try { db.exec("ALTER TABLE progress ADD COLUMN carbs INTEGER DEFAULT 0;"); } catch (e) { /* Ignore if it already exists */ }
try { db.exec("ALTER TABLE progress ADD COLUMN fats INTEGER DEFAULT 0;"); } catch (e) { /* Ignore if it already exists */ }

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(session({
    secret: "sweat-fix-secret",
    resave: true,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: any, done) => {
    console.log("Serializing user:", user.id);
    done(null, user.id);
  });
  passport.deserializeUser((id: number, done) => {
    console.log("Deserializing user ID:", id);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    done(null, user);
  });

  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || "placeholder",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "placeholder",
    callbackURL: `${process.env.APP_URL}/auth/google/callback`,
  }, (accessToken, refreshToken, profile, done) => {
    let user = db.prepare("SELECT * FROM users WHERE google_id = ?").get(profile.id);
    if (!user) {
      const info = db.prepare("INSERT INTO users (google_id, name, email, avatar) VALUES (?, ?, ?, ?)").run(
        profile.id,
        profile.displayName,
        profile.emails?.[0].value,
        profile.photos?.[0].value
      );
      user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
    }
    return done(null, user);
  }));

  // Auth Routes
  app.get("/api/auth/google", passport.authenticate("google", { scope: ["openid", "profile", "email"] }));

  app.post("/api/auth/demo", (req, res) => {
    console.log("Demo login requested");
    let user = db.prepare("SELECT * FROM users WHERE google_id = ?").get("demo_user");
    if (!user) {
      console.log("Creating demo user");
      const info = db.prepare("INSERT INTO users (google_id, name, email, avatar) VALUES (?, ?, ?, ?)").run(
        "demo_user",
        "Demo User",
        "demo@sweatfix.com",
        "https://picsum.photos/seed/demo/200"
      );
      user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
    }

    (req as any).login(user, (err: any) => {
      if (err) {
        console.error("Login error:", err);
        return res.status(500).json({ error: "Login failed" });
      }
      (req as any).session.save((err: any) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "Session save failed" });
        }
        console.log("Demo login successful for user:", user.id);
        res.json(user);
      });
    });
  });

  app.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: "/" }), (req, res) => {
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  });

  app.get("/api/me", (req, res) => {
    const user = (req as any).user;
    console.log("Checking /api/me, user found:", !!user);
    res.json(user || null);
  });

  app.get("/api/logout", (req, res) => {
    (req as any).logout(() => res.json({ success: true }));
  });

  app.put("/api/user", (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { name } = req.body;
    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "Invalid name" });
    }

    try {
      db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name.trim(), user.id);
      const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
      res.json(updatedUser);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Progress Routes
  app.get("/api/progress", (req, res) => {
    if (!(req as any).user) return res.status(401).json({ error: "Unauthorized" });
    const userId = ((req as any).user as any).id;
    const data = db.prepare("SELECT * FROM progress WHERE user_id = ? ORDER BY date DESC LIMIT 7").all(userId);
    res.json(data);
  });

  app.post("/api/progress", (req, res) => {
    if (!(req as any).user) return res.status(401).json({ error: "Unauthorized" });
    const userId = ((req as any).user as any).id;
    const { date, workout_name, calories, protein, water, carbs, fats } = req.body;
    db.prepare("INSERT INTO progress (user_id, date, workout_name, calories, protein, water, carbs, fats) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
      userId, date, workout_name, calories, protein, water, carbs || 0, fats || 0
    );
    res.json({ success: true });
  });

  // Chat Route
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history } = req.body;
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          ...history.map((h: any) => ({ role: h.role, parts: h.parts })),
          { role: "user", parts: [{ text: message }] }
        ],
        config: {
          systemInstruction: "You are a premium AI fitness coach for 'Sweat Fix Gym'. Your tone is motivating, professional, and expert. When asked for workout plans, diets, or macro details, ALWAYS format your response strictly as concise bullet points. Avoid long paragraphs. Deliver highly actionable, scannable advice.",
        }
      });
      res.json({ text: response.text });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
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
