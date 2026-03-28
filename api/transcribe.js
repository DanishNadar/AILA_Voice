import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, result => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'Missing GROQ_API_KEY in environment' });
  }

  try {
    await runMiddleware(req, res, upload.single('audio'));

    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'audio file is required' });
    }

    const form = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype || 'audio/webm' });

    form.append('file', blob, req.file.originalname || 'speech.webm');
    form.append('model', process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo');
    form.append('language', 'en');
    form.append('response_format', 'json');
    form.append('temperature', '0');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: form
    });

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { raw: rawText };
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || data?.error || `Groq transcription failed with ${response.status}`,
        details: data
      });
    }

    return res.status(200).json({ text: data?.text || '' });
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Server error in /api/transcribe'
    });
  }
}
