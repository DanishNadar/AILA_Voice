AILA Leadership Studio with Talking Avatar

What is included
- Simple friendly circular avatar under the Conversation header
- Browser voice playback for Jamie replies using SpeechSynthesis
- Soft pulse / ring animation while the voice is speaking
- Serverless Groq chat endpoint for the conversation
- Serverless Groq transcription endpoint for uploaded or recorded audio
- Scenario import and JSON template download
- Vercel-ready static frontend + API routes

How to push to GitHub
1. Unzip the project.
2. Open a terminal inside the inner project folder:
   cd ~/Documents/Development/AILA_Avatar/AILA_Avatar-main

3. Start clean and connect the repo:
   rm -rf .git
   git init
   git branch -M main
   git remote add origin https://github.com/DanishNadar/AILA_Avatar.git

4. Commit and push:
   git add .
   git commit -m "AILA avatar pulse build"
   git push -u origin main --force

Use --force only if you want this project to replace what is currently in that GitHub repo.

How to deploy on Vercel
1. Import DanishNadar/AILA_Avatar into Vercel.
2. Add these environment variables:
   GROQ_API_KEY=your_real_key
   GROQ_CHAT_MODEL=llama-3.1-8b-instant
   GROQ_CHAT_FALLBACK_MODEL=llama-3.1-8b-instant
   GROQ_STT_MODEL=whisper-large-v3-turbo

3. Deploy.

Important behavior notes
- The avatar voice uses the browser's built-in speech engine, not a separate paid TTS provider.
- The visualizer is driven by the speaking state and boundary events from browser speech playback.
- Terms acceptance is intentionally not persisted between page loads.
- Conversation messages stay in browser memory for the current session only.
- Imported scenarios are saved in browser local storage for convenience.


Latest fixes
- Simplified the avatar so it feels cleaner and more friendly
- Tightened Groq prompting so Jamie replies return as clean JSON more reliably
- Added stronger JSON extraction on both the API and browser side so only Jamie's actual reply is shown in the conversation


Groq-only response behavior
- Jamie replies and coaching feedback are generated only through Groq.
- The opening AILA intro and opening Jamie message are also generated through Groq on scenario start and restart.
- If Groq returns invalid JSON, the app shows an error instead of inventing a fallback reply.
