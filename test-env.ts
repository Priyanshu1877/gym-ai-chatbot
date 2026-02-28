import dotenv from "dotenv";
dotenv.config();

console.log("Has GEMINI_API_KEY:", !!process.env.GEMINI_API_KEY);
console.log("Has GROK_API_KEY:", !!process.env.GROK_API_KEY);
