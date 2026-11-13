# Leicester → Nottingham — FPV Drive & Park

A browser-based 3D first-person bonnet-view driving game built with vanilla HTML5 Canvas, CSS, ES Modules, and Web Audio API.

## Objective
Drive from **Leicester City Centre** along the **A46 dual carriageway**, cross **Trent Bridge** into **Nottingham**, enter **Broadmarsh Multi-Storey Car Park**, climb two spiral concrete ramps to **Level 2**, and park cleanly inside **Bay 14**.

## Signature Mechanic
- **Progressive Brake Stiffening**: Brakes start crisp and responsive in Leicester, then gradually stiffen along the route—introducing hydraulic pedal lag and longer stopping distances as darkness and fog settle over Nottingham.

## Controls
- `W` / `↑`: Accelerate
- `S` / `↓`: Brake (hold at a stop to engage Reverse)
- `Space`: Dedicated Brake
- `A` / `D` or `←` / `→`: Steer
- `R`: Toggle Drive (`D`) / Reverse (`R`)
- `N`: Toggle Car Radio (or pick an MP3)
- `M`: Mute / Unmute Audio
- `P` / `Esc`: Pause

## Car Radio MP3
- Click **📻 Choose Radio MP3** on the start/pause screen to load any local MP3, or place a file at `radio.mp3` (or `audio/radio.mp3`) for automatic playback.

## Running Locally
```bash
python3 -m http.server 8000
```
Then open `http://localhost:8000`.
