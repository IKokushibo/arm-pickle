# ARM Pickleball Court

PWA for booking covered pickleball courts. Deploy on **Vercel** (HTTPS required for “Add to Home Screen”).

## Deploy on Vercel

1. Import this repo in [Vercel](https://vercel.com/new) → connect `IKokushibo/ARMPickleBallCourt`.
2. Framework preset: **Other** (static HTML). Root directory: `.`
3. Deploy. Note the production URL (e.g. `https://arm-pickleball-court.vercel.app`).

Optional CLI:

```bash
npx vercel --prod
```

## Install on a phone (PWA)

Open the **live HTTPS** site in the phone browser (not HTTP).

### Android (Chrome)

1. Open the site.
2. Tap the browser menu (**⋮**) → **Install app** / **Add to Home screen**,  
   or use the in-site **Install app** button when it appears.
3. Confirm. The app opens fullscreen like a native app.

### iPhone / iPad (Safari)

1. Open the site in **Safari**.
2. Tap **Share** → **Add to Home Screen**.
3. Tap **Add**. Launch from the home screen icon.

## Local preview

Serve the folder over HTTP (service worker needs localhost or HTTPS):

```bash
npx serve .
```

Then open `http://localhost:3000` (port may vary).

## Project layout

| Path | Role |
|------|------|
| `index.html` | Home + booking entry |
| `book.html` / `pay.html` / `confirm.html` | Booking flow |
| `login.html` / `admin.html` | Admin |
| `manifest.webmanifest` + `sw.js` | PWA install + offline cache |
| `assets/` | Logo, icons, court images |
| `vercel.json` | Headers for SW + manifest |

## Admin

Admin login: `/login.html` → dashboard `/admin.html`.
