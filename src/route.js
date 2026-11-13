// Route generator: Leicester -> A46 -> Trent Bridge -> Nottingham -> Broadmarsh Multi-Storey Car Park

export function buildRoute() {
  const points = [];
  const props = []; // signs, trees, buildings, streetlights, pillars, parkedCars, lights, ceilingLights
  const trafficLights = [];

  let x = 0;
  let y = 0;
  let z = 0;
  let heading = 0; // 0 = +z, +PI/2 = +x
  let s = 0;

  function addSegment({
    length,
    step = 8,
    turnAngle = 0, // total radians to turn across this segment (+ = right, - = left)
    deltaY = 0,
    width = 10,
    lanes = 2,
    speedLimit = 30,
    env = 'city',
    zone = 'Leicester',
    hasCeiling = false,
    ceilingHeight = 3.5,
    dualCarriageway = false,
    carparkLevel = -1,
  }) {
    const count = Math.max(2, Math.round(length / step));
    const ds = length / count;
    const dHeading = turnAngle / count;
    const dy = deltaY / count;

    for (let i = 0; i < count; i++) {
      const t = i / count;
      // Smooth S-curve for elevation
      const smoothY = dy;
      points.push({
        x,
        y,
        z,
        heading,
        s,
        width,
        lanes,
        speedLimit,
        env,
        zone,
        hasCeiling,
        ceilingHeight,
        dualCarriageway,
        carparkLevel,
        tx: Math.sin(heading),
        ty: dy / ds,
        tz: Math.cos(heading),
        rx: Math.cos(heading),
        rz: -Math.sin(heading),
      });

      heading += dHeading * 0.5;
      x += Math.sin(heading) * ds;
      z += Math.cos(heading) * ds;
      y += smoothY;
      heading += dHeading * 0.5;
      s += ds;
    }
  }

  // 1. LEICESTER CITY DEPARTURE (0m - 740m)
  addSegment({ length: 240, step: 8, width: 10, lanes: 2, speedLimit: 30, env: 'city', zone: 'Leicester City Centre' });
  addSegment({ length: 180, step: 8, turnAngle: 0.28, width: 10, lanes: 2, speedLimit: 30, env: 'city', zone: 'St Margaret’s Way, Leicester' });
  addSegment({ length: 200, step: 8, turnAngle: -0.22, deltaY: 1.5, width: 11, lanes: 2, speedLimit: 40, env: 'city', zone: 'Abbey Lane, Leicester' });
  addSegment({ length: 140, step: 8, turnAngle: 0.14, deltaY: 2.0, width: 13.5, lanes: 4, speedLimit: 40, env: 'city', zone: 'Joining A46 North' });

  // 2. A46 DUAL CARRIAGEWAY & LEICESTERSHIRE (760m - 2960m)
  addSegment({ length: 380, step: 10, turnAngle: -0.35, deltaY: 3.5, width: 15, lanes: 4, speedLimit: 60, env: 'highway', zone: 'A46 Northbound', dualCarriageway: true });
  addSegment({ length: 420, step: 10, turnAngle: 0.45, deltaY: -4.0, width: 15, lanes: 4, speedLimit: 70, env: 'highway', zone: 'A46 — Leicestershire', dualCarriageway: true });
  addSegment({ length: 360, step: 10, turnAngle: -0.25, deltaY: 5.5, width: 15, lanes: 4, speedLimit: 70, env: 'highway', zone: 'Six Hills Ridge', dualCarriageway: true });

  // Roundabout / Junction deceleration zone
  addSegment({ length: 220, step: 8, turnAngle: 0.08, deltaY: -3.5, width: 14, lanes: 4, speedLimit: 40, env: 'highway', zone: 'Six Hills Junction', dualCarriageway: true });
  addSegment({ length: 140, step: 6, turnAngle: 0.85, width: 11, lanes: 2, speedLimit: 30, env: 'highway', zone: 'Roundabout Approach' });
  addSegment({ length: 140, step: 6, turnAngle: -0.95, width: 11, lanes: 2, speedLimit: 30, env: 'highway', zone: 'Exiting Roundabout' });

  // Second A46 fast stretch toward Nottingham
  addSegment({ length: 360, step: 10, turnAngle: 0.22, deltaY: 2.0, width: 15, lanes: 4, speedLimit: 60, env: 'highway', zone: 'A46 — Widmerpool', dualCarriageway: true });
  addSegment({ length: 320, step: 10, turnAngle: -0.30, deltaY: -4.5, width: 15, lanes: 4, speedLimit: 50, env: 'highway', zone: 'Approaching Nottingham', dualCarriageway: true });

  // 3. WEST BRIDGFORD, TRENT BRIDGE & NOTTINGHAM CITY (3100m - 4200m)
  addSegment({ length: 220, step: 8, turnAngle: 0.16, deltaY: -1.5, width: 11.5, lanes: 2, speedLimit: 40, env: 'city', zone: 'West Bridgford' });
  addSegment({ length: 240, step: 8, turnAngle: 0.0, deltaY: 1.5, width: 11, lanes: 2, speedLimit: 30, env: 'bridge', zone: 'Trent Bridge — River Trent' });
  addSegment({ length: 260, step: 8, turnAngle: -0.24, deltaY: -1.5, width: 10.5, lanes: 2, speedLimit: 30, env: 'city', zone: 'London Road, Nottingham' });
  addSegment({ length: 260, step: 8, turnAngle: 0.18, deltaY: 0.0, width: 10, lanes: 2, speedLimit: 30, env: 'city', zone: 'Nottingham City Centre' });
  addSegment({ length: 130, step: 6, turnAngle: 0.0, deltaY: 0.0, width: 8.5, lanes: 2, speedLimit: 15, env: 'carpark_entry', zone: 'Car Park Approach' });

  const carparkStartS = s;

  // 4. BROADMARSH MULTI-STOREY CAR PARK
  // Level 0 (Ground) Entry Aisle (y = 0)
  addSegment({ length: 60, step: 4, turnAngle: 0, deltaY: 0, width: 8.6, lanes: 2, speedLimit: 10, env: 'carpark', zone: 'Multi-Storey — Ground Level', hasCeiling: true, ceilingHeight: 3.4, carparkLevel: 0 });
  // Smooth Left 90 deg turn onto Ramp 1
  addSegment({ length: 24, step: 3, turnAngle: -Math.PI / 2, deltaY: 0.3, width: 8.6, lanes: 2, speedLimit: 10, env: 'carpark', zone: 'Multi-Storey — Ramp to L1', hasCeiling: true, ceilingHeight: 3.4, carparkLevel: 0 });
  // Ramp 1 climb (0.3 -> 4.2m)
  addSegment({ length: 44, step: 4, turnAngle: 0, deltaY: 3.9, width: 8.2, lanes: 2, speedLimit: 10, env: 'carpark', zone: 'Multi-Storey — Climbing to Level 1', hasCeiling: true, ceilingHeight: 3.4, carparkLevel: 0 });

  // Level 1 (y = 4.2m): Turn Left 90 deg onto Level 1 deck
  addSegment({ length: 24, step: 3, turnAngle: -Math.PI / 2, deltaY: 0, width: 8.6, lanes: 2, speedLimit: 10, env: 'carpark', zone: 'Multi-Storey — Level 1', hasCeiling: true, ceilingHeight: 3.4, carparkLevel: 1 });
  addSegment({ length: 56, step: 4, turnAngle: 0, deltaY: 0, width: 8.6, lanes: 2, speedLimit: 10, env: 'carpark', zone: 'Multi-Storey — Level 1', hasCeiling: true, ceilingHeight: 3.4, carparkLevel: 1 });

  // Turn Left 90 deg onto Ramp 2
  addSegment({ length: 24, step: 3, turnAngle: -Math.PI / 2, deltaY: 0.3, width: 8.6, lanes: 2, speedLimit: 10, env: 'carpark', zone: 'Multi-Storey — Ramp to L2', hasCeiling: true, ceilingHeight: 3.4, carparkLevel: 1 });
  // Ramp 2 climb (4.5 -> 8.4m)
  addSegment({ length: 44, step: 4, turnAngle: 0, deltaY: 3.9, width: 8.2, lanes: 2, speedLimit: 10, env: 'carpark', zone: 'Multi-Storey — Climbing to Level 2', hasCeiling: true, ceilingHeight: 3.4, carparkLevel: 1 });

  // Level 2 (y = 8.4m): Turn Left 90 deg onto final parking deck
  addSegment({ length: 24, step: 3, turnAngle: -Math.PI / 2, deltaY: 0, width: 8.6, lanes: 2, speedLimit: 10, env: 'carpark', zone: 'Multi-Storey — Level 2 (Find Bay 14)', hasCeiling: true, ceilingHeight: 3.4, carparkLevel: 2 });
  const level2AisleStartS = s;
  addSegment({ length: 68, step: 4, turnAngle: 0, deltaY: 0, width: 9.2, lanes: 2, speedLimit: 5, env: 'carpark', zone: 'Multi-Storey — Level 2 (Bay 14 Ahead)', hasCeiling: true, ceilingHeight: 3.4, carparkLevel: 2 });

  // Final point node
  points.push({
    x,
    y,
    z,
    heading,
    s,
    width: 9.2,
    lanes: 2,
    speedLimit: 5,
    env: 'carpark',
    zone: 'Multi-Storey — Level 2 (Bay 14)',
    hasCeiling: true,
    ceilingHeight: 3.4,
    carparkLevel: 2,
    tx: Math.sin(heading),
    ty: 0,
    tz: Math.cos(heading),
    rx: Math.cos(heading),
    rz: -Math.sin(heading),
  });

  const totalLength = s;

  // Helper to sample a point at distance `targetS`
  function sampleAt(targetS) {
    const clamped = Math.max(0, Math.min(totalLength, targetS));
    let lo = 0;
    let hi = points.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (points[mid].s <= clamped) lo = mid;
      else hi = mid;
    }
    const a = points[lo];
    const b = points[hi];
    const span = Math.max(0.0001, b.s - a.s);
    const t = (clamped - a.s) / span;
    const headingInterp = a.heading + (b.heading - a.heading) * t;
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
      heading: headingInterp,
      s: clamped,
      width: a.width + (b.width - a.width) * t,
      lanes: a.lanes,
      speedLimit: a.speedLimit,
      env: a.env,
      zone: a.zone,
      hasCeiling: a.hasCeiling,
      ceilingHeight: a.ceilingHeight,
      dualCarriageway: a.dualCarriageway,
      carparkLevel: a.carparkLevel,
      tx: Math.sin(headingInterp),
      ty: a.ty + (b.ty - a.ty) * t,
      tz: Math.cos(headingInterp),
      rx: Math.cos(headingInterp),
      rz: -Math.sin(headingInterp),
    };
  }

  // Helper to place a prop relative to track distance `dist` and lateral offset `lat` (m)
  function placeProp(dist, lat, prop) {
    const pt = sampleAt(dist);
    props.push({
      ...prop,
      s: dist,
      x: pt.x + pt.rx * lat,
      y: pt.y + (prop.yOffset || 0),
      z: pt.z + pt.rz * lat,
      heading: pt.heading,
      tx: pt.tx,
      tz: pt.tz,
      rx: pt.rx,
      rz: pt.rz,
      carparkLevel: pt.carparkLevel,
    });
  }

  // UK Road Signs along route
  const signs = [
    { dist: 55, lat: -6.2, bg: '#006b54', fg: '#ffffff', lines: ['LEICESTER', 'A46  Nottingham  26'] },
    { dist: 510, lat: -6.5, bg: '#006b54', fg: '#ffffff', lines: ['A46 NORTH', 'Loughborough 8', 'Nottingham  22'] },
    { dist: 720, lat: -8.0, bg: '#ffffff', fg: '#111111', border: '#dc2626', lines: ['60', 'NATIONAL'] },
    { dist: 1180, lat: -8.8, bg: '#006b54', fg: '#ffffff', lines: ['SIX HILLS  3', 'NOTTINGHAM 15'] },
    { dist: 1840, lat: -8.5, bg: '#f5c518', fg: '#111111', lines: ['ROUNDABOUT', 'REDUCE SPEED', '40 MPH'] },
    { dist: 2350, lat: -8.8, bg: '#006b54', fg: '#ffffff', lines: ['A46 NORTH', 'NOTTINGHAM  9', 'TRENT BRIDGE 7'] },
    { dist: 2820, lat: -8.5, bg: '#ffffff', fg: '#111111', border: '#dc2626', lines: ['50', 'AHEAD'] },
    { dist: 3120, lat: -6.8, bg: '#006b54', fg: '#ffffff', lines: ['TRENT BRIDGE', 'NOTTINGHAM CITY', 'CAR PARKS ↑'] },
    { dist: 3440, lat: -6.5, bg: '#ffffff', fg: '#111111', border: '#006b54', lines: ['WELCOME TO', 'NOTTINGHAM'] },
    { dist: 3820, lat: -6.5, bg: '#1d4ed8', fg: '#ffffff', lines: ['BROADMARSH P', 'MULTI-STOREY', '300 YDS ↑'] },
    { dist: 4075, lat: -5.4, bg: '#f5c518', fg: '#111111', lines: ['CAR PARK ENTRY', 'MAX HT 2.1m', 'SPEED 10'] },
  ];

  for (const sg of signs) {
    placeProp(sg.dist, sg.lat, { type: 'sign', ...sg });
  }

  // Traffic Lights (urban intersections in Leicester & Nottingham)
  const lightSpecs = [
    { dist: 270, cycle: 14, phase: 2 },
    { dist: 600, cycle: 15, phase: 8 },
    { dist: 3560, cycle: 14, phase: 5 },
    { dist: 3960, cycle: 14, phase: 11 },
  ];

  for (const ls of lightSpecs) {
    const pt = sampleAt(ls.dist);
    const tl = {
      id: trafficLights.length,
      s: ls.dist,
      x: pt.x,
      y: pt.y,
      z: pt.z,
      heading: pt.heading,
      cycle: ls.cycle,
      phase: ls.phase,
      state: 'green', // 'green' | 'amber' | 'red'
    };
    trafficLights.push(tl);
    placeProp(ls.dist, -5.6, { type: 'trafficLight', lightRef: tl });
    placeProp(ls.dist, 5.6, { type: 'trafficLight', lightRef: tl });
  }

  // Roadside scenery (trees, buildings, streetlights) before car park
  for (let d = 25; d < carparkStartS - 15; d += 26) {
    const pt = sampleAt(d);
    if (pt.env === 'city') {
      // Streetlights + urban buildings
      if (Math.floor(d / 26) % 2 === 0) {
        placeProp(d, -pt.width * 0.5 - 1.2, { type: 'streetlight', side: -1 });
      } else {
        placeProp(d, pt.width * 0.5 + 1.2, { type: 'streetlight', side: 1 });
      }
      const bHue = (d * 17) % 360;
      placeProp(d, -pt.width * 0.5 - 8.5, {
        type: 'building',
        w: 9,
        d: 14,
        h: 9 + ((d * 13) % 10),
        color: d % 52 === 0 ? '#8b4c39' : `hsl(${20 + (bHue % 25)}, 22%, ${34 + (bHue % 14)}%)`,
      });
      placeProp(d, pt.width * 0.5 + 8.5, {
        type: 'building',
        w: 9,
        d: 14,
        h: 8 + ((d * 19) % 12),
        color: d % 78 === 0 ? '#7c3f34' : `hsl(${210 + (bHue % 20)}, 16%, ${32 + (bHue % 15)}%)`,
      });
    } else if (pt.env === 'highway') {
      // Trees & occasional lamp posts
      if (Math.floor(d / 26) % 2 === 0) {
        placeProp(d, -pt.width * 0.5 - 4.5 - (d % 5), { type: 'tree', scale: 0.9 + (d % 4) * 0.18 });
        placeProp(d, pt.width * 0.5 + 5.0 + (d % 4), { type: 'tree', scale: 0.85 + (d % 5) * 0.16 });
      }
      if (Math.floor(d / 52) !== Math.floor((d - 26) / 52)) {
        placeProp(d, 0, { type: 'highwayLamp' });
      }
    } else if (pt.env === 'bridge') {
      // Trent bridge stone pillars / Victorian arches
      placeProp(d, -pt.width * 0.5 - 0.6, { type: 'bridgePillar' });
      placeProp(d, pt.width * 0.5 + 0.6, { type: 'bridgePillar' });
    }
  }

  // Entry Barrier Gate at carparkStartS + 6m
  const barrierS = carparkStartS + 6;
  const barrierPt = sampleAt(barrierS);
  const barrierGate = {
    s: barrierS,
    x: barrierPt.x,
    y: barrierPt.y,
    z: barrierPt.z,
    openAmount: 0, // 0 = closed, 1 = open
  };
  placeProp(barrierS, -3.5, { type: 'barrier', barrierRef: barrierGate });

  // Car Park interior props: concrete pillars, overhead fluorescent lights, level signs, parked cars
  const carColors = ['#3b82f6', '#ef4444', '#64748b', '#e2e8f0', '#10b981', '#eab308', '#8b5cf6'];
  let carColorIdx = 0;

  for (let d = carparkStartS + 14; d < totalLength - 6; d += 10) {
    const pt = sampleAt(d);
    const inLevel2Aisle = d >= level2AisleStartS + 6;
    const isTurn = Math.abs(pt.ty) > 0.04;

    // Overhead fluorescent light strip
    placeProp(d, 0, { type: 'ceilingLight', yOffset: pt.ceilingHeight - 0.12 });

    // Concrete structural pillars along outer edges
    placeProp(d, -pt.width * 0.5 + 0.35, { type: 'pillar', h: pt.ceilingHeight });
    placeProp(d, pt.width * 0.5 - 0.35, { type: 'pillar', h: pt.ceilingHeight });

    // Add parked cars in side bays on flat straight aisles (avoid blocking target Bay 14 at the end of Level 2!)
    if (!isTurn && d > carparkStartS + 16 && d < totalLength - 18) {
      if (inLevel2Aisle && d > totalLength - 32) {
        // Leave target bay zone clear on the left! Only park on right side
        placeProp(d, 3.3, { type: 'parkedCar', color: carColors[carColorIdx++ % carColors.length] });
      } else if (Math.floor(d / 10) % 2 === 0) {
        placeProp(d, -3.2, { type: 'parkedCar', color: carColors[carColorIdx++ % carColors.length] });
        if (Math.floor(d / 10) % 4 === 0) {
          placeProp(d, 3.2, { type: 'parkedCar', color: carColors[carColorIdx++ % carColors.length] });
        }
      }
    }
  }

  // Car Park overhead directional signs
  placeProp(carparkStartS + 42, 0, {
    type: 'hangingSign',
    yOffset: 2.55,
    bg: '#111827',
    fg: '#fbbf24',
    lines: ['← RAMP TO LEVEL 1', 'BAY 14 ON LEVEL 2'],
  });
  placeProp(level2AisleStartS - 32, 0, {
    type: 'hangingSign',
    yOffset: 2.55,
    bg: '#111827',
    fg: '#38bdf8',
    lines: ['← LEVEL 2 PARKING', 'BAY 14 AHEAD'],
  });
  placeProp(level2AisleStartS + 18, 0, {
    type: 'hangingSign',
    yOffset: 2.55,
    bg: '#065f46',
    fg: '#ffffff',
    lines: ['BAY 14  EMPTY ↓', 'SLOW — USE BRAKES EARLY'],
  });

  // Define Target Parking Bay 14 at the end-left of Level 2 aisle
  // Bay is positioned along the track on the left side near the end of Level 2, facing forward!
  const bayS = totalLength - 12;
  const bayCenterPt = sampleAt(bayS);
  const bayLat = -1.6; // slightly left of center like a wide bay stall
  const parkingBay = {
    s: bayS,
    x: bayCenterPt.x + bayCenterPt.rx * bayLat,
    y: bayCenterPt.y,
    z: bayCenterPt.z + bayCenterPt.rz * bayLat,
    heading: bayCenterPt.heading,
    tx: bayCenterPt.tx,
    tz: bayCenterPt.tz,
    rx: bayCenterPt.rx,
    rz: bayCenterPt.rz,
    width: 3.1,
    length: 5.4,
    carparkLevel: 2,
  };

  // Neighbouring parked cars framing Bay 14 (on right side of bay and further back on left)
  placeProp(bayS, 2.5, { type: 'parkedCar', color: '#475569' });
  placeProp(bayS - 16, -3.1, { type: 'parkedCar', color: '#2563eb' });

  return {
    points,
    props,
    trafficLights,
    barrierGate,
    parkingBay,
    totalLength,
    carparkStartS,
    level2AisleStartS,
    sampleAt,
  };
}
