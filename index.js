/* ═══════════════════════════════════════════════════════════════════════
   Enchanted Flower Garden – index.js
   Realistic procedural flower animation with physics, wind & particles
   ═══════════════════════════════════════════════════════════════════════ */
'use strict';
// ─── Canvas Setup ───────────────────────────────────────────────────────────
const canvas = document.getElementById('garden-canvas');
const ctx    = canvas.getContext('2d');
function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
// ─── Global State ───────────────────────────────────────────────────────────
const state = {
  flowers      : [],
  particles    : [],
  windSpeed    : 2,
  growthSpeed  : 5,
  petalCount   : 8,
  flowerType   : 'rose',
  ambience     : 'day',
  showPollen   : true,
  time         : 0,
  mouseX       : 0,
  mouseY       : 0,
  isDragging   : false,
  lastMX       : 0,
};
// ─── Colour Palettes Per Species ────────────────────────────────────────────
const PALETTES = {
  rose: [
    ['#fa0338','#ff4d6d','#ff7096'],
    ['#ff0080','#ff33a0','#ff80c0'],
    ['#b30000','#e60000','#ff4444'],
    ['#cc00ff','#dd44ff','#ee88ff'],
    ['#ff6600','#ff8533','#ffaa66'],
    ['#fff0f0','#ffe0e0','#ffcccc'],
  ],
  daisy: [
    ['#fff700','#ffe600','#ffd300'],
    ['#ffffff','#f0f0ff','#e8e8ff'],
    ['#ffaaaa','#ff8888','#ff6666'],
    ['#aaffaa','#88ff88','#66ee66'],
    ['#aaddff','#88ccff','#66bbff'],
  ],
  tulip: [
    ['#ff2d55','#ff6b81','#ff9aaa'],
    ['#ff9500','#ffb347','#ffd28a'],
    ['#9b59b6','#c39bd3','#d7bde2'],
    ['#e74c3c','#f1948a','#fadbd8'],
    ['#ffffff','#ecf0f1','#d5dbdb'],
    ['#1abc9c','#48c9b0','#76d7c4'],
  ],
  sunflower: [
    ['#ffc107','#ffca28','#ffd54f'],
    ['#ff8f00','#ffa000','#ffb300'],
    ['#e65100','#ef6c00','#f57c00'],
  ],
  cherry: [
    ['#ffb7c5','#ffc2cc','#ffcdd2'],
    ['#ff80ab','#ff4081','#f50057'],
    ['#ffffff','#fff0f5','#ffe4e8'],
    ['#f8bbd0','#f48fb1','#f06292'],
    ['#ffecb3','#ffe082','#ffd54f'],
  ],
};
// ─── Noise / Math Helpers ───────────────────────────────────────────────────
function lerp(a, b, t)   { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function rand(lo, hi)     { return lo + Math.random() * (hi - lo); }
function randInt(lo, hi)  { return Math.floor(rand(lo, hi + 1)); }
function sinNoise(t, freq, phase) { return Math.sin(t * freq + phase); }
// ─── Pollen Particle ────────────────────────────────────────────────────────
class Pollen {
  constructor(x, y, color) {
    this.x     = x;
    this.y     = y;
    this.vx    = rand(-0.8, 0.8);
    this.vy    = rand(-1.5, -0.3);
    this.r     = rand(1.5, 3.5);
    this.alpha = rand(0.5, 0.9);
    this.color = color || `hsl(${randInt(40,60)},100%,70%)`;
    this.life  = 1.0;
    this.decay = rand(0.003, 0.008);
    this.angle = rand(0, Math.PI * 2);
    this.spin  = rand(-0.05, 0.05);
    this.gravity = rand(0.005, 0.02);
    this.waveAmp  = rand(0.2, 0.8);
    this.waveFreq = rand(0.02, 0.06);
    this.wavePhase = rand(0, Math.PI * 2);
  }
  update(wind, t) {
    const waveX = Math.sin(t * this.waveFreq + this.wavePhase) * this.waveAmp;
    this.vx  += wind * 0.003 + waveX * 0.05;
    this.vy  += this.gravity;
    this.vx  *= 0.99;
    this.vy  *= 0.99;
    this.x   += this.vx;
    this.y   += this.vy;
    this.angle += this.spin;
    this.life -= this.decay;
  }
  draw(ctx) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.alpha * this.life;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    // Sparkle cross shape
    const g = ctx.createRadialGradient(0,0,0, 0,0,this.r * 2);
    g.addColorStop(0, this.color);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, this.r * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
// ─── Leaf ────────────────────────────────────────────────────────────────────
class Leaf {
  constructor(stemX, stemY, angle, size, colorBase) {
    this.x       = stemX;
    this.y       = stemY;
    this.angle   = angle;
    this.size    = size;
    this.growth  = 0;
    this.targetGrowth = 1;
    // Leaf greens with slight variation
    const hue = rand(95, 130);
    this.fill   = `hsl(${hue}, 65%, 32%)`;
    this.fill2  = `hsl(${hue}, 55%, 22%)`;
    this.vein   = `hsl(${hue}, 80%, 55%)`;
    this.sway   = rand(0, Math.PI * 2);
    this.swayAmt = rand(0.04, 0.12);
  }
  update(growthRate, wind, t) {
    if (this.growth < this.targetGrowth) {
      this.growth = Math.min(this.targetGrowth, this.growth + 0.01 * growthRate);
    }
    this.sway = t;
  }
  draw(ctx, wind, t) {
    if (this.growth <= 0.01) return;
    const g = this.growth;
    const swayOffset = Math.sin(t * 0.8 + this.sway) * this.swayAmt * wind;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle + swayOffset);
    ctx.scale(g, g);
    const s = this.size;
    // Draw leaf shape using bezier
    const grad = ctx.createLinearGradient(-s*0.2, -s, s*0.8, s*0.3);
    grad.addColorStop(0, this.fill);
    grad.addColorStop(1, this.fill2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo( s * 0.6,  -s * 0.5,  s * 1.2, -s * 0.6,  s, 0);
    ctx.bezierCurveTo( s * 1.2,  s * 0.4,   s * 0.6,  s * 0.5,  0, 0);
    ctx.fillStyle = grad;
    ctx.fill();
    // Vein
    ctx.strokeStyle = this.vein;
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(s * 0.9, 0);
    ctx.stroke();
    ctx.restore();
  }
}
// ─── Flower Base Class ────────────────────────────────────────────────────────
class Flower {
  constructor(x, y, type, petalCount) {
    this.x          = x;
    this.y          = y;
    this.type       = type;
    this.petalCount = petalCount;
    this.growth     = 0;          // 0 → 1 full bloom
    this.stemGrowth = 0;
    this.bloomPhase = 0;          // 0=sprout 1=stem 2=bloom
    this.swayAngle  = 0;
    this.swayPhase  = rand(0, Math.PI * 2);
    this.swayAmt    = rand(0.02, 0.06);
    this.alive      = true;
    this.age        = 0;
    this.pollenTimer = 0;
    this.pollenInterval = rand(40, 100);
    // Stem parameters
    const stemH      = rand(80, 160);
    this.stemHeight   = stemH;
    this.stemThick    = rand(2.5, 5);
    this.stemColor    = `hsl(${rand(100,130)}, 55%, 28%)`;
    this.stemColor2   = `hsl(${rand(100,130)}, 45%, 18%)`;
    this.stemCurve    = rand(-0.3, 0.3);
    // Pick colour palette
    const palette = PALETTES[type] || PALETTES.rose;
    this.colors   = palette[Math.floor(Math.random() * palette.length)];
    // Leaves
    this.leaves = [];
    const nLeaves = randInt(1, 3);
    for (let i = 0; i < nLeaves; i++) {
      const t  = rand(0.25, 0.75);
      const lx = x + this.stemCurve * stemH * t * t;
      const ly = y - stemH * t;
      const side = (i % 2 === 0) ? 1 : -1;
      const angle = side * rand(0.3, 0.8);
      this.leaves.push(new Leaf(lx, ly, angle, rand(14, 28), this.colors[0]));
    }
    // Petal animation offsets for randomness
    this.petalOffsets = Array.from({length: 20}, () => rand(-0.08, 0.08));
    this.petalLengths = Array.from({length: 20}, () => rand(0.85, 1.15));
    this.petalWidths  = Array.from({length: 20}, () => rand(0.8, 1.2));
  }
  // Called every frame
  update(growthRate, wind, t) {
    this.age++;
    this.pollenTimer++;
    // Growth phase progression
    const gStep = 0.004 * growthRate;
    if (this.stemGrowth < 1) {
      this.stemGrowth = Math.min(1, this.stemGrowth + gStep * 1.5);
    } else if (this.growth < 1) {
      this.growth = Math.min(1, this.growth + gStep);
    }
    // Sway physics
    const windForce = wind * 0.003;
    const springBack = -this.swayAngle * 0.12;
    const damping   = -this.swayAngle * 0.04;
    const noise     = Math.sin(t * 0.7 + this.swayPhase) * windForce;
    this.swayAngle += springBack + damping + noise;
    this.swayAngle  = clamp(this.swayAngle, -0.3, 0.3);
    // Update leaves
    this.leaves.forEach(l => l.update(growthRate, wind, t));
  }
  // Spawn pollen
  emitPollen(particles) {
    if (!state.showPollen) return;
    if (this.growth < 0.7) return;
    if (this.pollenTimer < this.pollenInterval) return;
    this.pollenTimer = 0;
    const tipX = this.x + this.stemCurve * this.stemHeight + Math.sin(this.swayAngle) * this.stemHeight * 0.3;
    const tipY = this.y - this.stemHeight * this.stemGrowth;
    const n = randInt(1, 4);
    for (let i = 0; i < n; i++) {
      particles.push(new Pollen(tipX + rand(-8, 8), tipY + rand(-5, 5), this.colors[1]));
    }
  }
  // Compute stem tip position with sway
  getStemTip() {
    const prog = this.stemGrowth;
    const sx   = this.x + Math.sin(this.swayAngle) * this.stemHeight * prog * 0.5;
    const sy   = this.y - this.stemHeight * prog;
    return { x: sx, y: sy };
  }
  drawStem(ctx) {
    const prog = this.stemGrowth;
    if (prog < 0.01) return;
    const cp1x = this.x + this.stemCurve * this.stemHeight * 0.5 + Math.sin(this.swayAngle) * 10;
    const cp1y = this.y - this.stemHeight * prog * 0.5;
    const tip  = this.getStemTip();
    // Stem gradient
    const g = ctx.createLinearGradient(this.x, this.y, tip.x, tip.y);
    g.addColorStop(0, this.stemColor2);
    g.addColorStop(0.5, this.stemColor);
    g.addColorStop(1, this.stemColor);
    // Outer thick stroke
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.quadraticCurveTo(cp1x, cp1y, tip.x, tip.y);
    ctx.strokeStyle = g;
    ctx.lineWidth   = this.stemThick;
    ctx.lineCap     = 'round';
    ctx.stroke();
    // Inner highlight
    ctx.beginPath();
    ctx.moveTo(this.x + 1, this.y);
    ctx.quadraticCurveTo(cp1x + 1, cp1y, tip.x + 1, tip.y);
    ctx.strokeStyle = `rgba(255,255,255,0.15)`;
    ctx.lineWidth   = 1;
    ctx.stroke();
  }
  draw(ctx, wind, t) {
    // Leaves
    this.leaves.forEach(l => l.draw(ctx, wind, t));
    // Stem
    this.drawStem(ctx);
  }
}
// ─── Rose ────────────────────────────────────────────────────────────────────
class Rose extends Flower {
  constructor(x, y, petalCount) {
    super(x, y, 'rose', petalCount);
    this.layers = 4;
    this.rotOffset = rand(0, Math.PI * 2);
  }
  draw(ctx, wind, t) {
    super.draw(ctx, wind, t);
    if (this.growth < 0.02) return;
    const tip = this.getStemTip();
    const g   = this.growth;
    const pc  = this.petalCount;
    const c   = this.colors;
    ctx.save();
    ctx.translate(tip.x, tip.y);
    ctx.rotate(this.swayAngle + Math.sin(t * 0.3 + this.swayPhase) * 0.015);
    // Draw layers from outside in for realistic rose spiral
    for (let layer = this.layers - 1; layer >= 0; layer--) {
      const layerProgress = clamp((g - layer * 0.2) / 0.25, 0, 1);
      if (layerProgress <= 0) continue;
      const layerPetals = Math.max(3, pc - layer);
      const outerR = (18 + layer * 7) * g;
      const innerR = outerR * 0.4;
      const rotOff = this.rotOffset + layer * (Math.PI / pc) + layer * 0.25;
      // Color: outer lighter, inner darker
      const col1 = layer === 0 ? c[2] : (layer === 1 ? c[1] : c[0]);
      const col2 = layer === 0 ? c[1] : (layer === 1 ? c[0] : c[0]);
      for (let p = 0; p < layerPetals; p++) {
        const angle = (p / layerPetals) * Math.PI * 2 + rotOff;
        const pOff  = this.petalOffsets[p % 20] * 0.4 * layerProgress;
        const pLen  = this.petalLengths[p % 20];
        const pWid  = this.petalWidths[p % 20];
        ctx.save();
        ctx.rotate(angle + pOff);
        const petalLen = outerR * pLen * layerProgress;
        const petalW   = (outerR * 0.55 + layer * 2) * pWid * layerProgress;
        // Petal gradient
        const grad = ctx.createLinearGradient(innerR, 0, petalLen, 0);
        grad.addColorStop(0, col2);
        grad.addColorStop(0.6, col1);
        grad.addColorStop(1, `rgba(255,255,255,0.5)`);
        ctx.beginPath();
        ctx.moveTo(innerR, 0);
        // Top curve of petal
        ctx.bezierCurveTo(
          innerR + petalLen * 0.3,  -petalW * 0.8,
          innerR + petalLen * 0.7,  -petalW,
          petalLen, 0
        );
        // Bottom curve
        ctx.bezierCurveTo(
          innerR + petalLen * 0.7,  petalW,
          innerR + petalLen * 0.3,  petalW * 0.8,
          innerR, 0
        );
        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.9 * layerProgress;
        ctx.fill();
        // Petal vein
        ctx.beginPath();
        ctx.moveTo(innerR, 0);
        ctx.lineTo(petalLen * 0.85, 0);
        ctx.strokeStyle = `rgba(255,255,255,0.25)`;
        ctx.lineWidth   = 0.7;
        ctx.globalAlpha = 0.5 * layerProgress;
        ctx.stroke();
        ctx.restore();
      }
    }
    // Center stigma
    const center = 7 * g;
    const cg = ctx.createRadialGradient(0,0,0, 0,0,center);
    cg.addColorStop(0, '#fffde7');
    cg.addColorStop(0.6, '#f9a825');
    cg.addColorStop(1, '#e65100');
    ctx.globalAlpha = g;
    ctx.beginPath();
    ctx.arc(0, 0, center, 0, Math.PI * 2);
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.restore();
  }
}
// ─── Daisy ────────────────────────────────────────────────────────────────────
class Daisy extends Flower {
  constructor(x, y, petalCount) {
    super(x, y, 'daisy', petalCount);
    this.layers = 2;
  }
  draw(ctx, wind, t) {
    super.draw(ctx, wind, t);
    if (this.growth < 0.02) return;
    const tip = this.getStemTip();
    const g   = this.growth;
    const pc  = this.petalCount;
    const c   = this.colors;
    ctx.save();
    ctx.translate(tip.x, tip.y);
    ctx.rotate(this.swayAngle + Math.sin(t * 0.25 + this.swayPhase) * 0.01);
    // Petals — two layers offset by half angle
    for (let layer = 0; layer < 2; layer++) {
      const layerG = clamp((g - layer * 0.15) / 0.85, 0, 1);
      const rotOff = (layer === 1) ? Math.PI / pc : 0;
      const lenMul = layer === 0 ? 1 : 0.85;
      const wMul   = layer === 0 ? 1 : 0.9;
      const alpha  = layer === 0 ? 0.95 : 0.75;
      for (let p = 0; p < pc; p++) {
        const angle = (p / pc) * Math.PI * 2 + rotOff;
        const pOff  = this.petalOffsets[p % 20] * 0.3;
        const pLen  = this.petalLengths[p % 20] * lenMul;
        const pWid  = this.petalWidths[p % 20] * wMul;
        ctx.save();
        ctx.rotate(angle + pOff);
        ctx.globalAlpha = alpha * layerG;
        const base  = 5 * g;
        const reach = (26 + layer * 2) * g * pLen * layerG;
        const width = 7 * g * pWid;
        const grad = ctx.createLinearGradient(base, 0, reach, 0);
        grad.addColorStop(0, c[1]);
        grad.addColorStop(0.5, c[0]);
        grad.addColorStop(1, `rgba(255,255,255,0.9)`);
        ctx.beginPath();
        ctx.moveTo(base, 0);
        ctx.bezierCurveTo(
          base + reach * 0.25, -width,
          base + reach * 0.75, -width * 0.8,
          reach, 0
        );
        ctx.bezierCurveTo(
          base + reach * 0.75,  width * 0.8,
          base + reach * 0.25,  width,
          base, 0
        );
        ctx.fillStyle = grad;
        ctx.fill();
        // Subtle petal stroke
        ctx.strokeStyle = `rgba(0,0,0,0.06)`;
        ctx.lineWidth   = 0.5;
        ctx.stroke();
        ctx.restore();
      }
    }
    // Phyllotaxis seed center
    const centerR = 9 * g;
    const cg = ctx.createRadialGradient(0,0,0, 0,0,centerR);
    cg.addColorStop(0, '#fff176');
    cg.addColorStop(0.4, '#fbc02d');
    cg.addColorStop(1, '#e65100');
    ctx.globalAlpha = g;
    ctx.beginPath();
    ctx.arc(0, 0, centerR, 0, Math.PI * 2);
    ctx.fillStyle = cg;
    ctx.fill();
    // Seeds using phyllotaxis spiral
    const seeds = Math.floor(35 * g);
    const goldenAngle = 137.508 * Math.PI / 180;
    for (let i = 0; i < seeds; i++) {
      const r   = Math.sqrt(i / seeds) * centerR * 0.85;
      const ang = i * goldenAngle;
      const sx  = r * Math.cos(ang);
      const sy  = r * Math.sin(ang);
      ctx.beginPath();
      ctx.arc(sx, sy, 0.9, 0, Math.PI * 2);
      ctx.fillStyle = i % 3 === 0 ? '#5d4037' : '#795548';
      ctx.globalAlpha = 0.9 * g;
      ctx.fill();
    }
    ctx.restore();
  }
}
// ─── Tulip ────────────────────────────────────────────────────────────────────
class Tulip extends Flower {
  constructor(x, y, petalCount) {
    super(x, y, 'tulip', Math.min(6, petalCount));
    this.openAngle = rand(0.2, 0.6); // how open the cup is
  }
  draw(ctx, wind, t) {
    super.draw(ctx, wind, t);
    if (this.growth < 0.02) return;
    const tip = this.getStemTip();
    const g   = this.growth;
    const pc  = this.petalCount;
    const c   = this.colors;
    const oa  = this.openAngle * g;
    ctx.save();
    ctx.translate(tip.x, tip.y);
    ctx.rotate(this.swayAngle + Math.sin(t * 0.3 + this.swayPhase) * 0.012);
    // Draw cup petals
    for (let p = 0; p < pc; p++) {
      const angle = (p / pc) * Math.PI * 2 + (Math.PI / pc);
      const pOff  = this.petalOffsets[p % 20] * 0.2;
      ctx.save();
      ctx.rotate(angle + pOff);
      const height = 28 * g;
      const width  = 12 * g * this.petalWidths[p % 20];
      // Tulip petal gradient (dark base → bright tip)
      const grad = ctx.createLinearGradient(0, 0, 0, -height);
      grad.addColorStop(0, c[2]);
      grad.addColorStop(0.4, c[0]);
      grad.addColorStop(0.85, c[1]);
      grad.addColorStop(1, `rgba(255,255,255,0.8)`);
      ctx.globalAlpha = 0.92 * g;
      // Petal path: base closes inward, top opens outward
      const spread = oa * width;
      ctx.beginPath();
      ctx.moveTo(-spread * 0.5, 0);
      ctx.bezierCurveTo(
        -spread - width * 0.5, -height * 0.35,
        -spread - width * 0.3, -height * 0.75,
        0, -height
      );
      ctx.bezierCurveTo(
         spread + width * 0.3, -height * 0.75,
         spread + width * 0.5, -height * 0.35,
         spread * 0.5, 0
      );
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      // Edge highlight
      ctx.strokeStyle = `rgba(255,255,255,0.2)`;
      ctx.lineWidth   = 1;
      ctx.stroke();
      ctx.restore();
    }
    // Inner pistil
    const pistilH = 14 * g;
    const pg = ctx.createLinearGradient(0, 0, 0, -pistilH);
    pg.addColorStop(0, '#2e7d32');
    pg.addColorStop(1, '#81c784');
    ctx.globalAlpha = g * 0.9;
    ctx.beginPath();
    ctx.moveTo(-2, 0);
    ctx.lineTo(-2, -pistilH);
    ctx.lineTo(2, -pistilH);
    ctx.lineTo(2, 0);
    ctx.fillStyle = pg;
    ctx.fill();
    // Stigma
    ctx.beginPath();
    ctx.arc(0, -pistilH, 3.5 * g, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe082';
    ctx.fill();
    ctx.restore();
  }
}
// ─── Sunflower ────────────────────────────────────────────────────────────────
class Sunflower extends Flower {
  constructor(x, y, petalCount) {
    super(x, y, 'sunflower', Math.max(12, petalCount));
    this.diskR = rand(18, 26);
    this.stemThick *= 1.8;
    this.stemHeight *= 1.3;
  }
  draw(ctx, wind, t) {
    super.draw(ctx, wind, t);
    if (this.growth < 0.02) return;
    const tip = this.getStemTip();
    const g   = this.growth;
    const pc  = this.petalCount;
    const c   = this.colors;
    const dR  = this.diskR * g;
    ctx.save();
    ctx.translate(tip.x, tip.y);
    ctx.rotate(this.swayAngle + Math.sin(t * 0.2 + this.swayPhase) * 0.008);
    // Outer petal layer
    for (let p = 0; p < pc; p++) {
      const angle = (p / pc) * Math.PI * 2;
      const pOff  = this.petalOffsets[p % 20] * 0.15;
      ctx.save();
      ctx.rotate(angle + pOff);
      ctx.globalAlpha = 0.95 * g;
      const reach = (dR + 22) * this.petalLengths[p % 20];
      const w     = 9 * g * this.petalWidths[p % 20];
      const grad = ctx.createLinearGradient(dR * 0.7, 0, reach, 0);
      grad.addColorStop(0, c[2]);
      grad.addColorStop(0.5, c[0]);
      grad.addColorStop(1, `rgba(255,240,100,0.7)`);
      ctx.beginPath();
      ctx.moveTo(dR * 0.7, 0);
      ctx.bezierCurveTo(dR + reach*0.2, -w, dR + reach*0.6, -w*0.9, reach, 0);
      ctx.bezierCurveTo(dR + reach*0.6,  w, dR + reach*0.2,  w,     dR * 0.7, 0);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    }
    // Inner petal layer (offset)
    for (let p = 0; p < pc; p++) {
      const angle = (p / pc) * Math.PI * 2 + Math.PI / pc;
      ctx.save();
      ctx.rotate(angle);
      ctx.globalAlpha = 0.7 * g;
      const reach = (dR + 14) * 0.9;
      const w     = 6 * g;
      const grad = ctx.createLinearGradient(dR * 0.6, 0, reach, 0);
      grad.addColorStop(0, c[1]);
      grad.addColorStop(1, `rgba(255,200,50,0.6)`);
      ctx.beginPath();
      ctx.moveTo(dR * 0.6, 0);
      ctx.bezierCurveTo(dR + reach*0.2, -w, dR + reach*0.6, -w*0.8, reach, 0);
      ctx.bezierCurveTo(dR + reach*0.6,  w, dR + reach*0.2,  w*0.8, dR * 0.6, 0);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    }
    // Disk face gradient
    const diskGrad = ctx.createRadialGradient(0, -dR*0.15, 0, 0, 0, dR);
    diskGrad.addColorStop(0, '#5d4037');
    diskGrad.addColorStop(0.4, '#4e342e');
    diskGrad.addColorStop(0.8, '#3e2723');
    diskGrad.addColorStop(1, '#212121');
    ctx.globalAlpha = g;
    ctx.beginPath();
    ctx.arc(0, 0, dR, 0, Math.PI * 2);
    ctx.fillStyle = diskGrad;
    ctx.fill();
    // Phyllotaxis seeds in disk
    const seeds = Math.floor(80 * g);
    const goldenAngle = 137.508 * Math.PI / 180;
    for (let i = 0; i < seeds; i++) {
      const r   = Math.sqrt(i / seeds) * dR * 0.88;
      const ang = i * goldenAngle;
      const sx  = r * Math.cos(ang);
      const sy  = r * Math.sin(ang);
      const sr  = 1.2 + r / dR * 0.8;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      // Alternate dark seeds
      ctx.fillStyle = i % 2 === 0 ? '#6d4c41' : '#4e342e';
      ctx.globalAlpha = 0.85 * g;
      ctx.fill();
    }
    // Highlight on disk
    const hlGrad = ctx.createRadialGradient(-dR*0.3, -dR*0.3, 0, 0, 0, dR);
    hlGrad.addColorStop(0, `rgba(255,255,255,0.12)`);
    hlGrad.addColorStop(1, `transparent`);
    ctx.globalAlpha = g;
    ctx.beginPath();
    ctx.arc(0, 0, dR, 0, Math.PI * 2);
    ctx.fillStyle = hlGrad;
    ctx.fill();
    ctx.restore();
  }
}
// ─── Cherry Blossom ───────────────────────────────────────────────────────────
class Cherry extends Flower {
  constructor(x, y, petalCount) {
    super(x, y, 'cherry', petalCount);
    this.stemHeight *= 0.75;
    // Cherry petals have a notch at the tip
    this.notch = true;
  }
  draw(ctx, wind, t) {
    super.draw(ctx, wind, t);
    if (this.growth < 0.02) return;
    const tip = this.getStemTip();
    const g   = this.growth;
    const pc  = this.petalCount;
    const c   = this.colors;
    ctx.save();
    ctx.translate(tip.x, tip.y);
    ctx.rotate(this.swayAngle + Math.sin(t * 0.35 + this.swayPhase) * 0.015);
    // Petals — cherry blossom style (5 notched petals)
    const numPetals = Math.min(5, pc);
    for (let p = 0; p < numPetals; p++) {
      const angle = (p / numPetals) * Math.PI * 2;
      const pOff  = this.petalOffsets[p % 20] * 0.25;
      ctx.save();
      ctx.rotate(angle + pOff);
      ctx.globalAlpha = 0.88 * g;
      const base  = 4 * g;
      const reach = 20 * g * this.petalLengths[p % 20];
      const w     = 10 * g * this.petalWidths[p % 20];
      // Gradient: center pink → soft white tip
      const grad = ctx.createLinearGradient(base, 0, reach, 0);
      grad.addColorStop(0, c[0]);
      grad.addColorStop(0.7, c[1]);
      grad.addColorStop(1, `rgba(255,255,255,0.95)`);
      // Notched petal (heart-shaped tip)
      ctx.beginPath();
      ctx.moveTo(base, 0);
      ctx.bezierCurveTo(base + reach*0.2, -w*0.9, reach - w*0.4, -w, reach - w*0.3, -w*0.35);
      // Notch in tip
      ctx.quadraticCurveTo(reach, -w*0.05, reach + w*0.18, -w*0.25);
      ctx.bezierCurveTo(reach + w*0.4, -w*0.1, reach + w*0.4, w*0.1, reach + w*0.18, w*0.25);
      ctx.quadraticCurveTo(reach, w*0.05, reach - w*0.3, w*0.35);
      ctx.bezierCurveTo(reach - w*0.4, w, base + reach*0.2, w*0.9, base, 0);
      ctx.fillStyle = grad;
      ctx.fill();
      // Petal vein lines (radiating)
      ctx.strokeStyle = `rgba(255,150,180,0.3)`;
      ctx.lineWidth   = 0.6;
      for (let v = -1; v <= 1; v++) {
        ctx.beginPath();
        ctx.moveTo(base, v * 1.5);
        ctx.lineTo(reach * 0.8, v * w * 0.4);
        ctx.stroke();
      }
      ctx.restore();
    }
    // Stamen cluster
    const stamenCount = 8;
    for (let s = 0; s < stamenCount; s++) {
      const ang = (s / stamenCount) * Math.PI * 2;
      const sr  = 5 * g;
      const ex  = Math.cos(ang) * sr;
      const ey  = Math.sin(ang) * sr;
      ctx.globalAlpha = 0.9 * g;
      ctx.strokeStyle = '#f48fb1';
      ctx.lineWidth   = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      // Anther dot
      ctx.beginPath();
      ctx.arc(ex, ey, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = '#f9a825';
      ctx.fill();
    }
    // Center
    const cg = ctx.createRadialGradient(0,0,0, 0,0,4*g);
    cg.addColorStop(0, '#fff9c4');
    cg.addColorStop(1, '#ffe082');
    ctx.globalAlpha = g;
    ctx.beginPath();
    ctx.arc(0, 0, 4 * g, 0, Math.PI * 2);
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.restore();
  }
}
// ─── Factory ────────────────────────────────────────────────────────────────
function createFlower(x, y, type, petalCount) {
  const pc = petalCount || state.petalCount;
  switch (type) {
    case 'rose':      return new Rose(x, y, pc);
    case 'daisy':     return new Daisy(x, y, pc);
    case 'tulip':     return new Tulip(x, y, pc);
    case 'sunflower': return new Sunflower(x, y, pc);
    case 'cherry':    return new Cherry(x, y, pc);
    default: {
      const types = ['rose','daisy','tulip','sunflower','cherry'];
      return createFlower(x, y, types[randInt(0, types.length - 1)], pc);
    }
  }
}
// ─── Background Drawing ─────────────────────────────────────────────────────
function drawBackground() {
  const W = canvas.width, H = canvas.height;
  const t = state.time;
  let sky1, sky2, groundColor;
  switch (state.ambience) {
    case 'sunset':
      sky1 = '#ff6b35'; sky2 = '#f7c59f'; groundColor = '#8d6e63';
      break;
    case 'night':
      sky1 = '#0a0a2e'; sky2 = '#1a1a4e'; groundColor = '#1b5e20';
      break;
    default: // day
      sky1 = '#87ceeb'; sky2 = '#c8e6c9'; groundColor = '#388e3c';
  }
  // Sky gradient
  const skyG = ctx.createLinearGradient(0, 0, 0, H * 0.75);
  skyG.addColorStop(0, sky1);
  skyG.addColorStop(1, sky2);
  ctx.fillStyle = skyG;
  ctx.fillRect(0, 0, W, H);
  // Ground
  const groundY = H * 0.88;
  const gndG = ctx.createLinearGradient(0, groundY, 0, H);
  gndG.addColorStop(0, groundColor);
  gndG.addColorStop(1, '#1b5e20');
  ctx.fillStyle = gndG;
  ctx.fillRect(0, groundY, W, H - groundY);
  // Gentle ground mound curve
  ctx.beginPath();
  ctx.moveTo(0, groundY + 10);
  for (let x = 0; x <= W; x += W / 12) {
    const y = groundY + 5 + Math.sin(x * 0.006 + t * 0.1) * 6;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fillStyle = groundColor;
  ctx.fill();
  // Ambient light / sun / moon
  if (state.ambience === 'day') {
    // Sun
    const sunX = W * 0.85, sunY = H * 0.1;
    const sunG = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 80);
    sunG.addColorStop(0, 'rgba(255,255,200,1)');
    sunG.addColorStop(0.3, 'rgba(255,240,120,0.8)');
    sunG.addColorStop(1, 'transparent');
    ctx.fillStyle = sunG;
    ctx.fillRect(0, 0, W, H);
    // Sun rays
    ctx.save();
    ctx.translate(sunX, sunY);
    for (let r = 0; r < 8; r++) {
      const ang = (r / 8) * Math.PI * 2 + t * 0.015;
      ctx.strokeStyle = `rgba(255,255,200,${0.15 + 0.05 * Math.sin(t + r)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * 30, Math.sin(ang) * 30);
      ctx.lineTo(Math.cos(ang) * 80, Math.sin(ang) * 80);
      ctx.stroke();
    }
    ctx.restore();
    // Clouds
    drawCloud(ctx, W * 0.2 + Math.sin(t * 0.02) * 5, H * 0.12, 70, 0.65, state.ambience);
    drawCloud(ctx, W * 0.55 + Math.sin(t * 0.015 + 1) * 4, H * 0.08, 50, 0.5, state.ambience);
  } else if (state.ambience === 'night') {
    // Moon
    const moonX = W * 0.15, moonY = H * 0.1;
    const moonG = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 45);
    moonG.addColorStop(0, 'rgba(240,240,255,1)');
    moonG.addColorStop(0.5, 'rgba(200,210,255,0.7)');
    moonG.addColorStop(1, 'transparent');
    ctx.fillStyle = moonG;
    ctx.fillRect(0, 0, W, H);
    // Stars
    if (!state.stars) {
      state.stars = Array.from({length: 120}, () => ({
        x: rand(0, W), y: rand(0, H * 0.55),
        r: rand(0.5, 1.8), blink: rand(0, Math.PI * 2)
      }));
    }
    state.stars.forEach(s => {
      const alpha = 0.5 + 0.5 * Math.sin(t * 0.04 + s.blink);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fill();
    });
  } else {
    // Sunset haze
    const hazeG = ctx.createRadialGradient(W * 0.9, H * 0.15, 0, W * 0.9, H * 0.15, H * 0.5);
    hazeG.addColorStop(0, 'rgba(255,120,50,0.5)');
    hazeG.addColorStop(1, 'transparent');
    ctx.fillStyle = hazeG;
    ctx.fillRect(0, 0, W, H);
  }
}
function drawCloud(ctx, cx, cy, size, alpha, theme) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const col = theme === 'night' ? 'rgba(200,200,230' : 'rgba(255,255,255';
  ctx.fillStyle = `${col},1)`;
  const blobs = [
    [0, 0, size * 0.5],
    [-size * 0.5, size * 0.1, size * 0.38],
    [size * 0.55, size * 0.1, size * 0.38],
    [-size * 0.25, -size * 0.18, size * 0.38],
    [size * 0.3, -size * 0.18, size * 0.35],
  ];
  blobs.forEach(([bx, by, br]) => {
    ctx.beginPath();
    ctx.arc(cx + bx, cy + by, br, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}
// ─── Grass Blades ───────────────────────────────────────────────────────────
let grassBlades = null;
function initGrass() {
  const W = canvas.width, H = canvas.height;
  grassBlades = Array.from({length: 180}, () => ({
    x    : rand(0, W),
    y    : rand(H * 0.85, H * 0.92),
    h    : rand(12, 32),
    w    : rand(1.5, 3),
    col  : `hsl(${rand(100,130)}, ${rand(50,70)}%, ${rand(22,38)}%)`,
    phase: rand(0, Math.PI * 2),
    sway : rand(0.3, 0.8),
  }));
}
function drawGrass(t, wind) {
  if (!grassBlades) initGrass();
  grassBlades.forEach(b => {
    const swayX = Math.sin(t * 0.7 + b.phase) * b.sway * (1 + wind * 0.3);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(swayX * 0.5, -b.h * 0.5, swayX, -b.h);
    ctx.strokeStyle = b.col;
    ctx.lineWidth   = b.w;
    ctx.lineCap     = 'round';
    ctx.stroke();
    ctx.restore();
  });
}
// ─── Main Render Loop ────────────────────────────────────────────────────────
function render() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  state.time += 0.5;
  const t    = state.time;
  const wind = state.windSpeed;
  // Background
  drawBackground();
  drawGrass(t, wind);
  // Update & draw flowers
  state.flowers.forEach(f => {
    f.update(state.growthSpeed, wind, t);
    f.emitPollen(state.particles);
    f.draw(ctx, wind, t);
  });
  // Update & draw particles
  if (state.showPollen) {
    state.particles = state.particles.filter(p => p.life > 0);
    state.particles.forEach(p => {
      p.update(wind, t);
      p.draw(ctx);
    });
    // Cap particles
    if (state.particles.length > 400) {
      state.particles.splice(0, state.particles.length - 400);
    }
  }
  // Update stats
  document.getElementById('stat-flowers').textContent  = state.flowers.length;
  document.getElementById('stat-particles').textContent = state.particles.length;
  document.getElementById('stat-wind').textContent      = wind.toFixed(1);
  requestAnimationFrame(render);
}
// ─── UI Controls ─────────────────────────────────────────────────────────────
// Canvas click → plant
canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const type = state.flowerType === 'random'
    ? ['rose','daisy','tulip','sunflower','cherry'][randInt(0,4)]
    : state.flowerType;
  state.flowers.push(createFlower(x, y, type));
});
// Mouse track for wind drag
canvas.addEventListener('mousemove', e => {
  const dx = e.clientX - state.lastMX;
  state.lastMX = e.clientX;
  if (state.isDragging) {
    state.windSpeed = clamp(state.windSpeed + dx * 0.05, 0, 10);
    document.getElementById('wind-slider').value = state.windSpeed;
    document.getElementById('wind-val').textContent = state.windSpeed.toFixed(1);
  }
  state.mouseX = e.clientX;
  state.mouseY = e.clientY;
});
canvas.addEventListener('mousedown', () => { state.isDragging = true; });
canvas.addEventListener('mouseup',   () => { state.isDragging = false; });
// Flower type buttons
document.querySelectorAll('.flower-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.flower-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.flowerType = btn.dataset.type;
  });
});
// Wind slider
const windSlider = document.getElementById('wind-slider');
windSlider.addEventListener('input', () => {
  state.windSpeed = parseFloat(windSlider.value);
  document.getElementById('wind-val').textContent = state.windSpeed.toFixed(1);
});
// Growth slider
const growthSlider = document.getElementById('growth-slider');
growthSlider.addEventListener('input', () => {
  state.growthSpeed = parseFloat(growthSlider.value);
  document.getElementById('growth-val').textContent = state.growthSpeed;
});
// Petal slider
const petalSlider = document.getElementById('petal-slider');
petalSlider.addEventListener('input', () => {
  state.petalCount = parseInt(petalSlider.value);
  document.getElementById('petal-val').textContent = state.petalCount;
});
// Ambience buttons
document.querySelectorAll('.amb-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.amb-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.ambience = btn.dataset.mode;
    document.body.className = '';
    document.body.classList.add(`theme-${state.ambience}`);
    state.stars = null; // reset stars on change
  });
});
// Pollen toggle
const pollenToggle = document.getElementById('pollen-toggle');
pollenToggle.addEventListener('change', () => {
  state.showPollen = pollenToggle.checked;
  document.getElementById('pollen-toggle-label').textContent = state.showPollen ? 'On' : 'Off';
  if (!state.showPollen) state.particles = [];
});
// Plant 5 Random
document.getElementById('btn-plant-random').addEventListener('click', () => {
  const W = canvas.width, H = canvas.height;
  const types = ['rose','daisy','tulip','sunflower','cherry'];
  for (let i = 0; i < 5; i++) {
    const x = rand(W * 0.1, W * 0.85);
    const y = rand(H * 0.6, H * 0.88);
    const t = types[randInt(0, types.length - 1)];
    state.flowers.push(createFlower(x, y, t));
  }
});
// Clear Garden
document.getElementById('btn-clear').addEventListener('click', () => {
  state.flowers   = [];
  state.particles = [];
});
// ─── Initial Garden ─────────────────────────────────────────────────────────
function plantInitialGarden() {
  const W = canvas.width, H = canvas.height;
  const types = ['rose','daisy','tulip','sunflower','cherry'];
  const count = Math.min(8, Math.floor(W / 120));
  for (let i = 0; i < count; i++) {
    const x = rand(W * 0.06, W * 0.88);
    const y = rand(H * 0.62, H * 0.86);
    const t = types[randInt(0, types.length - 1)];
    state.flowers.push(createFlower(x, y, t));
  }
}
// ─── Boot ───────────────────────────────────────────────────────────────────
document.body.classList.add('theme-day');
plantInitialGarden();
render();
