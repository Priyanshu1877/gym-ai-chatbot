import express from "express";
import { createServer as createViteServer } from "vite";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import Database from "better-sqlite3";
import path from "path";
import dotenv from "dotenv";
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

  CREATE TABLE IF NOT EXISTS daily_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    date TEXT,
    workout_plan TEXT,
    diet_plan TEXT,
    completed BOOLEAN DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id),
    UNIQUE(user_id, date)
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
        "Demo",
        "demo@sweatfix.com",
        "https://picsum.photos/seed/demo/200"
      );
      user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
    }

    // Refresh demo user data every time they log in
    if (user && user.id) {
      db.prepare("DELETE FROM progress WHERE user_id = ?").run(user.id);
      db.prepare("DELETE FROM daily_plans WHERE user_id = ?").run(user.id);
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

  // Daily Plans Routes
  app.get("/api/plans", (req, res) => {
    if (!(req as any).user) return res.status(401).json({ error: "Unauthorized" });
    const userId = ((req as any).user as any).id;
    const data = db.prepare("SELECT * FROM daily_plans WHERE user_id = ? ORDER BY date DESC LIMIT 14").all(userId);
    res.json(data);
  });

  app.post("/api/plans", (req, res) => {
    if (!(req as any).user) return res.status(401).json({ error: "Unauthorized" });
    const userId = ((req as any).user as any).id;
    const { date, workout_plan, diet_plan } = req.body;
    db.prepare(`
      INSERT INTO daily_plans (user_id, date, workout_plan, diet_plan, completed) 
      VALUES (?, ?, ?, ?, 0)
      ON CONFLICT(user_id, date) DO UPDATE SET 
        workout_plan = excluded.workout_plan, 
        diet_plan = excluded.diet_plan
    `).run(userId, date, workout_plan, diet_plan);
    res.json({ success: true });
  });

  app.put("/api/plans/:id/complete", (req, res) => {
    if (!(req as any).user) return res.status(401).json({ error: "Unauthorized" });
    const userId = ((req as any).user as any).id;
    const { completed } = req.body;
    db.prepare("UPDATE daily_plans SET completed = ? WHERE id = ? AND user_id = ?").run(
      completed ? 1 : 0, req.params.id, userId
    );
    res.json({ success: true });
  });

  // Chat Route
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history } = req.body;

      const messages = history.map((h: any) => ({
        role: h.role === "model" ? "assistant" : h.role,
        content: h.parts[0].text
      }));

      messages.unshift({
        role: "system",
        content: `Role & Identity
You are Sweat Fix Coach AI, an elite, premium fitness and wellness concierge. Your ultimate goal is to help users master their bodies, achieve peak physical condition, and experience an effortless daily routine—a state of feeling light, explosive, mobile, and effortlessly powerful. You specialize in calisthenics, plyometrics, aerial fitness, and high-performance mobility, but you are fully equipped to handle general weight loss, hypertrophy, and nutrition coaching.

Tone & Voice
Premium & Exclusive: Speak like a high-end personal trainer at a luxury fitness club. Use sophisticated, empowering, and clean language.
Motivating & Empathetic: Acknowledge the user's struggles, but push them toward their potential. No toxic positivity; offer grounded, realistic encouragement.
Scientific & Precise: Explain why a movement works. Use accurate anatomical and biomechanical terms when appropriate, but keep it accessible.

Core Features & Protocols
You must seamlessly execute the following core fitness features:
Personalized Daily Routine Programming: Design custom routines focusing on relative strength, bodyweight mastery, suspension training, or explosive power based on the user's available equipment and goals.
Form & Biomechanics Coaching: When users ask about exercises, break down the mechanics step-by-step (e.g., core engagement, scapular retraction, breathing cues) to ensure safety and maximum efficiency.
Dynamic Nutrition Strategy: Provide macro-nutrient breakdowns, hydration protocols, and pre/post-workout fueling strategies tailored to support high-energy, joint-heavy movements.
Progressive Overload Tracking: Always encourage users to log their reps or duration. Suggest micro-progressions (e.g., moving from a tuck planche to an advanced tuck) to keep them advancing.
Recovery & Mobility (The "Float" Protocol): Emphasize joint health, flexibility, and active recovery, which are crucial for daily routines and bodyweight training.

Interaction Structure
Onboarding & Details Gathering: Before creating any diet or workout plan, you MUST politely ask the user to provide their current details if they haven't already. Specifically, ask for:
1. Current weight & height
2. Primary fitness goal (e.g., cut, bulk, bodyweight mastery)
3. Dietary restrictions
4. Available equipment
DO NOT generate a plan until you have this information.

Formatting: Use bullet points, bold text for key terms, and clear spacing. Never send a massive wall of text.
Closing: End every interaction with a clear, actionable next step or a motivational check-in question.

Guardrails & Safety
You are a coach, not a doctor. If a user mentions acute pain, injury, or medical conditions, advise them to consult a physical therapist or physician immediately.
Do not recommend extreme caloric deficits or dangerous training volumes.

Auto-Fill Protocol:
ONLY ONCE you have gathered the user's details, you can generate a highly accurate, customized diet and workout plan.
Whenever you generate this specific plan for the day, YOU MUST append a JSON block at the very end of your response inside triple backticks like this:
\`\`\`json
{
  "workout_plan": "Short summary of the workout plan",
  "diet_plan": "Short summary of the diet plan"
}
\`\`\`
This JSON will be used to automatically update their Daily Protocol dashboard. Keep the JSON properties exactly as "workout_plan" and "diet_plan", providing realistic autofill data based on the conversation.`
      });

      messages.push({ role: "user", content: message });

      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.GROK_API_KEY || ""}`
        },
        body: JSON.stringify({
          model: "grok-beta",
          messages: messages
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errorMessage = typeof errJson.error === 'string' ? errJson.error : errJson.error?.message;

        console.error("Grok API Error:", errorMessage);

        // As a fallback for missing credits/licenses or model not found, return a simulated premium response 
        // to keep the frontend completely functional.

        const userInputLower = message.toLowerCase();
        const seemsToHaveDetails = userInputLower.includes("weight") || userInputLower.includes("height") || userInputLower.includes("goal") || userInputLower.includes("lbs") || userInputLower.includes("kg") || userInputLower.includes("gym");

        if (!seemsToHaveDetails) {
          return res.json({
            text: `*(Simulated Coach Mode)*\n\nI’d love to craft the perfect **Daily Routine** for you, but I need to understand your baseline first to ensure the protocol matches your goals and capabilities safely. \n\nCould you please share:\n1. Your current weight & height\n2. Your primary fitness goal (e.g., bodyweight mastery, cutting, bulking)\n3. Any dietary restrictions\n4. What equipment you have available\n\nOnce I have these, I'll generate a personalized plan for you to instantly track.`
          });
        }

        const mockResponses = [
          "💪 **Perfect, let's get to work!**\n\nBased on your details, I've generated a high-protein plan for you to get started. Focus on form and let the tension dictate the burn.\n\n```json\n{\n  \"workout_plan\": \"4x10 Close-Grip Pushups\\n3x15 Tricep Dips\\n3x12 Pike Pushups\",\n  \"diet_plan\": \"Breakfast: 3 Eggs & Oatmeal\\nLunch: Chicken Breast with Rice & Broccoli\\nDinner: Salmon & Asparagus\"\n}\n```",
          "🔥 **Great baseline!**\n\nLet's get some active recovery and mobility work in today. Keep your joints healthy for the big lifts.\n\n```json\n{\n  \"workout_plan\": \"30 Min Deep Stretching\\n3x30s Wall Sits\\n20 Min Light Jogging\",\n  \"diet_plan\": \"Maintenance Day: Keep protein high (140g) and carbs moderate. Focus on hydration (3L Water).\"\n}\n```",
          "🏆 **You're tracking perfectly.**\n\nHere's an explosive plyometric routine combined with a balanced diet to fuel your fast-twitch fibers based on your stats.\n\n```json\n{\n  \"workout_plan\": \"4x5 Box Jumps\\n3x8 Clapping Pushups\\n5xSprint Intervals (40m)\",\n  \"diet_plan\": \"Pre-workout: Banana & Peanut Butter\\nPost-workout: Whey Protein Shake + Dextrose\\nDinner: Lean Beef & Sweet Potatoes\"\n}\n```"
        ];

        const randomMock = mockResponses[Math.floor(Math.random() * mockResponses.length)];

        return res.json({
          text: `*(Simulated Coach Mode)*\n\n${randomMock}`
        });
      }

      const data = await response.json();
      res.json({ text: data.choices[0].message.content });
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
