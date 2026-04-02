import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { z } from "zod";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Mongo setup
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.warn(
    "MONGODB_URI is not set. History saving will be disabled until it is configured."
  );
}

const symptomQuerySchema = z.object({
  symptomsText: z.string().min(10, "Please describe your symptoms in more detail."),
  age: z.number().int().min(0).max(120).optional(),
  sex: z.enum(["male", "female", "other"]).optional(),
  duration: z
    .enum(["hours_0_24", "days_1_3", "days_4_7", "weeks_plus", "unknown"])
    .optional(),
  severity: z.enum(["mild", "moderate", "severe", "unknown"]).optional(),
});

let SymptomQueryModel = null;

async function connectMongo() {
  if (!mongoUri) return;
  try {
    await mongoose.connect(mongoUri);
    const symptomQuerySchemaMongo = new mongoose.Schema(
      {
        symptomsText: String,
        age: Number,
        sex: String,
        duration: String,
        severity: String,
        llmResponse: Object,
      },
      { timestamps: true }
    );

    SymptomQueryModel =
      mongoose.models.SymptomQuery ||
      mongoose.model("SymptomQuery", symptomQuerySchemaMongo);

    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection error", err);
  }
}

connectMongo();

const EDUCATOR_SYSTEM = `You are a cautious healthcare educator. You are NOT a doctor, and you do not give diagnoses. You only suggest possible educational explanations and clear guidance on when to seek urgent in-person care. Always include a strong disclaimer at the start of your answer.`;

/** Models to try in order if the API returns “model not found” (names differ by API/version). */
const GEMINI_MODEL_FALLBACKS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

function buildGeminiUrl(model, apiKey) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Minimal REST body — matches Google’s curl examples. Avoids optional fields that some keys/models reject.
 * Pass generationOverrides for JSON mode etc.
 */
async function generateWithModel(model, fullText, apiKey, generationOverrides = {}) {
  const url = buildGeminiUrl(model, apiKey);
  const generationConfig = {
    temperature: 0.35,
    maxOutputTokens: 2048,
    ...generationOverrides,
  };
  let lastFetchError;
  // Retry transient DNS/network errors (EAI_AGAIN) without failing the whole request.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullText }] }],
          generationConfig,
        }),
      });

      const rawText = await res.text();
      if (!res.ok) {
        let parsed;
        try {
          parsed = JSON.parse(rawText);
        } catch {
          parsed = null;
        }
        const apiMsg =
          parsed?.error?.message ||
          parsed?.error?.status ||
          rawText.slice(0, 400);
        const err = new Error(
          `Gemini API error (${res.status}): ${apiMsg || "unknown"}`
        );
        err.status = res.status;
        err.raw = rawText.slice(0, 500);
        throw err;
      }

      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error("Invalid JSON from Gemini API");
      }

      const text =
        data?.candidates?.[0]?.content?.parts
          ?.map((p) => p.text)
          .join("") || "";

      if (!text.trim()) {
        const block = data?.promptFeedback?.blockReason;
        const finish = data?.candidates?.[0]?.finishReason;
        console.error(
          "Gemini empty response:",
          JSON.stringify(data).slice(0, 800)
        );
        throw new Error(
          block || finish
            ? `Model did not return text (blocked or filtered). Reason: ${
                block || finish
              }`
            : "Model returned no text. Try a different GEMINI_MODEL or shorten the prompt."
        );
      }

      return text;
    } catch (e) {
      lastFetchError = e;
      // Retry only on likely transient network issues (e.g., DNS).
      if (attempt === 1) throw e;
      const msg = e?.message || String(e);
      console.warn("Gemini fetch failed, retrying:", msg);
      await sleep(800);
    }
  }

  throw lastFetchError;
}

function isModelNotFoundError(err) {
  const msg = (err?.message || "").toLowerCase();
  return (
    err?.status === 404 ||
    msg.includes("not found") ||
    (msg.includes("model") && msg.includes("not available")) ||
    msg.includes("invalid model")
  );
}

function stripOptionalJsonFence(text) {
  let t = String(text || "").trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/s, "").trim();
  }
  return t;
}

function normalizeCondition(entry) {
  if (typeof entry === "string") {
    return { title: entry, note: "" };
  }
  if (entry && typeof entry === "object") {
    return {
      title: String(entry.title || entry.name || entry.label || "Possible category"),
      note: String(entry.note || entry.description || entry.detail || ""),
    };
  }
  return { title: "Possible category", note: "" };
}

function parseSymptomJson(text) {
  const cleaned = stripOptionalJsonFence(text);

  // Extract the first JSON object from the model output (handles cases where
  // the model includes extra text before/after the JSON).
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  const candidate =
    firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace
      ? cleaned.slice(firstBrace, lastBrace + 1).trim()
      : cleaned.trim();

  let data;
  try {
    data = JSON.parse(candidate);
  } catch (e) {
    // Attempt lightweight repairs for common JSON issues:
    //  - trailing commas: { "a": 1, }
    //  - unquoted keys: { a: 1 }
    //  - single-quoted strings: { "a": 'text' }
    const repaired = candidate
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/([{\s,])([A-Za-z0-9_]+)\s*:/g, '$1"$2":')
      .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');

    data = JSON.parse(repaired);
  }

  const probableConditions = Array.isArray(data.probableConditions)
    ? data.probableConditions.map(normalizeCondition)
    : [];
  const redFlags = Array.isArray(data.redFlags)
    ? data.redFlags.map((s) => String(s))
    : [];
  const recommendedNextSteps = Array.isArray(data.recommendedNextSteps)
    ? data.recommendedNextSteps.map((s) => String(s))
    : [];
  const shortDisclaimer = String(data.shortDisclaimer || "").trim();
  return {
    shortDisclaimer,
    probableConditions,
    redFlags,
    recommendedNextSteps,
  };
}

function extractSection(text, startRe, endRes) {
  const t = String(text || "");
  const startMatch = t.match(startRe);
  if (!startMatch || startMatch.index === undefined) return "";

  const startIndex = startMatch.index + startMatch[0].length;
  let endIndex = t.length;
  for (const endRe of endRes) {
    const m = t.slice(startIndex).match(endRe);
    if (m && m.index !== undefined) {
      endIndex = Math.min(endIndex, startIndex + m.index);
    }
  }
  return t.slice(startIndex, endIndex).trim();
}

function parseBullets(block) {
  const lines = String(block || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const bullets = lines
    .filter(
      (l) => l.startsWith("-") || l.startsWith("*") || /^\d+\./.test(l) || /^\d+\)/.test(l)
    )
    .map((l) => l.replace(/^(-|\*|\d+\.\s*|\d+\)\s*)/, "").trim());

  if (bullets.length) return bullets;
  // fallback: return non-empty lines as items
  return lines;
}

function parseSymptomText(text) {
  const cleaned = String(text || "").replace(/\r/g, "").trim();

  // Disclaimer line (optional)
  const discMatch = cleaned.match(/Disclaimer\s*:\s*(.+)$/im);
  const firstLine = cleaned.split("\n").find((l) => l.trim().length > 0) || "";
  const shortDisclaimer = (
    discMatch?.[1] ||
    firstLine.replace(/^Disclaimer\s*[-:]\s*/i, "")
  ).trim();

  const probableBlock = extractSection(
    cleaned,
    /Probable\s+conditions\s*:?/i,
    [/Red\s+flags\s*:/i, /Recommended\s+next\s+steps\s*:/i]
  );

  const redFlagsBlock = extractSection(
    cleaned,
    /Red\s+flags\s*:?/i,
    [/Recommended\s+next\s+steps\s*:?/i]
  );

  const nextStepsBlock = extractSection(
    cleaned,
    /Recommended\s+next\s+steps\s*:?/i,
    []
  );

  const probableItems = parseBullets(probableBlock);
  const redFlags = parseBullets(redFlagsBlock);
  const recommendedNextSteps = parseBullets(nextStepsBlock);

  const probableConditions = probableItems.map((s) => {
    // If the model uses "Title: note..." split it.
    const idx = s.indexOf(":");
    if (idx > 0 && idx < 80) {
      return { title: s.slice(0, idx).trim(), note: s.slice(idx + 1).trim() };
    }
    return { title: s, note: "" };
  });

  return {
    shortDisclaimer,
    probableConditions,
    redFlags,
    recommendedNextSteps,
  };
}

async function runGemini(userPrompt, generationOverrides = {}) {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  const preferred = (process.env.GEMINI_MODEL || "").trim();

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to server/.env and restart the server."
    );
  }

  const fullText = `${EDUCATOR_SYSTEM}\n\n${userPrompt}`;

  const tryModels = [
    ...(preferred ? [preferred] : []),
    ...GEMINI_MODEL_FALLBACKS.filter((m) => m !== preferred),
  ];
  const models = [...new Set(tryModels)];

  let lastErr;
  for (const model of models) {
    try {
      const out = await generateWithModel(model, fullText, apiKey, generationOverrides);
      if (model !== models[0]) {
        console.log(`Gemini: succeeded with fallback model "${model}".`);
      }
      return out;
    } catch (e) {
      lastErr = e;
      if (isModelNotFoundError(e)) {
        console.warn(`Gemini: model "${model}" failed (${e.message}). Trying next...`);
        continue;
      }
      throw e;
    }
  }

  throw lastErr || new Error("Gemini: all configured models failed.");
}

app.post("/api/check-symptoms", async (req, res) => {
  try {
    const parseResult = symptomQuerySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Invalid input",
        details: parseResult.error.format(),
      });
    }

    const { symptomsText, age, sex, duration, severity } = parseResult.data;

    const llmPrompt = `
Based on the following patient-provided information, produce an EDUCATIONAL symptom overview (not a diagnosis).

Symptoms: ${symptomsText}
Age: ${age ?? "not provided"}
Sex: ${sex ?? "not provided"}
How long: ${duration ?? "not provided"}
Severity (self-reported): ${severity ?? "not provided"}

You MUST respond using EXACTLY these headings (each on its own line):
Disclaimer:
Probable conditions:
Red flags:
Recommended next steps:

Rules:
- Disclaimer: 1 short sentence (not medical advice; not a diagnosis; see a clinician).
- Probable conditions: 3–6 bullet points. Each bullet should be a broad possible explanation/category.
- Red flags: 2–6 bullet points with concrete emergency/urgent signs.
- Recommended next steps: 4–8 bullet points with practical actions (what to track, self-care vs see a clinician, what to ask/prepare).
- Use plain language. Do NOT provide diagnoses or claim certainty.
`;

    const STATIC_DISCLAIMER =
      "This tool is for educational purposes only and is not a medical diagnosis or medical advice. Always consult a qualified healthcare professional for concerns.";

    const modelText = await runGemini(llmPrompt);

    let structured;
    let parseError = null;
    try {
      structured = parseSymptomJson(modelText);
    } catch (jsonErr) {
      try {
        structured = parseSymptomText(modelText);
      } catch (textErr) {
        console.error("Failed to parse Gemini output:", {
          json: jsonErr?.message || String(jsonErr),
          text: textErr?.message || String(textErr),
        });
        parseError = textErr?.message || String(textErr);
        structured = {
          shortDisclaimer: "",
          probableConditions: [],
          redFlags: [],
          recommendedNextSteps: [],
        };
      }
    }

    const responsePayload = {
      disclaimer: [STATIC_DISCLAIMER, structured.shortDisclaimer]
        .filter(Boolean)
        .join("\n\n"),
      probableConditions: structured.probableConditions,
      redFlags: structured.redFlags,
      recommendedNextSteps: structured.recommendedNextSteps,
      parseError,
      rawText: parseError ? modelText : null,
    };

    if (SymptomQueryModel) {
      try {
        await SymptomQueryModel.create({
          symptomsText,
          age,
          sex,
          duration,
          severity,
          llmResponse: responsePayload,
        });
      } catch (err) {
        console.error("Failed to save query history:", err);
      }
    }

    res.json(responsePayload);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Something went wrong processing your request.",
      details: err?.message || String(err),
    });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

