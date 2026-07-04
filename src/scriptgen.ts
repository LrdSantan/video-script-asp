const VENICE_BASE_URL = "https://api.venice.ai/api/v1";
const VENICE_MODEL = "llama-3.3-70b";

export interface GenerateScriptParams {
  topic: string;
  duration_minutes?: number; // target spoken length
  tone?: "educational" | "entertaining" | "news" | "dramatic" | "casual";
  language?: string; // e.g. "English"
  audience?: string; // e.g. "general", "history enthusiasts"
}

export interface ScriptScene {
  scene_number: number;
  timestamp_estimate: string; // e.g. "0:00-0:20"
  narration: string;
  visual_direction: string;
  music_cue: string;
}

export interface GeneratedScript {
  title: string;
  hook: string;
  scenes: ScriptScene[];
  call_to_action: string;
  estimated_duration_minutes: number;
  word_count: number;
}

const SYSTEM_PROMPT = `You are a professional video script writer for short-form documentary and educational content (2-6 minute videos, similar to dark-history / educational YouTube channels).

You write scripts that are:
- Punchy and hook-driven in the first 5-10 seconds
- Broken into clear scenes with narration, visual direction, and music cues
- Paced for spoken delivery (roughly 130-150 words per minute of narration)
- Ending with a clear call to action (subscribe, comment, watch next)

You MUST respond with ONLY valid JSON matching this exact schema, no markdown fences, no preamble:
{
  "title": string,
  "hook": string (the opening line(s), 1-3 sentences),
  "scenes": [
    { "scene_number": number, "timestamp_estimate": string, "narration": string, "visual_direction": string, "music_cue": string }
  ],
  "call_to_action": string,
  "estimated_duration_minutes": number,
  "word_count": number
}`;

export async function generateVideoScript(params: GenerateScriptParams): Promise<GeneratedScript> {
  const { topic, duration_minutes = 3, tone = "educational", language = "English", audience = "general audience" } = params;

  const userPrompt = `Topic: ${topic}
Target duration: ${duration_minutes} minutes
Tone: ${tone}
Language: ${language}
Audience: ${audience}

Write the full script now, following the JSON schema exactly.`;

  const apiKey = process.env.VENICE_API_KEY;
  if (!apiKey) throw new Error("VENICE_API_KEY is not set in environment variables");

  const res = await fetch(`${VENICE_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: VENICE_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      venice_parameters: { include_venice_system_prompt: false },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Venice API error (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as any;
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("No text response from model");

  const cleaned = text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned) as GeneratedScript;
  return parsed;
}
