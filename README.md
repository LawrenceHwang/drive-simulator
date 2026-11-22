# Top-Down Drive Simulator

A fast, zero-dependency, offline-ready top-down arcade driving simulator built with HTML5 Canvas and procedural Web Audio. Designed to play smoothly on desktop, mobile, or tablet—even with no internet connection.

## Features

- **4 Circuits**: *Emerald Circuit*, *Sunset Canyon*, *Midnight Neon* (rain + headlights), and *Alpine Pass* (snow + ice patches)
- **4 Cars**: *Apex GT*, *Drift King*, *Veloce F1*, and *Baja Rally* — each with distinct visuals and handling
- **4 Game Modes**:
  - **Time Trial** — Beat Bronze/Silver/Gold medals and race your saved Personal Best Ghost
  - **Traffic Race** — Weave through multi-class AI traffic for Near-Miss boost bonuses
  - **Drift Attack** — 2-minute combo multiplier run with S/A/B/C grading
  - **Free Cruise** — Relaxed endless driving
- **100% Offline Audio**: Procedural 6-gear engine synth, tire screech, off-road rumble, collision/lap SFX, and a toggleable **Chill Synth Bus Radio**
- **PWA Offline Caching**: Visit once on GitHub Pages (or Add to Home Screen) and play completely offline via the built-in Service Worker

## Controls

| Action | Keyboard | Touch / Gamepad |
|---|---|---|
| Accelerate / Brake | `W` `S` or `↑` `↓` | Right pedals / Triggers |
| Steer | `A` `D` or `←` `→` | Left buttons / Left stick |
| Handbrake / Drift | `Space` | `◎` button / X |
| Nitro Boost | `Shift` or `B` | `⚡` button / Y |
| Reset to Track | `R` | `↻` HUD button |
| Pause | `Esc` or `P` | `⏸` HUD button |
| Toggle SFX / Radio | `M` / `N` | HUD toolbar |
| Toggle Camera | `C` | `📷` HUD button |

## Playing Locally

Open `index.html` directly in any browser (works over `file://` with no build step or server required).

## Publishing to GitHub Pages

1. Create a new repository on GitHub and push this repo:
   ```bash
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
2. In your GitHub repository, go to **Settings → Pages**:
   - Under **Build and deployment → Source**, choose **GitHub Actions** (the included `.github/workflows/pages.yml` will deploy automatically on every push to `main`), **or** choose **Deploy from a branch** (`main` / `/ (root)`).
3. Visit `https://<your-username>.github.io/<your-repo>/` once before going offline—the Service Worker caches all files automatically for offline play.
