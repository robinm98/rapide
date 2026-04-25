# Salon. — A Parlor Game

A real-time multiplayer quiz app. Create a room, share a 4-letter code, play from any phone. Questions generated live by Claude.

Three games: **Trivia** (4-choice), **The Wall** (12 items, pick the 8 that belong), **The Closest** (numeric guess, nearest wins).

---

## Quick deploy (10 minutes)

You need three things: an Anthropic API key, a Supabase project (free), and a Vercel account (free).

### 1. Get an Anthropic API key

- Go to https://console.anthropic.com
- Sign up, add $5 of credit (lasts for hundreds of games)
- Settings → API Keys → Create Key
- Copy the key (starts with `sk-ant-`)

### 2. Create a Supabase project

- Go to https://supabase.com, sign in with GitHub
- New project → any name, any region near you, set a DB password (save it, you won't need it)
- Wait ~2 min for it to provision
- Once ready:
  - **SQL Editor** (left sidebar) → New Query → paste the contents of `supabase-setup.sql` → Run
  - **Project Settings → Data API** → copy the **Project URL** and the **anon public** key
  - **Project Settings → API Keys** → copy the **service_role** key (click "Reveal")

### 3. Push this project to GitHub

```bash
cd salon-quiz
git init
git add .
git commit -m "Salon quiz app"
# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/salon-quiz.git
git branch -M main
git push -u origin main
```

### 4. Deploy to Vercel

- Go to https://vercel.com, sign in with GitHub
- Add New Project → Import your `salon-quiz` repo → Deploy (it'll fail the first time — that's fine)
- Settings → Environment Variables, add all four:
  - `ANTHROPIC_API_KEY` = your `sk-ant-...` key
  - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
  - `SUPABASE_SERVICE_ROLE_KEY` = your Supabase service_role key
- Deployments tab → click the three dots on the failed deploy → Redeploy

You're live. Your URL will be something like `salon-quiz.vercel.app`. Share it with friends, the host creates a room, everyone else joins with the 4-letter code on their phone.

---

## Run locally (for testing)

```bash
cp .env.local.example .env.local
# Fill in .env.local with the four keys from above
npm install
npm run dev
```

Open http://localhost:3000

---

## How it works

- **Supabase Realtime** pushes room updates to every connected phone instantly. When the host reveals an answer, everyone's screen changes at once.
- **Host-only controls**: only the person who created the room can start, reveal answers, or advance rounds. Guests see a waiting state.
- **API key safety**: the Anthropic key never touches the browser. Question generation happens in `/api/question` on the Vercel server.
- **Row Level Security**: Supabase has RLS enabled. The browser can only read rooms (never write). All writes go through the `/api/room` endpoint which uses the service role key server-side.

## Costs

- **Anthropic**: ~$0.005 per question. A 5-round game with 4 friends = $0.025.
- **Supabase**: free tier is plenty (500MB storage, 2GB bandwidth, unlimited realtime for small rooms).
- **Vercel**: free tier is plenty (100GB bandwidth/month).

Total for normal use: basically free after the initial $5 Anthropic top-up.

## Extending

- Add more categories in `app/page.tsx` (the `CATEGORIES` object)
- Tweak the prompts in `app/api/question/route.ts` to change style or difficulty
- Adjust colors in `lib/design.ts`
