import { buildRoute } from './route.js';

const MPH_PER_MS = 2.23694;

function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class GameEngine {
  constructor(sound) {
    this.sound = sound;
    this.route = buildRoute();
    this.reset();
  }

  reset() {
    this.route = buildRoute();
    const startPt = this.route.sampleAt(8);

    this.status = 'menu'; // 'menu' | 'playing' | 'paused' | 'won' | 'lost'
    this.timeSec = 0;
    this.driveTimeSec = 0;
    this.alertTimer = 0;
    this.alertText = '';
    this.alertKind = 'warn';
    this.warnedStage = 0; // 0 = fresh, 1 = stiffening, 2 = severe

    this.player = {
      x: startPt.x - startPt.rx * 2.2, // UK left-hand lane
      y: startPt.y,
      z: startPt.z - startPt.rz * 2.2,
      heading: startPt.heading,
      speed: 0, // m/s
      s: startPt.s,
      lat: -2.2,
      gear: 'D', // 'D' | 'R'
      reverseHoldTimer: 0,
      pitch: 0,
      roll: 0,
      hull: 100,
      collisions: 0,
      redLightsRun: 0,
      brakeEfficiency: 1.0, // 1.0 (100% responsive) -> ~0.24 (stiff)
      brakeUsagePenalty: 0,
      brakeDemand: 0,
      brakeActual: 0,
      parkHoldTimer: 0,
      parkingPrecision: 0,
    };

    this.traffic = this.spawnTraffic();
    this.passedLights = new Set();
    this.collisionCooldown = 0;
  }

  spawnTraffic() {
    const cars = [];
    const colors = ['#cbd5e1', '#3b82f6', '#ef4444', '#10b981', '#eab308', '#64748b', '#f97316'];

    // Northbound traffic (same direction, UK left side)
    const nbSpecs = [
      { s: 95, laneOffset: -2.4, speed: 12.2, lorry: false },
      { s: 210, laneOffset: -2.4, speed: 12.8, lorry: false },
      { s: 360, laneOffset: -2.4, speed: 12.5, lorry: true },
      { s: 520, laneOffset: -2.4, speed: 13.5, lorry: false },
      { s: 780, laneOffset: -5.2, speed: 20.0, lorry: true },
      { s: 940, laneOffset: -2.3, speed: 24.5, lorry: false },
      { s: 1120, laneOffset: -5.2, speed: 19.0, lorry: true },
      { s: 1320, laneOffset: -2.3, speed: 25.5, lorry: false },
      { s: 1510, laneOffset: -5.2, speed: 20.5, lorry: false },
      { s: 1680, laneOffset: -2.3, speed: 23.0, lorry: false },
      { s: 1920, laneOffset: -2.3, speed: 14.0, lorry: true },
      { s: 2180, laneOffset: -5.2, speed: 20.5, lorry: true },
      { s: 2380, laneOffset: -2.3, speed: 25.0, lorry: false },
      { s: 2580, laneOffset: -5.2, speed: 21.0, lorry: false },
      { s: 2790, laneOffset: -2.3, speed: 22.0, lorry: false },
      { s: 3020, laneOffset: -2.4, speed: 14.5, lorry: true },
      { s: 3250, laneOffset: -2.4, speed: 12.5, lorry: false },
      { s: 3480, laneOffset: -2.4, speed: 12.8, lorry: false },
      { s: 3720, laneOffset: -2.4, speed: 12.0, lorry: false },
      { s: 3890, laneOffset: -2.4, speed: 12.2, lorry: false },
    ];

    nbSpecs.forEach((sp, i) => {
      const pt = this.route.sampleAt(sp.s);
      cars.push({
        id: `nb_${i}`,
        active: true,
        s: sp.s,
        laneOffset: sp.laneOffset,
        baseSpeed: sp.speed,
        speed: sp.speed,
        dir: 1,
        oncoming: false,
        isLorry: sp.lorry,
        color: sp.lorry ? '#e2e8f0' : colors[i % colors.length],
        braking: false,
        x: pt.x + pt.rx * sp.laneOffset,
        y: pt.y,
        z: pt.z + pt.rz * sp.laneOffset,
        heading: pt.heading,
      });
    });

    // Southbound oncoming traffic (right side of road!)
    const sbSpecs = [
      { s: 220, laneOffset: 2.4, speed: 13 },
      { s: 450, laneOffset: 2.4, speed: 13.5 },
      { s: 680, laneOffset: 2.5, speed: 15 },
      { s: 920, laneOffset: 4.5, speed: 25 },
      { s: 1180, laneOffset: 2.5, speed: 27 },
      { s: 1420, laneOffset: 4.6, speed: 24 },
      { s: 1690, laneOffset: 4.5, speed: 26 },
      { s: 1980, laneOffset: 2.4, speed: 15 },
      { s: 2290, laneOffset: 4.5, speed: 26 },
      { s: 2560, laneOffset: 2.5, speed: 28 },
      { s: 2840, laneOffset: 4.5, speed: 24 },
      { s: 3120, laneOffset: 2.4, speed: 15 },
      { s: 3390, laneOffset: 2.4, speed: 13 },
      { s: 3660, laneOffset: 2.4, speed: 12.5 },
      { s: 3940, laneOffset: 2.4, speed: 12 },
    ];

    sbSpecs.forEach((sp, i) => {
      const pt = this.route.sampleAt(sp.s);
      cars.push({
        id: `sb_${i}`,
        active: true,
        s: sp.s,
        laneOffset: sp.laneOffset,
        baseSpeed: sp.speed,
        speed: sp.speed,
        dir: -1,
        oncoming: true,
        isLorry: i % 3 === 1,
        color: colors[(i + 2) % colors.length],
        braking: false,
        x: pt.x + pt.rx * sp.laneOffset,
        y: pt.y,
        z: pt.z + pt.rz * sp.laneOffset,
        heading: pt.heading + Math.PI,
      });
    });

    return cars;
  }

  triggerAlert(text, kind = 'warn', duration = 3.6) {
    this.alertText = text;
    this.alertKind = kind;
    this.alertTimer = duration;
  }

  update(dt, input) {
    if (this.status !== 'playing') {
      this.sound.stopContinuous();
      return;
    }

    const clampedDt = Math.min(0.05, dt);
    this.timeSec += clampedDt;
    this.driveTimeSec += clampedDt;
    if (this.alertTimer > 0) this.alertTimer -= clampedDt;
    if (this.collisionCooldown > 0) this.collisionCooldown -= clampedDt;

    this.updateTrafficLights();
    this.updateBarrierGate(clampedDt);
    this.updatePlayer(clampedDt, input);
    this.updateTraffic(clampedDt);
    this.checkCollisions(clampedDt);
    this.checkParking(clampedDt);

    const roadPt = this.route.sampleAt(this.player.s);
    this.sound.update(
      this.player.speed,
      input.gas ? 1 : 0,
      this.player.brakeDemand,
      this.player.brakeActual,
      this.player.brakeEfficiency,
      roadPt.hasCeiling
    );
  }

  updateTrafficLights() {
    for (const tl of this.route.trafficLights) {
      const t = (this.timeSec + tl.phase) % tl.cycle;
      if (t < tl.cycle * 0.48) tl.state = 'green';
      else if (t < tl.cycle * 0.63) tl.state = 'amber';
      else tl.state = 'red';
    }
  }

  updateBarrierGate(dt) {
    const gate = this.route.barrierGate;
    const dist = Math.abs(this.player.s - gate.s);
    const shouldOpen = dist < 24 && Math.abs(this.player.speed) < 10;
    const target = shouldOpen || this.player.s > gate.s + 2 ? 1 : 0;
    gate.openAmount += (target - gate.openAmount) * Math.min(1, dt * 4.5);
  }

  updatePlayer(dt, input) {
    const p = this.player;
    const roadPt = this.route.sampleAt(p.s);

    // 1. Progressive brake stiffening along the journey from Leicester to Nottingham
    const journeyRatio = Math.min(1, p.s / this.route.carparkStartS);
    let baseEfficiency;
    if (journeyRatio < 0.18) {
      // Fresh responsive brakes in Leicester
      baseEfficiency = 1.0 - (journeyRatio / 0.18) * 0.08;
    } else if (journeyRatio < 0.62) {
      // Noticeable stiffening along A46
      const k = (journeyRatio - 0.18) / 0.44;
      baseEfficiency = 0.92 - k * 0.46;
    } else {
      // Severe stiffening approaching Nottingham & Multi-Storey Car Park
      const k = (journeyRatio - 0.62) / 0.38;
      baseEfficiency = 0.46 - k * 0.18;
    }

    // Heavy high-speed braking slightly accelerates hydraulic stiffness
    if (p.brakeDemand > 0.5 && Math.abs(p.speed) > 14) {
      p.brakeUsagePenalty = Math.min(0.06, p.brakeUsagePenalty + dt * 0.005);
    }

    p.brakeEfficiency = Math.max(0.24, baseEfficiency - p.brakeUsagePenalty);

    // Trigger milestone warnings so player notices the progressive stiffening
    if (this.warnedStage === 0 && p.brakeEfficiency < 0.78) {
      this.warnedStage = 1;
      this.sound.playWarningChime();
      this.triggerAlert('BRAKES STIFFENING — LONGER PEDAL LAG & STOPPING DISTANCE', 'warn', 4.5);
    } else if (this.warnedStage === 1 && p.brakeEfficiency < 0.46) {
      this.warnedStage = 2;
      this.sound.playWarningChime();
      this.triggerAlert('HEAVY BRAKE STIFFNESS — BRAKE MUCH EARLIER FOR LIGHTS & CAR PARK!', 'danger', 5.0);
    }

    // 2. Gear & Pedal Input
    if (input.toggleReversePressed) {
      if (Math.abs(p.speed) < 1.2) {
        p.gear = p.gear === 'D' ? 'R' : 'D';
        p.speed = 0;
        this.sound.playBeep(p.gear === 'R' ? 520 : 680, 0.06, 0.05);
      }
    }

    let throttle = 0;
    let braking = 0;

    if (input.spaceBrake) {
      braking = 1;
    } else if (p.gear === 'D') {
      if (input.gas) throttle = 1;
      if (input.brake) {
        if (p.speed > 0.35) {
          braking = 1;
          p.reverseHoldTimer = 0;
        } else {
          // Holding S/Down while stopped engages Reverse smoothly
          p.reverseHoldTimer += dt;
          if (p.reverseHoldTimer > 0.35) {
            p.gear = 'R';
            throttle = 0.6;
          } else {
            braking = 1;
          }
        }
      } else {
        p.reverseHoldTimer = 0;
      }
    } else {
      // Reverse Gear
      if (input.brake) {
        throttle = 0.7; // S/Down backs up in R
      } else if (input.gas) {
        if (p.speed < -0.3) {
          braking = 1;
        } else {
          p.gear = 'D';
          throttle = 1;
        }
      }
    }

    p.brakeDemand = braking;

    // 3. Stiffened Brake Hydraulic Response
    // Fresh brakes (1.0): 0.05s response. Stiff brakes (0.25): ~0.85s hydraulic ramp-up!
    const lagSec = 0.05 + (1 - p.brakeEfficiency) * 1.05;
    if (braking > 0) {
      p.brakeActual = Math.min(1, p.brakeActual + (dt / lagSec));
    } else {
      p.brakeActual = Math.max(0, p.brakeActual - dt * 6.5);
    }

    // Non-linear stiff pedal curve: initial press gives weak bite until held
    const biteFactor = Math.pow(p.brakeActual, 1.0 + (1 - p.brakeEfficiency) * 0.75);
    const maxDecel = 7.2 + p.brakeEfficiency * 16.8; // 24 m/s^2 fresh -> ~11.2 m/s^2 stiff

    // 4. Longitudinal Acceleration
    let accel = 0;
    const absSpeed = Math.abs(p.speed);

    if (p.gear === 'D') {
      if (throttle > 0) {
        const topSpeed = 34.5; // ~77 mph
        const torque = 10.5 * (1 - Math.min(0.85, p.speed / topSpeed));
        accel += throttle * torque;
      }
      if (biteFactor > 0.001 && p.speed > 0) {
        accel -= biteFactor * maxDecel;
      }
      // Natural rolling resistance + engine braking
      if (throttle === 0 && braking === 0 && p.speed > 0) {
        accel -= 1.35 + 0.012 * p.speed * p.speed;
      }
    } else {
      // Reverse
      if (throttle > 0) {
        if (p.speed > -5.5) accel -= 5.2 * throttle;
      }
      if (biteFactor > 0.001 && p.speed < 0) {
        accel += biteFactor * maxDecel;
      }
      if (throttle === 0 && braking === 0 && p.speed < 0) {
        accel += 2.2;
      }
    }

    const prevSpeed = p.speed;
    p.speed += accel * dt;

    // Prevent braking from reversing direction unintentionally
    if (p.gear === 'D' && prevSpeed > 0 && p.speed < 0 && braking > 0) {
      p.speed = 0;
    }
    if (p.gear === 'R' && prevSpeed < 0 && p.speed > 0 && braking > 0) {
      p.speed = 0;
    }
    if (throttle === 0 && absSpeed < 0.15 && Math.abs(p.speed) < 0.15) {
      p.speed = 0;
    }

    // 5. Steering (nimble at low speed for multi-storey car park, smooth at highway speeds)
    let steerInput = 0;
    if (input.left) steerInput -= 1;
    if (input.right) steerInput += 1;

    const steerAuthority =
      absSpeed < 0.2
        ? 0
        : absSpeed < 12
          ? 0.95 * (absSpeed / 7 + 0.28)
          : Math.max(0.36, 1.05 - (absSpeed - 12) * 0.025);

    const reverseSign = p.speed < -0.1 ? -1 : 1;
    const yawRate = steerInput * steerAuthority * 1.45 * reverseSign;
    p.heading = normalizeAngle(p.heading + yawRate * dt);

    // 6. Integrate World Position
    p.x += Math.sin(p.heading) * p.speed * dt;
    p.z += Math.cos(p.heading) * p.speed * dt;

    // Update closest spline distance `s` & lateral offset `lat`
    const proj = this.projectOntoRoute(p.x, p.z, p.s);
    p.s = proj.s;
    p.lat = proj.lat;
    const newRoadPt = this.route.sampleAt(p.s);
    p.y = newRoadPt.y;

    // 7. Suspension Pitch (nose dive when braking) & Roll (cornering)
    const netDecel = p.speed > 0.5 ? Math.max(0, -accel) : 0;
    const targetPitch = Math.min(0.065, netDecel * 0.0028) - Math.max(0, accel) * 0.0014;
    const targetRoll = steerInput * Math.min(1, absSpeed / 16) * 0.045;
    p.pitch += (targetPitch - p.pitch) * Math.min(1, dt * 10);
    p.roll += (targetRoll - p.roll) * Math.min(1, dt * 8);

    // 8. Check Red Light Violations
    for (const tl of this.route.trafficLights) {
      if (!this.passedLights.has(tl.id) && p.s > tl.s + 1.5 && p.s < tl.s + 12) {
        this.passedLights.add(tl.id);
        if (tl.state === 'red') {
          p.redLightsRun += 1;
          p.hull = Math.max(10, p.hull - 8);
          this.sound.playWarningChime();
          this.triggerAlert('RED LIGHT VIOLATION! (-8% HULL) — ANTICIPATE STIFF BRAKES!', 'danger', 3.5);
        }
      }
    }

    // Carpark arrival alert
    if (p.s >= this.route.carparkStartS - 5 && p.s <= this.route.carparkStartS + 6 && this.warnedStage < 3) {
      this.warnedStage = 3;
      this.triggerAlert('ENTERING BROADMARSH MULTI-STOREY — SLOW DOWN FOR RAMPS & BAY 14!', 'info', 4.5);
    }
  }

  projectOntoRoute(wx, wz, approxS) {
    const pts = this.route.points;
    let bestIdx = 0;
    let bestDistSq = Infinity;

    for (let i = 0; i < pts.length; i++) {
      if (Math.abs(pts[i].s - approxS) > 35) continue;
      const dx = wx - pts[i].x;
      const dz = wz - pts[i].z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        bestIdx = i;
      }
    }

    // Refine along segment [bestIdx-1 .. bestIdx+1]
    const i0 = Math.max(0, bestIdx - 1);
    const i1 = Math.min(pts.length - 1, bestIdx + 1);
    let bestS = pts[bestIdx].s;
    let minSegD2 = Infinity;

    for (let i = i0; i < i1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const vx = b.x - a.x;
      const vz = b.z - a.z;
      const lenSq = vx * vx + vz * vz;
      if (lenSq < 1e-6) continue;
      const t = Math.max(0, Math.min(1, ((wx - a.x) * vx + (wz - a.z) * vz) / lenSq));
      const px = a.x + vx * t;
      const pz = a.z + vz * t;
      const d2 = (wx - px) ** 2 + (wz - pz) ** 2;
      if (d2 < minSegD2) {
        minSegD2 = d2;
        bestS = a.s + (b.s - a.s) * t;
      }
    }

    const pt = this.route.sampleAt(bestS);
    const lat = (wx - pt.x) * pt.rx + (wz - pt.z) * pt.rz;
    return { s: bestS, lat };
  }

  updateTraffic(dt) {
    for (const car of this.traffic) {
      if (!car.active) continue;
      let targetSpeed = car.baseSpeed;
      car.braking = false;

      if (car.dir === 1) {
        // Stop before red/amber traffic lights
        for (const tl of this.route.trafficLights) {
          const distToLight = tl.s - car.s;
          if (distToLight > 2 && distToLight < 42 && tl.state !== 'green') {
            targetSpeed = Math.max(0, (distToLight - 4) * 0.45);
            car.braking = true;
          }
        }
        // Slow down if approaching another northbound car in same lane
        for (const other of this.traffic) {
          if (!other.active || other === car || other.dir !== 1) continue;
          const ds = other.s - car.s;
          if (ds > 0 && ds < 28 && Math.abs(other.laneOffset - car.laneOffset) < 1.8) {
            targetSpeed = Math.min(targetSpeed, Math.max(0, other.speed - (28 - ds) * 0.25));
            car.braking = true;
          }
        }
        // Slow for roundabouts & city approach
        if (car.s > 1860 && car.s < 2150) targetSpeed = Math.min(targetSpeed, 12);
        if (car.s > 3050) targetSpeed = Math.min(targetSpeed, 13.5);
      }

      if (car.speed > targetSpeed) {
        car.speed = Math.max(targetSpeed, car.speed - 11 * dt);
        car.braking = true;
      } else {
        car.speed = Math.min(targetSpeed, car.speed + 5.5 * dt);
      }

      car.s += car.dir * car.speed * dt;

      if (car.dir === 1 && car.s > this.route.carparkStartS - 75) {
        car.active = false;
        continue;
      }
      if (car.dir === -1 && car.s < 40) {
        car.s = this.route.carparkStartS - 180;
      }

      const pt = this.route.sampleAt(car.s);
      const maxLane = pt.dualCarriageway ? 5.2 : pt.width * 0.24;
      const effectiveLat = Math.sign(car.laneOffset) * Math.min(Math.abs(car.laneOffset), maxLane);
      car.x = pt.x + pt.rx * effectiveLat;
      car.y = pt.y;
      car.z = pt.z + pt.rz * effectiveLat;
      car.heading = car.dir === 1 ? pt.heading : pt.heading + Math.PI;
    }
  }

  checkCollisions(dt) {
    const p = this.player;
    const roadPt = this.route.sampleAt(p.s);
    const halfW = roadPt.width * 0.5;

    // 1. Road boundaries / Car park concrete walls
    const maxLat = roadPt.hasCeiling ? halfW - 0.95 : halfW + 1.3;
    if (Math.abs(p.lat) > maxLat) {
      const sign = Math.sign(p.lat);
      const excess = Math.abs(p.lat) - maxLat;
      p.x -= roadPt.rx * sign * excess;
      p.z -= roadPt.rz * sign * excess;
      p.lat = sign * maxLat;

      if (roadPt.hasCeiling || roadPt.env === 'bridge') {
        if (Math.abs(p.speed) > 1.8 && this.collisionCooldown <= 0) {
          this.applyImpact(Math.min(18, Math.abs(p.speed) * 1.4), 'SCRAPED WALL!');
        }
        p.speed *= 0.6;
        // Gently align heading back toward aisle
        const hDiff = normalizeAngle(roadPt.heading - p.heading);
        p.heading = normalizeAngle(p.heading + hDiff * 0.35);
      } else {
        // Grass verge rumble slows car
        p.speed *= Math.max(0.5, 1 - dt * 1.8);
      }
    }

    // End wall at very end of car park (Level 2 back wall)
    if (p.s > this.route.totalLength - 2.2) {
      p.s = this.route.totalLength - 2.2;
      const clampPt = this.route.sampleAt(p.s);
      p.x = clampPt.x + clampPt.rx * p.lat;
      p.z = clampPt.z + clampPt.rz * p.lat;
      if (p.speed > 1.2 && this.collisionCooldown <= 0) {
        this.applyImpact(Math.min(24, p.speed * 2.2), 'HIT CAR PARK END WALL!');
      }
      p.speed = Math.min(0, p.speed * -0.2);
    }

    // 2. Entry Barrier Gate collision if approaching too fast while closed
    const gate = this.route.barrierGate;
    if (Math.abs(p.s - gate.s) < 1.3 && gate.openAmount < 0.5 && p.speed > 2) {
      if (this.collisionCooldown <= 0) {
        this.applyImpact(12, 'HIT ENTRY BARRIER — SLOW DOWN TO LET IT LIFT!');
      }
      p.speed = 0;
      gate.openAmount = 1;
    }

    // 3. Central reservation on dual carriageway
    if (roadPt.dualCarriageway && Math.abs(p.lat) < 0.75) {
      p.speed *= Math.max(0.6, 1 - dt * 2.5);
    }

    // 4. Traffic vehicles & parked cars in carpark
    for (const car of this.traffic) {
      if (!car.active || Math.abs(car.y - p.y) > 2.2) continue;
      const dx = p.x - car.x;
      const dz = p.z - car.z;
      if (dx * dx + dz * dz < 2.25 * 2.25) {
        if (this.collisionCooldown <= 0) {
          const relSpeed = Math.abs(p.speed - (car.dir === 1 ? car.speed : -car.speed));
          this.applyImpact(Math.max(8, Math.min(35, relSpeed * 1.6)), 'TRAFFIC COLLISION!');
        }
        p.speed = -Math.sign(p.speed || 1) * 2.5;
        car.speed *= 0.4;
      }
    }

    if (roadPt.hasCeiling) {
      for (const prop of this.route.props) {
        if (prop.type !== 'parkedCar' && prop.type !== 'pillar') continue;
        if (Math.abs(prop.y - p.y) > 2.2) continue;
        const dx = p.x - prop.x;
        const dz = p.z - prop.z;
        const hitRadius = prop.type === 'pillar' ? 1.15 : 1.85;
        if (dx * dx + dz * dz < hitRadius * hitRadius) {
          if (this.collisionCooldown <= 0) {
            this.applyImpact(
              Math.max(6, Math.min(22, Math.abs(p.speed) * 2.1)),
              prop.type === 'pillar' ? 'HIT CONCRETE PILLAR!' : 'BUMPED PARKED CAR!'
            );
          }
          p.speed = -Math.sign(p.speed || 1) * 1.6;
        }
      }
    }
  }

  applyImpact(damage, message) {
    this.collisionCooldown = 0.75;
    this.player.collisions += 1;
    this.player.hull = Math.max(0, Math.round(this.player.hull - damage));
    this.sound.playCollision(damage / 25);
    this.triggerAlert(message, 'danger', 2.8);

    if (this.player.hull <= 0) {
      this.status = 'lost';
      this.sound.stopContinuous();
    }
  }

  checkParking(dt) {
    const p = this.player;
    const bay = this.route.parkingBay;
    if (p.s < this.route.level2AisleStartS) {
      this.parkingStatus = null;
      return;
    }

    const dx = p.x - bay.x;
    const dz = p.z - bay.z;
    const along = dx * bay.tx + dz * bay.tz;
    const across = dx * bay.rx + dz * bay.rz;
    const headingErr = Math.abs(normalizeAngle(p.heading - bay.heading));
    const distToBay = Math.hypot(along, across);

    const proximity = Math.max(0, Math.min(1, 1 - distToBay / 22));
    if (distToBay < 22 && Math.abs(p.y - bay.y) < 1.5) {
      this.sound.updateParkingSensor(proximity, this.timeSec);
    }

    const insideBay = Math.abs(along) < 2.25 && Math.abs(across) < 1.15 && headingErr < 0.44;
    const stopped = Math.abs(p.speed) < 0.25;

    if (insideBay && stopped) {
      p.parkHoldTimer += dt;
      if (p.parkHoldTimer >= 0.45) {
        const centerScore = Math.max(0, 1 - Math.abs(across) / 1.15) * 45 + Math.max(0, 1 - Math.abs(along) / 2.25) * 35;
        const angleScore = Math.max(0, 1 - headingErr / 0.44) * 20;
        p.parkingPrecision = Math.min(100, Math.round(centerScore + angleScore));
        this.status = 'won';
        this.sound.stopContinuous();
        this.sound.playVictory();
      }
    } else {
      p.parkHoldTimer = Math.max(0, p.parkHoldTimer - dt * 2);
    }

    this.parkingStatus = {
      proximity,
      insideBay,
      stopped,
      distToBay,
      along,
      across,
      headingErr,
    };
  }

  getHudSnapshot() {
    const p = this.player;
    const roadPt = this.route.sampleAt(p.s);
    const progress = Math.max(0, Math.min(1, p.s / this.route.parkingBay.s));
    const milesRemaining = Math.max(0, (1 - progress) * 26.0);
    const speedMph = Math.round(Math.abs(p.speed) * MPH_PER_MS);
    const lagSec = 0.05 + (1 - p.brakeEfficiency) * 1.05;

    return {
      status: this.status,
      speedMph,
      gear: p.gear,
      speedLimit: roadPt.speedLimit,
      zone: roadPt.zone,
      progressPct: progress * 100,
      milesRemaining,
      driveTimeSec: this.driveTimeSec,
      hull: p.hull,
      collisions: p.collisions,
      redLightsRun: p.redLightsRun,
      brakeEfficiency: p.brakeEfficiency,
      brakeDemand: p.brakeDemand,
      brakeActual: p.brakeActual,
      brakeLagSec: lagSec,
      alertActive: this.alertTimer > 0,
      alertText: this.alertText,
      alertKind: this.alertKind,
      inCarparkLevel2: p.s >= this.route.level2AisleStartS,
      parkingStatus: this.parkingStatus,
      parkingPrecision: p.parkingPrecision,
    };
  }
}
