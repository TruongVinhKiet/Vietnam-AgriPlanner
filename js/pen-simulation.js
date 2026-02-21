/**
 * Pen Simulation - Canvas-based animal visualization
 * Renders animated animals inside pens with movement behaviors
 * Enhanced: Feeding, Petting, Cleaning, Day/Night, Weather, Growth, Sick, Sound
 */

// ==================== PARTICLE SYSTEMS ====================

class FoodParticle {
    constructor(x, y, isWater) {
        this.x = x; this.y = y;
        this.radius = isWater ? 2 : 3;
        this.color = isWater ? '#d4a574' : '#c4860b';
        this.alpha = 1; this.life = 1;
        this.isWater = isWater;
        this.sinkSpeed = isWater ? 0.15 : 0;
        this.eaten = false;
    }
    update(dt) {
        if (this.eaten) { this.life -= dt * 0.008; this.alpha = Math.max(0, this.life); }
        if (this.isWater) this.y += this.sinkSpeed;
    }
    draw(ctx) {
        if (this.life <= 0) return;
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
    }
}

class HeartParticle {
    constructor(x, y) {
        this.x = x + (Math.random() - 0.5) * 10;
        this.y = y - 10;
        this.vy = -0.4 - Math.random() * 0.3;
        this.vx = (Math.random() - 0.5) * 0.3;
        this.alpha = 1; this.life = 1;
        this.size = 6 + Math.random() * 4;
        this.rotation = (Math.random() - 0.5) * 0.3;
    }
    update(dt) {
        this.life -= dt * 0.003;
        this.alpha = Math.max(0, this.life);
        this.x += this.vx; this.y += this.vy;
        this.vy -= 0.002; // float up faster
    }
    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save(); ctx.globalAlpha = this.alpha;
        ctx.translate(this.x, this.y); ctx.rotate(this.rotation);
        ctx.fillStyle = '#ef4444';
        ctx.font = `${this.size}px sans-serif`;
        ctx.textAlign = 'center'; ctx.fillText('❤', 0, 0);
        ctx.restore();
    }
}

class SparkleParticle {
    constructor(x, y) {
        this.x = x; this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.3 + Math.random() * 0.5;
        this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed;
        this.alpha = 1; this.life = 1;
        this.size = 3 + Math.random() * 3;
    }
    update(dt) {
        this.life -= dt * 0.004;
        this.alpha = Math.max(0, this.life * (0.5 + Math.sin(Date.now() * 0.01) * 0.5));
        this.x += this.vx; this.y += this.vy;
        this.vx *= 0.98; this.vy *= 0.98;
    }
    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save(); ctx.globalAlpha = this.alpha;
        ctx.fillStyle = '#fbbf24';
        ctx.font = `${this.size}px sans-serif`;
        ctx.textAlign = 'center'; ctx.fillText('✨', this.x, this.y);
        ctx.restore();
    }
}

class RainDrop {
    constructor(w, h) {
        this.reset(w, h, true);
    }
    reset(w, h, initial) {
        this.x = Math.random() * (w + 60) - 30;
        this.y = initial ? Math.random() * h : -5;
        this.len = 8 + Math.random() * 12;
        this.speed = 4 + Math.random() * 4;
        this.alpha = 0.15 + Math.random() * 0.2;
    }
    update(w, h) {
        this.x += 1.5; this.y += this.speed;
        if (this.y > h) this.reset(w, h, false);
    }
    draw(ctx) {
        ctx.strokeStyle = `rgba(174,194,224,${this.alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + 2, this.y + this.len);
        ctx.stroke();
    }
}

// ==================== AMBIENT AUDIO (Web Audio Synthesis) ====================

class AmbientAudio {
    constructor() {
        this.ctx = null; this.enabled = false; this.gainNode = null;
        this.sources = []; this.interval = null; this.type = null;
    }
    _init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.value = 0.08;
        this.gainNode.connect(this.ctx.destination);
    }
    toggle() {
        this.enabled = !this.enabled;
        if (this.enabled) { this._init(); this._startLoop(); }
        else this._stopLoop();
        return this.enabled;
    }
    setType(category, farmingType) {
        const wasEnabled = this.enabled;
        this._stopLoop();
        const isWater = ['FRESHWATER', 'BRACKISH', 'SALTWATER'].includes(category);
        if (isWater || farmingType === 'POND' || farmingType === 'TANK') this.type = 'water';
        else if (farmingType === 'FREE_RANGE' || farmingType === 'BACKYARD') this.type = 'field';
        else this.type = 'barn';
        if (wasEnabled) this._startLoop();
    }
    _startLoop() {
        if (!this.ctx || !this.enabled) return;
        this._playOnce();
        const delay = this.type === 'water' ? 3000 : 5000 + Math.random() * 8000;
        this.interval = setInterval(() => { if (this.enabled) this._playOnce(); }, delay);
    }
    _stopLoop() { clearInterval(this.interval); this.interval = null; }
    _playOnce() {
        if (!this.ctx || !this.enabled) return;
        try {
            if (this.type === 'water') this._waterSound();
            else if (this.type === 'field') this._birdChirp();
            else this._barnSound();
        } catch (e) { /* ignore audio errors */ }
    }
    _waterSound() {
        const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.8, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.3;
        const src = this.ctx.createBufferSource(); src.buffer = buf;
        const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
        src.connect(f); f.connect(this.gainNode); src.start(); src.stop(this.ctx.currentTime + 0.8);
    }
    _birdChirp() {
        const osc = this.ctx.createOscillator(); osc.type = 'sine';
        const g = this.ctx.createGain(); g.gain.setValueAtTime(0, this.ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + 0.02);
        g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.15);
        osc.frequency.setValueAtTime(2000 + Math.random() * 1500, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(2500 + Math.random() * 1000, this.ctx.currentTime + 0.08);
        osc.frequency.linearRampToValueAtTime(1800 + Math.random() * 800, this.ctx.currentTime + 0.15);
        osc.connect(g); g.connect(this.gainNode); osc.start(); osc.stop(this.ctx.currentTime + 0.2);
    }
    _barnSound() {
        const osc = this.ctx.createOscillator(); osc.type = 'sawtooth';
        const g = this.ctx.createGain(); g.gain.setValueAtTime(0, this.ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.06, this.ctx.currentTime + 0.05);
        g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.4);
        const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
        osc.frequency.setValueAtTime(180 + Math.random() * 80, this.ctx.currentTime);
        osc.connect(f); f.connect(g); g.connect(this.gainNode); osc.start(); osc.stop(this.ctx.currentTime + 0.5);
    }
    destroy() { this._stopLoop(); if (this.ctx) { this.ctx.close(); this.ctx = null; } }
}

// ==================== ENVIRONMENT RENDERER ====================

class Environment {
    static draw(ctx, w, h, farmingType, waterType) {
        ctx.save();
        switch (farmingType) {
            case 'POND':
            case 'TANK':
                Environment.drawWater(ctx, w, h, waterType);
                break;
            case 'FREE_RANGE':
            case 'BACKYARD':
                Environment.drawGrass(ctx, w, h);
                break;
            case 'BARN':
            case 'CAGE':
            case 'INDUSTRIAL':
            default:
                Environment.drawBarn(ctx, w, h);
                break;
        }
        ctx.restore();
    }

    static drawBarn(ctx, w, h) {
        // Warm wooden floor
        ctx.fillStyle = '#f5e6d3';
        ctx.fillRect(0, 0, w, h);

        // Subtle wood grain pattern
        ctx.strokeStyle = 'rgba(139, 90, 43, 0.06)';
        ctx.lineWidth = 1;
        for (let y = 0; y < h; y += 18) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            for (let x = 0; x < w; x += 5) {
                ctx.lineTo(x, y + Math.sin(x * 0.02 + y * 0.1) * 2);
            }
            ctx.stroke();
        }

        // Fence border
        ctx.strokeStyle = '#a0845c';
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.strokeStyle = '#c4a36e';
        ctx.lineWidth = 2;
        ctx.strokeRect(6, 6, w - 12, h - 12);

        // Corner posts
        const postSize = 12;
        ctx.fillStyle = '#8B6914';
        [[0, 0], [w - postSize, 0], [0, h - postSize], [w - postSize, h - postSize]].forEach(([x, y]) => {
            ctx.fillRect(x, y, postSize, postSize);
        });
    }

    static drawGrass(ctx, w, h) {
        // Green grass base
        ctx.fillStyle = '#e8f5e9';
        ctx.fillRect(0, 0, w, h);

        // Grass patches
        const rng = Environment._seededRandom(42);
        ctx.fillStyle = 'rgba(76, 175, 80, 0.08)';
        for (let i = 0; i < 30; i++) {
            const x = rng() * w;
            const y = rng() * h;
            const r = 20 + rng() * 40;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        // Tiny grass blades
        ctx.strokeStyle = 'rgba(56, 142, 60, 0.12)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 100; i++) {
            const x = rng() * w;
            const y = rng() * h;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + (rng() - 0.5) * 4, y - 4 - rng() * 6);
            ctx.stroke();
        }

        // Fence — lighter, wooden style
        ctx.strokeStyle = 'rgba(139, 69, 19, 0.3)';
        ctx.lineWidth = 3;
        ctx.setLineDash([12, 6]);
        ctx.strokeRect(4, 4, w - 8, h - 8);
        ctx.setLineDash([]);
    }

    static drawWater(ctx, w, h, waterType) {
        // Water gradient
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        if (waterType === 'SALTWATER') {
            grad.addColorStop(0, '#e0f2fe');
            grad.addColorStop(1, '#bae6fd');
        } else if (waterType === 'BRACKISH') {
            grad.addColorStop(0, '#e0f2f1');
            grad.addColorStop(1, '#b2dfdb');
        } else {
            grad.addColorStop(0, '#e8f5e9');
            grad.addColorStop(1, '#c8e6c9');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Water ripple circles
        const time = Date.now() * 0.001;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        const rng = Environment._seededRandom(7);
        for (let i = 0; i < 8; i++) {
            const cx = rng() * w;
            const cy = rng() * h;
            const phase = rng() * Math.PI * 2;
            const r = 10 + Math.sin(time * 0.8 + phase) * 8;
            ctx.beginPath();
            ctx.arc(cx, cy, Math.abs(r), 0, Math.PI * 2);
            ctx.stroke();
        }

        // Pond/tank border
        ctx.strokeStyle = 'rgba(96, 125, 139, 0.4)';
        ctx.lineWidth = 4;
        Environment._roundRect(ctx, 2, 2, w - 4, h - 4, 16);
        ctx.stroke();
    }

    static _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    static _seededRandom(seed) {
        let s = seed;
        return () => {
            s = (s * 16807 + 0) % 2147483647;
            return s / 2147483647;
        };
    }
}

// ==================== ANIMAL SHAPES ====================

class AnimalShapes {
    // --- Large livestock ---
    static drawCattle(ctx, x, y, r, dir, phase, variant) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(dir);
        const c = variant === 'buffalo' ? '#5d4037' : variant === 'dairy' ? '#f5f5f5' : '#8d6e63';
        // Body oval
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.ellipse(0, 0, r * 1.3, r, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1; ctx.stroke();
        // Spots for dairy
        if (variant === 'dairy') {
            ctx.fillStyle = '#333';
            ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.3, r * 0.3, r * 0.2, 0.3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(r * 0.4, r * 0.2, r * 0.25, r * 0.15, -0.5, 0, Math.PI * 2); ctx.fill();
        }
        // Head
        ctx.fillStyle = variant === 'buffalo' ? '#4e342e' : '#a1887f';
        ctx.beginPath(); ctx.arc(r * 1.1, 0, r * 0.5, 0, Math.PI * 2); ctx.fill();
        // Horns
        ctx.strokeStyle = variant === 'buffalo' ? '#3e2723' : '#bcaaa4';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(r * 1.3, -r * 0.3); ctx.quadraticCurveTo(r * 1.6, -r * 0.7, r * 1.4, -r * 0.9); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r * 1.3, r * 0.3); ctx.quadraticCurveTo(r * 1.6, r * 0.7, r * 1.4, r * 0.9); ctx.stroke();
        // Eye
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(r * 1.3, -r * 0.15, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    static drawPig(ctx, x, y, r, dir, phase) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(dir);
        // Body
        ctx.fillStyle = '#f8bbd0';
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 1; ctx.stroke();
        // Snout
        ctx.fillStyle = '#f48fb1';
        ctx.beginPath(); ctx.ellipse(r * 0.9, 0, r * 0.35, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
        // Nostrils
        ctx.fillStyle = '#e91e63';
        ctx.beginPath(); ctx.arc(r * 1.0, -r * 0.08, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 1.0, r * 0.08, 1.5, 0, Math.PI * 2); ctx.fill();
        // Ears
        ctx.fillStyle = '#f48fb1';
        ctx.beginPath(); ctx.ellipse(-r * 0.5, -r * 0.7, r * 0.3, r * 0.2, -0.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-r * 0.5, r * 0.7, r * 0.3, r * 0.2, 0.4, 0, Math.PI * 2); ctx.fill();
        // Curly tail
        ctx.strokeStyle = '#f48fb1'; ctx.lineWidth = 2;
        const tw = Math.sin(phase * 3) * 0.3;
        ctx.beginPath(); ctx.moveTo(-r, 0);
        ctx.quadraticCurveTo(-r * 1.3, -r * 0.5 + tw, -r * 1.1, -r * 0.8 + tw); ctx.stroke();
        // Eye
        ctx.fillStyle = '#333';
        ctx.beginPath(); ctx.arc(r * 0.5, -r * 0.25, 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    static drawGoatSheep(ctx, x, y, r, dir, phase, variant) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(dir);
        if (variant === 'sheep') {
            // Woolly body
            ctx.fillStyle = '#efebe9';
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2;
                ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3, r * 0.6, 0, Math.PI * 2); ctx.fill();
            }
        } else {
            // Goat body
            ctx.fillStyle = '#a1887f';
            ctx.beginPath(); ctx.ellipse(0, 0, r * 1.1, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 1;
        // Head
        ctx.fillStyle = variant === 'sheep' ? '#d7ccc8' : '#8d6e63';
        ctx.beginPath(); ctx.ellipse(r * 0.9, 0, r * 0.4, r * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // Horns (goat has bigger)
        if (variant === 'goat') {
            ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(r * 0.7, -r * 0.2); ctx.quadraticCurveTo(r * 0.3, -r * 0.9, r * 0.8, -r * 1.0); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(r * 0.7, r * 0.2); ctx.quadraticCurveTo(r * 0.3, r * 0.9, r * 0.8, r * 1.0); ctx.stroke();
        }
        // Eye
        ctx.fillStyle = '#333';
        ctx.beginPath(); ctx.arc(r * 1.05, -r * 0.1, 1.5, 0, Math.PI * 2); ctx.fill();
        // Legs
        ctx.strokeStyle = variant === 'sheep' ? '#795548' : '#6d4c41'; ctx.lineWidth = 2;
        const legBob = Math.sin(phase * 4) * 2;
        ctx.beginPath(); ctx.moveTo(-r * 0.4, r * 0.6); ctx.lineTo(-r * 0.5, r * 1.2 + legBob); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r * 0.3, r * 0.6); ctx.lineTo(r * 0.2, r * 1.2 - legBob); ctx.stroke();
        ctx.restore();
    }

    static drawPoultry(ctx, x, y, r, dir, phase, variant) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(dir);
        const isQuail = variant === 'quail';
        const bodyColor = isQuail ? '#8d6e63' : '#ff9800';
        // Body (teardrop)
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.moveTo(-r, 0);
        ctx.quadraticCurveTo(-r * 0.3, -r * 0.9, r * 0.6, 0);
        ctx.quadraticCurveTo(-r * 0.3, r * 0.9, -r, 0);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 1; ctx.stroke();
        // Wing
        ctx.fillStyle = isQuail ? '#6d4c41' : '#f57c00';
        ctx.beginPath();
        ctx.ellipse(-r * 0.1, r * 0.15, r * 0.5, r * 0.3, 0.2, 0, Math.PI * 2); ctx.fill();
        // Head
        ctx.fillStyle = isQuail ? '#795548' : '#ffa726';
        ctx.beginPath(); ctx.arc(r * 0.7, -r * 0.15, r * 0.3, 0, Math.PI * 2); ctx.fill();
        // Beak
        ctx.fillStyle = '#ffab40';
        ctx.beginPath(); ctx.moveTo(r * 0.95, -r * 0.15);
        ctx.lineTo(r * 1.2, -r * 0.05); ctx.lineTo(r * 0.95, -r * 0.0); ctx.fill();
        // Comb (chicken only)
        if (!isQuail) {
            ctx.fillStyle = '#e53935';
            ctx.beginPath(); ctx.arc(r * 0.65, -r * 0.42, r * 0.15, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(r * 0.8, -r * 0.38, r * 0.12, 0, Math.PI * 2); ctx.fill();
        }
        // Eye
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(r * 0.8, -r * 0.22, 1.5, 0, Math.PI * 2); ctx.fill();
        // Legs
        ctx.strokeStyle = '#ff8f00'; ctx.lineWidth = 1.5;
        const peck = Math.sin(phase * 5) * 1.5;
        ctx.beginPath(); ctx.moveTo(r * 0.1, r * 0.5); ctx.lineTo(r * 0.1, r * 1.0 + peck); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-r * 0.3, r * 0.5); ctx.lineTo(-r * 0.3, r * 1.0 - peck); ctx.stroke();
        // Tail feathers
        ctx.strokeStyle = isQuail ? '#5d4037' : '#e65100'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-r * 0.9, 0); ctx.lineTo(-r * 1.4, -r * 0.3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-r * 0.9, 0); ctx.lineTo(-r * 1.4, r * 0.1); ctx.stroke();
        ctx.restore();
    }

    static drawWaterfowl(ctx, x, y, r, dir, phase, variant) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(dir);
        const isDuck = variant === 'duck';
        const isGoose = variant === 'goose';
        const bodyColor = isDuck ? '#f5f5f5' : isGoose ? '#e0e0e0' : '#bdbdbd';
        // Body
        ctx.fillStyle = bodyColor;
        ctx.beginPath(); ctx.ellipse(0, 0, r * 1.2, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 1; ctx.stroke();
        // Neck
        const neckLen = isGoose ? r * 1.2 : r * 0.8;
        const neckSway = Math.sin(phase * 2) * 0.1;
        ctx.strokeStyle = bodyColor; ctx.lineWidth = r * 0.4;
        ctx.beginPath(); ctx.moveTo(r * 0.6, 0);
        ctx.quadraticCurveTo(r * 0.8, -neckLen * 0.5 + neckSway, r * 0.6, -neckLen); ctx.stroke();
        // Head
        ctx.fillStyle = isDuck ? '#2e7d32' : bodyColor;
        ctx.beginPath(); ctx.arc(r * 0.6, -neckLen, r * 0.25, 0, Math.PI * 2); ctx.fill();
        // Beak
        ctx.fillStyle = '#ff8f00';
        ctx.beginPath(); ctx.moveTo(r * 0.85, -neckLen);
        ctx.lineTo(r * 1.1, -neckLen + r * 0.08); ctx.lineTo(r * 0.85, -neckLen + r * 0.15); ctx.fill();
        // Eye
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(r * 0.68, -neckLen - r * 0.08, 1.2, 0, Math.PI * 2); ctx.fill();
        // Tail
        ctx.fillStyle = isDuck ? '#1b5e20' : '#9e9e9e';
        ctx.beginPath(); ctx.moveTo(-r * 1.0, 0);
        ctx.lineTo(-r * 1.5, -r * 0.2); ctx.lineTo(-r * 1.5, r * 0.2); ctx.closePath(); ctx.fill();
        ctx.restore();
    }

    static drawFish(ctx, x, y, r, dir, phase, color) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(dir);
        const tailSwing = Math.sin(phase * 5) * 0.3;
        // Body
        ctx.fillStyle = color || '#26a69a';
        ctx.beginPath();
        ctx.moveTo(r * 1.0, 0);
        ctx.quadraticCurveTo(r * 0.3, -r * 0.8, -r * 0.5, 0);
        ctx.quadraticCurveTo(r * 0.3, r * 0.8, r * 1.0, 0);
        ctx.fill();
        // Tail fin
        ctx.beginPath();
        ctx.moveTo(-r * 0.4, 0);
        ctx.lineTo(-r * 1.1, -r * 0.5 + tailSwing * r);
        ctx.lineTo(-r * 1.1, r * 0.5 + tailSwing * r);
        ctx.closePath(); ctx.fill();
        // Dorsal fin
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath(); ctx.moveTo(r * 0.4, -r * 0.55);
        ctx.quadraticCurveTo(0, -r * 1.0, -r * 0.3, -r * 0.4); ctx.lineTo(r * 0.4, -r * 0.55); ctx.fill();
        // Eye
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(r * 0.55, -r * 0.15, r * 0.18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(r * 0.6, -r * 0.15, r * 0.1, 0, Math.PI * 2); ctx.fill();
        // Scale shimmer
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 0.5;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath(); ctx.arc(r * (0.1 - i * 0.25), 0, r * 0.3, -0.5, 0.5); ctx.stroke();
        }
        ctx.restore();
    }

    static drawShrimp(ctx, x, y, r, dir, phase, variant) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(dir);
        const isLobster = variant === 'lobster';
        const c = isLobster ? '#d84315' : '#ff7043';
        const curl = Math.sin(phase * 3) * 0.15;
        // Body segments
        ctx.fillStyle = c;
        for (let i = 0; i < 5; i++) {
            const sx = r * 0.5 - i * r * 0.35;
            const sy = i * r * 0.1 * curl;
            ctx.beginPath(); ctx.ellipse(sx, sy, r * 0.3, r * 0.2, 0, 0, Math.PI * 2); ctx.fill();
        }
        // Antennae
        ctx.strokeStyle = c; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(r * 0.7, 0); ctx.quadraticCurveTo(r * 1.3, -r * 0.6, r * 1.5, -r * 0.8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r * 0.7, 0); ctx.quadraticCurveTo(r * 1.3, r * 0.4, r * 1.5, r * 0.3); ctx.stroke();
        // Claws for lobster
        if (isLobster) {
            ctx.fillStyle = '#bf360c';
            ctx.beginPath(); ctx.ellipse(r * 0.9, -r * 0.3, r * 0.3, r * 0.15, -0.3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(r * 0.9, r * 0.3, r * 0.3, r * 0.15, 0.3, 0, Math.PI * 2); ctx.fill();
        }
        // Eye
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(r * 0.65, -r * 0.15, 1.3, 0, Math.PI * 2); ctx.fill();
        // Tail fan
        ctx.beginPath(); ctx.moveTo(-r * 0.9, 0);
        ctx.lineTo(-r * 1.3, -r * 0.3); ctx.lineTo(-r * 1.4, 0); ctx.lineTo(-r * 1.3, r * 0.3);
        ctx.closePath(); ctx.fill();
        ctx.restore();
    }

    static drawCrab(ctx, x, y, r, dir, phase) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(dir);
        const clawWave = Math.sin(phase * 2) * 0.2;
        // Shell
        ctx.fillStyle = '#d84315';
        ctx.beginPath(); ctx.ellipse(0, 0, r * 1.0, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1; ctx.stroke();
        // Shell pattern
        ctx.strokeStyle = 'rgba(191,54,12,0.4)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(0, 0, r * 0.6, r * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
        // Eyes on stalks
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(r * 0.4, -r * 0.65, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-r * 0.4, -r * 0.65, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#bf360c'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(r * 0.3, -r * 0.4); ctx.lineTo(r * 0.4, -r * 0.65); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 0.4); ctx.lineTo(-r * 0.4, -r * 0.65); ctx.stroke();
        // Claws
        ctx.fillStyle = '#e64a19';
        ctx.beginPath(); ctx.ellipse(r * 1.2, -r * 0.2 + clawWave * r, r * 0.35, r * 0.2, 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-r * 1.2, -r * 0.2 - clawWave * r, r * 0.35, r * 0.2, -0.4, 0, Math.PI * 2); ctx.fill();
        // Legs
        ctx.strokeStyle = '#bf360c'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
            const ly = r * 0.2 + i * r * 0.25;
            ctx.beginPath(); ctx.moveTo(r * 0.7, ly); ctx.lineTo(r * 1.3, ly + r * 0.3); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-r * 0.7, ly); ctx.lineTo(-r * 1.3, ly + r * 0.3); ctx.stroke();
        }
        ctx.restore();
    }

    static drawMollusc(ctx, x, y, r, dir, phase, variant) {
        ctx.save(); ctx.translate(x, y);
        if (variant === 'snail') {
            // Spiral shell
            ctx.fillStyle = '#8d6e63';
            ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(r * 0.1, -r * 0.1, r * 0.5, 0, Math.PI * 1.5); ctx.stroke();
            ctx.beginPath(); ctx.arc(r * 0.15, -r * 0.05, r * 0.25, 0, Math.PI); ctx.stroke();
            // Body extending
            ctx.fillStyle = '#a1887f';
            ctx.beginPath(); ctx.ellipse(r * 0.7, r * 0.3, r * 0.4, r * 0.2, 0.3, 0, Math.PI * 2); ctx.fill();
            // Eyes on stalks
            ctx.strokeStyle = '#a1887f'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(r * 0.9, r * 0.2); ctx.lineTo(r * 1.1, -r * 0.1); ctx.stroke();
            ctx.fillStyle = '#333';
            ctx.beginPath(); ctx.arc(r * 1.1, -r * 0.1, 1, 0, Math.PI * 2); ctx.fill();
        } else {
            // Bivalve shell (oyster, clam, mussel)
            ctx.fillStyle = variant === 'oyster' ? '#9e9e9e' : '#78909c';
            ctx.beginPath(); ctx.ellipse(0, 0, r * 0.9, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1; ctx.stroke();
            // Shell ridges
            ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 0.8;
            for (let i = 1; i < 4; i++) {
                ctx.beginPath(); ctx.ellipse(0, 0, r * 0.9 * (i / 4), r * 0.6 * (i / 4), 0, 0, Math.PI * 2); ctx.stroke();
            }
            // Slightly open
            ctx.fillStyle = '#e0e0e0';
            ctx.beginPath(); ctx.ellipse(r * 0.3, 0, r * 0.15, r * 0.05, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }

    static drawEel(ctx, x, y, r, dir, phase) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(dir);
        const segments = 8;
        ctx.fillStyle = '#455a64';
        ctx.strokeStyle = '#37474f'; ctx.lineWidth = 1;
        // Sinuous body
        ctx.beginPath();
        ctx.moveTo(r * 1.2, 0);
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const sx = r * 1.2 - t * r * 2.8;
            const sy = Math.sin(phase * 4 + t * Math.PI * 2) * r * 0.3 * t;
            const w = r * 0.4 * (1 - t * 0.6);
            if (i === 0) { ctx.ellipse(sx, sy, r * 0.35, r * 0.35, 0, 0, Math.PI * 2); }
            else { ctx.ellipse(sx, sy, r * 0.2, w, 0, 0, Math.PI * 2); }
        }
        ctx.fill();
        // Eye
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(r * 1.0, -r * 0.1, r * 0.12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(r * 1.05, -r * 0.1, r * 0.06, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    static drawFrog(ctx, x, y, r, dir, phase) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(dir);
        // Body
        ctx.fillStyle = '#4caf50';
        ctx.beginPath(); ctx.ellipse(0, 0, r * 1.0, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
        // Belly
        ctx.fillStyle = '#c8e6c9';
        ctx.beginPath(); ctx.ellipse(r * 0.1, r * 0.1, r * 0.6, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        // Big eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(r * 0.5, -r * 0.55, r * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.55, r * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(r * 0.55, -r * 0.55, r * 0.15, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-r * 0.15, -r * 0.55, r * 0.15, 0, Math.PI * 2); ctx.fill();
        // Back legs
        const legKick = Math.sin(phase * 3) * r * 0.2;
        ctx.strokeStyle = '#388e3c'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(-r * 0.6, r * 0.4); ctx.quadraticCurveTo(-r * 1.3, r * 0.8 + legKick, -r * 1.0, r * 1.0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.2); ctx.quadraticCurveTo(-r * 1.3, -r * 0.6 - legKick, -r * 1.0, -r * 0.8); ctx.stroke();
        ctx.restore();
    }

    static drawBee(ctx, x, y, r, dir, phase) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(dir);
        // Wings (fluttering)
        const wingAngle = Math.sin(phase * 15) * 0.4;
        ctx.fillStyle = 'rgba(200,220,255,0.5)';
        ctx.beginPath(); ctx.ellipse(0, -r * 0.5, r * 0.7, r * 0.3, wingAngle - 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, r * 0.5, r * 0.7, r * 0.3, -wingAngle + 0.3, 0, Math.PI * 2); ctx.fill();
        // Body stripes
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = i % 2 === 0 ? '#ffc107' : '#333';
            const bx = r * 0.5 - i * r * 0.35;
            ctx.beginPath(); ctx.ellipse(bx, 0, r * 0.25, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
        }
        // Head
        ctx.fillStyle = '#333';
        ctx.beginPath(); ctx.arc(r * 0.7, 0, r * 0.22, 0, Math.PI * 2); ctx.fill();
        // Antennae
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(r * 0.85, -r * 0.1); ctx.lineTo(r * 1.1, -r * 0.35); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r * 0.85, r * 0.1); ctx.lineTo(r * 1.1, r * 0.25); ctx.stroke();
        // Stinger
        ctx.beginPath(); ctx.moveTo(-r * 0.7, 0); ctx.lineTo(-r * 0.95, 0); ctx.stroke();
        ctx.restore();
    }

    static drawSilkworm(ctx, x, y, r, dir, phase) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(dir);
        const segWave = Math.sin(phase * 2) * r * 0.05;
        // Body segments
        for (let i = 0; i < 6; i++) {
            const sx = r * 0.6 - i * r * 0.3;
            const sy = Math.sin(phase * 2 + i * 0.5) * r * 0.08;
            ctx.fillStyle = i === 0 ? '#d7ccc8' : (i % 2 === 0 ? '#efebe9' : '#e8e0db');
            ctx.beginPath(); ctx.ellipse(sx + segWave * i, sy, r * 0.22, r * 0.28, 0, 0, Math.PI * 2); ctx.fill();
        }
        // Head
        ctx.fillStyle = '#bcaaa4';
        ctx.beginPath(); ctx.arc(r * 0.75, 0, r * 0.2, 0, Math.PI * 2); ctx.fill();
        // Tiny eyes
        ctx.fillStyle = '#555';
        ctx.beginPath(); ctx.arc(r * 0.85, -r * 0.06, 1, 0, Math.PI * 2); ctx.fill();
        // Tiny legs
        ctx.strokeStyle = '#bcaaa4'; ctx.lineWidth = 0.8;
        for (let i = 1; i < 5; i++) {
            const lx = r * 0.6 - i * r * 0.3;
            ctx.beginPath(); ctx.moveTo(lx, r * 0.25); ctx.lineTo(lx, r * 0.4); ctx.stroke();
        }
        ctx.restore();
    }
}

// ==================== PEN FURNITURE ====================

class PenFurniture {
    static draw(ctx, w, h, animalName, farmingType, time) {
        const name = (animalName || '').toLowerCase();
        if (farmingType === 'POND' || farmingType === 'TANK') {
            PenFurniture.drawAquaticDecor(ctx, w, h, name, time);
        } else if (farmingType === 'CAGED' || farmingType === 'BARN' || farmingType === 'INDUSTRIAL') {
            PenFurniture.drawBarnFurniture(ctx, w, h, name);
        } else {
            PenFurniture.drawFreeRangeFurniture(ctx, w, h, name);
        }
        // Special: beehives, silkworm trays
        if (name.includes('ong')) PenFurniture.drawBeehiveFrames(ctx, w, h);
        if (name.includes('tằm')) PenFurniture.drawSilkwormTrays(ctx, w, h);
    }

    static drawBarnFurniture(ctx, w, h, name) {
        const nm = (name || '').toLowerCase();
        // Feeding trough (top-left)
        ctx.fillStyle = '#8d6e63';
        ctx.fillRect(20, 20, w * 0.25, 18);
        ctx.fillStyle = '#a1887f';
        ctx.fillRect(22, 22, w * 0.25 - 4, 14);
        ctx.fillStyle = '#d4a574';
        ctx.fillRect(24, 26, w * 0.25 - 8, 8);

        // Water trough (top-right)
        ctx.fillStyle = '#78909c';
        ctx.fillRect(w - w * 0.2 - 20, 20, w * 0.2, 16);
        ctx.fillStyle = '#90caf9';
        ctx.fillRect(w - w * 0.2 - 18, 22, w * 0.2 - 4, 12);

        // Animal-specific additions
        if (nm.includes('lợn') || nm.includes('heo')) {
            // Mud puddle (larger, more visible)
            ctx.fillStyle = 'rgba(121, 85, 61, 0.18)';
            ctx.beginPath(); ctx.ellipse(w * 0.65, h * 0.65, w * 0.15, h * 0.1, 0.2, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(121, 85, 61, 0.25)'; ctx.lineWidth = 1; ctx.stroke();
            // Mud splashes
            ctx.fillStyle = 'rgba(121, 85, 61, 0.1)';
            [[w * 0.55, h * 0.58], [w * 0.72, h * 0.72]].forEach(([sx, sy]) => {
                ctx.beginPath(); ctx.ellipse(sx, sy, 6, 4, Math.random(), 0, Math.PI * 2); ctx.fill();
            });
            // Scratching post
            ctx.fillStyle = '#6d4c41';
            ctx.fillRect(w * 0.85, h * 0.4, 8, 30);
            ctx.fillStyle = '#8d6e63';
            ctx.fillRect(w * 0.84, h * 0.38, 10, 6);
        }
        if (nm.includes('gà') || nm.includes('cút')) {
            // Nesting boxes (bottom-right) - improved with more detail
            for (let i = 0; i < 3; i++) {
                const nx = w - 50 - i * 30;
                // Box frame
                ctx.fillStyle = '#7b5b3a';
                ctx.fillRect(nx - 1, h - 42, 27, 28);
                ctx.fillStyle = '#8d6e63';
                ctx.fillRect(nx, h - 40, 25, 25);
                ctx.fillStyle = '#d7ccc8';
                ctx.fillRect(nx + 2, h - 38, 21, 21);
                // Straw bedding
                ctx.fillStyle = '#f0d99c';
                ctx.beginPath(); ctx.ellipse(nx + 12, h - 22, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
                // Egg in some nests
                if (i !== 1) {
                    ctx.fillStyle = '#fff8e1';
                    ctx.beginPath(); ctx.ellipse(nx + 12, h - 24, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = 'rgba(200, 180, 140, 0.5)'; ctx.lineWidth = 0.5; ctx.stroke();
                }
            }
            // Perch bar (improved with multiple levels)
            ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(w * 0.15, h * 0.32); ctx.lineTo(w * 0.65, h * 0.32); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(w * 0.25, h * 0.45); ctx.lineTo(w * 0.55, h * 0.45); ctx.stroke();
            // Support posts
            ctx.fillStyle = '#5d4037';
            ctx.fillRect(w * 0.15, h * 0.32, 4, h * 0.18);
            ctx.fillRect(w * 0.65 - 4, h * 0.32, 4, h * 0.18);
            // Dust bath area
            ctx.fillStyle = 'rgba(194, 178, 128, 0.15)';
            ctx.beginPath(); ctx.ellipse(w * 0.35, h * 0.75, 20, 12, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(160, 140, 100, 0.2)'; ctx.lineWidth = 1; ctx.stroke();
        }
        if (nm.includes('trâu') || nm.includes('bò')) {
            // Hay bales in corners (larger, more visible)
            ctx.fillStyle = '#f0d99c';
            ctx.fillRect(18, h - 50, 40, 30);
            ctx.strokeStyle = '#c9a84c'; ctx.lineWidth = 1;
            ctx.strokeRect(18, h - 50, 40, 30);
            ctx.beginPath(); ctx.moveTo(38, h - 50); ctx.lineTo(38, h - 20); ctx.stroke();
            // Second hay bale
            ctx.fillStyle = '#e8d08c';
            ctx.fillRect(w - 60, h - 45, 38, 28);
            ctx.strokeStyle = '#c9a84c';
            ctx.strokeRect(w - 60, h - 45, 38, 28);
            // Salt lick block
            ctx.fillStyle = 'rgba(200, 180, 160, 0.4)';
            ctx.fillRect(w * 0.5 - 10, 22, 20, 12);
            ctx.strokeStyle = 'rgba(180, 160, 140, 0.5)'; ctx.strokeRect(w * 0.5 - 10, 22, 20, 12);
            // Milking area indicator for dairy cows
            if (nm.includes('sữa')) {
                ctx.strokeStyle = 'rgba(33, 150, 243, 0.2)'; ctx.lineWidth = 1;
                ctx.setLineDash([3, 3]);
                ctx.strokeRect(w * 0.6, h * 0.3, w * 0.3, h * 0.3);
                ctx.setLineDash([]);
                // Bucket
                ctx.fillStyle = 'rgba(120, 144, 156, 0.3)';
                ctx.fillRect(w * 0.72, h * 0.52, 12, 14);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.beginPath(); ctx.ellipse(w * 0.72 + 6, h * 0.53, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
            }
        }
        if (nm.includes('dê') || nm.includes('cừu')) {
            // Hay rack (wall-mounted)
            ctx.fillStyle = '#8d6e63';
            ctx.fillRect(w * 0.4, 12, w * 0.25, 6);
            ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 2;
            for (let i = 0; i < 5; i++) {
                const rx = w * 0.42 + i * (w * 0.22 / 5);
                ctx.beginPath(); ctx.moveTo(rx, 18); ctx.lineTo(rx, 35); ctx.stroke();
            }
            // Hay sticking out
            ctx.fillStyle = '#e8d08c';
            for (let i = 0; i < 4; i++) {
                const hx = w * 0.43 + i * (w * 0.22 / 4);
                ctx.fillRect(hx, 10, 4, 12);
            }
            // Hay bales (ground level)
            ctx.fillStyle = '#f0d99c';
            ctx.fillRect(20, h - 45, 35, 25);
            ctx.strokeStyle = '#c9a84c'; ctx.lineWidth = 1;
            ctx.strokeRect(20, h - 45, 35, 25);
            ctx.beginPath(); ctx.moveTo(37, h - 45); ctx.lineTo(37, h - 20); ctx.stroke();
            // Climbing platform for goats
            if (nm.includes('dê')) {
                ctx.fillStyle = 'rgba(139, 119, 42, 0.15)';
                ctx.fillRect(w * 0.6, h * 0.55, 35, 8);
                ctx.fillRect(w * 0.65, h * 0.45, 30, 8);
                ctx.fillRect(w * 0.7, h * 0.35, 25, 8);
                // Steps
                ctx.fillStyle = '#8d6e63';
                ctx.fillRect(w * 0.58, h * 0.55, 4, 25);
                ctx.fillRect(w * 0.95, h * 0.55, 4, 25);
            }
            // Wool collection area for sheep
            if (nm.includes('cừu')) {
                ctx.fillStyle = 'rgba(245, 245, 245, 0.2)';
                ctx.beginPath(); ctx.ellipse(w * 0.75, h * 0.7, 15, 10, 0, 0, Math.PI * 2); ctx.fill();
            }
        }
    }

    static drawFreeRangeFurniture(ctx, w, h, name) {
        const nm = (name || '').toLowerCase();
        // Scattered feed bowls
        ctx.fillStyle = '#8d6e63';
        ctx.beginPath(); ctx.ellipse(w * 0.2, h * 0.75, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d4a574';
        ctx.beginPath(); ctx.ellipse(w * 0.2, h * 0.75, 10, 4, 0, 0, Math.PI * 2); ctx.fill();

        // Water bowl
        ctx.fillStyle = '#78909c';
        ctx.beginPath(); ctx.ellipse(w * 0.8, h * 0.2, 14, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#90caf9';
        ctx.beginPath(); ctx.ellipse(w * 0.8, h * 0.2, 12, 5, 0, 0, Math.PI * 2); ctx.fill();

        // Grass patches scattered around
        ctx.fillStyle = 'rgba(76, 175, 80, 0.1)';
        [[w * 0.3, h * 0.4], [w * 0.6, h * 0.55], [w * 0.15, h * 0.3]].forEach(([gx, gy]) => {
            ctx.beginPath(); ctx.ellipse(gx, gy, 18, 10, Math.random() * 0.5, 0, Math.PI * 2); ctx.fill();
        });

        // Small tree
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(w * 0.85 - 3, h * 0.45, 6, 25);
        ctx.fillStyle = 'rgba(56, 142, 60, 0.4)';
        ctx.beginPath(); ctx.arc(w * 0.85, h * 0.42, 18, 0, Math.PI * 2); ctx.fill();
        // Tree shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
        ctx.beginPath(); ctx.ellipse(w * 0.85 + 5, h * 0.72, 16, 6, 0.2, 0, Math.PI * 2); ctx.fill();

        if (nm.includes('vịt') || nm.includes('ngan') || nm.includes('ngỗng')) {
            // Larger pond area for waterfowl
            ctx.fillStyle = 'rgba(144, 202, 249, 0.25)';
            ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.75, w * 0.2, h * 0.12, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(100, 181, 246, 0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
            // Water ripples
            ctx.strokeStyle = 'rgba(100, 181, 246, 0.15)'; ctx.lineWidth = 0.8;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.ellipse(w * 0.48 + i * 12, h * 0.74 + i * 3, 8 + i * 4, 3 + i, 0, 0, Math.PI * 2);
                ctx.stroke();
            }
            // Nest area near pond
            ctx.fillStyle = 'rgba(194, 178, 128, 0.2)';
            ctx.beginPath(); ctx.ellipse(w * 0.3, h * 0.85, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(224, 208, 158, 0.3)';
            ctx.beginPath(); ctx.ellipse(w * 0.3, h * 0.85, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
        }

        // Shade shelter for free-range poultry
        if (nm.includes('gà') || nm.includes('cút')) {
            ctx.fillStyle = 'rgba(139, 119, 42, 0.1)';
            ctx.fillRect(w * 0.05, h * 0.15, w * 0.25, h * 0.2);
            ctx.strokeStyle = 'rgba(109, 76, 65, 0.2)'; ctx.lineWidth = 2;
            ctx.strokeRect(w * 0.05, h * 0.15, w * 0.25, h * 0.2);
            // Roof line
            ctx.beginPath(); ctx.moveTo(w * 0.04, h * 0.15); ctx.lineTo(w * 0.31, h * 0.15); ctx.stroke();

            // --- Additional vegetation for chicken pen ---
            // Bushy shrub (left side)
            ctx.fillStyle = 'rgba(46, 125, 50, 0.25)';
            ctx.beginPath(); ctx.arc(w * 0.12, h * 0.55, 14, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(56, 142, 60, 0.2)';
            ctx.beginPath(); ctx.arc(w * 0.1, h * 0.53, 10, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(w * 0.15, h * 0.56, 9, 0, Math.PI * 2); ctx.fill();

            // Second tree (opposite side from existing)
            ctx.fillStyle = '#6d4c41';
            ctx.fillRect(w * 0.18 - 2, h * 0.58, 5, 20);
            ctx.fillStyle = 'rgba(67, 160, 71, 0.35)';
            ctx.beginPath(); ctx.arc(w * 0.18, h * 0.55, 15, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(56, 142, 60, 0.25)';
            ctx.beginPath(); ctx.arc(w * 0.16, h * 0.53, 10, 0, Math.PI * 2); ctx.fill();

            // Small drinking pond
            ctx.fillStyle = 'rgba(100, 181, 246, 0.18)';
            ctx.beginPath(); ctx.ellipse(w * 0.55, h * 0.85, 22, 10, 0.1, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(66, 165, 245, 0.25)'; ctx.lineWidth = 1;
            ctx.stroke();
            // Pond edge pebbles
            ctx.fillStyle = 'rgba(158, 158, 158, 0.15)';
            [[w*0.545, h*0.855], [w*0.565, h*0.84], [w*0.535, h*0.842]].forEach(([px,py]) => {
                ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2); ctx.fill();
            });

            // Scattered wildflowers
            const flowerColors = ['rgba(244,67,54,0.3)', 'rgba(233,30,99,0.3)', 'rgba(255,235,59,0.4)', 'rgba(156,39,176,0.25)'];
            [[w*0.4, h*0.38], [w*0.65, h*0.42], [w*0.72, h*0.62], [w*0.25, h*0.82], [w*0.45, h*0.28]].forEach(([fx,fy], i) => {
                ctx.fillStyle = flowerColors[i % flowerColors.length];
                ctx.beginPath(); ctx.arc(fx, fy, 2.5, 0, Math.PI * 2); ctx.fill();
                // Stem
                ctx.strokeStyle = 'rgba(76,175,80,0.25)'; ctx.lineWidth = 0.8;
                ctx.beginPath(); ctx.moveTo(fx, fy + 2); ctx.lineTo(fx, fy + 7); ctx.stroke();
            });

            // Rock cluster near shelter
            ctx.fillStyle = 'rgba(158, 158, 158, 0.12)';
            ctx.beginPath(); ctx.ellipse(w * 0.28, h * 0.38, 7, 4, 0.3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(120, 120, 120, 0.1)';
            ctx.beginPath(); ctx.ellipse(w * 0.3, h * 0.39, 5, 3, -0.2, 0, Math.PI * 2); ctx.fill();

            // Additional grass tufts
            ctx.strokeStyle = 'rgba(76,175,80,0.2)'; ctx.lineWidth = 1.2;
            [[w*0.5, h*0.5], [w*0.7, h*0.3], [w*0.35, h*0.65]].forEach(([gx,gy]) => {
                for (let j = -2; j <= 2; j++) {
                    ctx.beginPath();
                    ctx.moveTo(gx + j * 2, gy);
                    ctx.quadraticCurveTo(gx + j * 3, gy - 7, gx + j * 2.5 + 1, gy - 10);
                    ctx.stroke();
                }
            });
        }

        // Fence post markers (corner indicators)
        ctx.fillStyle = 'rgba(109, 76, 65, 0.15)';
        [[8, 8], [w - 12, 8], [8, h - 12], [w - 12, h - 12]].forEach(([fx, fy]) => {
            ctx.fillRect(fx, fy, 4, 10);
        });
    }

    static drawAquaticDecor(ctx, w, h, name, time) {
        const t = time || Date.now() * 0.001;
        const nm = (name || '').toLowerCase();

        // Lily pads on edges
        ctx.fillStyle = 'rgba(76, 175, 80, 0.25)';
        const pads = [[w * 0.1, h * 0.15], [w * 0.85, h * 0.1], [w * 0.9, h * 0.85], [w * 0.08, h * 0.8]];
        pads.forEach(([px, py]) => {
            ctx.beginPath(); ctx.ellipse(px, py, 12, 8, Math.sin(t + px) * 0.2, 0, Math.PI * 2); ctx.fill();
        });

        // Reeds on sides
        ctx.strokeStyle = 'rgba(76, 175, 80, 0.3)'; ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
            const rx = 10 + i * 8;
            const sway = Math.sin(t * 0.5 + i) * 3;
            ctx.beginPath(); ctx.moveTo(rx, h); ctx.quadraticCurveTo(rx + sway, h * 0.6, rx + sway * 2, h * 0.4); ctx.stroke();
        }
        for (let i = 0; i < 4; i++) {
            const rx = w - 10 - i * 8;
            const sway = Math.sin(t * 0.5 + i + 2) * 3;
            ctx.beginPath(); ctx.moveTo(rx, h); ctx.quadraticCurveTo(rx + sway, h * 0.65, rx + sway * 2, h * 0.45); ctx.stroke();
        }

        // Bubbles
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        for (let i = 0; i < 6; i++) {
            const bx = w * 0.3 + i * w * 0.08;
            const by = h * 0.5 + Math.sin(t * 0.8 + i * 1.5) * h * 0.15;
            const br = 2 + Math.sin(t + i) * 1;
            ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
        }

        // Rocky substrate (bottom)
        ctx.fillStyle = 'rgba(120, 144, 156, 0.12)';
        for (let i = 0; i < 8; i++) {
            const sx = (i + 0.5) * w / 8;
            ctx.beginPath(); ctx.ellipse(sx, h - 8, 15 + (i % 3) * 5, 6, 0, 0, Math.PI * 2); ctx.fill();
        }

        // --- Algae / moss patches on rocks and walls ---
        // Wall algae (green patches on edges)
        ctx.fillStyle = 'rgba(76, 143, 80, 0.1)';
        ctx.beginPath(); ctx.ellipse(5, h * 0.3, 8, 25, 0.1, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(w - 5, h * 0.6, 6, 20, -0.1, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(w * 0.4, 5, 30, 6, 0, 0, Math.PI * 2); ctx.fill();
        // Moss on bottom rocks
        ctx.fillStyle = 'rgba(56, 142, 60, 0.12)';
        for (let i = 0; i < 5; i++) {
            const mx = (i + 1) * w / 6;
            ctx.beginPath(); ctx.ellipse(mx, h - 12, 10 + (i % 2) * 4, 4, 0.2 * i, 0, Math.PI * 2); ctx.fill();
        }
        // Floating duckweed/algae spots on surface
        ctx.fillStyle = 'rgba(76, 175, 80, 0.08)';
        const duckweed = [[w*0.15, 8], [w*0.35, 6], [w*0.6, 10], [w*0.82, 7]];
        duckweed.forEach(([dx, dy]) => {
            for (let j = 0; j < 3; j++) {
                ctx.beginPath();
                ctx.arc(dx + j * 4 - 4, dy + Math.sin(t * 0.3 + dx + j) * 2, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        // Small algae strands swaying from bottom
        ctx.strokeStyle = 'rgba(76, 143, 80, 0.15)'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 7; i++) {
            const ax = w * 0.1 + i * w * 0.12;
            const sway = Math.sin(t * 0.5 + i * 1.3) * 3;
            ctx.beginPath();
            ctx.moveTo(ax, h - 6);
            ctx.quadraticCurveTo(ax + sway, h - 18, ax + sway * 1.5, h - 28);
            ctx.stroke();
        }

        // ===== ANIMAL-SPECIFIC AQUATIC ENVIRONMENTS =====

        // Fish caves / shelters (for cá rô, cá trắm, cá chép, cá mè, cá trê, cá lóc, cá tra, cá basa, etc.)
        if (nm.includes('cá') || nm.includes('ca ')) {
            // Stone cave bottom-left
            ctx.fillStyle = 'rgba(100, 100, 100, 0.25)';
            ctx.beginPath();
            ctx.moveTo(15, h - 10); ctx.lineTo(15, h - 40); ctx.quadraticCurveTo(35, h - 55, 55, h - 40);
            ctx.lineTo(55, h - 10); ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(50, 50, 50, 0.3)';
            ctx.beginPath(); ctx.ellipse(35, h - 22, 14, 10, 0, 0, Math.PI * 2); ctx.fill(); // cave entrance
            // Stone cave top-right
            ctx.fillStyle = 'rgba(100, 100, 100, 0.2)';
            ctx.beginPath();
            ctx.moveTo(w - 15, 15); ctx.lineTo(w - 15, 45); ctx.quadraticCurveTo(w - 35, 55, w - 55, 45);
            ctx.lineTo(w - 55, 15); ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(50, 50, 50, 0.25)';
            ctx.beginPath(); ctx.ellipse(w - 35, 32, 12, 9, 0, 0, Math.PI * 2); ctx.fill();
            // Aquatic plants
            ctx.fillStyle = 'rgba(56, 142, 60, 0.2)';
            for (let i = 0; i < 3; i++) {
                const px = w * 0.4 + i * 25;
                for (let j = 0; j < 3; j++) {
                    const sway = Math.sin(t * 0.6 + i + j) * 4;
                    ctx.beginPath();
                    ctx.ellipse(px + sway, h - 20 - j * 15, 4, 8, sway * 0.1, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        // Crab: sandy bottom with burrow holes
        if (nm.includes('cua')) {
            ctx.fillStyle = 'rgba(194, 178, 128, 0.2)';
            ctx.fillRect(0, h - 20, w, 20); // Sandy bottom
            // Burrow holes
            ctx.fillStyle = 'rgba(100, 80, 50, 0.3)';
            const burrows = [[w * 0.15, h - 12], [w * 0.45, h - 10], [w * 0.75, h - 14], [w * 0.9, h - 11]];
            burrows.forEach(([bx, by]) => {
                ctx.beginPath(); ctx.ellipse(bx, by, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
            });
            // Scattered shells
            ctx.fillStyle = 'rgba(210, 190, 160, 0.3)';
            [[w * 0.25, h - 15], [w * 0.6, h - 13]].forEach(([sx, sy]) => {
                ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI, true); ctx.fill();
            });
        }

        // Shrimp: substrate with hiding debris
        if (nm.includes('tôm')) {
            // Seaweed strips
            ctx.strokeStyle = 'rgba(56, 142, 60, 0.25)'; ctx.lineWidth = 2;
            for (let i = 0; i < 6; i++) {
                const sx = w * 0.1 + i * w * 0.15;
                const sway = Math.sin(t * 0.4 + i) * 5;
                ctx.beginPath();
                ctx.moveTo(sx, h - 5);
                ctx.quadraticCurveTo(sx + sway, h - 25, sx + sway * 1.5, h - 45);
                ctx.stroke();
            }
            // Bottom substrate texture
            ctx.fillStyle = 'rgba(139, 119, 101, 0.1)';
            for (let i = 0; i < 12; i++) {
                ctx.beginPath();
                ctx.ellipse(w * (i / 12) + 10, h - 5, 10 + (i % 3) * 3, 4, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Eel: mud tubes / pipes
        if (nm.includes('lươn')) {
            ctx.fillStyle = 'rgba(101, 67, 33, 0.25)';
            // Mud tubes (PVC pipe shapes)
            const tubes = [[20, h - 35, 45, 16], [w - 65, h - 30, 45, 14], [w * 0.4, h - 25, 40, 12]];
            tubes.forEach(([tx, ty, tw, th]) => {
                ctx.beginPath();
                ctx.ellipse(tx + tw, ty + th / 2, th / 2 + 2, th / 2 + 2, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillRect(tx, ty, tw, th);
                ctx.fillStyle = 'rgba(60, 40, 20, 0.3)';
                ctx.beginPath(); ctx.ellipse(tx, ty + th / 2, th / 2, th / 2, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = 'rgba(101, 67, 33, 0.25)';
            });
            // Muddy water tint
            ctx.fillStyle = 'rgba(101, 67, 33, 0.05)';
            ctx.fillRect(0, 0, w, h);
        }

        // Molluscs (ốc, hàu, nghêu, sò): rocky/sandy bed with clusters
        if (nm.includes('ốc') || nm.includes('hàu') || nm.includes('nghêu') || nm.includes('sò')) {
            // Rocky clusters
            ctx.fillStyle = 'rgba(140, 140, 140, 0.15)';
            const rocks = [[w * 0.2, h * 0.6], [w * 0.5, h * 0.3], [w * 0.7, h * 0.7], [w * 0.3, h * 0.5]];
            rocks.forEach(([rx, ry]) => {
                for (let i = 0; i < 4; i++) {
                    ctx.beginPath();
                    ctx.ellipse(rx + (i - 2) * 8, ry + (i % 2) * 6, 10 + i * 2, 7, i * 0.3, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
            // Sandy bottom
            ctx.fillStyle = 'rgba(194, 178, 128, 0.12)';
            ctx.fillRect(0, h - 15, w, 15);
        }

        // Frog: half-land, half-water environment
        if (nm.includes('ếch')) {
            // Land area (right side) - raised bank
            ctx.fillStyle = 'rgba(139, 119, 42, 0.12)';
            ctx.beginPath();
            ctx.moveTo(w * 0.65, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(w * 0.65, h);
            ctx.quadraticCurveTo(w * 0.6, h * 0.5, w * 0.65, 0);
            ctx.closePath(); ctx.fill();
            // Small rocks on bank
            ctx.fillStyle = 'rgba(120, 120, 100, 0.15)';
            [[w * 0.75, h * 0.3], [w * 0.85, h * 0.6], [w * 0.7, h * 0.8]].forEach(([rx, ry]) => {
                ctx.beginPath(); ctx.ellipse(rx, ry, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
            });
            // Extra lily pads in water area
            ctx.fillStyle = 'rgba(76, 175, 80, 0.3)';
            [[w * 0.2, h * 0.4], [w * 0.35, h * 0.6], [w * 0.15, h * 0.7]].forEach(([lx, ly]) => {
                ctx.beginPath(); ctx.ellipse(lx, ly, 14, 9, Math.sin(t + lx) * 0.15, 0, Math.PI * 2); ctx.fill();
            });
        }

        // Feeding spot indicator
        ctx.strokeStyle = 'rgba(255, 193, 7, 0.15)'; ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(w * 0.3, 8, w * 0.4, 20);
        ctx.setLineDash([]);
    }

    static drawBeehiveFrames(ctx, w, h) {
        // --- Flower garden and vegetation around the hive ---
        // Flower patches (multiple colors — bees love diversity)
        const flowers = [
            [w*0.12, h*0.25, 'rgba(255,183,77,0.5)', 4],   // marigold
            [w*0.2, h*0.18, 'rgba(244,143,177,0.45)', 3.5],  // pink
            [w*0.08, h*0.4, 'rgba(186,104,200,0.4)', 3],     // lavender
            [w*0.15, h*0.7, 'rgba(255,241,118,0.5)', 3.5],   // sunflower
            [w*0.85, h*0.3, 'rgba(239,83,80,0.35)', 3],      // red
            [w*0.9, h*0.55, 'rgba(129,212,250,0.4)', 3.5],   // blue
            [w*0.78, h*0.75, 'rgba(255,183,77,0.45)', 4],    // orange
            [w*0.88, h*0.18, 'rgba(244,67,54,0.3)', 3],      // rose
            [w*0.22, h*0.85, 'rgba(255,235,59,0.5)', 3.5],   // yellow
            [w*0.72, h*0.88, 'rgba(233,30,99,0.35)', 3],     // magenta
            [w*0.4, h*0.15, 'rgba(255,152,0,0.35)', 3],      // orange-2
            [w*0.65, h*0.12, 'rgba(156,39,176,0.3)', 3.5],   // purple
        ];
        flowers.forEach(([fx, fy, col, r]) => {
            // Petals
            ctx.fillStyle = col;
            for (let p = 0; p < 5; p++) {
                const a = (p / 5) * Math.PI * 2;
                ctx.beginPath();
                ctx.arc(fx + Math.cos(a) * r * 0.6, fy + Math.sin(a) * r * 0.6, r * 0.55, 0, Math.PI * 2);
                ctx.fill();
            }
            // Center
            ctx.fillStyle = 'rgba(255,235,59,0.6)';
            ctx.beginPath(); ctx.arc(fx, fy, r * 0.35, 0, Math.PI * 2); ctx.fill();
            // Stem
            ctx.strokeStyle = 'rgba(76,175,80,0.3)'; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(fx, fy + r); ctx.lineTo(fx + 1, fy + r + 8); ctx.stroke();
            // Small leaf
            ctx.fillStyle = 'rgba(76,175,80,0.2)';
            ctx.beginPath(); ctx.ellipse(fx + 3, fy + r + 4, 3, 1.5, 0.5, 0, Math.PI * 2); ctx.fill();
        });

        // Grass/wildflower meadow patches
        ctx.fillStyle = 'rgba(76,175,80,0.08)';
        ctx.beginPath(); ctx.ellipse(w*0.15, h*0.5, 35, 20, 0.2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(w*0.85, h*0.48, 30, 18, -0.15, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(w*0.5, h*0.88, 40, 14, 0, 0, Math.PI*2); ctx.fill();

        // Grass tufts around edges
        ctx.strokeStyle = 'rgba(76,175,80,0.2)'; ctx.lineWidth = 1;
        [[w*0.08, h*0.6], [w*0.92, h*0.65], [w*0.3, h*0.92], [w*0.7, h*0.9], [w*0.05, h*0.82]].forEach(([gx,gy]) => {
            for (let j = -2; j <= 2; j++) {
                ctx.beginPath();
                ctx.moveTo(gx + j * 2, gy);
                ctx.quadraticCurveTo(gx + j * 2.5, gy - 6, gx + j * 2 + 1, gy - 9);
                ctx.stroke();
            }
        });

        // Small bushes
        ctx.fillStyle = 'rgba(46,125,50,0.18)';
        ctx.beginPath(); ctx.arc(w*0.08, h*0.3, 10, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(56,142,60,0.15)';
        ctx.beginPath(); ctx.arc(w*0.06, h*0.28, 7, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(46,125,50,0.18)';
        ctx.beginPath(); ctx.arc(w*0.92, h*0.42, 10, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(56,142,60,0.15)';
        ctx.beginPath(); ctx.arc(w*0.94, h*0.44, 7, 0, Math.PI*2); ctx.fill();

        // --- Beehive frame (center) ---
        const frameW = w * 0.3;
        const frameH = h * 0.4;
        const fx = w * 0.5 - frameW / 2;
        const fy = h * 0.5 - frameH / 2;

        // Hive stand legs
        ctx.fillStyle = '#6d4c41';
        ctx.fillRect(fx + 5, fy + frameH + 2, 5, 10);
        ctx.fillRect(fx + frameW - 10, fy + frameH + 2, 5, 10);

        // Frame box
        ctx.fillStyle = '#8d6e63';
        ctx.fillRect(fx - 2, fy - 2, frameW + 4, frameH + 4);
        ctx.fillStyle = '#d4a060';
        ctx.fillRect(fx, fy, frameW, frameH);

        // Landing board
        ctx.fillStyle = '#a1887f';
        ctx.fillRect(fx + frameW * 0.3, fy + frameH, frameW * 0.4, 4);

        // Honeycomb cells
        ctx.strokeStyle = 'rgba(139, 69, 19, 0.3)'; ctx.lineWidth = 0.8;
        const cellR = 7;
        const cellH = cellR * Math.sqrt(3);
        for (let row = 0; row < Math.floor(frameH / cellH); row++) {
            for (let col = 0; col < Math.floor(frameW / (cellR * 1.5)); col++) {
                const cx = fx + col * cellR * 1.5 + cellR + (row % 2) * cellR * 0.75;
                const cy = fy + row * cellH * 0.5 + cellR;
                if (cx > fx + frameW - cellR || cy > fy + frameH - cellR) continue;
                // Hex
                ctx.fillStyle = Math.random() > 0.7 ? '#ffc107' : '#e6a817';
                ctx.beginPath();
                for (let s = 0; s < 6; s++) {
                    const a = (s / 6) * Math.PI * 2 - Math.PI / 6;
                    const px = cx + Math.cos(a) * cellR * 0.8;
                    const py = cy + Math.sin(a) * cellR * 0.8;
                    s === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
                }
                ctx.closePath(); ctx.fill(); ctx.stroke();
            }
        }

        // Hive entrance slot
        ctx.fillStyle = 'rgba(62, 39, 35, 0.6)';
        ctx.fillRect(fx + frameW * 0.35, fy + frameH - 3, frameW * 0.3, 3);
    }

    static drawSilkwormTrays(ctx, w, h) {
        // Mulberry leaf piles
        ctx.fillStyle = 'rgba(76, 175, 80, 0.3)';
        const spots = [[w * 0.2, h * 0.3], [w * 0.5, h * 0.6], [w * 0.8, h * 0.4], [w * 0.3, h * 0.8]];
        spots.forEach(([lx, ly]) => {
            for (let i = 0; i < 4; i++) {
                const a = (i / 4) * Math.PI * 2;
                ctx.beginPath();
                ctx.ellipse(lx + Math.cos(a) * 6, ly + Math.sin(a) * 4, 10, 5, a, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        // Tray borders
        ctx.strokeStyle = 'rgba(139, 69, 19, 0.2)'; ctx.lineWidth = 1;
        ctx.strokeRect(15, 15, w - 30, h - 30);
    }
}

// ==================== ANIMAL ENTITY ====================

class Animal {
    constructor(id, x, y, config) {
        this.id = id;
        this.x = x;
        this.y = y;
        // Growth scaling
        const gs = config.growthScale ?? 1;
        this.baseSpeed = config.speed || 0.5;
        this.baseRadius = config.radius || 8;
        this.speed = this.baseSpeed * (1.1 - gs * 0.2); // bigger = slightly slower
        this.radius = this.baseRadius * (0.5 + gs * 0.5);
        this.vx = (Math.random() - 0.5) * this.speed;
        this.vy = (Math.random() - 0.5) * this.speed;
        this.color = config.color || '#4caf50';
        this.glowColor = config.glowColor || 'rgba(76,175,80,0.3)';
        this.type = config.type || 'LAND';
        this.drawShape = config.drawShape || null;
        this.shapeVariant = config.shapeVariant || null;
        this.status = config.status || 'HEALTHY';
        this.state = 'walking'; // walking, idle, eating, sleeping, petting, nesting, foraging
        this.stateTimer = Math.random() * 200;
        this.direction = Math.atan2(this.vy, this.vx);
        this.hovered = false;
        this.selected = false;
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.tailPhase = Math.random() * Math.PI * 2;
        this.foodTarget = null; // FoodParticle reference
        this.isNight = false;
        this.sickSepMul = this.status === 'SICK' ? 3 : 1;
        // Bee foraging: some bees start foraging (invisible)
        this.isForaging = false;
        this.foragingTimer = 0;
        if (this.drawShape === 'bee' && Math.random() < 0.15) {
            this.isForaging = true;
            this.foragingTimer = 400 + Math.random() * 800;
        }
        // Chicken nesting
        this.nestTarget = null;
        // Night behavior: not all animals sleep — some stay active but slower
        this.isSleeping = false; // tracks actual sleep state for draw suppression
        this.nightActive = false; // this individual stays active at night
        this._assignNightBehavior();
    }

    _assignNightBehavior() {
        // Determine if this individual stays active at night
        // Each animal type has a % that stay awake
        const r = Math.random();
        switch (this.drawShape) {
            case 'fish':    this.nightActive = r < 0.4; break; // 40% still swim slowly
            case 'eel':     this.nightActive = r < 0.3; break; // 30% active
            case 'shrimp':  this.nightActive = r < 0.5; break; // shrimp are somewhat nocturnal
            case 'crab':    this.nightActive = r < 0.6; break; // crabs are nocturnal
            case 'frog':    this.nightActive = r < 0.7; break; // frogs are nocturnal
            case 'mollusc': this.nightActive = r < 0.2; break;
            case 'bee':     this.nightActive = false; break; // ALL bees sleep in hive
            case 'silkworm': this.nightActive = r < 0.1; break;
            case 'poultry': this.nightActive = r < 0.15; break; // few chickens wander
            case 'waterfowl': this.nightActive = r < 0.2; break;
            case 'cattle':  this.nightActive = r < 0.25; break; // some cattle chew cud
            case 'pig':     this.nightActive = r < 0.2; break;
            case 'goatSheep': this.nightActive = r < 0.15; break;
            default:        this.nightActive = r < 0.2; break;
        }
    }

    update(bounds, others, dt) {
        this.pulsePhase += dt * 0.003;
        // Only animate tail/wing when not sleeping
        if (!this.isSleeping) {
            this.tailPhase += dt * 0.005;
        }

        // ---- Bee foraging: absent bees are invisible, periodically return ----
        if (this.drawShape === 'bee') {
            if (this.isForaging) {
                this.foragingTimer -= dt;
                if (this.foragingTimer <= 0) {
                    // Return from foraging
                    this.isForaging = false;
                    this.state = 'walking';
                    this.stateTimer = 400 + Math.random() * 600;
                    // Re-enter from edge
                    this.x = Math.random() < 0.5 ? 15 : bounds.w - 15;
                    this.y = 15 + Math.random() * (bounds.h - 30);
                    const a = Math.atan2(bounds.h / 2 - this.y, bounds.w / 2 - this.x);
                    this.vx = Math.cos(a) * this.speed;
                    this.vy = Math.sin(a) * this.speed;
                }
                return; // Skip all movement while foraging
            }
            // Chance to leave for foraging (only during day)
            // Cap: max 40% of bees can be foraging at once — rest stay at hive
            if (!this.isNight && this.state === 'walking' && Math.random() < 0.0001 * dt) {
                const totalBees = others.filter(o => o.drawShape === 'bee').length + 1;
                const foragingBees = others.filter(o => o.drawShape === 'bee' && o.isForaging).length;
                const foragingRatio = foragingBees / totalBees;
                if (foragingRatio < 0.4) { // Only leave if less than 40% are already foraging
                    this.isForaging = true;
                    this.foragingTimer = 600 + Math.random() * 1000;
                    return;
                }
            }
        }

        // ---- Night behavior (per-animal) ----
        if (this.isNight) {
            // Bees: ALL return to hive at night
            if (this.drawShape === 'bee') {
                if (this.isForaging) {
                    this.isForaging = false; // come back immediately
                    this.foragingTimer = 0;
                }
                // Move toward hive center with slight individual scatter, then sleep
                const hiveX = bounds.w * 0.5 + ((this.id % 5) - 2) * 6;
                const hiveY = bounds.h * 0.47 + ((this.id % 3) - 1) * 5;
                const dx = hiveX - this.x, dy = hiveY - this.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d > 12) {
                    this.vx = (dx / d) * this.speed * 0.6;
                    this.vy = (dy / d) * this.speed * 0.6;
                    this.state = 'walking';
                    this.isSleeping = false;
                } else {
                    this.vx = 0; this.vy = 0;
                    this.state = 'sleeping';
                    this.isSleeping = true;
                }
                // Skip normal state machine for bees at night
                this.stateTimer = 9999;
            } else if (this.nightActive) {
                // Active at night: move slowly
                if (this.state === 'sleeping') {
                    this.state = 'walking'; this.stateTimer = 200;
                    const a = Math.random() * Math.PI * 2;
                    this.vx = Math.cos(a) * this.speed * 0.3;
                    this.vy = Math.sin(a) * this.speed * 0.3;
                }
                this.isSleeping = false;
                // Cap speed to 30% of normal at night
            } else {
                // Sleeping individuals
                if (this.state !== 'sleeping') {
                    this.state = 'sleeping'; this.stateTimer = 9999;
                    this.vx = 0; this.vy = 0;
                }
                this.isSleeping = true;
            }
        } else {
            // Daytime: wake up if sleeping
            if (this.state === 'sleeping') {
                this.state = 'walking'; this.stateTimer = 200;
                const a = Math.random() * Math.PI * 2;
                this.vx = Math.cos(a) * this.speed; this.vy = Math.sin(a) * this.speed;
            }
            this.isSleeping = false;
        }

        // Effective speed (sick animals 70% slower, night-active animals 70% slower)
        let effSpeed = this.status === 'SICK' ? this.speed * 0.3 : this.speed;
        if (this.isNight && this.nightActive) effSpeed *= 0.3;

        // ---- Eating: move toward food ----
        if (this.state === 'eating' && this.foodTarget) {
            const dx = this.foodTarget.x - this.x, dy = this.foodTarget.y - this.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < this.radius + 5) {
                this.foodTarget.eaten = true; this.foodTarget = null;
                this.state = 'idle'; this.stateTimer = 80 + Math.random() * 100;
                this.vx *= 0.1; this.vy *= 0.1;
            } else {
                this.vx += (dx / d) * 0.04; this.vy += (dy / d) * 0.04;
            }
        }

        // ---- Petting: stay still briefly ----
        if (this.state === 'petting') {
            this.vx *= 0.9; this.vy *= 0.9;
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) { this.state = 'walking'; this.stateTimer = 200; }
            return; // skip normal state machine
        }

        // ---- Sleeping: barely move ----
        if (this.state === 'sleeping') {
            this.vx *= 0.95; this.vy *= 0.95; return;
        }

        this.stateTimer -= dt;

        // State machine
        if (this.stateTimer <= 0 && this.state !== 'eating') {
            const sickIdleChance = this.status === 'SICK' ? 0.7 : 0.3;
            // Shape-dependent behavior config
            let idleChance = sickIdleChance;
            let moveDurMin = 100, moveDurMax = 300;
            let idleDurMin = 80, idleDurMax = 200;
            let moveSpeed = effSpeed;

            // Specialized behaviors
            if (this.drawShape === 'fish' || this.drawShape === 'eel' || this.drawShape === 'shrimp') {
                idleChance = 0.2; // Fish pause sometimes
                moveDurMin = 800; moveDurMax = 2500;
                idleDurMin = 200; idleDurMax = 600; // Pause to rest
                // Fish-specific: occasional darting behavior
                if (this.drawShape === 'fish' && Math.random() < 0.07) {
                    moveSpeed = effSpeed * 2.5; // sudden dart
                    moveDurMin = 60; moveDurMax = 120;
                }
                // Eels: snaky slow movement with occasional bursts
                if (this.drawShape === 'eel') {
                    idleChance = 0.35; // Eels hide more
                    moveDurMin = 600; moveDurMax = 2000;
                    idleDurMin = 400; idleDurMax = 1000;
                    if (Math.random() < 0.04) moveSpeed = effSpeed * 3; // sudden strike
                }
                // Shrimp: bottom-dwelling, slower, occasional jumps
                if (this.drawShape === 'shrimp') {
                    idleChance = 0.4;
                    moveDurMin = 500; moveDurMax = 1200;
                    idleDurMin = 300; idleDurMax = 800;
                    if (Math.random() < 0.06) { moveSpeed = effSpeed * 4; moveDurMin = 40; moveDurMax = 80; }
                }
            } else if (this.drawShape === 'crab') {
                idleChance = 0.55; // Crabs sit a lot, then scurry sideways
                moveDurMin = 200; moveDurMax = 500; // Short bursts
                idleDurMin = 500; idleDurMax = 1500; // Long pauses
                moveSpeed = effSpeed * 1.5;
            } else if (this.drawShape === 'mollusc') {
                idleChance = 0.85; // Molluscs barely move
                moveDurMin = 1000; moveDurMax = 3000; // Very slow when they do move
                idleDurMin = 2000; idleDurMax = 5000;
                moveSpeed = effSpeed * 0.3;
            } else if (this.drawShape === 'frog') {
                idleChance = 0.8; // Frogs mostly sit
                moveDurMin = 30; moveDurMax = 80; // Quick jumps
                idleDurMin = 800; idleDurMax = 2500; // Long waits between jumps
                moveSpeed = effSpeed * 5; // Powerful jumps
            } else if (this.drawShape === 'bee') {
                idleChance = 0.15; // Bees are active
                moveDurMin = 400; moveDurMax = 1200; // Fly in straight lines
                idleDurMin = 150; idleDurMax = 400; // Brief hovers
                moveSpeed = effSpeed * 1.2;
            } else if (this.drawShape === 'silkworm') {
                idleChance = 0.7;
                moveDurMin = 800; moveDurMax = 2000; // Very slow crawling
                idleDurMin = 1000; idleDurMax = 3000;
                moveSpeed = effSpeed * 0.5;
            } else if (this.drawShape === 'poultry') {
                if (this.shapeVariant === 'chicken') {
                    idleChance = 0.4; // Pecking ground
                    moveDurMin = 400; moveDurMax = 1200; // Walk straight then stop to peck
                    idleDurMin = 300; idleDurMax = 800;
                    // Occasional quick runs
                    if (Math.random() < 0.06) { moveSpeed = effSpeed * 2.5; moveDurMin = 80; moveDurMax = 200; }
                } else { // quail
                    idleChance = 0.45;
                    moveDurMin = 400; moveDurMax = 1000;
                    idleDurMin = 400; idleDurMax = 1000;
                    moveSpeed = effSpeed * 0.8;
                }
            } else if (this.drawShape === 'waterfowl') {
                idleChance = 0.35;
                moveDurMin = 500; moveDurMax = 1500;
                idleDurMin = 400; idleDurMax = 1000;
                // Ducks waddle pattern
                if (this.shapeVariant === 'duck' || this.shapeVariant === 'ngan') {
                    moveSpeed = effSpeed * 0.7;
                }
                // Geese: more assertive movement
                if (this.shapeVariant === 'goose') {
                    moveSpeed = effSpeed * 1.1;
                    moveDurMin = 600; moveDurMax = 1800;
                }
            } else if (this.drawShape === 'cattle') {
                idleChance = 0.45; // Cattle graze a lot
                moveDurMin = 600; moveDurMax = 2000; // Walk slowly for long stretches
                idleDurMin = 500; idleDurMax = 1500;
                moveSpeed = effSpeed * 0.7;
                // Buffalo: even slower, more sedentary
                if (this.shapeVariant === 'buffalo') {
                    idleChance += 0.1;
                    moveSpeed = effSpeed * 0.5;
                    moveDurMin = 800; moveDurMax = 2500;
                }
            } else if (this.drawShape === 'pig') {
                idleChance = 0.35; // Pigs root around
                moveDurMin = 500; moveDurMax = 1500; // Walk in straight lines
                idleDurMin = 400; idleDurMax = 1200; // Pause to sniff/root
                moveSpeed = effSpeed * 0.8;
            } else if (this.drawShape === 'goatSheep') {
                if (this.shapeVariant === 'goat') {
                    idleChance = 0.3;
                    moveDurMin = 400; moveDurMax = 1200;
                    idleDurMin = 300; idleDurMax = 800;
                    moveSpeed = effSpeed * 1.2; // Goats are agile
                    // Occasional climbing/jumping behavior
                    if (Math.random() < 0.05) { moveSpeed = effSpeed * 2.5; moveDurMin = 40; moveDurMax = 80; }
                } else { // sheep
                    idleChance = 0.4; // Sheep graze calmly
                    moveDurMin = 500; moveDurMax = 1500;
                    idleDurMin = 500; idleDurMax = 1200;
                    moveSpeed = effSpeed * 0.65;
                }
            } else {
                // Default land animals — also fix to walk straight
                moveDurMin = 500; moveDurMax = 1500;
                idleDurMin = 300; idleDurMax = 800;
            }

            if (this.state === 'walking') {
                this.state = Math.random() < idleChance ? 'idle' : 'walking';
                this.stateTimer = this.state === 'idle' ?
                    idleDurMin + Math.random() * (idleDurMax - idleDurMin) :
                    moveDurMin + Math.random() * (moveDurMax - moveDurMin);

                if (this.state === 'walking') {
                    // Smooth direction change: turn slightly from current heading
                    const currentAngle = Math.atan2(this.vy, this.vx);
                    const turnAmount = (Math.random() - 0.5) * Math.PI * 0.6; // max ~54 deg turn
                    const newAngle = currentAngle + turnAmount;
                    this.vx = Math.cos(newAngle) * moveSpeed;
                    this.vy = Math.sin(newAngle) * moveSpeed;
                }
            } else {
                this.state = 'walking';
                this.stateTimer = moveDurMin + Math.random() * (moveDurMax - moveDurMin);
                // After idle: pick a new direction (can be bigger turn since animal rested)
                const currentAngle = Math.atan2(this.vy || 0.001, this.vx || 0.001);
                const turnAmount = (Math.random() - 0.5) * Math.PI * 1.2; // wider turn after rest
                const newAngle = currentAngle + turnAmount;
                this.vx = Math.cos(newAngle) * moveSpeed;
                this.vy = Math.sin(newAngle) * moveSpeed;
            }
        }
        // Gentle hovering for bees (very subtle, not zigzag)
        if (this.state === 'walking' && this.drawShape === 'bee' && Math.random() < 0.03) {
            const angle = (Math.random() - 0.5) * 0.4; // very gentle micro-adjustment
            this.vx += Math.cos(angle) * 0.05; this.vy += Math.sin(angle) * 0.05;
        }

        // Chicken nesting behavior: occasionally move toward nesting boxes and sit
        if (this.drawShape === 'poultry' && this.shapeVariant === 'chicken' && !this.isNight) {
            if (this.state === 'idle' && !this.nestTarget && Math.random() < 0.002 * dt) {
                // Go to a nesting box (bottom-right area of barn)
                const nestIndex = Math.floor(Math.random() * 3);
                const nx = bounds.w - 50 - nestIndex * 30 + 12;
                const ny = bounds.h - 28;
                this.nestTarget = { x: nx, y: ny };
                this.state = 'nesting';
                this.stateTimer = 400 + Math.random() * 300; // sit for a while
            }
        }

        // Waterfowl: occasionally swim toward pond area
        if (this.drawShape === 'waterfowl' && this.state === 'idle' && !this.isNight && Math.random() < 0.001 * dt) {
            const pondX = bounds.w * 0.5 + (Math.random() - 0.5) * bounds.w * 0.15;
            const pondY = bounds.h * 0.75 + (Math.random() - 0.5) * bounds.h * 0.06;
            this.nestTarget = { x: pondX, y: pondY };
            this.state = 'nesting'; // Reuse nesting state for "swimming to pond"
            this.stateTimer = 300 + Math.random() * 200;
        }

        // Crab: sideways scurry (adjust velocity direction)
        if (this.drawShape === 'crab' && this.state === 'walking') {
            // Crabs tend to move more laterally
            if (Math.random() < 0.05 * dt) {
                const lateralBias = (Math.random() < 0.5 ? 1 : -1) * effSpeed * 1.5;
                this.vx = lateralBias; // Mostly horizontal movement
                this.vy *= 0.3; // Less vertical movement
            }
        }

        // Fish: occasional dart and schooling near cave
        if (this.drawShape === 'fish' && this.state === 'walking' && Math.random() < 0.0005 * dt) {
            // Dart toward cave shelter
            const caveX = Math.random() < 0.5 ? 35 : bounds.w - 35;
            const caveY = Math.random() < 0.5 ? bounds.h - 22 : 32;
            const dx = caveX - this.x, dy = caveY - this.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > 0) {
                this.vx = (dx / d) * effSpeed * 2;
                this.vy = (dy / d) * effSpeed * 2;
                this.stateTimer = 30 + Math.random() * 40;
            }
        }

        // Eel: occasionally hide in mud tubes
        if (this.drawShape === 'eel' && this.state === 'idle' && Math.random() < 0.001 * dt) {
            const tubeTargets = [{ x: 42, y: bounds.h - 27 }, { x: bounds.w - 43, y: bounds.h - 23 }, { x: bounds.w * 0.46, y: bounds.h - 19 }];
            const target = tubeTargets[Math.floor(Math.random() * tubeTargets.length)];
            this.nestTarget = { x: target.x, y: target.y };
            this.state = 'nesting';
            this.stateTimer = 600 + Math.random() * 400; // Hide for a while
        }
        if (this.state === 'nesting' && this.nestTarget) {
            const dx = this.nestTarget.x - this.x;
            const dy = this.nestTarget.y - this.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > 5) {
                // Walk toward nest
                this.vx = (dx / d) * this.speed * 0.8;
                this.vy = (dy / d) * this.speed * 0.8;
            } else {
                // Sitting in nest
                this.vx *= 0.1; this.vy *= 0.1;
                this.stateTimer -= dt;
                if (this.stateTimer <= 0) {
                    this.state = 'walking'; this.nestTarget = null;
                    this.stateTimer = 150 + Math.random() * 200;
                    const a = Math.random() * Math.PI * 2;
                    this.vx = Math.cos(a) * this.speed; this.vy = Math.sin(a) * this.speed;
                }
            }
        }

        if (this.state === 'idle') { this.vx *= 0.95; this.vy *= 0.95; }

        // Flocking / separation
        if (this.type !== 'WATER') {
            let sepX = 0, sepY = 0;
            const sepDist = this.radius * 4 * this.sickSepMul;
            others.forEach(other => {
                if (other === this) return;
                const dx = this.x - other.x, dy = this.y - other.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < sepDist && dist > 0) {
                    sepX += dx / dist * 0.02 * this.sickSepMul;
                    sepY += dy / dist * 0.02 * this.sickSepMul;
                }
            });
            this.vx += sepX; this.vy += sepY;
        } else {
            let avgVx = 0, avgVy = 0, count = 0;
            others.forEach(other => {
                if (other === this) return;
                const dx = this.x - other.x, dy = this.y - other.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 80) {
                    avgVx += other.vx; avgVy += other.vy; count++;
                    if (dist < this.radius * 3 && dist > 0) {
                        this.vx += dx / dist * 0.015; this.vy += dy / dist * 0.015;
                    }
                }
            });
            if (count > 0) {
                this.vx += (avgVx / count - this.vx) * 0.01;
                this.vy += (avgVy / count - this.vy) * 0.01;
            }
        }

        // Clamp speed
        const cur = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (cur > effSpeed * 1.5) {
            this.vx = (this.vx / cur) * effSpeed; this.vy = (this.vy / cur) * effSpeed;
        }

        this.x += this.vx; this.y += this.vy;

        // Bounds - bees fly freely beyond edges (foraging), others stay within pen
        const pad = this.radius + 15;
        if (this.drawShape === 'bee') {
            // Bees can fly beyond pen edges but are gently pulled back toward center/hive
            const margin = 60; // How far beyond canvas edges bees can go
            if (this.x < -margin) { this.vx = Math.abs(this.vx) * 0.8 + 0.2; }
            if (this.x > bounds.w + margin) { this.vx = -Math.abs(this.vx) * 0.8 - 0.2; }
            if (this.y < -margin) { this.vy = Math.abs(this.vy) * 0.8 + 0.2; }
            if (this.y > bounds.h + margin) { this.vy = -Math.abs(this.vy) * 0.8 - 0.2; }
            // Gentle pull toward hive center when far from it
            const hiveX = bounds.w * 0.5, hiveY = bounds.h * 0.5;
            const distFromHive = Math.sqrt((this.x - hiveX) ** 2 + (this.y - hiveY) ** 2);
            if (distFromHive > bounds.w * 0.6) {
                this.vx += (hiveX - this.x) * 0.0003;
                this.vy += (hiveY - this.y) * 0.0003;
            }
        } else if (this.drawShape === 'frog') {
            // Frogs can sometimes reach edges (jumping) but bounce back
            if (this.x < pad * 0.5) { this.x = pad * 0.5; this.vx = Math.abs(this.vx) * 1.2; }
            if (this.x > bounds.w - pad * 0.5) { this.x = bounds.w - pad * 0.5; this.vx = -Math.abs(this.vx) * 1.2; }
            if (this.y < pad * 0.5) { this.y = pad * 0.5; this.vy = Math.abs(this.vy) * 1.2; }
            if (this.y > bounds.h - pad * 0.5) { this.y = bounds.h - pad * 0.5; this.vy = -Math.abs(this.vy) * 1.2; }
        } else {
            if (this.x < pad) { this.x = pad; this.vx = Math.abs(this.vx); }
            if (this.x > bounds.w - pad) { this.x = bounds.w - pad; this.vx = -Math.abs(this.vx); }
            if (this.y < pad) { this.y = pad; this.vy = Math.abs(this.vy); }
            if (this.y > bounds.h - pad) { this.y = bounds.h - pad; this.vy = -Math.abs(this.vy); }
        }

        if (Math.abs(this.vx) > 0.01 || Math.abs(this.vy) > 0.01) {
            this.direction = Math.atan2(this.vy, this.vx);
        }
    }

    draw(ctx) {
        // Foraging bees are invisible (off-screen foraging)
        if (this.isForaging) return;

        ctx.save();

        // Sick pulse
        if (this.status === 'SICK') {
            const pulse = 0.4 + Math.sin(this.pulsePhase * 3) * 0.3;
            ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 6, 0, Math.PI * 2);
            ctx.fill();
        }

        // Selection highlight
        if (this.selected) {
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Hover glow
        if (this.hovered && !this.selected) {
            ctx.fillStyle = this.glowColor;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // Body: dispatch to shape or fallback to circle
        // When sleeping, pass phase=0 so all animations (tail wag, wing flutter, leg peck) freeze
        const phase = this.state === 'sleeping' ? 0 : this.tailPhase;
        if (this.drawShape) {
            switch (this.drawShape) {
                case 'cattle': AnimalShapes.drawCattle(ctx, this.x, this.y, this.radius, this.direction, phase, this.shapeVariant); break;
                case 'pig': AnimalShapes.drawPig(ctx, this.x, this.y, this.radius, this.direction, phase); break;
                case 'goatSheep': AnimalShapes.drawGoatSheep(ctx, this.x, this.y, this.radius, this.direction, phase, this.shapeVariant); break;
                case 'poultry': AnimalShapes.drawPoultry(ctx, this.x, this.y, this.radius, this.direction, phase, this.shapeVariant); break;
                case 'waterfowl': AnimalShapes.drawWaterfowl(ctx, this.x, this.y, this.radius, this.direction, phase, this.shapeVariant); break;
                case 'fish': AnimalShapes.drawFish(ctx, this.x, this.y, this.radius, this.direction, phase, this.color); break;
                case 'shrimp': AnimalShapes.drawShrimp(ctx, this.x, this.y, this.radius, this.direction, phase, this.shapeVariant); break;
                case 'crab': AnimalShapes.drawCrab(ctx, this.x, this.y, this.radius, this.direction, phase); break;
                case 'mollusc': AnimalShapes.drawMollusc(ctx, this.x, this.y, this.radius, this.direction, phase, this.shapeVariant); break;
                case 'eel': AnimalShapes.drawEel(ctx, this.x, this.y, this.radius, this.direction, phase); break;
                case 'frog': AnimalShapes.drawFrog(ctx, this.x, this.y, this.radius, this.direction, phase); break;
                case 'bee': AnimalShapes.drawBee(ctx, this.x, this.y, this.radius, this.direction, phase); break;
                case 'silkworm': AnimalShapes.drawSilkworm(ctx, this.x, this.y, this.radius, this.direction, phase); break;
                default:
                    ctx.fillStyle = this.color;
                    ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1; ctx.stroke();
            }
        } else {
            // Fallback: plain circle
            ctx.fillStyle = this.color;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1; ctx.stroke();
        }

        // Sleeping indicator
        if (this.state === 'sleeping') {
            const bob = Math.sin(this.pulsePhase * 2) * 3;
            ctx.fillStyle = 'rgba(100,116,139,0.7)';
            ctx.font = '600 10px Manrope, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('zzZ', this.x + 6, this.y - this.radius - 4 + bob);
        }

        // Nesting indicator (chicken sitting on nest)
        if (this.state === 'nesting' && this.nestTarget) {
            const d = Math.hypot(this.nestTarget.x - this.x, this.nestTarget.y - this.y);
            if (d < 8) {
                ctx.font = `${Math.max(8, this.radius * 0.8)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText('🥚', this.x + this.radius + 4, this.y + 2);
            }
        }

        // Sick icon (only when not selected — tooltip already shows status)
        if (this.status === 'SICK' && !this.selected && this.state !== 'sleeping') {
            ctx.font = `${Math.max(10, this.radius)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('🤒', this.x, this.y - this.radius - 6);
        }

        ctx.restore();
    }

    isClicked(mx, my) {
        if (this.isForaging) return false; // Can't click foraging bees
        const dx = this.x - mx;
        const dy = this.y - my;
        return Math.sqrt(dx * dx + dy * dy) <= this.radius + 4;
    }
}

class PenSimulation {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) { console.warn('PenSimulation: Canvas not found:', canvasId); return; }
        this.ctx = this.canvas.getContext('2d');
        this.animals = [];
        this.pen = null;
        this.running = false;
        this.lastTime = 0;
        this.hoveredAnimal = null;
        this.selectedAnimal = null;
        this.emptyMessage = 'Chọn một chuồng để xem mô phỏng';

        // ---- State persistence across pen switches ----
        this.penStateCache = {}; // { penId: { animals: [...serialized], timestamp } }

        // ---- New systems ----
        this.foodParticles = [];
        this.heartParticles = [];
        this.sparkleParticles = [];
        this.rainDrops = [];
        this.weatherType = null;
        this.isNight = false;
        this.dayPhase = 1;
        this.cleaningProgress = -1;
        this.ambientAudio = new AmbientAudio();
        this.overflowCount = 0;

        // Event listeners
        this.canvas.addEventListener('click', (e) => this._onClick(e));
        this.canvas.addEventListener('dblclick', (e) => this._onDblClick(e));
        this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => this._onMouseLeave());

        // Resize
        this._resizeObserver = new ResizeObserver(() => this._resize());
        this._resizeObserver.observe(this.canvas.parentElement);

        // Visibility
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.stop();
            else if (this.pen) this.start();
        });

        // Day/night check every 30s
        this._updateDayNight();
        this._dayNightInterval = setInterval(() => this._updateDayNight(), 30000);

        this._resize();
    }

    _updateDayNight() {
        const h = new Date().getHours(); // Local time (user's timezone)
        this.isNight = h >= 19 || h < 5;
        // Smooth phase: 0=midnight, 1=noon
        if (h >= 5 && h < 7) this.dayPhase = (h - 5) / 2 * 0.5 + 0.5; // dawn
        else if (h >= 7 && h < 17) this.dayPhase = 1; // day
        else if (h >= 17 && h < 19) this.dayPhase = 1 - ((h - 17) / 2) * 0.5; // dusk
        else this.dayPhase = this.isNight ? 0.15 : 0.5;
        this.animals.forEach(a => a.isNight = this.isNight);
    }

    _resize() {
        if (!this.canvas || !this.canvas.parentElement) return;
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.width = rect.width;
        this.height = rect.height;
        if (!this.running) this._drawFrame();
    }

    loadPen(pen) {
        // ---- Save current pen state before switching ----
        if (this.pen && this.pen.id && this.animals.length > 0) {
            this._savePenState(this.pen.id);
        }

        this.pen = pen;
        this.animals = [];
        this.selectedAnimal = null;
        this.hoveredAnimal = null;
        this.foodParticles = [];
        this.heartParticles = [];
        this.sparkleParticles = [];
        this.cleaningProgress = -1;
        this.animalName = pen?.animalDefinition?.name || '';

        if (!pen || !pen.animalCount || pen.animalCount <= 0) {
            this.emptyMessage = pen ? 'Chuồng trống — Chọn vật nuôi để bắt đầu' : 'Chọn một chuồng để xem mô phỏng';
            this.stop(); this._drawFrame(); return;
        }

        const category = pen.animalDefinition?.category || 'LAND';
        const isWater = ['FRESHWATER', 'BRACKISH', 'SALTWATER'].includes(category);
        const config = this._getAnimalConfig(this.animalName, category, pen.farmingType);

        // Growth scale from pen data
        const daysOld = pen.daysOld ?? 0;
        const growthDays = pen.animalDefinition?.growthDurationDays ?? pen.growthDurationDays ?? 90;
        const growthScale = growthDays > 0 ? Math.min(daysOld / growthDays, 1) : 1;

        const count = Math.min(pen.animalCount, 150);
        const pad = 30;

        // ---- Try to restore saved state ----
        const saved = this.penStateCache[pen.id];
        if (saved && saved.animals && saved.animals.length === count) {
            // Restore animals from cached state
            for (let i = 0; i < count; i++) {
                const s = saved.animals[i];
                const animal = new Animal(s.id, s.x, s.y, {
                    ...config,
                    type: isWater ? 'WATER' : 'LAND',
                    status: pen.status === 'SICK' ? (Math.random() < 0.3 ? 'SICK' : 'HEALTHY') : 'HEALTHY',
                    growthScale
                });
                // Restore dynamic state
                animal.vx = s.vx;
                animal.vy = s.vy;
                animal.state = s.state;
                animal.stateTimer = s.stateTimer;
                animal.direction = s.direction;
                animal.isSleeping = s.isSleeping;
                animal.isForaging = s.isForaging;
                animal.foragingTimer = s.foragingTimer;
                animal.tailPhase = s.tailPhase;
                animal.pulsePhase = s.pulsePhase;
                if (s.nestTarget) animal.nestTarget = s.nestTarget;
                animal.isNight = this.isNight;
                this.animals.push(animal);
            }
        } else {
            // Create animals with fresh random positions
            for (let i = 0; i < count; i++) {
                const x = pad + Math.random() * (this.width - pad * 2);
                const y = pad + Math.random() * (this.height - pad * 2);
                const animal = new Animal(i + 1, x, y, {
                    ...config,
                    type: isWater ? 'WATER' : 'LAND',
                    status: pen.status === 'SICK' ? (Math.random() < 0.3 ? 'SICK' : 'HEALTHY') : 'HEALTHY',
                    growthScale
                });
                animal.isNight = this.isNight;
                this.animals.push(animal);
            }
        }

        this.overflowCount = pen.animalCount > 150 ? pen.animalCount - 150 : 0;
        this.noFeeding = config.noFeeding || false;

        // Setup ambient audio
        this.ambientAudio.setType(category, pen.farmingType);

        // Setup rain if weather is rainy
        if (this.weatherType === 'rain' && this.rainDrops.length === 0) {
            for (let i = 0; i < 60; i++) this.rainDrops.push(new RainDrop(this.width, this.height));
        }

        this.start();
    }

    // ---- State persistence helpers ----
    _savePenState(penId) {
        this.penStateCache[penId] = {
            animals: this.animals.map(a => ({
                id: a.id,
                x: a.x,
                y: a.y,
                vx: a.vx,
                vy: a.vy,
                state: a.state,
                stateTimer: a.stateTimer,
                direction: a.direction,
                isSleeping: a.isSleeping,
                isForaging: a.isForaging,
                foragingTimer: a.foragingTimer,
                tailPhase: a.tailPhase,
                pulsePhase: a.pulsePhase,
                nestTarget: a.nestTarget || null
            })),
            timestamp: Date.now()
        };
    }

    _clearPenState(penId) {
        if (penId) delete this.penStateCache[penId];
        else this.penStateCache = {};
    }

    _getAnimalConfig(animalName, category, farmingType) {
        const n = (animalName || '').toLowerCase();
        // ---- Map animal names to visual configs ----
        // Cattle
        if (n.includes('trâu')) return { speed: 0.3, radius: 12, color: '#5d4037', glowColor: 'rgba(93,64,55,0.3)', drawShape: 'cattle', shapeVariant: 'buffalo' };
        if (n.includes('bò sữa')) return { speed: 0.3, radius: 12, color: '#f5f5f5', glowColor: 'rgba(200,200,200,0.3)', drawShape: 'cattle', shapeVariant: 'dairy' };
        if (n.includes('bò')) return { speed: 0.35, radius: 11, color: '#8d6e63', glowColor: 'rgba(141,110,99,0.3)', drawShape: 'cattle', shapeVariant: 'beef' };
        // Pig
        if (n.includes('lợn') || n.includes('heo')) return { speed: 0.2, radius: 9, color: '#f8bbd0', glowColor: 'rgba(248,187,208,0.3)', drawShape: 'pig' };
        // Small ruminants
        if (n.includes('dê')) return { speed: 0.5, radius: 8, color: '#a1887f', glowColor: 'rgba(161,136,127,0.3)', drawShape: 'goatSheep', shapeVariant: 'goat' };
        if (n.includes('cừu')) return { speed: 0.4, radius: 9, color: '#efebe9', glowColor: 'rgba(239,235,233,0.3)', drawShape: 'goatSheep', shapeVariant: 'sheep' };
        // Poultry
        if (n.includes('gà')) return { speed: 0.4, radius: 6, color: '#ff9800', glowColor: 'rgba(255,152,0,0.3)', drawShape: 'poultry', shapeVariant: 'chicken' };
        if (n.includes('cút')) return { speed: 0.35, radius: 4, color: '#8d6e63', glowColor: 'rgba(141,110,99,0.3)', drawShape: 'poultry', shapeVariant: 'quail' };
        // Waterfowl
        if (n.includes('vịt')) return { speed: 0.6, radius: 7, color: '#f5f5f5', glowColor: 'rgba(220,220,220,0.3)', drawShape: 'waterfowl', shapeVariant: 'duck' };
        if (n.includes('ngan')) return { speed: 0.5, radius: 8, color: '#bdbdbd', glowColor: 'rgba(189,189,189,0.3)', drawShape: 'waterfowl', shapeVariant: 'ngan' };
        if (n.includes('ngỗng')) return { speed: 0.5, radius: 9, color: '#e0e0e0', glowColor: 'rgba(224,224,224,0.3)', drawShape: 'waterfowl', shapeVariant: 'goose' };
        // Freshwater fish
        if (n.includes('cá rô')) return { speed: 0.6, radius: 6, color: '#26a69a', glowColor: 'rgba(38,166,154,0.3)', drawShape: 'fish' };
        if (n.includes('cá trắm')) return { speed: 0.5, radius: 7, color: '#4db6ac', glowColor: 'rgba(77,182,172,0.3)', drawShape: 'fish' };
        if (n.includes('cá chép')) return { speed: 0.5, radius: 6, color: '#e65100', glowColor: 'rgba(230,81,0,0.3)', drawShape: 'fish' };
        if (n.includes('cá mè')) return { speed: 0.55, radius: 6, color: '#78909c', glowColor: 'rgba(120,144,156,0.3)', drawShape: 'fish' };
        if (n.includes('cá trê')) return { speed: 0.5, radius: 5, color: '#5d4037', glowColor: 'rgba(93,64,55,0.3)', drawShape: 'fish' };
        if (n.includes('cá lóc')) return { speed: 0.6, radius: 7, color: '#37474f', glowColor: 'rgba(55,71,79,0.3)', drawShape: 'fish' };
        if (n.includes('cá tra')) return { speed: 0.55, radius: 7, color: '#546e7a', glowColor: 'rgba(84,110,122,0.3)', drawShape: 'fish' };
        if (n.includes('cá basa')) return { speed: 0.55, radius: 7, color: '#607d8b', glowColor: 'rgba(96,125,139,0.3)', drawShape: 'fish' };
        // Brackish fish
        if (n.includes('cá kèo')) return { speed: 0.6, radius: 5, color: '#80cbc4', glowColor: 'rgba(128,203,196,0.3)', drawShape: 'fish' };
        if (n.includes('cá đối')) return { speed: 0.55, radius: 6, color: '#4dd0e1', glowColor: 'rgba(77,208,225,0.3)', drawShape: 'fish' };
        // Saltwater fish
        if (n.includes('cá mú')) return { speed: 0.5, radius: 8, color: '#6d4c41', glowColor: 'rgba(109,76,65,0.3)', drawShape: 'fish' };
        if (n.includes('cá chim')) return { speed: 0.6, radius: 7, color: '#42a5f5', glowColor: 'rgba(66,165,245,0.3)', drawShape: 'fish' };
        if (n.includes('cá hồng')) return { speed: 0.55, radius: 7, color: '#ef5350', glowColor: 'rgba(239,83,80,0.3)', drawShape: 'fish' };
        // Eel
        if (n.includes('lươn')) return { speed: 0.5, radius: 6, color: '#455a64', glowColor: 'rgba(69,90,100,0.3)', drawShape: 'eel' };
        // Frog
        if (n.includes('ếch')) return { speed: 0.5, radius: 7, color: '#4caf50', glowColor: 'rgba(76,175,80,0.3)', drawShape: 'frog' };
        // Shrimp
        if (n.includes('tôm hùm')) return { speed: 0.3, radius: 8, color: '#d84315', glowColor: 'rgba(216,67,21,0.3)', drawShape: 'shrimp', shapeVariant: 'lobster' };
        if (n.includes('tôm sú')) return { speed: 0.5, radius: 5, color: '#ff7043', glowColor: 'rgba(255,112,67,0.3)', drawShape: 'shrimp', shapeVariant: 'shrimp' };
        if (n.includes('tôm')) return { speed: 0.5, radius: 5, color: '#ff8a65', glowColor: 'rgba(255,138,101,0.3)', drawShape: 'shrimp', shapeVariant: 'shrimp' };
        // Crab
        if (n.includes('cua')) return { speed: 0.35, radius: 8, color: '#d84315', glowColor: 'rgba(216,67,21,0.3)', drawShape: 'crab' };
        // Molluscs
        if (n.includes('ốc')) return { speed: 0.08, radius: 5, color: '#8d6e63', glowColor: 'rgba(141,110,99,0.3)', drawShape: 'mollusc', shapeVariant: 'snail' };
        if (n.includes('hàu')) return { speed: 0.02, radius: 5, color: '#9e9e9e', glowColor: 'rgba(158,158,158,0.3)', drawShape: 'mollusc', shapeVariant: 'oyster' };
        if (n.includes('nghêu')) return { speed: 0.02, radius: 4, color: '#78909c', glowColor: 'rgba(120,144,156,0.3)', drawShape: 'mollusc', shapeVariant: 'clam' };
        if (n.includes('sò')) return { speed: 0.02, radius: 4, color: '#78909c', glowColor: 'rgba(120,144,156,0.3)', drawShape: 'mollusc', shapeVariant: 'clam' };
        // Bee (no feeding) — calmer movement, some bees forage off-screen
        if (n.includes('ong')) return { speed: 0.5, radius: 4, color: '#ffc107', glowColor: 'rgba(255,193,7,0.3)', drawShape: 'bee', noFeeding: true };
        // Silkworm (no feeding via button — eats leaves)
        if (n.includes('tằm')) return { speed: 0.05, radius: 5, color: '#efebe9', glowColor: 'rgba(239,235,233,0.3)', drawShape: 'silkworm', noFeeding: true };

        // Fallback by category
        switch (category) {
            case 'FRESHWATER': case 'BRACKISH':
                return { speed: 0.6, radius: 6, color: '#26a69a', glowColor: 'rgba(38,166,154,0.3)', drawShape: 'fish' };
            case 'SALTWATER':
                return { speed: 0.7, radius: 7, color: '#42a5f5', glowColor: 'rgba(66,165,245,0.3)', drawShape: 'fish' };
            case 'SPECIAL':
                return { speed: 0.2, radius: 9, color: '#ab47bc', glowColor: 'rgba(171,71,188,0.3)' };
            case 'LAND': default:
                if (farmingType === 'FREE_RANGE' || farmingType === 'BACKYARD')
                    return { speed: 0.8, radius: 6, color: '#ff9800', glowColor: 'rgba(255,152,0,0.3)' };
                return { speed: 0.4, radius: 9, color: '#8d6e63', glowColor: 'rgba(141,110,99,0.3)' };
        }
    }

    // ---- PUBLIC TRIGGER METHODS ----

    triggerFeeding() {
        if (!this.pen || this.animals.length === 0 || this.noFeeding) return;
        const isWater = this.pen.farmingType === 'POND' || this.pen.farmingType === 'TANK';
        const name = (this.animalName || '').toLowerCase();
        const w = this.width, h = this.height;

        // Animal-specific food placement
        if (isWater) {
            // Fish/shrimp: food falls on water surface (top area)
            for (let i = 0; i < 25; i++) {
                const fx = w * 0.15 + Math.random() * w * 0.7;
                const fy = 10 + Math.random() * h * 0.15;
                this.foodParticles.push(new FoodParticle(fx, fy, true));
            }
        } else if (name.includes('lợn') || name.includes('heo')) {
            // Pig: food goes into trough (top-left area)
            for (let i = 0; i < 20; i++) {
                const fx = 20 + Math.random() * w * 0.25;
                const fy = 20 + Math.random() * 14;
                this.foodParticles.push(new FoodParticle(fx, fy, false));
            }
        } else if (name.includes('gà') || name.includes('cút') || name.includes('vịt') || name.includes('ngỗng')) {
            // Poultry/waterfowl: scattered on ground randomly
            for (let i = 0; i < 30; i++) {
                const fx = w * 0.1 + Math.random() * w * 0.8;
                const fy = h * 0.3 + Math.random() * h * 0.6;
                this.foodParticles.push(new FoodParticle(fx, fy, false));
            }
        } else {
            // Default: scatter near trough area
            for (let i = 0; i < 25; i++) {
                const fx = 20 + Math.random() * w * 0.4;
                const fy = 15 + Math.random() * h * 0.3;
                this.foodParticles.push(new FoodParticle(fx, fy, false));
            }
        }

        // Assign nearest food to animals
        const available = [...this.foodParticles.filter(f => !f.eaten)];
        this.animals.forEach(a => {
            if (a.state === 'sleeping' || a.foodTarget) return;
            let best = null, bestD = Infinity;
            available.forEach(fp => {
                const d = Math.hypot(fp.x - a.x, fp.y - a.y);
                if (d < bestD) { bestD = d; best = fp; }
            });
            if (best) { a.state = 'eating'; a.foodTarget = best; a.stateTimer = 500; }
        });
    }

    triggerPetting(animal) {
        if (!animal) return;
        animal.state = 'petting'; animal.stateTimer = 120;
        for (let i = 0; i < 4; i++) this.heartParticles.push(new HeartParticle(animal.x, animal.y));
    }

    triggerCleaning() {
        this.cleaningProgress = 0;
        // Will animate in _update and spawn sparkles when complete
    }

    setWeather(weatherData) {
        if (!weatherData) { this.weatherType = 'clear'; return; }
        const main = (weatherData.weather?.[0]?.main || '').toLowerCase();
        if (main.includes('rain') || main.includes('drizzle') || main.includes('thunderstorm')) {
            this.weatherType = 'rain';
            if (this.rainDrops.length === 0) {
                for (let i = 0; i < 60; i++) this.rainDrops.push(new RainDrop(this.width, this.height));
            }
        } else if (main.includes('cloud')) {
            this.weatherType = 'clouds';
            this.rainDrops = [];
        } else {
            this.weatherType = 'clear';
            this.rainDrops = [];
        }
    }

    toggleSound() { return this.ambientAudio.toggle(); }

    clear() {
        this.pen = null; this.animals = [];
        this.selectedAnimal = null; this.hoveredAnimal = null;
        this.foodParticles = []; this.heartParticles = [];
        this.sparkleParticles = []; this.rainDrops = [];
        this.cleaningProgress = -1;
        this.emptyMessage = 'Chọn một chuồng để xem mô phỏng';
        this.stop(); this._drawFrame();
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.lastTime = performance.now();
        this._loop();
    }

    stop() { this.running = false; }

    _loop() {
        if (!this.running) return;
        const now = performance.now();
        const dt = Math.min(now - this.lastTime, 50);
        this.lastTime = now;
        this._update(dt); this._drawFrame();
        requestAnimationFrame(() => this._loop());
    }

    _update(dt) {
        const bounds = { w: this.width, h: this.height };
        this.animals.forEach(a => a.update(bounds, this.animals, dt));

        // Update particles
        this.foodParticles.forEach(f => f.update(dt));
        this.foodParticles = this.foodParticles.filter(f => f.life > 0);
        this.heartParticles.forEach(h => h.update(dt));
        this.heartParticles = this.heartParticles.filter(h => h.life > 0);
        this.sparkleParticles.forEach(s => s.update(dt));
        this.sparkleParticles = this.sparkleParticles.filter(s => s.life > 0);
        this.rainDrops.forEach(r => r.update(this.width, this.height));

        // Cleaning animation
        if (this.cleaningProgress >= 0 && this.cleaningProgress < 1) {
            this.cleaningProgress += dt * 0.002;
            if (this.cleaningProgress >= 1) {
                this.cleaningProgress = -1;
                // Spawn sparkles across the pen
                for (let i = 0; i < 15; i++) {
                    this.sparkleParticles.push(new SparkleParticle(
                        Math.random() * this.width, Math.random() * this.height
                    ));
                }
            }
        }
    }

    _drawFrame() {
        const ctx = this.ctx;
        const w = this.width, h = this.height;
        ctx.clearRect(0, 0, w, h);

        if (!this.pen || this.animals.length === 0) {
            ctx.fillStyle = '#f1f5f9'; ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = 'rgba(0,0,0,0.03)'; ctx.lineWidth = 1;
            for (let x = 0; x < w; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
            for (let y = 0; y < h; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
            ctx.fillStyle = '#94a3b8';
            ctx.font = '600 16px Manrope, sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(this.emptyMessage, w / 2, h / 2 + 8);
            ctx.font = '48px Material Symbols Outlined';
            ctx.fillText('pets', w / 2, h / 2 - 20);
            return;
        }

        // Environment
        Environment.draw(ctx, w, h, this.pen.farmingType, this.pen.waterType);

        // Pen furniture & decorations
        PenFurniture.draw(ctx, w, h, this.animalName, this.pen.farmingType, Date.now() * 0.001);

        // Dirty overlay (brown spots when DIRTY)
        if (this.pen.status === 'DIRTY' && this.cleaningProgress < 0) {
            const rng = Environment._seededRandom(99);
            ctx.fillStyle = 'rgba(121,85,61,0.12)';
            for (let i = 0; i < 12; i++) {
                ctx.beginPath();
                ctx.arc(rng() * w, rng() * h, 8 + rng() * 15, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Cleaning sweep animation
        if (this.cleaningProgress >= 0) {
            const sweepX = this.cleaningProgress * w;
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fillRect(0, 0, sweepX, h);
            ctx.strokeStyle = 'rgba(59,130,246,0.5)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(sweepX, 0); ctx.lineTo(sweepX, h); ctx.stroke();
        }

        // Food particles (under animals)
        this.foodParticles.forEach(f => f.draw(ctx));

        // Animals
        this.animals.forEach(a => { if (!a.selected) a.draw(ctx); });
        this.animals.forEach(a => { if (a.selected) a.draw(ctx); });

        // Particles on top
        this.heartParticles.forEach(p => p.draw(ctx));
        this.sparkleParticles.forEach(p => p.draw(ctx));

        // Rain
        this.rainDrops.forEach(r => r.draw(ctx));

        // Weather overlays
        if (this.weatherType === 'clouds') {
            ctx.fillStyle = 'rgba(148,163,184,0.08)'; ctx.fillRect(0, 0, w, h);
        }

        // Day/Night overlay
        if (this.dayPhase < 1) {
            const nightAlpha = (1 - this.dayPhase) * 0.4;
            ctx.fillStyle = `rgba(15,23,42,${nightAlpha})`; ctx.fillRect(0, 0, w, h);
            // Dusk/dawn tint
            if (this.dayPhase > 0.3 && this.dayPhase < 0.7) {
                ctx.fillStyle = `rgba(251,146,60,${(0.7 - Math.abs(this.dayPhase - 0.5)) * 0.08})`;
                ctx.fillRect(0, 0, w, h);
            }
        }

        // Overflow indicator
        if (this.overflowCount > 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.font = '600 13px Manrope, sans-serif';
            ctx.textAlign = 'right'; ctx.fillText(`+${this.overflowCount} khác`, w - 16, h - 16);
        }

        // Foraging count for bees
        const foragingCount = this.animals.filter(a => a.isForaging).length;
        if (foragingCount > 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.font = '500 12px Manrope, sans-serif';
            ctx.textAlign = 'left'; ctx.fillText(`🐝 ${foragingCount} đang kiếm mật`, 16, h - 16);
        }

        // Tooltip
        if (this.selectedAnimal) this._drawTooltip(ctx, this.selectedAnimal);
    }

    _drawTooltip(ctx, animal) {
        const stateLabel = animal.state === 'sleeping' ? ' · Đang ngủ' :
                          animal.state === 'eating' ? ' · Đang ăn' :
                          animal.state === 'nesting' ? ' · Đang ấp' :
                          animal.isForaging ? ' · Đi kiếm ăn' : '';
        const text = `#${animal.id} — ${animal.status === 'SICK' ? 'Ốm' : 'Khỏe mạnh'}${stateLabel}`;
        ctx.font = '500 12px Manrope, sans-serif';
        const pw = ctx.measureText(text).width + 20, ph = 28;
        let tx = animal.x - pw / 2, ty = animal.y - animal.radius - ph - 8;
        if (tx < 4) tx = 4;
        if (tx + pw > this.width - 4) tx = this.width - pw - 4;
        if (ty < 4) ty = animal.y + animal.radius + 8;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.beginPath(); Environment._roundRect(ctx, tx, ty, pw, ph, 6); ctx.fill();
        ctx.fillStyle = '#f1f5f9'; ctx.textAlign = 'left';
        ctx.fillText(text, tx + 10, ty + 18);
    }

    _onClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        if (this.selectedAnimal) this.selectedAnimal.selected = false;
        let found = null;
        for (let i = this.animals.length - 1; i >= 0; i--) {
            if (this.animals[i].isClicked(mx, my)) { found = this.animals[i]; break; }
        }
        this.selectedAnimal = found;
        if (found) found.selected = true;
        if (!this.running) this._drawFrame();
        this.canvas.dispatchEvent(new CustomEvent('animalclick', {
            detail: found ? { id: found.id, status: found.status } : null
        }));
    }

    _onDblClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        for (let i = this.animals.length - 1; i >= 0; i--) {
            if (this.animals[i].isClicked(mx, my)) {
                this.triggerPetting(this.animals[i]);
                break;
            }
        }
    }

    _onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        let found = null;
        for (let i = this.animals.length - 1; i >= 0; i--) {
            this.animals[i].hovered = false;
            if (!found && this.animals[i].isClicked(mx, my)) found = this.animals[i];
        }
        if (found) { found.hovered = true; this.canvas.style.cursor = 'pointer'; }
        else { this.canvas.style.cursor = 'default'; }
        this.hoveredAnimal = found;
    }

    _onMouseLeave() {
        this.animals.forEach(a => a.hovered = false);
        this.hoveredAnimal = null;
        this.canvas.style.cursor = 'default';
    }

    destroy() {
        this.stop();
        if (this._resizeObserver) this._resizeObserver.disconnect();
        clearInterval(this._dayNightInterval);
        this.ambientAudio.destroy();
    }
}

// Export globally
window.PenSimulation = PenSimulation;
