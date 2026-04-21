# EUC World HUD for Even G2 Glasses

Displays live ride data from **EUC World** on your **Even G2** smart glasses — speed, battery, temperature, voltage, current, power, and trip/odometer distance — updated every second.

```
+----------- EUC WORLD HUD ----------+
|  SPEED      42.3 km/h               |
|  BATT    ████████░░ 78%             |
|  TEMP      32.1 °C                  |
|  VOLT      67.2 V                   |
|  CURR      12.5 A      839 W        |
|  TRIP       8.42 km  ODO  1234 km   |
+-- Live  14:32                     --+
```

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Even G2 glasses | Paired to your Android phone via Even Realities app |
| EUC World ≥ 2.50 | Free app on Google Play |
| Node.js 18+ | For running the dev server |
| Your phone & PC on the same Wi-Fi | For sideloading |

---

## Quick Start

### 1. Enable EUC World's Web Server

Open **EUC World → Settings → Web Server** and turn it on.  
Note the **port number** (commonly `8080`).

### 2. Install & run this plugin

```bash
npm install
npm run dev
# → server starts at http://0.0.0.0:5173
```

### 3. Sideload onto your glasses

Find your phone's local IP address (Settings → Wi-Fi → your network).

```bash
# Replace 192.168.1.XXX with your phone's actual IP
npm run qr -- "http://192.168.1.XXX:5173"
```

Scan the QR code with the **Even Realities app** on your phone.

### 4. Configure the URL (if needed)

The phone-side companion screen shows a URL input box.  
Default is `http://localhost:8080` — change this to match your EUC World port.  
Tap **Apply & Reconnect** after changing it.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "No signal" on glasses | EUC World web server not enabled, or wrong port |
| Glasses show nothing | Bridge not connected — check Even app is open |
| All values show `--` | Wheel not connected to EUC World |
| Wrong data after update | EUC World v2.60 changed the API shape — the plugin handles both, but check `console.log` output in browser devtools |

### EUC World API Notes

The `/api/values` endpoint changed structure in **v2.60**:
- **Before v2.60**: Fields returned flat at root level `{ speed: 42.3, battery: 78, ... }`
- **v2.60+**: Fields nested under `data` key `{ data: { speed: 42.3, battery: 78, ... } }`

This plugin handles both automatically.

If you see unexpected `--` values, open browser devtools while the dev server is running and check `window.__setRaw` output to see the raw API response and identify the correct field names.

---

## Project Structure

```
euc-world-g2/
├── src/
│   ├── main.ts        ← bootstrap entrypoint
│   ├── plugin.ts      ← runtime orchestration and bridge lifecycle
│   ├── telemetry.ts   ← EUC World probing, fetch, simulator, parsing
│   ├── hud.ts         ← HUD rendering, text/image updates, event parsing
│   ├── layout.ts      ← EvenHub container layout definitions
│   ├── config.ts      ← shared runtime constants and layout config
│   ├── utils.ts       ← shared formatting and data helpers
│   └── types.ts       ← global window hooks and shared TS types
├── index.html         ← phone-side companion UI
├── Dockerfile
├── docker-compose.yml
├── app.json           ← Even Hub app manifest
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## Packaging for Distribution

```bash
npm run build
npm run pack
# → produces euc-world-g2.ehpk
```

Upload `euc-world-g2.ehpk` to [hub.evenrealities.com](https://hub.evenrealities.com) to share with other riders.

---

## Docker Deployment

Build and run the production static site with Docker:

```bash
docker compose up --build -d
```

The app will be served on:

```text
http://localhost:8080
```

To stop it:

```bash
docker compose down
```

---

## Resources

- [Even Hub Developer Docs](https://hub.evenrealities.com/docs/)
- [Even Hub SDK (npm)](https://www.npmjs.com/package/@evenrealities/even_hub_sdk)
- [EUC World](https://euc.world/)
- [EUC Community Forum](https://forum.electricunicycle.org/)
