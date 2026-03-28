function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractText(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string' && content.trim()) return content.trim();

  if (Array.isArray(content)) {
    const joined = content.map(part => {
      if (typeof part === 'string') return part;
      if (typeof part?.text === 'string') return part.text;
      if (typeof part?.content === 'string') return part.content;
      return '';
    }).join(' ').trim();
    if (joined) return joined;
  }

  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  if (Array.isArray(data?.output)) {
    const joined = data.output.flatMap(item => {
      if (typeof item?.content === 'string') return [item.content];
      if (Array.isArray(item?.content)) {
        return item.content.map(part => part?.text || part?.content || '').filter(Boolean);
      }
      return [];
    }).join(' ').trim();
    if (joined) return joined;
  }

  return '';
}

function parseJsonObject(text) {
  const raw = String(text || '').trim();
  const candidates = [raw];
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());
  const objectMatch = raw.match(/\{[\s\S]*\}/);
  if (objectMatch) candidates.push(objectMatch[0]);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (_) {}
  }

  return null;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseStructuredReply(output, mode) {
  const parsed = parseJsonObject(output);
  if (!parsed) return null;

  if (mode === 'init') {
    const ailaIntro = normalizeString(parsed.ailaIntro);
    const jamieReply = normalizeString(parsed.jamieReply);
    const coachingFeedback = normalizeString(parsed.coachingFeedback);
    if (!ailaIntro || !jamieReply || !coachingFeedback) return null;
    return { ailaIntro, jamieReply, coachingFeedback };
  }

  const jamieReply = normalizeString(parsed.jamieReply);
  const coachingFeedback = normalizeString(parsed.coachingFeedback);
  if (!jamieReply || !coachingFeedback) return null;
  return { jamieReply, coachingFeedback };
}

async function requestChat(model, messages, maxTokens = 260) {
  const payload = {
    model,
    messages,
    temperature: 0.8,
    max_tokens: maxTokens,
    top_p: 0.95,
    response_format: { type: 'json_object' }
  };

  let response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  if (response.status === 429) {
    await sleep(6500);
    response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify(payload)
    });
  }

  const rawText = await response.text();
  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    data = { raw: rawText };
  }

  return { response, data };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'Missing GROQ_API_KEY in environment' });
  }

  try {
    const { messages, model, mode } = req.body || {};

    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const requestMode = mode === 'init' ? 'init' : 'turn';
    const requestedModel = model || process.env.GROQ_CHAT_MODEL || 'llama-3.1-8b-instant';
    const fallbackModel = process.env.GROQ_CHAT_FALLBACK_MODEL || 'llama-3.1-8b-instant';

    let { response, data } = await requestChat(requestedModel, messages, requestMode === 'init' ? 320 : 260);

    if (!response.ok) {
      const msg = data?.error?.message || data?.error || `Groq chat failed with ${response.status}`;
      return res.status(response.status).json({ error: msg, details: data });
    }

    let output = extractText(data);
    let structured = parseStructuredReply(output, requestMode);

    if ((!output || !structured) && fallbackModel && fallbackModel !== requestedModel) {
      ({ response, data } = await requestChat(fallbackModel, messages, requestMode === 'init' ? 320 : 260));
      if (response.ok) {
        output = extractText(data);
        structured = parseStructuredReply(output, requestMode);
      }
    }

    if (!output || !structured) {
      return res.status(502).json({
        error: 'Groq returned a reply that did not match the required JSON schema.',
        details: data
      });
    }

    return res.status(200).json({ output, structured, raw: data, provider: 'groq', mode: requestMode });
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Server error in /api/chat'
    });
  }
}
