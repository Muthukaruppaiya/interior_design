# Interior Visualizer

React Native (Expo) sales tool for an interior company: capture a room photo, choose style / colour / catalog items, generate a concept preview for the customer.

## Stack

| Layer | Tech |
|-------|------|
| Mobile | Expo + React Native (TypeScript) |
| API | Node.js + Express + TypeScript |
| DB | Local PostgreSQL |

## Project layout

```
Interior/
  backend/     # Express API + PostgreSQL
  mobile/      # Expo React Native app
```

## 1. Database setup (one time)

PostgreSQL 15/17 is already running on this machine. Create the app database:

```powershell
cd backend
.\scripts\setup-db.ps1
```

Enter your `postgres` user password when prompted. This creates `interior_viz`, writes `backend/.env`, and runs schema + seed.

Or manually:

```powershell
$env:PGPASSWORD = "YOUR_PASSWORD"
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost -c "CREATE DATABASE interior_viz;"
# Edit backend/.env DATABASE_URL, then:
cd backend
npm run migrate
```

## 2. Start API

```powershell
cd backend
npm run dev
```

Health check: http://localhost:4001/health

## 3. Start mobile app

```powershell
cd mobile
npm start
```

Then press `a` for Android emulator, or scan the QR with Expo Go on a phone.

**Physical phone:** set your PC LAN IP in `mobile/src/config.ts` (replace `10.0.2.2` / `localhost`).

## App flow

1. Choose room (e.g. Kitchen)
2. Open **guided camera** — backup-camera style map (CUPBOARD / CHIMNEY / LIGHT / FLOOR)
3. Align the real counters to the blue boxes, then capture
4. Tap **Auto design into map zones** — items paste into those same boxes
5. Customer wants another colour? Tap a finish → all cabinets update
6. Optional: 4-corner tweak → Save → Share

This is map-based placement (not free AI guessing). Correct framing = correct auto layout.

## API endpoints

- `GET /api/rooms`
- `GET /api/rooms/:idOrSlug/catalog`
- `GET /api/styles`
- `GET /api/colors`
- `GET /api/projects`
- `POST /api/projects` (multipart: `image`, `roomId`, optional `styleId`, `colorId`, `catalogItemIds`, `customerName`)

## AI visualization

### Clear fact about Gemini

**Gemini image redesign is not free.** On the free tier, image quota is **0**.  
Text Gemini may work free; **image generation needs a paid Google AI plan**.

### Default in this project: Pollinations (FREE)

```
AI_MODE=pollinations
```

No API key required. Limit: about **1 image every 45 seconds** per IP.  
Quality is good for demos; room layout may not match as precisely as paid models.

### Paid options (better accuracy)

```
AI_MODE=gemini
GEMINI_API_KEY=...   # requires billing enabled

AI_MODE=replicate
REPLICATE_API_TOKEN=...
```

Restart the backend after changing `.env`.
# interior_design
