import OpenAI from "openai";

const apiKey = process.env.OPENROUTER_API_KEY?.trim();
const model = process.env.OPENROUTER_MODEL_JUDGE?.trim();

if (!apiKey || !model) {
  throw new Error("OpenRouter environment variables are missing.");
}

const client = new OpenAI({
  apiKey,
  baseURL: "https://openrouter.ai/api/v1",
  timeout: 55_000,
  maxRetries: 0,
});
const completion = await client.chat.completions.create({
  model,
  messages: [{ role: "user", content: "Merhaba. Yalnızca OK yaz." }],
  reasoning_effort: "low",
  max_completion_tokens: 16,
});

console.log(
  JSON.stringify({
    id: completion.id,
    model: completion.model,
    responded: Boolean(completion.choices[0]?.message),
  }),
);
