/**
 * Swee AI Service
 *
 * Supports two providers, selected via the AI_PROVIDER env var:
 *   AI_PROVIDER=gemini   → Google Gemini 1.5 Flash  (default — free API key)
 *   AI_PROVIDER=openai   → OpenAI GPT-4o            (client key, set when ready)
 *
 * To switch from Gemini to OpenAI:
 *   1. Add OPENAI_API_KEY=sk-... to .env
 *   2. Change AI_PROVIDER=openai in .env
 *   3. Restart the server — no code changes needed
 */

const { query: db } = require('../../config/database');
const config = require('../../config');

const MAX_HISTORY_MESSAGES = 20;

// ─── Provider detection ────────────────────────────────────────────────────

function getProvider() {
  return (config.ai?.provider || 'gemini').toLowerCase();
}

// ─── Lazy clients (only init when first request arrives) ──────────────────

let _openai = null;
let _geminiGenAI = null;

function getOpenAIClient() {
  if (!_openai) {
    if (!config.openai?.apiKey) {
      const err = new Error('OpenAI API key not configured. Set OPENAI_API_KEY in .env');
      err.statusCode = 503;
      throw err;
    }
    const OpenAI = require('openai');
    _openai = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return _openai;
}

function getGeminiModel(systemPrompt) {
  if (!_geminiGenAI) {
    if (!config.gemini?.apiKey) {
      const err = new Error('Gemini API key not configured. Set GEMINI_API_KEY in .env');
      err.statusCode = 503;
      throw err;
    }
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    _geminiGenAI = new GoogleGenerativeAI(config.gemini.apiKey);
  }
  return _geminiGenAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: systemPrompt,
  });
}

// ─── Shared helpers ────────────────────────────────────────────────────────

function buildSystemPrompt(tripContext) {
  let prompt =
    'You are Swee, a friendly and knowledgeable AI travel assistant for GatherGo — ' +
    'a group travel planning app. You help users plan trips, suggest itineraries, ' +
    'recommend restaurants and activities, create packing lists, answer visa and travel ' +
    'document questions, and help coordinate group travel logistics. ' +
    'Keep responses concise, warm, and actionable. Use bullet points where helpful. ' +
    'Always respond in the language the user writes in.';

  if (tripContext) {
    const { name, destination, startDate, endDate, memberCount, contextType } = tripContext;
    const type = contextType === 'event' ? 'event' : 'trip';
    prompt += `\n\nContext: You are currently helping plan the ${type} "${name || 'this trip'}"`;
    if (destination) prompt += ` to ${destination}`;
    if (startDate && endDate) prompt += `, from ${startDate} to ${endDate}`;
    if (memberCount) prompt += `, with ${memberCount} member${memberCount !== 1 ? 's' : ''}`;
    prompt += '. Tailor your suggestions to this specific trip when relevant.';
  }

  return prompt;
}

function trimHistory(history = []) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => m && typeof m.role === 'string' && typeof m.content === 'string')
    .slice(-MAX_HISTORY_MESSAGES);
}

// ─── Gemini format conversion ──────────────────────────────────────────────
// Gemini requires: [{role:'user'|'model', parts:[{text}]}]
// Our history uses: [{role:'user'|'assistant', content}]

function toGeminiHistory(history) {
  const converted = history.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  // Gemini requires the history to start with a 'user' turn.
  // Drop leading 'model' turns if any (shouldn't happen normally).
  while (converted.length > 0 && converted[0].role === 'model') {
    converted.shift();
  }

  // Gemini also requires alternating user/model turns.
  // Deduplicate consecutive same-role turns by merging their text.
  const cleaned = [];
  for (const turn of converted) {
    const last = cleaned[cleaned.length - 1];
    if (last && last.role === turn.role) {
      last.parts[0].text += '\n' + turn.parts[0].text;
    } else {
      cleaned.push({ role: turn.role, parts: [{ text: turn.parts[0].text }] });
    }
  }
  return cleaned;
}

// ─── Provider: Gemini ──────────────────────────────────────────────────────

async function geminiChat(message, history, systemPrompt) {
  const model = getGeminiModel(systemPrompt);
  const geminiHistory = toGeminiHistory(history);
  const chatSession = model.startChat({ history: geminiHistory });
  const result = await chatSession.sendMessage(message);
  return result.response.text();
}

async function geminiChatStream(message, history, systemPrompt, res) {
  const model = getGeminiModel(systemPrompt);
  const geminiHistory = toGeminiHistory(history);
  const chatSession = model.startChat({ history: geminiHistory });
  const result = await chatSession.sendMessageStream(message);

  for await (const chunk of result.stream) {
    const delta = chunk.text();
    if (delta) {
      res.write(`data: ${JSON.stringify({ delta })}\n\n`);
    }
  }
  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
}

// ─── Provider: OpenAI ─────────────────────────────────────────────────────

async function openaiChat(message, history, systemPrompt) {
  const openai = getOpenAIClient();
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    max_tokens: 1024,
    temperature: 0.7,
  });
  return completion.choices[0]?.message?.content ?? '';
}

async function openaiChatStream(message, history, systemPrompt, res) {
  const openai = getOpenAIClient();
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    max_tokens: 1024,
    temperature: 0.7,
    stream: true,
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? '';
    if (delta) res.write(`data: ${JSON.stringify({ delta })}\n\n`);
    if (chunk.choices[0]?.finish_reason === 'stop') break;
  }
  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
}

// ─── Public API ────────────────────────────────────────────────────────────

const chat = async (_userId, message, conversationHistory, tripContext) => {
  const systemPrompt = buildSystemPrompt(tripContext);
  const history = trimHistory(conversationHistory);
  const provider = getProvider();

  const reply = provider === 'openai'
    ? await openaiChat(message, history, systemPrompt)
    : await geminiChat(message, history, systemPrompt);

  return { reply };
};

const chatStream = async (_userId, message, conversationHistory, tripContext, res) => {
  // Set SSE headers before any streaming starts
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const systemPrompt = buildSystemPrompt(tripContext);
  const history = trimHistory(conversationHistory);
  const provider = getProvider();

  if (provider === 'openai') {
    await openaiChatStream(message, history, systemPrompt, res);
  } else {
    await geminiChatStream(message, history, systemPrompt, res);
  }
};

const reportIssue = async (userId, messageId, reason) => {
  await db(
    `INSERT INTO feedback (user_id, type, message, status, created_at)
     VALUES ($1, 'swee_report', $2, 'open', NOW())`,
    [userId, `[messageId: ${messageId || 'unknown'}] ${reason}`],
  );
};

module.exports = { chat, chatStream, reportIssue };
