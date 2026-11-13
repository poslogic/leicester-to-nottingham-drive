// Custom 3D FPV Perspective Renderer on HTML5 Canvas

export class Renderer3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 1280;
    this.height = 720;
    this.dpr = 1;
    this.colorCache = new Map();
    this.resize();
  }

  parseRgb(color) {
    const cached = this.colorCache.get(color);
    if (cached) return cached;
    let rgb = [100, 110, 125];
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 6) {
        rgb = [
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16),
        ];
      }
    } else if (color.startsWith('hsl(')) {
      const m = color.match(/hsl\(([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%\)/);
      if (m) {
        const h = Number(m[1]) / 360;
        const s = Number(m[2]) / 100;
        const l = Number(m[3]) / 100;
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const hue2rgb = (t) => {
          let tt = t;
          if (tt < 0) tt += 1;
          if (tt > 1) tt -= 1;
          if (tt < 1 / 6) return p + (q - p) * 6 * tt;
          if (tt < 1 / 2) return q;
          if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
          return p;
        };
        rgb = [
          Math.round(hue2rgb(h + 1 / 3) * 255),
          Math.round(hue2rgb(h) * 255),
          Math.round(hue2rgb(h - 1 / 3) * 255),
        ];
      }
    }
    this.colorCache.set(color, rgb);
    return rgb;
  }

  lerpRgbArr(a, b, t) {
    const k = Math.max(0, Math.min(1, t));
    return [
      Math.round(a[0] + (b[0] - a[0]) * k),
      Math.round(a[1] + (b[1] - a[1]) * k),
      Math.round(a[2] + (b[2] - a[2]) * k),
    ];
  }

  rgbCss(rgb) {
    return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  }

  applyAtmos(color, dist, atmos, isLit = false) {
    if (atmos.inCarpark || (atmos.darkness < 0.02 && atmos.fog < 0.02)) return color;
    const base = this.parseRgb(color);
    const dim = isLit ? 1 : 1 - atmos.darkness * 0.62;
    const r0 = base[0] * dim;
    const g0 = base[1] * dim;
    const b0 = base[2] * dim;
    const fogAmt =
      atmos.fog <= 0.01
        ? 0
        : Math.max(0, Math.min(1, (dist - atmos.fogNear) / (atmos.fogFar - atmos.fogNear))) *
          Math.min(0.95, 0.25 + atmos.fog * 0.72);
    const [fr, fg, fb] = atmos.fogRgb;
    return `rgb(${Math.round(r0 + (fr - r0) * fogAmt)},${Math.round(g0 + (fg - g0) * fogAmt)},${Math.round(b0 + (fb - b0) * fogAmt)})`;
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = this.canvas.clientWidth || window.innerWidth;
    this.height = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  // Transform world point to camera space
  toCamera(wx, wy, wz, cam) {
    const dx = wx - cam.x;
    const dy = wy - cam.y;
    const dz = wz - cam.z;
    const cz = dx * cam.fx + dz * cam.fz;
    const cx = dx * cam.rx + dz * cam.rz;
    // Apply camera pitch around X axis (pitch > 0 = nose dive down under braking)
    const cosP = cam.cosPitch;
    const sinP = cam.sinPitch;
    const cy = dy * cosP + cz * sinP;
    const rz = -dy * sinP + cz * cosP;
    return { x: cx, y: cy, z: rz };
  }

  // Sutherland-Hodgman near-plane clip (z >= near)
  clipPolygonNear(pts, near = 0.5) {
    if (pts.length === 0) return [];
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const curr = pts[i];
      const prev = pts[(i + pts.length - 1) % pts.length];
      const currIn = curr.z >= near;
      const prevIn = prev.z >= near;

      if (currIn !== prevIn) {
        const t = (near - prev.z) / (curr.z - prev.z);
        out.push({
          x: prev.x + (curr.x - prev.x) * t,
          y: prev.y + (curr.y - prev.y) * t,
          z: near,
        });
      }
      if (currIn) {
        out.push(curr);
      }
    }
    return out;
  }

  project(camPt, cam) {
    const invZ = cam.focal / camPt.z;
    return {
      x: cam.halfW + camPt.x * invZ,
      y: cam.horizonY - camPt.y * invZ,
    };
  }

  drawPoly3D(worldPts, cam, fillStyle, strokeStyle = null, lineWidth = 1) {
    const camPts = worldPts.map((p) => this.toCamera(p.x, p.y, p.z, cam));
    const clipped = this.clipPolygonNear(camPts, 0.55);
    if (clipped.length < 3) return;

    const ctx = this.ctx;
    ctx.beginPath();
    for (let i = 0; i < clipped.length; i++) {
      const sp = this.project(clipped[i], cam);
      if (i === 0) ctx.moveTo(sp.x, sp.y);
      else ctx.lineTo(sp.x, sp.y);
    }
    ctx.closePath();
    if (fillStyle) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
    if (strokeStyle) {
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  render(state) {
    const ctx = this.ctx;
    const { width: w, height: h } = this;
    const { player, route, traffic, timeSec } = state;

    // Camera setup (UK right-hand drive eye position inside car looking over bonnet)
    const roadPt = route.sampleAt(player.s);
    const pitch = player.pitch || 0; // nose-dive when braking
    const roll = player.roll || 0;
    const focal = w * 0.62;

    const cam = {
      x: player.x + Math.cos(player.heading) * 0.25, // subtle RHD driver offset
      y: player.y + 1.32 - Math.max(0, pitch) * 0.2,
      z: player.z - Math.sin(player.heading) * 0.25,
      fx: Math.sin(player.heading),
      fz: Math.cos(player.heading),
      rx: Math.cos(player.heading),
      rz: -Math.sin(player.heading),
      cosPitch: Math.cos(pitch),
      sinPitch: Math.sin(pitch),
      focal,
      halfW: w * 0.5,
      horizonY: h * 0.48,
      skyHorizonY: h * 0.48 - Math.tan(pitch) * focal,
    };

    const inCarpark = roadPt.hasCeiling;
    const tripRatio = Math.max(0, Math.min(1, player.s / route.carparkStartS));
    const darkness = inCarpark ? 0.52 : Math.pow(tripRatio, 1.05) * 0.85;
    const fog = inCarpark ? 0.08 : Math.pow(tripRatio, 0.85) * 0.88;
    const fogRgb = [
      Math.round(166 - darkness * 124),
      Math.round(180 - darkness * 126),
      Math.round(196 - darkness * 124),
    ];
    const atmos = {
      inCarpark,
      darkness,
      fog,
      fogRgb,
      fogCss: `rgb(${fogRgb[0]},${fogRgb[1]},${fogRgb[2]})`,
      fogNear: 14,
      fogFar: 225 - fog * 125,
    };

    // 1. Sky / Ceiling Backdrop & Distant Horizon
    this.drawSkyAndHorizon(cam, w, h, player, roadPt, atmos);

    // 2. Collect visible track segments
    const pts = route.points;
    const segs = [];
    const lookAhead = inCarpark ? 85 : Math.min(240, Math.round(atmos.fogFar + 30));
    const lookBehind = 16;

    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (b.s < player.s - lookBehind || a.s > player.s + lookAhead) continue;

      // Filter multi-storey levels cleanly so upper/lower decks don't bleed through
      if (inCarpark && a.carparkLevel >= 0) {
        const nearAlongTrack = a.s >= player.s - 14 && a.s <= player.s + 65;
        if (!nearAlongTrack && a.carparkLevel !== roadPt.carparkLevel) continue;
      }

      const midX = (a.x + b.x) * 0.5;
      const midY = (a.y + b.y) * 0.5;
      const midZ = (a.z + b.z) * 0.5;
      const distSq = (midX - cam.x) ** 2 + (midY - cam.y) ** 2 + (midZ - cam.z) ** 2;
      segs.push({ i, a, b, distSq, dist: Math.sqrt(distSq) });
    }

    // Painter's sort far to near
    segs.sort((u, v) => v.distSq - u.distSq);

    // 3. Draw terrain, road, bridge, carpark floors/walls/ceilings
    for (const seg of segs) {
      this.drawRoadSegment(seg.i, seg.a, seg.b, cam, route, atmos, seg.dist);
    }

    // Draw Parking Bay 14 & end-wall if near Level 2
    if (player.s > route.level2AisleStartS - 20) {
      this.drawParkingBay(route, cam, timeSec);
    }

    // 4. Collect & sort 3D props + traffic vehicles
    const renderItems = [];
    const maxPropDistSq = (inCarpark ? 75 : lookAhead) ** 2;

    for (const prop of route.props) {
      if (prop.s < player.s - 12 || prop.s > player.s + (inCarpark ? 75 : lookAhead)) continue;
      if (inCarpark && prop.carparkLevel >= 0) {
        const nearAlongTrack = prop.s >= player.s - 12 && prop.s <= player.s + 65;
        if (!nearAlongTrack && prop.carparkLevel !== roadPt.carparkLevel) continue;
      }
      const dx = prop.x - cam.x;
      const dy = prop.y - cam.y;
      const dz = prop.z - cam.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq > maxPropDistSq) continue;
      renderItems.push({ kind: 'prop', prop, distSq, dist: Math.sqrt(distSq) });
    }

    for (const car of traffic) {
      if (!car.active) continue;
      const dx = car.x - cam.x;
      const dy = car.y - cam.y;
      const dz = car.z - cam.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq > 220 * 220) continue;
      renderItems.push({ kind: 'traffic', car, distSq, dist: Math.sqrt(distSq) });
    }

    renderItems.sort((u, v) => v.distSq - u.distSq);

    for (const item of renderItems) {
      if (item.kind === 'prop') {
        this.drawProp(item.prop, cam, atmos, item.dist);
      } else {
        this.drawTrafficCar(item.car, cam, atmos, item.dist);
      }
    }

    if (player.s > route.level2AisleStartS - 10) {
      this.drawParkingBeacon(route, cam);
    }

    // 5. Atmospheric fog mist & darkness vignette
    if (!inCarpark && (atmos.fog > 0.06 || atmos.darkness > 0.15)) {
      const hy = Math.max(0, Math.min(h, cam.skyHorizonY));
      if (atmos.fog > 0.06) {
        const mistTop = Math.max(0, hy - 140);
        const mist = ctx.createLinearGradient(0, mistTop, 0, hy + 120);
        const [fr, fg, fb] = atmos.fogRgb;
        const maxA = (atmos.fog * 0.48).toFixed(2);
        const midA = (atmos.fog * 0.14).toFixed(2);
        mist.addColorStop(0, `rgba(${fr},${fg},${fb},0)`);
        mist.addColorStop(0.25, `rgba(${fr},${fg},${fb},${midA})`);
        mist.addColorStop(0.55, `rgba(${fr},${fg},${fb},${maxA})`);
        mist.addColorStop(0.8, `rgba(${fr},${fg},${fb},${midA})`);
        mist.addColorStop(1, `rgba(${fr},${fg},${fb},0)`);
        ctx.fillStyle = mist;
        ctx.fillRect(0, mistTop, w, hy + 120 - mistTop);
      }
      if (atmos.darkness > 0.2) {
        const vig = ctx.createRadialGradient(w * 0.5, h * 0.62, w * 0.14, w * 0.5, h * 0.55, w * 0.78);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, `rgba(4, 7, 14, ${(atmos.darkness * 0.45).toFixed(2)})`);
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, w, h);
      }
    } else if (inCarpark) {
      const grad = ctx.createRadialGradient(w * 0.5, h * 0.58, w * 0.08, w * 0.5, h * 0.55, w * 0.72);
      grad.addColorStop(0, 'rgba(255, 250, 220, 0.05)');
      grad.addColorStop(1, 'rgba(5, 8, 14, 0.42)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    // 6. Draw the FPV Car Bonnet (ONLY the bonnet in foreground, reacting to braking/steering)
    this.drawFPVBonnet(w, h, player, pitch, roll, atmos);
  }

  drawSkyAndHorizon(cam, w, h, player, roadPt, atmos) {
    const ctx = this.ctx;
    const hy = Math.max(-h * 0.5, Math.min(h * 1.2, cam.skyHorizonY));

    if (atmos.inCarpark) {
      ctx.fillStyle = '#181d26';
      ctx.fillRect(0, 0, w, h);
      return;
    }

    // Progress-based sky shift: Leicester bright morning -> Nottingham dark misty evening
    const d = atmos.darkness;
    const f = atmos.fog;
    const skyTop = this.rgbCss(this.lerpRgbArr([37, 99, 235], [10, 16, 30], d));
    const skyMid = this.rgbCss(
      this.lerpRgbArr(this.lerpRgbArr([96, 165, 250], [24, 34, 54], d), atmos.fogRgb, f * 0.55)
    );
    const skyHor = this.rgbCss(
      this.lerpRgbArr(this.lerpRgbArr([219, 234, 254], [38, 48, 68], d), atmos.fogRgb, f * 0.85)
    );

    const skyGrad = ctx.createLinearGradient(0, 0, 0, Math.max(10, hy));
    skyGrad.addColorStop(0, skyTop);
    skyGrad.addColorStop(0.55, skyMid);
    skyGrad.addColorStop(1, skyHor);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, Math.max(0, hy + 2));

    // Distant rolling Leicestershire / Trent Valley hills fading into fog
    const hillBase = roadPt.env === 'city' ? '#475569' : '#4b6b53';
    ctx.fillStyle = this.applyAtmos(hillBase, 190, atmos);
    ctx.beginPath();
    ctx.moveTo(0, hy + 2);
    const offset = player.heading * 260;
    for (let sx = 0; sx <= w + 40; sx += 40) {
      const hill =
        roadPt.env === 'city'
          ? 12 + Math.abs(Math.sin((sx + offset) * 0.015)) * 28
          : 10 + Math.sin((sx + offset) * 0.006) * 18 + Math.cos((sx + offset) * 0.013) * 10;
      ctx.lineTo(sx, hy - hill);
    }
    ctx.lineTo(w, hy + 2);
    ctx.closePath();
    ctx.fill();

    // Ground plane below horizon
    const groundGrad = ctx.createLinearGradient(0, hy, 0, h);
    if (roadPt.env === 'bridge') {
      groundGrad.addColorStop(0, this.applyAtmos('#1e4e79', 150, atmos));
      groundGrad.addColorStop(1, this.applyAtmos('#0f2d4a', 20, atmos));
    } else if (roadPt.env === 'city' || roadPt.env === 'carpark_entry') {
      groundGrad.addColorStop(0, this.applyAtmos('#4b5563', 150, atmos));
      groundGrad.addColorStop(1, this.applyAtmos('#374151', 20, atmos));
    } else {
      groundGrad.addColorStop(0, this.applyAtmos('#4c7c3e', 150, atmos));
      groundGrad.addColorStop(1, this.applyAtmos('#2f5228', 20, atmos));
    }
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, Math.max(0, hy), w, h - Math.max(0, hy));
  }

  drawRoadSegment(idx, a, b, cam, route, atmos, dist) {
    const wa = a.width * 0.5;
    const wb = b.width * 0.5;

    const aL = { x: a.x - a.rx * wa, y: a.y, z: a.z - a.rz * wa };
    const aR = { x: a.x + a.rx * wa, y: a.y, z: a.z + a.rz * wa };
    const bR = { x: b.x + b.rx * wb, y: b.y, z: b.z + b.rz * wb };
    const bL = { x: b.x - b.rx * wb, y: b.y, z: b.z - b.rz * wb };

    // Bridge river water flanking road
    if (a.env === 'bridge') {
      const riverW = 55;
      this.drawPoly3D(
        [
          { x: a.x - a.rx * riverW, y: a.y - 3.5, z: a.z - a.rz * riverW },
          { x: a.x + a.rx * riverW, y: a.y - 3.5, z: a.z + a.rz * riverW },
          { x: b.x + b.rx * riverW, y: b.y - 3.5, z: b.z + b.rz * riverW },
          { x: b.x - b.rx * riverW, y: b.y - 3.5, z: b.z - b.rz * riverW },
        ],
        cam,
        this.applyAtmos(idx % 2 === 0 ? '#1d5d8f' : '#21689e', dist, atmos)
      );
    }

    // Shoulders / Pavement / Concrete curbs
    const shoulder = a.hasCeiling ? 0.5 : 1.8;
    const shoulderBase = a.hasCeiling
      ? '#4b5563'
      : a.env === 'city' || a.env === 'bridge'
        ? '#9ca3af'
        : '#57534e';
    const shoulderColor = this.applyAtmos(shoulderBase, dist, atmos);

    this.drawPoly3D(
      [
        { x: a.x - a.rx * (wa + shoulder), y: a.y + 0.04, z: a.z - a.rz * (wa + shoulder) },
        aL,
        bL,
        { x: b.x - b.rx * (wb + shoulder), y: b.y + 0.04, z: b.z - b.rz * (wb + shoulder) },
      ],
      cam,
      shoulderColor
    );
    this.drawPoly3D(
      [
        aR,
        { x: a.x + a.rx * (wa + shoulder), y: a.y + 0.04, z: a.z + a.rz * (wa + shoulder) },
        { x: b.x + b.rx * (wb + shoulder), y: b.y + 0.04, z: b.z + b.rz * (wb + shoulder) },
        bR,
      ],
      cam,
      shoulderColor
    );

    // Main asphalt / concrete surface
    let roadBase;
    if (a.hasCeiling) {
      roadBase = idx % 2 === 0 ? '#374151' : '#323b49';
    } else if (a.env === 'highway') {
      roadBase = idx % 2 === 0 ? '#272c35' : '#222730';
    } else {
      roadBase = idx % 2 === 0 ? '#2f3540' : '#2a303a';
    }
    this.drawPoly3D([aL, aR, bR, bL], cam, this.applyAtmos(roadBase, dist, atmos));

    // Bridge side parapets
    if (a.env === 'bridge') {
      const railH = 1.15;
      const railCol = this.applyAtmos('#94a3b8', dist, atmos);
      const railEdge = this.applyAtmos('#475569', dist, atmos);
      this.drawPoly3D(
        [aL, bL, { ...bL, y: bL.y + railH }, { ...aL, y: aL.y + railH }],
        cam,
        railCol,
        railEdge
      );
      this.drawPoly3D(
        [aR, bR, { ...bR, y: bR.y + railH }, { ...aR, y: aR.y + railH }],
        cam,
        railCol,
        railEdge
      );
    }

    // Road markings
    if (!a.hasCeiling) {
      const whiteLine = this.applyAtmos('#e5e7eb', dist, atmos);
      const dashLine = this.applyAtmos('#f8fafc', dist, atmos);
      const amberLine = this.applyAtmos('#fbbf24', dist, atmos);
      const greenMedian = this.applyAtmos('#166534', dist, atmos);

      // Edge white lines
      this.drawStripe(a, b, -wa + 0.25, 0.14, whiteLine, cam);
      this.drawStripe(a, b, wa - 0.25, 0.14, whiteLine, cam);

      if (a.dualCarriageway) {
        // Central reservation divider
        this.drawStripe(a, b, 0, 0.7, greenMedian, cam);
        this.drawStripe(a, b, -0.45, 0.14, amberLine, cam);
        this.drawStripe(a, b, 0.45, 0.14, amberLine, cam);
        // Dashed lane lines on northbound left half & southbound right half
        if (idx % 2 === 0) {
          this.drawStripe(a, b, -wa * 0.5, 0.15, dashLine, cam);
          this.drawStripe(a, b, wa * 0.5, 0.15, dashLine, cam);
        }
      } else {
        // Center dashed line
        if (idx % 2 === 0) {
          this.drawStripe(a, b, 0, 0.15, dashLine, cam);
        }
      }

      // Stop lines at traffic lights
      for (const tl of route.trafficLights) {
        if (a.s <= tl.s - 2 && b.s >= tl.s - 2) {
          this.drawPoly3D(
            [
              { x: a.x - a.rx * (wa - 0.3), y: a.y + 0.03, z: a.z - a.rz * (wa - 0.3) },
              { x: a.x - a.rx * 0.2, y: a.y + 0.03, z: a.z - a.rz * 0.2 },
              { x: b.x - b.rx * 0.2, y: b.y + 0.03, z: b.z - b.rz * 0.2 },
              { x: b.x - b.rx * (wb - 0.3), y: b.y + 0.03, z: b.z - b.rz * (wb - 0.3) },
            ],
            cam,
            this.applyAtmos(tl.state === 'red' ? '#f8fafc' : '#e2e8f0', dist, atmos)
          );
        }
      }
    } else {
      // Multi-storey carpark walls, yellow bay lines & concrete ceiling
      const ch = a.ceilingHeight || 3.4;
      const wallColL = idx % 2 === 0 ? '#2b323d' : '#252b35';
      const wallColR = idx % 2 === 0 ? '#2d3440' : '#262d38';

      // Left wall
      this.drawPoly3D(
        [aL, bL, { ...bL, y: bL.y + ch }, { ...aL, y: aL.y + ch }],
        cam,
        wallColL
      );
      // Right wall
      this.drawPoly3D(
        [aR, bR, { ...bR, y: bR.y + ch }, { ...aR, y: aR.y + ch }],
        cam,
        wallColR
      );
      // Concrete ceiling slab
      this.drawPoly3D(
        [
          { ...aL, y: aL.y + ch },
          { ...aR, y: aR.y + ch },
          { ...bR, y: bR.y + ch },
          { ...bL, y: bL.y + ch },
        ],
        cam,
        idx % 2 === 0 ? '#1f252e' : '#1b2028'
      );

      // Yellow safety curb stripe along walls & center guidance dashes
      this.drawStripe(a, b, -wa + 0.3, 0.14, '#f59e0b', cam);
      this.drawStripe(a, b, wa - 0.3, 0.14, '#f59e0b', cam);
      if (idx % 2 === 0) {
        this.drawStripe(a, b, 0, 0.14, '#fbbf24', cam);
      }
    }
  }

  drawStripe(a, b, offset, halfW, color, cam) {
    const hw = halfW * 0.5;
    this.drawPoly3D(
      [
        { x: a.x + a.rx * (offset - hw), y: a.y + 0.025, z: a.z + a.rz * (offset - hw) },
        { x: a.x + a.rx * (offset + hw), y: a.y + 0.025, z: a.z + a.rz * (offset + hw) },
        { x: b.x + b.rx * (offset + hw), y: b.y + 0.025, z: b.z + b.rz * (offset + hw) },
        { x: b.x + b.rx * (offset - hw), y: b.y + 0.025, z: b.z + b.rz * (offset - hw) },
      ],
      cam,
      color
    );
  }

  drawParkingBay(route, cam, timeSec) {
    const bay = route.parkingBay;
    const hw = bay.width * 0.5;
    const hl = bay.length * 0.5;

    const corners = [
      { x: bay.x - bay.rx * hw - bay.tx * hl, y: bay.y + 0.04, z: bay.z - bay.rz * hw - bay.tz * hl },
      { x: bay.x + bay.rx * hw - bay.tx * hl, y: bay.y + 0.04, z: bay.z + bay.rz * hw - bay.tz * hl },
      { x: bay.x + bay.rx * hw + bay.tx * hl, y: bay.y + 0.04, z: bay.z + bay.rz * hw + bay.tz * hl },
      { x: bay.x - bay.rx * hw + bay.tx * hl, y: bay.y + 0.04, z: bay.z - bay.rz * hw + bay.tz * hl },
    ];

    const pulse = 0.22 + 0.12 * Math.sin(timeSec * 4.5);
    this.drawPoly3D(corners, cam, `rgba(34, 197, 94, ${pulse})`, '#22c55e', 3);

    // Wheel-stop concrete curb at front of bay
    const stopZ = hl - 0.55;
    const sL = { x: bay.x - bay.rx * (hw - 0.35) + bay.tx * stopZ, y: bay.y, z: bay.z - bay.rz * (hw - 0.35) + bay.tz * stopZ };
    const sR = { x: bay.x + bay.rx * (hw - 0.35) + bay.tx * stopZ, y: bay.y, z: bay.z + bay.rz * (hw - 0.35) + bay.tz * stopZ };
    this.drawPoly3D(
      [sL, sR, { ...sR, y: bay.y + 0.18 }, { ...sL, y: bay.y + 0.18 }],
      cam,
      '#facc15',
      '#111827',
      1.5
    );

    // End wall behind bay 14
    const endPt = route.sampleAt(route.totalLength - 1);
    const ew = endPt.width * 0.5;
    const eL = { x: endPt.x - endPt.rx * ew, y: endPt.y, z: endPt.z - endPt.rz * ew };
    const eR = { x: endPt.x + endPt.rx * ew, y: endPt.y, z: endPt.z + endPt.rz * ew };
    this.drawPoly3D(
      [eL, eR, { ...eR, y: endPt.y + 3.4 }, { ...eL, y: endPt.y + 3.4 }],
      cam,
      '#242a34',
      '#111827'
    );
  }

  drawParkingBeacon(route, cam) {
    const bay = route.parkingBay;
    if (Math.abs(cam.y - bay.y) > 4.2) return;
    const camCenter = this.toCamera(bay.x, bay.y + 2.45, bay.z, cam);
    if (camCenter.z > 1.2) {
      const p = this.project(camCenter, cam);
      const scale = Math.max(0.35, Math.min(1.15, (cam.focal / camCenter.z) * 0.028));
      const ctx = this.ctx;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(scale, scale);
      ctx.fillStyle = '#065f46';
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 3;
      ctx.fillRect(-52, -20, 104, 40);
      ctx.strokeRect(-52, -20, 104, 40);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('BAY 14', 0, 0);
      ctx.restore();
    }
  }

  drawProp(prop, cam, atmos, dist) {
    const camPt = this.toCamera(prop.x, prop.y, prop.z, cam);
    if (camPt.z < 0.8) return;
    const sp = this.project(camPt, cam);
    const pxPerM = cam.focal / camPt.z;
    const ctx = this.ctx;

    switch (prop.type) {
      case 'tree': {
        const s = prop.scale || 1;
        const trunkW = Math.max(2, 0.38 * pxPerM * s);
        const trunkH = 2.6 * pxPerM * s;
        ctx.fillStyle = this.applyAtmos('#4a3525', dist, atmos);
        ctx.fillRect(sp.x - trunkW * 0.5, sp.y - trunkH, trunkW, trunkH);

        const crownR = 1.9 * pxPerM * s;
        ctx.fillStyle = this.applyAtmos('#2d6a36', dist, atmos);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y - trunkH - crownR * 0.55, crownR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = this.applyAtmos('#3a8444', dist, atmos);
        ctx.beginPath();
        ctx.arc(sp.x - crownR * 0.25, sp.y - trunkH - crownR * 0.75, crownR * 0.7, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'building': {
        const bw = prop.w * pxPerM;
        const bh = prop.h * pxPerM;
        ctx.fillStyle = this.applyAtmos(prop.color, dist, atmos);
        ctx.fillRect(sp.x - bw * 0.5, sp.y - bh, bw, bh);
        ctx.strokeStyle = 'rgba(0,0,0,0.28)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sp.x - bw * 0.5, sp.y - bh, bw, bh);

        // Warm lit windows glow softly as darkness rises
        if (bw > 24) {
          const winAlpha = Math.min(0.75, 0.32 + atmos.darkness * 0.45) * (1 - Math.min(0.85, atmos.fog * (dist / 160)));
          ctx.fillStyle = `rgba(253, 230, 138, ${Math.max(0.08, winAlpha).toFixed(2)})`;
          const cols = 3;
          const rows = 4;
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const wx = sp.x - bw * 0.36 + c * (bw * 0.28);
              const wy = sp.y - bh * 0.88 + r * (bh * 0.2);
              ctx.fillRect(wx, wy, bw * 0.16, bh * 0.1);
            }
          }
        }
        break;
      }

      case 'streetlight':
      case 'highwayLamp': {
        const poleH = 6.2 * pxPerM;
        const poleW = Math.max(1.5, 0.16 * pxPerM);
        ctx.fillStyle = this.applyAtmos('#64748b', dist, atmos);
        ctx.fillRect(sp.x - poleW * 0.5, sp.y - poleH, poleW, poleH);
        const arm = (prop.side ? -prop.side * 1.4 : 0) * pxPerM;
        ctx.fillRect(Math.min(sp.x, sp.x + arm), sp.y - poleH, Math.abs(arm) + poleW, Math.max(2, poleW));
        const lampX = sp.x + arm;
        const lampY = sp.y - poleH + poleW;
        const lampR = Math.max(2, 0.22 * pxPerM);
        if (atmos.darkness > 0.25 && dist < 175) {
          const glowR = Math.max(8, 1.8 * pxPerM);
          const halo = ctx.createRadialGradient(lampX, lampY, 1, lampX, lampY, glowR);
          halo.addColorStop(0, `rgba(254, 240, 138, ${(0.45 * atmos.darkness).toFixed(2)})`);
          halo.addColorStop(1, 'rgba(254, 240, 138, 0)');
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(lampX, lampY, glowR, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(lampX, lampY, lampR, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'bridgePillar': {
        const pw = Math.max(2, 0.45 * pxPerM);
        const ph = 2.2 * pxPerM;
        ctx.fillStyle = this.applyAtmos('#cbd5e1', dist, atmos);
        ctx.fillRect(sp.x - pw * 0.5, sp.y - ph, pw, ph);
        break;
      }

      case 'sign': {
        const postH = 2.6 * pxPerM;
        const postW = Math.max(2, 0.14 * pxPerM);
        ctx.fillStyle = this.applyAtmos('#94a3b8', dist, atmos);
        ctx.fillRect(sp.x - postW * 0.5, sp.y - postH, postW, postH);

        const boardW = Math.max(18, 2.8 * pxPerM);
        const lineH = Math.max(7, 0.46 * pxPerM);
        const boardH = Math.max(14, (prop.lines.length * 0.52 + 0.35) * pxPerM);
        const bx = sp.x - boardW * 0.5;
        const by = sp.y - postH - boardH;

        // Road signs are reflective in headlights when close!
        const signAtmos = dist < 48 ? { ...atmos, darkness: atmos.darkness * 0.35 } : atmos;
        ctx.fillStyle = this.applyAtmos(prop.bg, dist, signAtmos);
        ctx.fillRect(bx, by, boardW, boardH);
        ctx.strokeStyle = this.applyAtmos(prop.border || '#ffffff', dist, signAtmos);
        ctx.lineWidth = Math.max(1, 0.08 * pxPerM);
        ctx.strokeRect(bx, by, boardW, boardH);

        if (boardW > 36) {
          ctx.fillStyle = this.applyAtmos(prop.fg, dist, signAtmos);
          ctx.font = `bold ${Math.max(8, Math.round(lineH * 0.78))}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          prop.lines.forEach((line, idx) => {
            const ly = by + (idx + 0.65) * (boardH / (prop.lines.length + 0.3));
            ctx.fillText(line, sp.x, ly, boardW * 0.92);
          });
        }
        break;
      }

      case 'hangingSign': {
        const boardW = Math.max(24, 3.6 * pxPerM);
        const boardH = Math.max(12, 1.15 * pxPerM);
        const bx = sp.x - boardW * 0.5;
        const by = sp.y;
        ctx.fillStyle = prop.bg;
        ctx.fillRect(bx, by, boardW, boardH);
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = Math.max(1, 0.06 * pxPerM);
        ctx.strokeRect(bx, by, boardW, boardH);

        if (boardW > 42) {
          ctx.fillStyle = prop.fg;
          ctx.font = `bold ${Math.max(8, Math.round(boardH * 0.28))}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          prop.lines.forEach((line, idx) => {
            ctx.fillText(line, sp.x, by + (idx + 0.6) * (boardH * 0.45), boardW * 0.92);
          });
        }
        break;
      }

      case 'trafficLight': {
        const tl = prop.lightRef;
        const postH = 3.8 * pxPerM;
        const postW = Math.max(2, 0.16 * pxPerM);
        ctx.fillStyle = this.applyAtmos('#334155', dist, atmos);
        ctx.fillRect(sp.x - postW * 0.5, sp.y - postH, postW, postH);

        const boxW = Math.max(6, 0.68 * pxPerM);
        const boxH = Math.max(14, 1.75 * pxPerM);
        const bx = sp.x - boxW * 0.5;
        const by = sp.y - postH - boxH;

        ctx.fillStyle = this.applyAtmos('#111827', dist, atmos);
        ctx.fillRect(bx, by, boxW, boxH);
        ctx.strokeStyle = this.applyAtmos('#f8fafc', dist, atmos);
        ctx.lineWidth = Math.max(1, 0.05 * pxPerM);
        ctx.strokeRect(bx, by, boxW, boxH);

        const r = Math.max(2, boxW * 0.3);
        const colors = [
          tl.state === 'red' ? '#ef4444' : '#450a0a',
          tl.state === 'amber' ? '#f59e0b' : '#451a03',
          tl.state === 'green' ? '#22c55e' : '#052e16',
        ];
        colors.forEach((col, i) => {
          const ly = by + boxH * (0.2 + i * 0.3);
          const isActive =
            (i === 0 && tl.state === 'red') ||
            (i === 1 && tl.state === 'amber') ||
            (i === 2 && tl.state === 'green');
          if (isActive && (atmos.darkness > 0.2 || atmos.fog > 0.2)) {
            ctx.fillStyle =
              i === 0 ? 'rgba(239,68,68,0.35)' : i === 1 ? 'rgba(245,158,11,0.35)' : 'rgba(34,197,94,0.35)';
            ctx.beginPath();
            ctx.arc(sp.x, ly, r * 2.4, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(sp.x, ly, r, 0, Math.PI * 2);
          ctx.fill();
        });
        break;
      }

      case 'barrier': {
        const bRef = prop.barrierRef;
        const boxW = Math.max(4, 0.55 * pxPerM);
        const boxH = Math.max(8, 1.15 * pxPerM);
        ctx.fillStyle = this.applyAtmos('#f59e0b', dist, atmos);
        ctx.fillRect(sp.x - boxW * 0.5, sp.y - boxH, boxW, boxH);

        // Boom arm rotating open
        const armLen = 4.2 * pxPerM;
        const angle = -bRef.openAmount * (Math.PI * 0.44); // 0 = horizontal, negative = up
        ctx.save();
        ctx.translate(sp.x, sp.y - boxH * 0.8);
        ctx.rotate(angle);
        for (let k = 0; k < 6; k++) {
          ctx.fillStyle = k % 2 === 0 ? '#ef4444' : '#ffffff';
          ctx.fillRect(k * (armLen / 6), -Math.max(2, 0.08 * pxPerM), armLen / 6, Math.max(3, 0.16 * pxPerM));
        }
        ctx.restore();
        break;
      }

      case 'pillar': {
        const pw = Math.max(3, 0.65 * pxPerM);
        const ph = (prop.h || 3.4) * pxPerM;
        ctx.fillStyle = '#64748b';
        ctx.fillRect(sp.x - pw * 0.5, sp.y - ph, pw, ph);
        // Yellow/black hazard stripe band
        ctx.fillStyle = '#facc15';
        ctx.fillRect(sp.x - pw * 0.5, sp.y - ph * 0.35, pw, ph * 0.12);
        break;
      }

      case 'ceilingLight': {
        const lw = Math.max(6, 1.6 * pxPerM);
        const lh = Math.max(2, 0.14 * pxPerM);
        ctx.fillStyle = '#e0f2fe';
        ctx.fillRect(sp.x - lw * 0.5, sp.y, lw, lh);
        break;
      }

      case 'parkedCar': {
        this.drawCarBox(sp.x, sp.y, pxPerM, prop.color, false, false, false, atmos, dist);
        break;
      }
    }
  }

  drawTrafficCar(car, cam, atmos, dist) {
    const camPt = this.toCamera(car.x, car.y, car.z, cam);
    if (camPt.z < 0.8) return;
    const sp = this.project(camPt, cam);
    const pxPerM = cam.focal / camPt.z;
    this.drawCarBox(sp.x, sp.y, pxPerM, car.color, car.braking, car.isLorry, car.oncoming, atmos, dist);
  }

  drawCarBox(sx, sy, pxPerM, color, braking, isLorry = false, oncoming = false, atmos = null, dist = 0) {
    const ctx = this.ctx;
    const w = (isLorry ? 2.45 : 1.85) * pxPerM;
    const h = (isLorry ? 3.2 : 1.45) * pxPerM;
    if (w < 2) return;

    const left = sx - w * 0.5;
    const top = sy - h;
    const bodyCol = atmos ? this.applyAtmos(color, dist, atmos) : color;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(left - w * 0.05, sy - h * 0.06, w * 1.1, h * 0.12);

    // Lower body
    ctx.fillStyle = bodyCol;
    ctx.fillRect(left, top + h * (isLorry ? 0.05 : 0.35), w, h * (isLorry ? 0.88 : 0.58));

    // Cabin / rear window
    if (!isLorry) {
      ctx.fillStyle = bodyCol;
      ctx.fillRect(left + w * 0.12, top, w * 0.76, h * 0.42);
      ctx.fillStyle = atmos ? this.applyAtmos('#1e293b', dist, atmos) : '#1e293b';
      ctx.fillRect(left + w * 0.18, top + h * 0.07, w * 0.64, h * 0.28);
    } else {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(left, top + h * 0.05, w, h * 0.88);
    }

    // Wheels
    ctx.fillStyle = atmos ? this.applyAtmos('#0f172a', dist, atmos) : '#0f172a';
    ctx.fillRect(left + w * 0.04, sy - h * 0.16, w * 0.18, h * 0.16);
    ctx.fillRect(left + w * 0.78, sy - h * 0.16, w * 0.18, h * 0.16);

    // Lights (self-luminous headlights & red brake/tail lights cut through dark & fog!)
    const lampW = Math.max(2, w * 0.16);
    const lampH = Math.max(2, h * 0.11);
    const lampY = sy - h * 0.42;
    const isDarkOrFoggy = atmos && (atmos.darkness > 0.2 || atmos.fog > 0.2);

    if (oncoming) {
      if (isDarkOrFoggy) {
        const glowR = Math.max(8, lampW * 3.4);
        const ly = lampY + lampH * 0.5;
        for (const lx of [left + w * 0.16, left + w * 0.84]) {
          const halo = ctx.createRadialGradient(lx, ly, 1, lx, ly, glowR);
          halo.addColorStop(0, 'rgba(254, 249, 195, 0.52)');
          halo.addColorStop(1, 'rgba(254, 249, 195, 0)');
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(lx, ly, glowR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.fillStyle = '#fef9c3';
      ctx.fillRect(left + w * 0.08, lampY, lampW, lampH);
      ctx.fillRect(left + w * 0.76, lampY, lampW, lampH);
    } else {
      ctx.fillStyle = braking ? '#ff2a2a' : isDarkOrFoggy ? '#ef4444' : '#991b1b';
      ctx.fillRect(left + w * 0.08, lampY, lampW, lampH);
      ctx.fillRect(left + w * 0.76, lampY, lampW, lampH);
      if ((braking || isDarkOrFoggy) && w > 8) {
        const glowAlpha = braking ? 0.55 : 0.3;
        const glowR = Math.max(5, lampW * 1.9);
        const ly = lampY + lampH * 0.5;
        for (const lx of [left + w * 0.16, left + w * 0.84]) {
          const halo = ctx.createRadialGradient(lx, ly, 1, lx, ly, glowR);
          halo.addColorStop(0, `rgba(255, 45, 45, ${glowAlpha})`);
          halo.addColorStop(1, 'rgba(255, 45, 45, 0)');
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(lx, ly, glowR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // FPV Bonnet: ONLY the sculpted car bonnet visible at the bottom of the screen
  drawFPVBonnet(w, h, player, pitch, roll, atmos) {
    const ctx = this.ctx;
    const inCarpark = atmos.inCarpark;

    // Suspension response: bonnet dips down when braking, lifts slightly when accelerating
    const dipY = pitch * h * 0.45;
    const shiftX = -roll * w * 0.18;
    const bonnetTopY = h * 0.76 + dipY;
    const bonnetEdgeW = w * 0.74;
    const centerX = w * 0.5 + shiftX;

    ctx.save();

    // Headlight projection beams cutting into darkness / fog / carpark
    const beamStrength = inCarpark ? 0.18 : Math.max(0, (atmos.darkness - 0.18) * 0.34);
    if (beamStrength > 0.02) {
      const beam = ctx.createRadialGradient(centerX, bonnetTopY, 20, centerX, h * 0.54, w * 0.46);
      beam.addColorStop(0, `rgba(254, 249, 195, ${beamStrength.toFixed(2)})`);
      beam.addColorStop(1, 'rgba(254, 249, 195, 0)');
      ctx.fillStyle = beam;
      ctx.fillRect(0, h * 0.34, w, h * 0.66);
    }

    // Main sculpted bonnet surface (subtly dims in dusk/darkness)
    const dim = inCarpark ? 0.85 : 1 - atmos.darkness * 0.45;
    const grad = ctx.createLinearGradient(0, bonnetTopY, 0, h);
    grad.addColorStop(0, `rgb(${Math.round(30 * dim)},${Math.round(77 * dim)},${Math.round(59 * dim)})`);
    grad.addColorStop(0.28, `rgb(${Math.round(19 * dim)},${Math.round(58 * dim)},${Math.round(44 * dim)})`);
    grad.addColorStop(1, `rgb(${Math.round(10 * dim)},${Math.round(31 * dim)},${Math.round(24 * dim)})`);

    ctx.beginPath();
    ctx.moveTo(centerX - bonnetEdgeW * 0.68, h + 20);
    ctx.quadraticCurveTo(
      centerX - bonnetEdgeW * 0.42,
      bonnetTopY + 12,
      centerX - bonnetEdgeW * 0.3,
      bonnetTopY
    );
    ctx.quadraticCurveTo(centerX, bonnetTopY - 12, centerX + bonnetEdgeW * 0.3, bonnetTopY);
    ctx.quadraticCurveTo(
      centerX + bonnetEdgeW * 0.42,
      bonnetTopY + 12,
      centerX + bonnetEdgeW * 0.68,
      h + 20
    );
    ctx.closePath();

    ctx.fillStyle = grad;
    ctx.fill();

    // Crisp leading lip highlight of the bonnet
    ctx.strokeStyle = 'rgba(187, 247, 208, 0.32)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - bonnetEdgeW * 0.3, bonnetTopY);
    ctx.quadraticCurveTo(centerX, bonnetTopY - 12, centerX + bonnetEdgeW * 0.3, bonnetTopY);
    ctx.stroke();

    // Subtle sculpted bonnet power-bulge creases
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.11)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - bonnetEdgeW * 0.22, bonnetTopY + 6);
    ctx.lineTo(centerX - bonnetEdgeW * 0.34, h);
    ctx.moveTo(centerX + bonnetEdgeW * 0.22, bonnetTopY + 6);
    ctx.lineTo(centerX + bonnetEdgeW * 0.34, h);
    ctx.stroke();

    // Subtle specular reflection strip across bonnet
    const spec = ctx.createLinearGradient(centerX - 180, bonnetTopY, centerX + 180, h);
    spec.addColorStop(0, 'rgba(255,255,255,0)');
    spec.addColorStop(0.5, inCarpark ? 'rgba(224,242,254,0.08)' : 'rgba(255,255,255,0.09)');
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = spec;
    ctx.fill();

    // Dark windscreen cowl lip at very bottom edge
    ctx.fillStyle = '#090d14';
    ctx.fillRect(0, h - 14, w, 16);

    ctx.restore();
  }
}
