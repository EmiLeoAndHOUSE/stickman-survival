// ==========================================
// STICKMAN SURVIVAL: REBIRTH - CORE ENGINE
// ==========================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 1024x576 è lo standard d'oro per performance/qualità su mobile (16:9)
let width = 1024;
let height = 576;

function resize() {
    // La risoluzione INTERNA del canvas rimane fissa per stabilità estrema
    canvas.width = 1024;
    canvas.height = 576;
    // Il CSS (object-fit: contain) si occupa di adattarlo allo schermo
}



window.addEventListener('resize', resize);
resize();

// ==========================================
// MACCHINA A STATI E AUDIO SYNTH
// ==========================================
let gameState = 'MENU'; // 'MENU', 'PLAY'

let audioCtx = null;

function initAudio() {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    } catch (e) {
        console.warn("AudioContext failed to initialize:", e);
    }
}

// ==========================================
// VARIABILI GLOBALI (Stato del Mondo ed Entità)
// ==========================================
let allies = [];
let enemies = [];
let particles = [];
let lastSpawnNight = -1;
let currentDay = 1;
let currentInteractable = null;
let timeOfDay = 5.0001;
let lastTime = 0;
let camera = { x: 0, y: 0 };
let gameOver = false;
let timeSpeedGlobal = 1.0;

function playSound(type, sourceX = null, sourceY = null) {
    if (!audioCtx || gameState !== 'PLAY') return;

    // --- LOGICA AUDIO SPAZIALE (Volume dinamico in base alla distanza) ---
    let volumeMultiplier = 1.0;
    if (sourceX !== null && sourceY !== null && typeof player !== 'undefined') {
        const dist = Math.sqrt(Math.pow(player.x - sourceX, 2) + Math.pow(player.y - sourceY, 2));
        const MAX_DIST = 1400; // Oltre questa distanza il suono sparisce
        const MIN_DIST = 300;  // Sotto questa distanza il volume è massimo

        if (dist > MAX_DIST) return; // Silenzio totale per zombie lontani
        if (dist > MIN_DIST) {
            volumeMultiplier = 1 - ((dist - MIN_DIST) / (MAX_DIST - MIN_DIST));
        }
    }

    let osc = audioCtx.createOscillator();
    let gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    let now = audioCtx.currentTime;

    if (type === 'slash') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
        gainNode.gain.setValueAtTime(0.3 * volumeMultiplier, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'zombie_hit') { // L'impatto ovattato sullo Zombie
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
        gainNode.gain.setValueAtTime(0.4 * volumeMultiplier, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    } else if (type === 'player_hit') { // Urlo Vocale Sintetizzato "AAA"
        osc.disconnect(); // Rimuovo il link diretto

        let filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass'; /* Isola le frequenze della voce */
        filter.frequency.value = 900; // Formante classica vocale "Ah" umana
        filter.Q.value = 2.5; // Risonanza stretta (Effetto Laringe)

        osc.connect(filter);
        filter.connect(gainNode); // Il filtro va al volume

        osc.type = 'sawtooth'; // Base molto "raschiante" come vere corde vocali
        osc.frequency.setValueAtTime(450, now); // Altissima tensione da spavento
        osc.frequency.linearRampToValueAtTime(300, now + 0.4); // Calo di gemito stanco

        gainNode.gain.setValueAtTime(1.5 * volumeMultiplier, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

        osc.start(now);
        osc.stop(now + 0.4);
    } else if (type === 'jump') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(600, now + 0.1);
        gainNode.gain.setValueAtTime(0.2 * volumeMultiplier, now);
        gainNode.gain.linearRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    } else if (type === 'wake') { // Ruggito basso Zombie della Grotta
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.linearRampToValueAtTime(150, now + 0.5);
        gainNode.gain.setValueAtTime(0.5 * volumeMultiplier, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    } else if (type === 'kill') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.setValueAtTime(300, now + 0.1);
        osc.frequency.setValueAtTime(400, now + 0.2);
        gainNode.gain.setValueAtTime(0.3 * volumeMultiplier, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
    } else if (type === 'hit') { // Impatto metallico Scudo
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.linearRampToValueAtTime(400, now + 0.1);
        gainNode.gain.setValueAtTime(0.2 * volumeMultiplier, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'break') { // Rottura Scudo
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.linearRampToValueAtTime(50, now + 0.3);
        gainNode.gain.setValueAtTime(0.6 * volumeMultiplier, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    }
}

// SETUP MENU (Eseguito direttamente poichè lo script è a fine body)
const startBtn = document.getElementById('startBtn');
if (startBtn) {
    startBtn.addEventListener('click', () => {
        // Su mobile proviamo il fullscreen immediato per immersività
        if (window.innerWidth < 1024) {
            document.documentElement.requestFullscreen().catch(() => {});
        }
        
        initAudio(); // Sblocca l'audio
        document.getElementById('mainMenu').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('mainMenu').style.display = 'none';
            gameState = 'PLAY';
        }, 500);
    });
}


// ==========================================
// 1. ASSET LOADER (Gestione Immagini in Parallelo)
// ==========================================
const gfx = {
    grass: new Image(),
    dirt: new Image(),
    sky_day: new Image(),
    sky_night: new Image()
};

let loadedAssets = 0;
// Non importa se l'immagine carica o fallisce (error), incrementiamo e avviamo.
// Se un'immagine non viene trovata, il gioco userà i colori fallback impostati in drawForeground()
let gameStarted = false;
function tryBoot() {
    if (gameStarted) return;
    gameStarted = true;
    // Avviamo immediatamente: le immagini caricheranno in background o useranno i fallback
    requestAnimationFrame(gameLoop);
}

// Fallback di sicurezza: se le immagini non rispondono entro 1 secondo, avvia comunque!
setTimeout(tryBoot, 1000);

gfx.grass.onload = tryBoot; gfx.dirt.onload = tryBoot; gfx.sky_day.onload = tryBoot; gfx.sky_night.onload = tryBoot;
gfx.grass.onerror = tryBoot; gfx.dirt.onerror = tryBoot; gfx.sky_day.onerror = tryBoot; gfx.sky_night.onerror = tryBoot;

// Caricamento su disco (Asincrono, farà scattare gli eventi di cui sopra)
gfx.grass.src = 'grass.png';
gfx.dirt.src = 'dirt.png';
gfx.sky_day.src = 'sky_day.png';
gfx.sky_night.src = 'sky_night.png';

// ==========================================
// 2. INPUT SYSTEM
// ==========================================
const keys = {};

window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

// Gestione Mouse per i combattimenti
window.addEventListener('mousedown', e => {
    if (e.button === 0) keys['MouseLeft'] = true;
    if (e.button === 2) keys['MouseRight'] = true;
});
window.addEventListener('mouseup', e => {
    if (e.button === 0) keys['MouseLeft'] = false;
    if (e.button === 2) keys['MouseRight'] = false;
});
// Disabilita Menu Contestuale per permettere la parata con tasto destro
// Disabilita Menu Contestuale per permettere la parata con tasto destro
window.addEventListener('contextmenu', e => e.preventDefault());

// --- SISTEMA DI CONTROLLO TOUCH (Virtual Joystick & Buttons) ---
function getTouchCoords(e) {
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
    };
}

function initTouch() {
    const joystickBase = document.getElementById('joystickBase');
    const joystickKnob = document.getElementById('joystickKnob');
    if (!joystickBase) return;

    let joystickActive = false;

    const handleJoystick = (e) => {
        if (!joystickActive) return;
        const coords = getTouchCoords(e);
        const rect = joystickBase.getBoundingClientRect(); // Questo è ancora fisico
        const scaleX = canvas.width / rect.width; // Non utile qui dato che il joystick è relativo
        
        // Per semplicità usiamo le coordinate fisiche relative per il joystick
        const touch = e.touches[0];
        const bRect = joystickBase.getBoundingClientRect();
        const centerX = bRect.left + bRect.width / 2;
        const centerY = bRect.top + bRect.height / 2;
        
        const dx = touch.clientX - centerX;
        const dy = touch.clientY - centerY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const maxDist = bRect.width / 2;
        
        const angle = Math.atan2(dy, dx);
        const limitedDist = Math.min(dist, maxDist);
        
        const moveX = Math.cos(angle) * limitedDist;
        const moveY = Math.sin(angle) * limitedDist;
        
        joystickKnob.style.transform = `translate(${moveX}px, ${moveY}px)`;
        
        keys['KeyA'] = (moveX < -20);
        keys['KeyD'] = (moveX > 20);
    };


    joystickBase.addEventListener('touchstart', (e) => {
        joystickActive = true;
        baseRect = joystickBase.getBoundingClientRect();
        handleJoystick(e);
        e.preventDefault();
    }, {passive: false});

    window.addEventListener('touchmove', (e) => {
        if (joystickActive) {
            handleJoystick(e);
            e.preventDefault();
        }
    }, {passive: false});

    window.addEventListener('touchend', () => {
        joystickActive = false;
        joystickKnob.style.transform = `translate(0, 0)`;
        keys['KeyA'] = false;
        keys['KeyD'] = false;
    });

    // Azioni Pulsanti
    const mapBtn = (id, keyCode) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('touchstart', (e) => {
            keys[keyCode] = true;
            e.preventDefault();
        }, {passive: false});
        btn.addEventListener('touchend', (e) => {
            keys[keyCode] = false;
            e.preventDefault();
        }, {passive: false});
    };

    mapBtn('btnJump', 'Space');
    mapBtn('btnAttack', 'MouseLeft');
    mapBtn('btnParry', 'MouseRight');
    mapBtn('btnInteract', 'KeyE');
}

// Inizializza il touch quando il DOM è pronto
document.addEventListener('DOMContentLoaded', initTouch);

class World {
    constructor() {
        this.platforms = [];
        this.backgrounds = [];
        this.interactables = [];
        this.decorations = [];
        this.mapWidth = 100000; // Definizione larghezza mondo

        // --- INIZIALIZZAZIONE PATTERN PIXEL ART ---
        this.initPatterns(ctx);

        this.generateWorld();
    }

    initPatterns(ctx) {
        if (!this.stonePattern) {
            // Pattern Pietra Grotta (Primo Piano)
            let sCanvas = document.createElement('canvas');
            sCanvas.width = 32; sCanvas.height = 32;
            let sCtx = sCanvas.getContext('2d');
            sCtx.fillStyle = '#1C1C24'; sCtx.fillRect(0, 0, 32, 32);
            sCtx.fillStyle = '#0D0D14';
            sCtx.fillRect(0, 15, 32, 2);
            sCtx.fillRect(15, 0, 2, 16);
            sCtx.fillStyle = '#26262E';
            sCtx.fillRect(2, 2, 12, 2); sCtx.fillRect(18, 2, 12, 2);
            this.stonePattern = ctx.createPattern(sCanvas, 'repeat');

            // Pattern Fondo Grotta (Parallasse Interno)
            let sbCanvas = document.createElement('canvas');
            sbCanvas.width = 64; sbCanvas.height = 64;
            let sbCtx = sbCanvas.getContext('2d');
            sbCtx.fillStyle = '#0A0A0F'; sbCtx.fillRect(0, 0, 64, 64);
            sbCtx.fillStyle = '#050508';
            for (let i = 0; i < 10; i++) {
                sbCtx.fillRect(Math.random() * 64, Math.random() * 64, 8, 8);
            }
            this.caveBgPattern = ctx.createPattern(sbCanvas, 'repeat');
        }
    }

    // Algoritmo Procedurale: Taverna Fantasy
    renderFantasyHouse(ctx, startX, startY, w, h, isBg, isLooted) {
        let wallColor = isBg ? '#352515' : '#5C4033';
        let woodPillar = isBg ? '#1A1105' : '#2A1810';
        let roofColor = isBg ? '#2E1111' : '#4A1C1C';
        let roofOutline = isBg ? '#110505' : '#220A0A';
        let winColor = isLooted ? '#1A1A1A' : (isBg ? '#886600' : '#FFCC00');

        let pWidth = 14;

        ctx.fillStyle = wallColor;
        ctx.fillRect(startX, startY, w, h);

        ctx.fillStyle = woodPillar;
        for (let i = 10; i < h; i += 20) {
            ctx.fillRect(startX, startY + i, w, 2);
        }

        ctx.fillStyle = woodPillar;
        ctx.fillRect(startX - 5, startY, pWidth, h);
        ctx.fillRect(startX + w - pWidth + 5, startY, pWidth, h);

        let steps = 6;
        let stepH = 80 / steps;
        let stepW = (w + 40) / 2 / steps;

        ctx.fillStyle = '#1A1105';
        ctx.fillRect(startX + w - 40, startY - 70, 20, 50);

        for (let s = 0; s < steps; s++) {
            let currentY = startY - (s + 1) * stepH;
            let currentW = (w + 40) - (s * 2 * stepW);
            let currentX = startX - 20 + (s * stepW);

            ctx.fillStyle = roofOutline;
            ctx.fillRect(currentX, currentY, currentW, stepH);

            ctx.fillStyle = roofColor;
            ctx.fillRect(currentX + 2, currentY + 2, currentW - 4, stepH - 2);
        }

        let doorW = 40;
        let doorH = 50;
        let doorX = startX + w / 2 - doorW / 2;
        ctx.fillStyle = '#1A1105';
        ctx.fillRect(doorX - 4, startY + h - doorH - 4, doorW + 8, doorH + 4);
        ctx.fillStyle = '#3E2723';
        ctx.fillRect(doorX, startY + h - doorH, doorW, doorH);
        ctx.fillStyle = '#111';
        ctx.fillRect(doorX + 10, startY + h - doorH, 4, doorH);
        ctx.fillRect(doorX + 26, startY + h - doorH, 4, doorH);
        ctx.fillStyle = '#000';
        ctx.fillRect(doorX + doorW - 12, startY + h - doorH / 2, 8, 8);

        let winW = 30;
        let winH = 30;
        ctx.fillStyle = '#111';
        ctx.fillRect(startX + 20 - 4, startY + 30 - 4, winW + 8, winH + 8);
        ctx.fillStyle = winColor;
        ctx.fillRect(startX + 20, startY + 30, winW, winH);
        ctx.fillStyle = '#111';
        ctx.fillRect(startX + 20 + winW / 2 - 2, startY + 30, 4, winH);
        ctx.fillRect(startX + 20, startY + 30 + winH / 2 - 2, winW, 4);

        ctx.fillStyle = '#111';
        ctx.fillRect(startX + w - 20 - winW - 4, startY + 30 - 4, winW + 8, winH + 8);
        ctx.fillStyle = winColor;
        ctx.fillRect(startX + w - 20 - winW, startY + 30, winW, winH);
        ctx.fillStyle = '#111';
        ctx.fillRect(startX + w - 20 - winW / 2 - 2, startY + 30, 4, winH);
        ctx.fillRect(startX + w - 20 - winW, startY + 30 + winH / 2 - 2, winW, 4);
    }

    // Algoritmo Procedurale: Castello Castlevania Premium
    renderCastlevania(ctx, startX, startY, w, h, isBg, isLooted) {

        if (!this.brickPattern) {
            let bCanvas = document.createElement('canvas');
            bCanvas.width = 32; bCanvas.height = 16;
            let bCtx = bCanvas.getContext('2d');

            bCtx.fillStyle = '#32323D'; bCtx.fillRect(0, 0, 32, 16);
            bCtx.fillStyle = '#1C1C24';
            bCtx.fillRect(0, 7, 32, 2); bCtx.fillRect(0, 15, 32, 2);
            bCtx.fillRect(15, 0, 2, 8); bCtx.fillRect(7, 8, 2, 8); bCtx.fillRect(23, 8, 2, 8);
            bCtx.fillStyle = '#454555';
            bCtx.fillRect(0, 0, 15, 2); bCtx.fillRect(17, 0, 15, 2);
            bCtx.fillRect(0, 8, 7, 2); bCtx.fillRect(9, 8, 14, 2); bCtx.fillRect(25, 8, 7, 2);
            this.brickPattern = ctx.createPattern(bCanvas, 'repeat');

            let bgCanvas = document.createElement('canvas');
            bgCanvas.width = 32; bgCanvas.height = 16;
            let bgCtx = bgCanvas.getContext('2d');
            bgCtx.fillStyle = '#181822'; bgCtx.fillRect(0, 0, 32, 16);
            bgCtx.fillStyle = '#0D0D14';
            bgCtx.fillRect(0, 7, 32, 2); bgCtx.fillRect(0, 15, 32, 2);
            bgCtx.fillRect(15, 0, 2, 8); bgCtx.fillRect(7, 8, 2, 8); bgCtx.fillRect(23, 8, 2, 8);
            bgCtx.fillStyle = '#22222E';
            bgCtx.fillRect(0, 0, 15, 2); bgCtx.fillRect(17, 0, 15, 2);
            bgCtx.fillRect(0, 8, 7, 2); bgCtx.fillRect(9, 8, 14, 2); bgCtx.fillRect(25, 8, 7, 2);
            this.bgBrickPattern = ctx.createPattern(bgCanvas, 'repeat');
        }

        let wallPattern = isBg ? this.bgBrickPattern : this.brickPattern;
        let shadowColor = isBg ? '#0D0D14' : '#1C1C24';
        let highlightColor = isBg ? '#22222E' : '#454555';
        let roofColor = isBg ? '#07070A' : '#111115';
        let windowBorder = isBg ? '#08080C' : '#111118';
        let glowColor = isLooted ? '#1A1A1A' : (isBg ? '#7A1111' : '#E62222');

        let keepWidth = w * 0.55;
        let keepX = startX + (w - keepWidth) / 2;
        let tWidth = w * 0.28;
        let tHeight = h * 1.35;
        let tY = startY - (tHeight - h);

        // Mura
        ctx.fillStyle = wallPattern;
        ctx.fillRect(keepX, startY, keepWidth, h);
        ctx.fillRect(startX, tY, tWidth, tHeight);
        ctx.fillRect(startX + w - tWidth, tY, tWidth, tHeight);

        // Colonne esterne (Volume prospettico 3D finto)
        ctx.fillStyle = shadowColor;
        ctx.fillRect(startX, tY, 6, tHeight);
        ctx.fillRect(startX + tWidth - 6, tY, 6, tHeight);
        ctx.fillRect(startX + w - tWidth, tY, 6, tHeight);
        ctx.fillRect(startX + w - 6, tY, 6, tHeight);
        ctx.fillStyle = highlightColor;
        ctx.fillRect(startX + 6, tY, 4, tHeight);
        ctx.fillRect(startX + w - tWidth + 6, tY, 4, tHeight);

        // Merlature blocky
        ctx.fillStyle = wallPattern;
        for (let i = 0; i < tWidth - 10; i += 16) {
            ctx.fillRect(startX + i + 4, tY - 14, 12, 14);
            ctx.fillRect(startX + w - tWidth + i + 4, tY - 14, 12, 14);
        }
        for (let i = 0; i < keepWidth - 10; i += 18) {
            ctx.fillRect(keepX + i + 5, startY - 14, 12, 14);
        }

        // Guglie voxel
        ctx.fillStyle = roofColor;
        function drawSpire(sx, sy, sw) {
            let steps = 14;
            let stepH = 90 / steps;
            let stepW = sw / 2 / steps;
            for (let s = 0; s < steps; s++) {
                ctx.fillRect(sx + (s * stepW), sy - (s * stepH) - stepH, sw - (s * 2 * stepW), stepH);
            }
        }
        drawSpire(startX - 5, tY - 14, tWidth + 10);
        drawSpire(startX + w - tWidth - 5, tY - 14, tWidth + 10);
        drawSpire(keepX, startY - 14, keepWidth);

        // Vetrate ad arco
        let renderGothicWindow = (wx, wy, ww, wh) => {
            ctx.fillStyle = windowBorder;
            ctx.beginPath();
            ctx.ellipse(wx + ww / 2, wy + ww / 2, ww / 2 + 4, ww / 2 + 4, 0, Math.PI, 0);
            ctx.fill();
            ctx.fillRect(wx - 4, wy + ww / 2, ww + 8, wh - ww / 2 + 4);

            ctx.fillStyle = glowColor;
            ctx.beginPath();
            ctx.ellipse(wx + ww / 2, wy + ww / 2, ww / 2, ww / 2, 0, Math.PI, 0);
            ctx.fill();
            ctx.fillRect(wx, wy + ww / 2, ww, wh - ww / 2);

            ctx.fillStyle = '#050505';
            ctx.fillRect(wx + ww / 2 - 2, wy, 4, wh);
            ctx.fillRect(wx, wy + wh / 2 - 2, ww, 4);
            ctx.fillRect(wx, wy + wh / 2 - 16, ww, 4);
        };
        renderGothicWindow(startX + tWidth / 2 - 10, tY + 50, 20, 50);
        renderGothicWindow(startX + w - tWidth / 2 - 10, tY + 50, 20, 50);
        renderGothicWindow(keepX + keepWidth / 2 - 18, startY + 50, 36, 70);

        // Portone Demoniaco in Ferro Nero
        let doorW = 70;
        let doorH = 70;
        let doorX = keepX + keepWidth / 2 - doorW / 2;
        let doorY = startY + h - doorH - 4;

        ctx.fillStyle = windowBorder;
        ctx.beginPath();
        ctx.ellipse(doorX + doorW / 2, doorY, doorW / 2 + 6, doorW / 2 + 6, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(doorX - 6, doorY, doorW + 12, doorH + 4);

        ctx.fillStyle = '#050505';
        ctx.beginPath();
        ctx.ellipse(doorX + doorW / 2, doorY, doorW / 2, doorW / 2, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(doorX, doorY, doorW, doorH + 4);

        // Cancello Spinato (sparisce se lo ispezioni)
        if (!isLooted) {
            ctx.fillStyle = '#333';
            for (let j = 0; j < 8; j++) {
                ctx.fillRect(doorX + 3 + (j * 9), doorY - 30, 4, doorH + 30);
            }
            ctx.fillStyle = '#111';
            for (let j = 0; j < 8; j++) {
                ctx.fillRect(doorX + 2 + (j * 9), doorY + doorH, 6, 12);
            }
        }
    }

    generateWorld() {
        let currentX = 0;
        const groundLevel = 600;

        // = Background Generation =
        let bgX = -1000;
        const MAP_SIZE = this.mapWidth;
        while (bgX < MAP_SIZE) {
            let choice = Math.random();
            let type = 'tree';
            let width = 100;

            if (choice > 0.8) {
                type = 'castle';
                width = 300;
            } else if (choice > 0.5) {
                type = 'house';
                width = 150;
            }

            this.backgrounds.push({
                x: bgX,
                y: groundLevel,
                type: type,
                width: width
            });

            bgX += width + Math.random() * 400 + 100;
        }

        // = Foreground Platforms Generation =
        while (currentX < MAP_SIZE) {

            // 1. Pianura di base
            let plainLength = 600 + Math.random() * 800;
            this.platforms.push({ x: currentX, y: groundLevel, width: plainLength, height: 800 });

            // 2. Edifici fisici esplorabili
            if (plainLength > 800 && Math.random() > 0.6) {
                let isCastle = Math.random() > 0.7;
                let bWidth = isCastle ? 350 : 180;
                let bHeight = isCastle ? 250 : 150;
                let bX = currentX + (plainLength / 2) - (bWidth / 2);
                let bY = groundLevel - bHeight;

                // Hitbox del tetto
                this.platforms.push({ x: bX, y: bY, width: bWidth, height: 20 });

                this.interactables.push({
                    x: bX, y: bY, width: bWidth, height: bHeight,
                    type: isCastle ? 'castle' : 'house',
                    doorX: bX + bWidth / 2 - 30,
                    doorWidth: 60,
                    looted: false
                });
            }

            // 3. Piattaforme fluttuanti (Jump challenge)
            if (Math.random() > 0.4) {
                this.platforms.push({ x: currentX + 200, y: groundLevel - 150, width: 200, height: 20 });
                if (Math.random() > 0.5) {
                    this.platforms.push({ x: currentX + 500, y: groundLevel - 280, width: 150, height: 20 });
                }
            }

            currentX += plainLength;            // 4. Crepacci sotterranei (Grotte Giganti & Esplorabili)
            if (currentX < MAP_SIZE - 1000 && Math.random() > 0.2) {
                let gapWidth = 600 + Math.random() * 600;
                let caveDepth = groundLevel + 280 + Math.random() * 200;

                // --- PIATTAFORME A MENSOLE SOVRAPPOSTE (SCALA FACILE) ---
                let cavePlatforms = [];
                let currentY = caveDepth - 120; // Partiamo dal basso verso l'alto
                let side = 1; // 1 = Sinistra, -1 = Destra

                while (currentY > groundLevel + 20) {
                    // Ogni piattaforma è larga poco più di metà grotta per garantire sovrapposizione al centro
                    let pw = (gapWidth / 2) + 40 + Math.random() * 40;
                    // Se side==1 si aggancia a sinistra, altrimenti a destra
                    let px = (side === 1) ? currentX : currentX + gapWidth - pw;

                    let plat = { x: px, y: currentY, width: pw, height: 20, isStairs: true };
                    cavePlatforms.push(plat);
                    this.platforms.push(plat);

                    currentY -= 110; // Salto verticale fisso, attraversabile dal basso grazie al motore pass-through
                    side *= -1;
                }

                // Ponte in legno per i crepacci molto larghi
                if (gapWidth > 800) {
                    this.platforms.push({
                        x: currentX + gapWidth / 2 - 200,
                        y: groundLevel - 40,
                        width: 400, height: 15,
                        isBridge: true
                    });
                }

                // --- SCALA A PIOLI MINERARIA ---
                let ladderX = currentX + 80 + Math.random() * (gapWidth - 160); // Posizione Casuale (Pari)
                let ladderY = groundLevel - 40; // Sporge poco fuori terra
                let ladderHeight = (caveDepth - groundLevel) + 60; // Fino al fondo della caverna

                this.interactables.push({
                    type: 'ladder',
                    x: ladderX,
                    y: ladderY,
                    width: 40,
                    height: ladderHeight
                });

                // Pareti di Roccia rimosse per pulire visivamente e fisicamente la grotta

                // Soffitto Irregolare rimosso per permettere l'uscita in superficie

                // Pavimento Organico
                let stepW = 150;
                for (let ix = 0; ix < gapWidth; ix += stepW) {
                    this.platforms.push({
                        x: currentX + ix, y: caveDepth + (Math.random() - 0.5) * 40,
                        width: stepW + 10, height: 800, isCave: true
                    });
                }

                // --- VITA & DECORAZIONI ---
                let numMinerals = Math.floor(gapWidth / 60);
                for (let i = 0; i < numMinerals; i++) {
                    let mColors = ['#444', '#CCC', '#FFD700'];
                    this.decorations.push({
                        type: 'mineral', color: mColors[Math.floor(Math.random() * 3)],
                        x: currentX + Math.random() * gapWidth, y: caveDepth + Math.random() * 400, size: 4 + Math.random() * 6
                    });
                }

                let numCaveZombies = Math.floor(gapWidth / 300) + 1;
                for (let i = 0; i < numCaveZombies; i++) {
                    // Spawn Zombie Bianchi nelle grotte
                    enemies.push(new Zombie(currentX + 100 + Math.random() * (gapWidth - 200), caveDepth - 80, 'white'));
                }

                // Stalattiti agganciate alle nuove piattaforme procedurali
                cavePlatforms.forEach(plat => {
                    if (Math.random() > 0.4) {
                        this.decorations.push({
                            type: 'stalactite', x: plat.x + 10 + Math.random() * (plat.width - 20), y: plat.y + plat.height, scale: 0.8 + Math.random()
                        });
                    }
                });

                // Cristalli extra nel profondo
                let numCrystals = Math.floor(gapWidth / 150) + 2;
                for (let i = 0; i < numCrystals; i++) {
                    this.decorations.push({
                        type: 'crystal', color: ['#00FFFF', '#FF00FF', '#7FFF00'][Math.floor(Math.random() * 3)],
                        x: currentX + Math.random() * gapWidth, y: caveDepth + (Math.random() - 0.5) * 100, scale: 0.7 + Math.random() * 1.3
                    });
                }

                // --- BAULI DEL TESORO (Chest Spawning) ---
                if (Math.random() > 0.6) {
                    this.interactables.push({
                        type: 'chest',
                        looted: false,
                        x: currentX + Math.random() * (gapWidth - 60),
                        y: caveDepth - 50,
                        width: 60, height: 50,
                        doorX: currentX, doorWidth: gapWidth // Area di interazione
                    });
                }

                currentX += gapWidth;
            }
        }
    }

    drawParallax(ctx, camera) {
        let parallaxFactor = 0.5;

        let horizonY = 600 - camera.y;
        let hillOffsetX = (camera.x * 0.2) % 800;
        let hillCount = Math.ceil(width / 800) + 1;

        ctx.fillStyle = '#3E2723';
        ctx.fillRect(0, horizonY, width, 2000);

        ctx.beginPath();
        for (let i = -1; i <= hillCount; i++) {
            let cx = (i * 800) - hillOffsetX + 400;
            ctx.ellipse(cx, horizonY + 110, 500, 200, 0, Math.PI, 0);
        }
        ctx.fill();

        if (typeof gfx !== 'undefined' && gfx.grass && gfx.grass.complete && gfx.grass.naturalWidth > 0) {
            ctx.fillStyle = ctx.createPattern(gfx.grass, 'repeat');
            ctx.save();
            ctx.translate(-hillOffsetX, 0);
            ctx.beginPath();
            for (let i = -2; i <= hillCount + 1; i++) {
                let cx = (i * 800) + 400;
                ctx.ellipse(cx, horizonY + 80, 500, 200, 0, Math.PI, 0);
            }
            ctx.fill();
            ctx.restore();
        } else {
            ctx.fillStyle = '#4a7023';
            ctx.beginPath();
            for (let i = -1; i <= hillCount; i++) {
                let cx = (i * 800) - hillOffsetX + 400;
                ctx.ellipse(cx, horizonY + 80, 500, 200, 0, Math.PI, 0);
            }
            ctx.fill();
        }

        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.beginPath();
        for (let i = -1; i <= hillCount; i++) {
            let cx = (i * 800) - hillOffsetX + 400;
            ctx.ellipse(cx, horizonY + 80, 500, 200, 0, Math.PI, 0);
        }
        ctx.fill();
        ctx.fillRect(0, horizonY + 80, width, 2000);

        // LAYER MEDIANO
        let midOffsetX = (camera.x * parallaxFactor) % 800;
        let midHorizonY = horizonY + 30;

        ctx.fillStyle = '#26150D';
        ctx.fillRect(0, midHorizonY, width, 2000);

        if (typeof gfx !== 'undefined' && gfx.grass && gfx.grass.complete && gfx.grass.naturalWidth > 0) {
            ctx.fillStyle = ctx.createPattern(gfx.grass, 'repeat');
            ctx.save();
            ctx.translate(-midOffsetX, 0);
            ctx.beginPath();
            for (let i = -2; i <= hillCount + 1; i++) {
                let cx = (i * 800) + 400;
                ctx.ellipse(cx, midHorizonY + 5, 450, 40, 0, Math.PI, 0);
            }
            ctx.fill();
            ctx.restore();
        } else {
            ctx.fillStyle = '#3a6015';
            ctx.fillRect(0, midHorizonY - 10, width, 10);
        }

        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        for (let i = -1; i <= hillCount; i++) {
            let cx = (i * 800) - midOffsetX + 400;
            ctx.ellipse(cx, midHorizonY + 5, 450, 40, 0, Math.PI, 0);
        }
        ctx.fill();

        this.backgrounds.forEach(bg => {
            let screenX = bg.x - (camera.x * parallaxFactor);
            let screenY = bg.y - camera.y + 30;

            if (screenX + bg.width > 0 && screenX < width) {
                if (bg.type === 'tree') {
                    let cx = screenX + bg.width / 2;
                    let cy = screenY;

                    ctx.fillStyle = '#1A1100';
                    ctx.fillRect(cx - 14, cy - 112, 28, 114);
                    ctx.fillStyle = '#3E2723';
                    ctx.fillRect(cx - 12, cy - 110, 24, 110);
                    ctx.fillStyle = '#5D4037';
                    ctx.fillRect(cx - 12, cy - 110, 8, 110);
                    ctx.fillStyle = '#2A1810';
                    ctx.fillRect(cx - 2, cy - 90, 10, 8);
                    ctx.fillRect(cx - 8, cy - 50, 8, 8);
                    ctx.fillRect(cx, cy - 20, 10, 8);

                    let leavesPos = [
                        { x: -45, y: -130, w: 90, h: 40 },
                        { x: -65, y: -160, w: 130, h: 50 },
                        { x: -55, y: -190, w: 110, h: 50 },
                        { x: -35, y: -220, w: 70, h: 50 },
                        { x: -15, y: -240, w: 30, h: 30 }
                    ];

                    leavesPos.forEach(leaf => {
                        ctx.fillStyle = '#051A05';
                        ctx.fillRect(cx + leaf.x - 2, cy + leaf.y - 2, leaf.w + 4, leaf.h + 4);
                        ctx.fillStyle = '#1B5E20';
                        ctx.fillRect(cx + leaf.x, cy + leaf.y, leaf.w, leaf.h);
                        ctx.fillStyle = '#2E7D32';
                        ctx.fillRect(cx + leaf.x + 2, cy + leaf.y + 2, leaf.w - 10, leaf.h / 2.5);
                    });

                } else if (bg.type === 'house') {
                    this.renderFantasyHouse(ctx, screenX, screenY - 120, bg.width, 120, true, false);
                } else if (bg.type === 'castle') {
                    this.renderCastlevania(ctx, screenX, screenY - 250, bg.width, 250, true, false);
                }
            }
        });
    }

    drawForeground(ctx, camera) {
        // --- 1. FONDO GROTTA (PROFONDITÀ 3D E MASCHERAMENTO) ---
        this.platforms.forEach(plat => {
            if (plat.isCave) {
                // Allargamento maschera per coprire le pareti jagged (da 60 a 120px)
                // Maschera parte ESATTAMENTE dal livello del suolo (groundLevel) per non coprire il cielo
                let maskX = plat.x - camera.x - 120;
                let maskY = (600 - camera.y); // Fissa al GroundLevel
                let maskW = plat.width + 240;
                let maskH = 2000;

                if (maskX + maskW > 0 && maskX < width) {
                    ctx.fillStyle = '#050505';
                    ctx.fillRect(maskX, maskY, maskW, maskH);

                    // Parallasse interno fissato alla struttura
                    let screenX = plat.x - camera.x;

                    ctx.save();
                    ctx.fillStyle = this.caveBgPattern;
                    // Il pattern segue la grotta ma con un offset di parallasse calcolato dal centro
                    let offsetX = (plat.x - camera.x) * 0.05;
                    ctx.translate(offsetX, 0);
                    // Disegniamo il pattern partendo *esattamente* dal livello dell'erba (600 - camera.y)
                    // per evitare che copra il cielo e le case sullo sfondo.
                    ctx.fillRect(screenX - offsetX, (600 - camera.y), plat.width, 2000);
                    ctx.restore();

                    // --- OMBRA SUL SOFFITTO (Transizione verso la grotta) ---
                    // Parte dal terreno (600) ad opacità 0.9 e sfuma verso il basso
                    let grad = ctx.createLinearGradient(0, (600 - camera.y), 0, plat.y - camera.y);
                    grad.addColorStop(0, 'rgba(0,0,0,0.9)');
                    grad.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(maskX, (600 - camera.y), maskW, plat.y - 600);
                }
            }
        });

        // --- 2. PIATTAFORME E PARETI ---
        this.platforms.forEach(plat => {
            let screenX = plat.x - camera.x;
            let screenY = plat.y - camera.y;

            if (screenX + plat.width > 0 && screenX < width) {

                if (plat.isCave || plat.isWall) {
                    ctx.save();
                    ctx.translate(screenX, screenY);
                    ctx.fillStyle = this.stonePattern;
                    ctx.fillRect(0, 0, plat.width, plat.height);

                    // Crepe sui bordi dei blocchi
                    ctx.strokeStyle = '#0D0D14';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(0, 0, plat.width, plat.height);
                    ctx.restore();
                } else {
                    let dirtColor = '#3E2723';
                    ctx.fillStyle = dirtColor;
                    ctx.fillRect(screenX, screenY, plat.width, plat.height);
                }

                if (!plat.isCave && !plat.isWall) {
                    let grassThickness = Math.min(40, plat.height);

                    if (typeof gfx !== 'undefined' && gfx.grass && gfx.grass.complete && gfx.grass.naturalWidth > 0) {
                        let pattern = ctx.createPattern(gfx.grass, 'repeat');
                        ctx.fillStyle = pattern;

                        ctx.save();
                        ctx.translate(screenX, screenY);
                        ctx.fillRect(0, 0, plat.width, grassThickness);
                        ctx.restore();
                    } else {
                        ctx.fillStyle = '#4a7023';
                        ctx.fillRect(screenX, screenY, plat.width, grassThickness);
                    }
                }
            }
        });

        // --- 3. DECORAZIONI (FUNGHI, LIANE, MINERALI) ---
        this.decorations.forEach(dec => {
            let screenX = dec.x - camera.x;
            let screenY = dec.y - camera.y;

            if (screenX > -200 && screenX < width + 200) {
                if (dec.type === 'stalactite') {
                    ctx.fillStyle = '#0F0F0F';
                    let steps = 4;
                    let stH = dec.scale * 15;
                    let stW = dec.scale * 20;
                    for (let i = 0; i < steps; i++) {
                        let currentW = stW - (i * (stW / steps));
                        let currentX = screenX - currentW / 2;
                        let currentY = screenY + (i * stH);
                        ctx.fillRect(currentX, currentY, currentW, stH);
                    }
                } else if (dec.type === 'mushroom') {
                    ctx.save();
                    ctx.translate(screenX, screenY);
                    ctx.scale(dec.scale, dec.scale);

                    // Glow Voxel Neon
                    ctx.shadowColor = '#00FFCC';
                    ctx.shadowBlur = 10 + Math.sin(Date.now() / 500) * 5;

                    ctx.fillStyle = '#DEDEDE';
                    ctx.fillRect(-1, -10, 2, 10); // Gambo pixel

                    ctx.fillStyle = '#00FFCC';
                    ctx.fillRect(-6, -14, 12, 4); // Cappello pixel
                    ctx.fillRect(-4, -16, 8, 2);

                    ctx.restore();
                } else if (dec.type === 'mineral') {
                    ctx.save();
                    ctx.translate(screenX, screenY);
                    ctx.rotate(Math.PI / 4); // Effetto diamante
                    ctx.fillStyle = dec.color;
                    ctx.fillRect(-dec.size / 2, -dec.size / 2, dec.size, dec.size);
                    // Brillocco
                    ctx.fillStyle = 'white';
                    ctx.fillRect(-dec.size / 4, -dec.size / 4, dec.size / 4, dec.size / 4);
                    ctx.restore();
                } else if (dec.type === 'vine') {
                    ctx.save();
                    ctx.translate(screenX, screenY);
                    ctx.fillStyle = '#1A3311'; // Verde scuro liana
                    let segments = Math.floor(dec.length / 10);
                    for (let i = 0; i < segments; i++) {
                        let sway = Math.sin(Date.now() / 1000 + i / 5) * 5;
                        ctx.fillRect(sway, i * 10, 3, 10);
                        if (i % 3 === 0) {
                            ctx.fillStyle = '#2D5A27';
                            ctx.fillRect(sway - 4, i * 10 + 2, 5, 4); // Fogliolina
                            ctx.fillStyle = '#1A3311';
                        }
                    }
                    ctx.restore();
                } else if (dec.type === 'crystal') {
                    // Cristallo sfaccettato e luminoso
                    ctx.save();
                    ctx.translate(screenX, screenY);
                    ctx.rotate(Math.sin(Date.now() / 500 + dec.x) * 0.2); // Leggera oscillazione "magica"

                    ctx.shadowBlur = 15;
                    ctx.shadowColor = dec.color;
                    ctx.fillStyle = dec.color;

                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(-8 * dec.scale, -20 * dec.scale);
                    ctx.lineTo(0, -35 * dec.scale);
                    ctx.lineTo(8 * dec.scale, -20 * dec.scale);
                    ctx.closePath();
                    ctx.fill();

                    // Riflesso interno
                    ctx.fillStyle = '#FFF';
                    ctx.globalAlpha = 0.5;
                    ctx.beginPath();
                    ctx.moveTo(-2 * dec.scale, -10 * dec.scale);
                    ctx.lineTo(0, -25 * dec.scale);
                    ctx.lineTo(2 * dec.scale, -10 * dec.scale);
                    ctx.fill();

                    ctx.restore();
                }
            }
        });

        // Render Interactables in Primo Piano
        this.interactables.forEach(b => {
            let screenX = b.x - camera.x;
            let screenY = b.y - camera.y;

            if (screenX + b.width > 0 && screenX < width) {
                if (b.type === 'house') {
                    this.renderFantasyHouse(ctx, screenX, screenY, b.width, b.height, false, b.looted);
                } else if (b.type === 'castle') {
                    this.renderCastlevania(ctx, screenX, screenY, b.width, b.height, false, b.looted);

                    if (!b.looted) {
                        ctx.fillStyle = '#800000';
                    } else {
                        ctx.fillStyle = '#331111';
                    }
                    ctx.fillRect(screenX + 35, screenY + 120, 25, 90);
                    ctx.fillRect(screenX + b.width - 60, screenY + 120, 25, 90);
                } else if (b.type === 'ladder') {
                    // Rendering Scala a Pioli in primo piano
                    ctx.fillStyle = '#2A1810'; // Legno scuro (Montanti verticali)
                    ctx.fillRect(screenX, screenY, 6, b.height);
                    ctx.fillRect(screenX + b.width - 6, screenY, 6, b.height);

                    ctx.fillStyle = '#3E2723'; // Legno chiaro (Gradini)
                    for (let n = 10; n < b.height - 10; n += 30) {
                        ctx.fillRect(screenX + 6, screenY + n, b.width - 12, 6);
                    }
                } else if (b.type === 'chest') {
                    this.drawChest(ctx, screenX, screenY, b.looted);
                }
            }
        });
    }

    drawChest(ctx, x, y, isLooted) {
        let w = 60;
        let h = 45;

        // Corpo del Baule (Legno Scuro)
        ctx.fillStyle = '#4e342e';
        ctx.fillRect(x, y + 15, w, h - 15);

        // Coperchio Pixel Art
        ctx.fillStyle = '#6d4c41';
        if (isLooted) {
            ctx.fillRect(x, y - 5, w, 20);
            ctx.fillStyle = '#FFD700'; // Oro interno
            ctx.fillRect(x + 10, y + 5, w - 20, 8);
        } else {
            ctx.fillRect(x, y, w, 20);
            // Rinforzo orizzontale
            ctx.fillStyle = '#3e2723';
            ctx.fillRect(x, y + 8, w, 4);
        }

        // Rinforzi in Ferro (Pixel Bands)
        ctx.fillStyle = '#212121';
        ctx.fillRect(x + 10, y + (isLooted ? -5 : 0), 8, isLooted ? 20 : h);
        ctx.fillRect(x + w - 18, y + (isLooted ? -5 : 0), 8, isLooted ? 20 : h);

        // Serratura in Oro
        if (!isLooted) {
            ctx.fillStyle = '#fbc02d';
            ctx.fillRect(x + w / 2 - 6, y + 15, 12, 10);
            ctx.fillStyle = '#000';
            ctx.fillRect(x + w / 2 - 1, y + 18, 2, 4);
        }
    }

    // --- NUOVA FUNZIONE DI COLLISIONE PER IA ---
    isSolid(x, y) {
        // Controlla se il punto (x,y) si trova all'interno di una piattaforma solida (non pass-through)
        return this.platforms.some(p => {
            let isOneWay = p.height <= 30 || p.isStairs || p.isBridge;
            if (isOneWay) return false; // Le piattaforme sottili non bloccano il cammino laterale
            return x >= p.x && x <= p.x + p.width && y >= p.y && y <= p.y + p.height;
        });
    }
}

// ==========================================
// 4. CLASSE PLAYER (Meccanica, Fisica e rendering Anime-Spada)
// ==========================================
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 80;

        this.vx = 0;
        this.vy = 0;
        this.speed = 400;
        this.jumpPower = -720; // Potenziato (prima -650)
        this.gravity = 1500;

        this.isGrounded = false;
        this.hasDoubleJumped = false; // Stato per il doppio salto
        this.isClimbing = false;

        // Meccaniche Combattimento Spada
        this.isAttacking = false;
        this.attackTimer = 0;
        this.attackDuration = 0.2;
        this.direction = 1;

        this.health = 100;
        this.score = 0;

        // --- PROPRIETÀ ANIMAZIONE ---
        this.visualScaleX = 1;
        this.visualScaleY = 1;
        this.trail = []; // Scia della spada
        this.wasGrounded = false;

        // --- MECCANICHE DIFENSIVE (SCUDO & ARMATURA) ---
        this.hasShield = false;
        this.shieldDurability = 0;
        this.isParrying = false;
        this.hasArmor = false; // Riduce i danni del 50%
    }

    update(dt, world) {
        // --- LOGICA SCALA A PIOLI ---
        let activeLadder = null;
        let pCenterX = this.x + this.width / 2;
        world.interactables.forEach(i => {
            if (i.type === 'ladder') {
                if (pCenterX > i.x && pCenterX < i.x + i.width &&
                    this.y + this.height + 10 > i.y && this.y < i.y + i.height) {
                    activeLadder = i;
                }
            }
        });

        // Aggancio intenzionale alla scala con W (Su) o S (Giù)
        if (activeLadder && (keys['KeyW'] || keys['ArrowUp'] || keys['KeyS'] || keys['ArrowDown']) && !this.isClimbing) {
            this.isClimbing = true;
            this.x = activeLadder.x + activeLadder.width / 2 - this.width / 2; // Centra perfettamente sulla scala
        }

        // Sgancio forzato se non si tocca più la scala
        if (!activeLadder) {
            this.isClimbing = false;
        }

        // Loop Esclusivo dell'arrampicata (esclude la gravità e i controlli classici)
        if (this.isClimbing) {
            this.vx = 0;
            this.vy = 0; // Gravità disattivata sulla scala

            if (keys['KeyW'] || keys['ArrowUp']) {
                this.vy = -200; // Arrampicata in su
            } else if (keys['KeyS'] || keys['ArrowDown']) {
                this.vy = 200; // Calata in giù
            }

            // Sbarco laterale dalla scala con A o D (Detaching)
            if (keys['KeyA'] || keys['ArrowLeft']) {
                this.isClimbing = false;
                this.vx = -this.speed * 0.5; // Piccolo balzo laterale per sbarcare
            } else if (keys['KeyD'] || keys['ArrowRight']) {
                this.isClimbing = false;
                this.vx = this.speed * 0.5;
            }

            // Lancio d'emergenza dalla scala con Spazio
            if (keys['Space']) {
                this.isClimbing = false;
                this.vy = this.jumpPower;
                // Se si premono anche direzioni laterali ci si lancia lontano
                if (keys['ArrowRight'] || keys['KeyD']) this.vx = this.speed;
                if (keys['ArrowLeft'] || keys['KeyA']) this.vx = -this.speed;
            }

            // Applica il solo movimento verticale e termina anticipatamente
            this.y += this.vy * dt;
            this.isGrounded = false;
            this.wasGrounded = false;

            // Ripristina l'elasticità visiva in caso fosse squashed e torna la forma originale
            this.visualScaleY += (1 - this.visualScaleY) * 0.15;
            this.visualScaleX += (1 - this.visualScaleX) * 0.15;

            return; // Interrompe il resto di update() evitando il conflitto con la fisica base
        }

        // --- CONTROLLI NORMALI A TERRA ED ARIA ---
        this.isParrying = (keys['MouseRight'] && this.hasShield && !this.isClimbing);

        // Calcola velocità in base alla parata (più lento se pariamo)
        let currentMaxSpeed = this.isParrying ? this.speed * 0.5 : this.speed;

        if (keys['ArrowRight'] || keys['KeyD']) {
            this.vx = currentMaxSpeed;
            this.direction = 1;
        } else if (keys['ArrowLeft'] || keys['KeyA']) {
            this.vx = -currentMaxSpeed;
            this.direction = -1;
        } else {
            // Più inerzia in aria per controllo fluido
            if (this.isGrounded) this.vx = 0;
            else this.vx *= 0.95;
        }

        if (keys['Space'] && this.isGrounded) {
            playSound('jump');
            this.vy = this.jumpPower;
            this.isGrounded = false;
            this.hasDoubleJumped = false; // Reset al primo salto
        } else if (keys['Space'] && !this.isGrounded && !this.hasDoubleJumped && !this.isClimbing && this.vy > -300) {
            // --- DOPPIO SALTO ---
            playSound('jump');
            this.vy = this.jumpPower * 0.9; // Secondo salto leggermente più debole per realismo
            this.hasDoubleJumped = true;
            createDust(this.x + this.width / 2, this.y + this.height, 5); // Feedback visivo "puff"
            keys['Space'] = false; // Forza il rilascio per non spammare
        }

        // Reset doppio salto quando si tocca terra (gestito nella collisione sotto)

        // --- SALTO VARIABILE (Controllo altezza) ---
        // Se il giocatore rilascia la barra spaziatrice mentre sta ancora salendo, 
        // freniamo bruscamente la salita per un salto più basso.
        if (this.vy < -100 && !keys['Space'] && !this.isClimbing) {
            this.vy *= 0.6; // Smorza la salita se hai rilasciato il tasto
        }

        // 1. FISICA ORIZZONTALE & COLLISIONE
        this.vy += this.gravity * dt; // Applica gravità
        this.x += this.vx * dt;
        if (this.x < 0) this.x = 0;

        world.platforms.forEach(p => {
            // "Piattaforme Unidirezionali" (One-Way): Tetti, Ponti, Mensole e Jump-pads
            // Sono attraversabili lateralmente e dal basso se sono sottili (height <= 30)
            let isOneWay = p.height <= 30 || p.isStairs || p.isBridge;
            if (isOneWay) return;

            // Controlla se siamo nell'area verticale della piattaforma
            if (this.y + this.height > p.y + 5 && this.y < p.y + p.height - 5) {
                // Collisione da sinistra (vado a destra)
                if (this.vx > 0 && this.x + this.width > p.x && this.x < p.x + 10) {
                    this.x = p.x - this.width;
                    this.vx = 0;
                }
                // Collisione da destra (vado a sinistra)
                else if (this.vx < 0 && this.x < p.x + p.width && this.x + this.width > p.x + p.width - 10) {
                    this.x = p.x + p.width;
                    this.vx = 0;
                }
            }
        });

        // 2. FISICA VERTICALE & COLLISIONE
        this.y += this.vy * dt;
        this.isGrounded = false;

        world.platforms.forEach(p => {
            // Controlla se siamo allineati orizzontalmente
            if (this.x < p.x + p.width - 5 && this.x + this.width > p.x + 5) {
                // Atterraggio (dall'alto)
                if (this.vy >= 0 && this.y + this.height >= p.y && this.y + this.height <= p.y + 20 + this.vy * dt) {
                    this.isGrounded = true;
                    this.vy = 0;
                    this.y = p.y - this.height;
                }
                // Urto soffitto (dal basso)
                else if (this.vy < 0 && this.y <= p.y + p.height && this.y >= p.y + p.height - 20) {
                    let isOneWay = p.height <= 30 || p.isStairs || p.isBridge;
                    if (!isOneWay) {
                        this.vy = 0;
                        this.y = p.y + p.height;
                    }
                }
            }
        });

        // --- GESTIONE SQUASH & STRETCH (Atterraggio) ---
        if (this.isGrounded && !this.wasGrounded) {
            this.visualScaleY = 0.7; // Si schiaccia
            this.visualScaleX = 1.3; // Si allarga
            createDust(this.x + this.width / 2, this.y + this.height);
            this.hasDoubleJumped = false; // Reset ufficiale del doppio salto!
        }
        this.wasGrounded = this.isGrounded;

        // Torna lentamente alla forma originale (Molla elastica)
        this.visualScaleY += (1 - this.visualScaleY) * 0.15;
        this.visualScaleX += (1 - this.visualScaleX) * 0.15;

        if (this.y > 2000 || this.x > world.mapWidth + 500) {
            this.health = 0;
        }

        document.getElementById('healthUI').innerText = `Salute: ${this.health}`;

        // Sistema d'Attacco a Fendente (Trigger)
        if ((keys['Enter'] || keys['MouseLeft']) && !this.isAttacking) {
            playSound('slash');
            this.isAttacking = true;
            this.attackTimer = this.attackDuration;

            // Consumo dell'Imput singolo frame per esigere click sequenziali veloci
            keys['MouseLeft'] = false;
            keys['Enter'] = false;
        }

        if (this.isAttacking) {
            this.attackTimer -= dt;
            if (this.attackTimer <= 0) {
                this.isAttacking = false;
            }
        }
    }

    draw(ctx, camera) {
        let screenX = this.x - camera.x;
        let screenY = this.y - camera.y;

        // --- 1. RENDERING SCIA SPADA (Coordinate Mondo) ---
        if (this.trail.length > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = '#00FFFF'; // Ciano Neon
            ctx.lineWidth = 12;
            ctx.lineCap = 'round';
            for (let i = 0; i < this.trail.length; i++) {
                let t = this.trail[i];
                t.life -= 0.05;
                if (t.life <= 0) {
                    this.trail.splice(i, 1);
                    continue;
                }
                ctx.globalAlpha = t.life * 0.8;
                let tx = t.x - camera.x;
                let ty = t.y - camera.y;
                if (i === 0) ctx.moveTo(tx, ty);
                else ctx.lineTo(tx, ty);
            }
            ctx.stroke();
            ctx.restore();
            ctx.globalAlpha = 1.0;
        }

        ctx.save();

        let bob = 0;
        let runAnim = 0;
        if (this.isGrounded && Math.abs(this.vx) > 10) {
            runAnim = Math.sin(Date.now() / 120);
            bob = Math.abs(runAnim) * 5;
        }

        // --- 2. LOGICA ATTACCO E ANGOLI ---
        let armAngle = -Math.PI * 0.15;
        let swordAngle = -Math.PI * 0.6;
        let attackLunge = 0;
        let attackRot = 0;

        if (this.isAttacking) {
            let progress = 1 - (this.attackTimer / this.attackDuration);

            // Fasi dell'attacco (Basate su HEMA)
            let backArm = Math.PI * 0.2;
            let backSword = Math.PI * 0.8;
            let slashArm = -Math.PI * 0.4;
            let slashSword = -Math.PI * 0.2;

            if (progress < 0.2) {
                let p = progress / 0.2;
                armAngle = (-Math.PI * 0.15) + p * (backArm - (-Math.PI * 0.15));
                swordAngle = (-Math.PI * 0.6) + p * (backSword - (-Math.PI * 0.6));
                attackLunge = -8 * p;
                attackRot = -0.15 * p;
            } else if (progress < 0.5) {
                let p = (progress - 0.2) / 0.3;
                armAngle = backArm - p * (backArm - slashArm);
                swordAngle = backSword - p * (backSword - slashSword);
                attackLunge = -8 + p * 28;
                attackRot = -0.15 + p * 0.45;
            } else {
                let p = (progress - 0.5) / 0.5;
                armAngle = slashArm + p * ((-Math.PI * 0.15) - slashArm);
                swordAngle = slashSword + p * ((-Math.PI * 0.6) - slashSword);
                attackLunge = 20 * (1 - p);
                attackRot = 0.3 * (1 - p);
            }

            // Registra punto per la scia (Usando coordinate mondo)
            if (progress > 0.1 && progress < 0.8) {
                let tipX = this.x + this.width / 2 + Math.cos(armAngle + swordAngle + attackRot) * 60 * this.direction + (attackLunge * this.direction);
                let tipY = this.y + this.height / 2 + Math.sin(armAngle + swordAngle + attackRot) * 60 - bob;
                this.trail.unshift({ x: tipX, y: tipY, life: 1.0 });
            }
        } else {
            armAngle += (runAnim * 0.4);
            swordAngle += (runAnim * 0.1);
        }

        // Pivot Body Centrale
        ctx.translate(screenX + this.width / 2 + (attackLunge * this.direction), screenY + this.height / 2 - bob);

        if (this.direction === -1) {
            ctx.scale(-1, 1);
        }
        ctx.rotate(attackRot);
        ctx.scale(this.visualScaleX, this.visualScaleY);

        // Disegno Fisiologico Stickman
        if (this.hasArmor) {
            ctx.save();
            ctx.globalAlpha = 0.2 + Math.abs(Math.sin(Date.now() / 400)) * 0.15;
            ctx.fillStyle = '#3498db';
            ctx.beginPath();
            ctx.arc(0, -this.height / 2, 55, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        let mainColor = '#FF8C00';
        let shadowColor = '#CC5500';
        let outline = '#222';

        function drawBlock(bx, by, bw, bh, color) {
            ctx.fillStyle = outline;
            ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
            ctx.fillStyle = color;
            ctx.fillRect(bx, by, bw, bh);
        }

        function drawLeg(angle, color) {
            ctx.save();
            ctx.translate(0, 10);
            ctx.rotate(angle);
            drawBlock(-4, 0, 8, 18, color);
            ctx.translate(0, 15);
            ctx.rotate(Math.max(0, angle * 1.2));
            drawBlock(-4, 0, 8, 18, color);
            ctx.restore();
        }

        // Gambe e Torso
        drawLeg(runAnim * 0.6, shadowColor);
        ctx.save();
        ctx.translate(0, -10); ctx.rotate(-runAnim * 0.6);
        drawBlock(-4, 0, 8, 22, shadowColor);
        ctx.restore();
        drawBlock(-10, -15, 20, 32, mainColor);

        // Testa
        drawBlock(-14, -40, 28, 26, mainColor);
        ctx.fillStyle = '#FFF'; ctx.fillRect(2, -34, 8, 8);
        ctx.fillStyle = '#000'; ctx.fillRect(6, -32, 4, 4);

        drawLeg(-runAnim * 0.6, mainColor);

        // Braccio e Spada
        ctx.save();
        ctx.translate(0, -10);
        ctx.rotate(armAngle);
        drawBlock(-4, 0, 8, 22, mainColor);

        ctx.translate(0, 20);
        ctx.rotate(-armAngle);
        ctx.rotate(swordAngle);

        // Elmi e Dettaglio Spada
        ctx.fillStyle = '#111'; ctx.fillRect(-3, -8, 6, 8);
        ctx.fillStyle = outline; ctx.fillRect(-8, 0, 16, 6);
        ctx.fillStyle = '#050505'; ctx.fillRect(-5, 6, 10, 42);
        ctx.fillStyle = '#DDDDDD'; ctx.fillRect(-2, 6, 4, 40);

        ctx.restore(); // Fine Braccio/Spada

        // --- DISEGNO SCUDO (Se Equipaggiato) ---
        if (this.hasShield) {
            ctx.save();
            // Oscillazione basata sul tempo se in movimento
            let shieldSway = (this.isGrounded && Math.abs(this.vx) > 5) ? Math.sin(Date.now() / 150) * 3 : 0;
            ctx.translate(this.direction === 1 ? shieldSway : -shieldSway, 0);

            if (this.isParrying) {
                ctx.translate(15, -10);
                ctx.rotate(-0.1);
            } else {
                ctx.translate(-5, 5);
                ctx.rotate(0.3);
            }

            // Bordo in Ferro Scuro
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(0, -25, 32, 50);
            // Piastra in Acciaio
            ctx.fillStyle = '#95a5a6';
            ctx.fillRect(4, -21, 24, 42);
            // Rinforzi e Croce Voxel
            ctx.fillStyle = '#7f8c8d';
            ctx.fillRect(14, -15, 4, 30);
            ctx.fillRect(6, -2, 20, 4);

            ctx.restore();
        }

        ctx.restore(); // Fine Pivot Corpo
    }
}

// ==========================================
// CLASSE ALLEATO: HERO ALLY (Eroe Stickman Intelligente)
// ==========================================
class HeroAlly {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 80;
        this.vx = 0;
        this.vy = 0;
        this.speed = 220;
        this.jumpPower = -720;
        this.gravity = 1500;

        const colors = ['#3498db', '#9b59b6', '#e74c3c', '#2ecc71', '#f1c40f', '#1abc9c'];
        this.mainColor = colors[Math.floor(Math.random() * colors.length)];
        this.direction = 1;
        this.isGrounded = false;
        this.hp = 200;
        this.isHitTimer = 0;
        this.isAttacking = false;
        this.attackTimer = 0;
        this.attackDuration = 0.2; // Sincronizzato con il giocatore
        this.attackCooldown = 0;
        this.state = 'follow';
        this.target = null;
        this.isClimbing = false;
        
        // --- PROPRIETÀ ANIMAZIONE SINCRONIZZATE ---
        this.visualScaleX = 1;
        this.visualScaleY = 1;
        this.wasGrounded = false;
        this.trail = [];
        
        this.isSaluting = false;
        this.saluteTimer = 0;

        // --- AI STABILITY PARAMS ---
        this.aiTimer = 0;
        this.targetHysteresis = 350;
        this.lastTargetX = x;
        this.ladderCooldown = 0;
    }


    update(dt, world, player, enemies) {
        if (this.isSaluting) {
            this.saluteTimer -= dt;
            return;
        }

        if (this.aiTimer > 0) this.aiTimer -= dt;
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.isHitTimer > 0) this.isHitTimer -= dt;
        if (this.ladderCooldown > 0) this.ladderCooldown -= dt;

        let nearestEnemy = null;
        let minDist = 1000;
        enemies.forEach(z => {
            if (z.state !== 'dead' && z.state !== 'emerging') {
                let d = Math.abs(z.x - this.x);
                if (d < minDist) {
                    minDist = d;
                    nearestEnemy = z;
                }
            }
        });

        // --- LOGICA DI TARGETING AGGRESSIVA (Priorità Sterminio) ---
        // Se sta già combattendo, insegue implacabilmente fino a 900px
        let detectionRange = (this.state === 'fight') ? 900 : 700;
        let finalTargetX = player.x;
        let finalTargetY = player.y;

        // Se il timer AI è attivo, mantiene lo stato precedente per stabilità
        if (this.aiTimer <= 0) {
            // Priorità Assoluta: Se c'è un nemico nel raggio di 700px, attacca! 
            // Rimosso il vincolo di vicinanza al giocatore per permettere lo sterminio libero.
            if (nearestEnemy && minDist < detectionRange) {
                if (this.state !== 'fight') this.aiTimer = 1.0;
                this.state = 'fight';
                this.target = nearestEnemy;
            } else {
                if (this.state !== 'follow') this.aiTimer = 0.5;
                this.state = 'follow';
                this.target = player;
            }
        }

        // Calcola coordinate target finali in base allo stato consolidato
        if (this.state === 'fight' && this.target && this.target.hp > 0) {
            finalTargetX = this.target.x;
            finalTargetY = this.target.y;
        } else {
            // Segue il giocatore ma con una "dead-zone" più ampia per evitare jitter
            if (Math.abs(player.x - this.x) < 120) {
                finalTargetX = this.x; // Resta dove sei se sei vicino
            } else {
                finalTargetX = player.x;
            }
            finalTargetY = player.y;
        }

        let nearLadder = null;
        world.interactables.forEach(i => {
            if (i.type === 'ladder' && Math.abs(i.x + i.width / 2 - this.x) < 60) {
                nearLadder = i;
            }
        });

        let heightDiff = finalTargetY - this.y;
        if (nearLadder && Math.abs(heightDiff) > 50 && !this.isClimbing && this.ladderCooldown <= 0) {
            // Se il target è su un altro livello, usa la scala
            if ((heightDiff < 0 && nearLadder.y < this.y) || (heightDiff > 0 && nearLadder.y + nearLadder.height > this.y)) {
                this.isClimbing = true;
                // Snap preciso al centro della scala
                this.x = nearLadder.x + nearLadder.width / 2 - this.width / 2;
                this.vx = 0;
            }
        }

        if (this.isClimbing) {
            this.vx = 0;
            this.vy = (heightDiff > 0) ? 200 : -220;

            // --- LOGICA DI USCITA ROBUSTA (Boundary Based) ---
            let reachedTop = (this.y + this.height < nearLadder.y + 10 && heightDiff < 0);
            let reachedBottom = (this.y > nearLadder.y + nearLadder.height - 10 && heightDiff > 0);
            let targetReached = Math.abs(heightDiff) < 30;

            if (reachedTop || reachedBottom || targetReached || !nearLadder) {
                this.isClimbing = false;
                this.ladderCooldown = 0.6; // Mezzo secondo di pausa per liberare la scala
                this.vy = -380; // Balzo di sbarco
                this.y -= 5;
                this.vx = (finalTargetX > this.x) ? 200 : -200;
            }
        } else {
            // --- LOGICA DI CAMMINATA E COMBATTIMENTO ---
            if (this.x < finalTargetX - 15) {
                this.direction = 1;
                this.vx = this.speed;
            } else if (this.x > finalTargetX + 15) {
                this.direction = -1;
                this.vx = -this.speed;
            } else {
                this.vx *= 0.8;
            }

            // Salto ostacoli (Muretti/Voxel)
            if (this.isGrounded && Math.abs(this.vx) > 10) {
                let wallCheck = (this.direction === 1) ? world.isSolid(this.x + this.width + 10, this.y + this.height - 10) : world.isSolid(this.x - 10, this.y + this.height - 10);
                if (wallCheck) this.vy = -550;
            }

            // Trigger Attacco (Solo se a terra e vicino)
            if (this.state === 'fight' && minDist < 85 && this.attackCooldown <= 0) {
                this.isAttacking = true;
                this.attackTimer = this.attackDuration;
                this.attackCooldown = 0.8;
                playSound('slash');
            }
        }

        // --- SISTEMA FISICO UNIVERSALE ---
        // La gravità agisce solo se non stiamo scalando
        if (!this.isClimbing) {
            this.vy += this.gravity * dt;
        }

        // Aggiornamento coordinate (Ora corretti fuori dal blocco else!)
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Collisioni con il terreno (Solo se non stiamo scalando)
        if (!this.isClimbing) {
            this.isGrounded = false;
            world.platforms.forEach(p => {
                if (p.isOneWay && this.vy < 0) return;
                if (this.x + this.width > p.x && this.x < p.x + p.width) {
                    if (this.y + this.height > p.y && this.y + this.height < p.y + p.height + this.vy * dt + 10 && this.vy >= 0) {
                        this.y = p.y - this.height;
                        this.vy = 0;
                        this.isGrounded = true;
                    }
                }
            });
        }

        // --- GESTIONE SQUASH & STRETCH (Atterraggio Alleato) ---
        if (this.isGrounded && !this.wasGrounded) {
            this.visualScaleY = 0.7;
            this.visualScaleX = 1.3;
            createDust(this.x + this.width / 2, this.y + this.height, 5);
        }
        this.wasGrounded = this.isGrounded;

        this.visualScaleY += (1 - this.visualScaleY) * 0.15;
        this.visualScaleX += (1 - this.visualScaleX) * 0.15;


        if (this.isAttacking) {
            this.attackTimer -= dt;
            if (this.attackTimer <= 0) this.isAttacking = false;
            enemies.forEach(z => {
                if (z.state !== 'dead' && Math.abs(z.x - this.x) < 75 && Math.abs(z.y - this.y) < 60) {
                    if (z.isHit <= 0) {
                        z.hp -= 1;
                        z.isHit = 0.4;
                        z.vx = this.direction * 300;
                        playSound('zombie_hit', z.x, z.y);
                    }
                }
            });
        }
    }

    draw(ctx, camera) {
        if (this.isSaluting && this.saluteTimer <= 0) return;

        let screenX = this.x - camera.x;
        let screenY = this.y - camera.y;

        // --- 1. RENDERING SCIA SPADA (Coordinate Mondo) ---
        if (this.trail.length > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = '#00FFFF'; 
            ctx.lineWidth = 12;
            ctx.lineCap = 'round';
            for (let i = 0; i < this.trail.length; i++) {
                let t = this.trail[i];
                t.life -= 0.05;
                if (t.life <= 0) {
                    this.trail.splice(i, 1);
                    continue;
                }
                ctx.globalAlpha = t.life * 0.8;
                let tx = t.x - camera.x;
                let ty = t.y - camera.y;
                if (i === 0) ctx.moveTo(tx, ty);
                else ctx.lineTo(tx, ty);
            }
            ctx.stroke();
            ctx.restore();
            ctx.globalAlpha = 1.0;
        }

        ctx.save();

        let bob = 0;
        let runAnim = 0;
        if (this.isGrounded && Math.abs(this.vx) > 10) {
            runAnim = Math.sin(Date.now() / 120);
            bob = Math.abs(runAnim) * 5;
        }

        if (this.isSaluting) ctx.globalAlpha = Math.max(0, this.saluteTimer / 2.0);

        // --- 2. LOGICA ATTACCO E ANGOLI (SINCRONIZZATA) ---
        let armAngle = -Math.PI * 0.15;
        let swordAngle = -Math.PI * 0.6;
        let attackLunge = 0;
        let attackRot = 0;

        if (this.isAttacking) {
            let progress = 1 - (this.attackTimer / this.attackDuration);

            let backArm = Math.PI * 0.2;
            let backSword = Math.PI * 0.8;
            let slashArm = -Math.PI * 0.4;
            let slashSword = -Math.PI * 0.2;

            if (progress < 0.2) {
                let p = progress / 0.2;
                armAngle = (-Math.PI * 0.15) + p * (backArm - (-Math.PI * 0.15));
                swordAngle = (-Math.PI * 0.6) + p * (backSword - (-Math.PI * 0.6));
                attackLunge = -8 * p;
                attackRot = -0.15 * p;
            } else if (progress < 0.5) {
                let p = (progress - 0.2) / 0.3;
                armAngle = backArm - p * (backArm - slashArm);
                swordAngle = backSword - p * (backSword - slashSword);
                attackLunge = -8 + p * 28;
                attackRot = -0.15 + p * 0.45;
            } else {
                let p = (progress - 0.5) / 0.5;
                armAngle = slashArm + p * ((-Math.PI * 0.15) - slashArm);
                swordAngle = slashSword + p * ((-Math.PI * 0.6) - slashSword);
                attackLunge = 20 * (1 - p);
                attackRot = 0.3 * (1 - p);
            }

            if (progress > 0.1 && progress < 0.8) {
                let tipX = this.x + this.width / 2 + Math.cos(armAngle + swordAngle + attackRot) * 60 * this.direction + (attackLunge * this.direction);
                let tipY = this.y + this.height / 2 + Math.sin(armAngle + swordAngle + attackRot) * 60 - bob;
                this.trail.unshift({ x: tipX, y: tipY, life: 1.0 });
            }
        } else {
            armAngle += (runAnim * 0.4);
            swordAngle += (runAnim * 0.1);
        }

        // Pivot Body Centrale
        ctx.translate(screenX + this.width / 2 + (attackLunge * this.direction), screenY + this.height / 2 - bob);

        if (this.direction === -1) {
            ctx.scale(-1, 1);
        }
        ctx.rotate(attackRot);
        ctx.scale(this.visualScaleX, this.visualScaleY);

        if (this.isSaluting) {
            armAngle = -Math.PI * 0.8;
            swordAngle = 0;
        }

        // Disegno Stickman (Style Sincronizzato)
        let shadowColor = '#555';
        let outline = '#222';

        function drawBlock(bx, by, bw, bh, color) {
            ctx.fillStyle = outline;
            ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
            ctx.fillStyle = color;
            ctx.fillRect(bx, by, bw, bh);
        }

        function drawLeg(angle, color) {
            ctx.save();
            ctx.translate(0, 10);
            ctx.rotate(angle);
            drawBlock(-4, 0, 8, 18, color);
            ctx.translate(0, 15);
            ctx.rotate(Math.max(0, angle * 1.2));
            drawBlock(-4, 0, 8, 18, color);
            ctx.restore();
        }

        // Gambe e Torso
        drawLeg(runAnim * 0.6, shadowColor);
        ctx.save();
        ctx.translate(0, -10); ctx.rotate(-runAnim * 0.6);
        drawBlock(-4, 0, 8, 22, shadowColor);
        ctx.restore();
        drawBlock(-10, -15, 20, 32, this.mainColor);

        // Testa
        drawBlock(-14, -40, 28, 26, this.mainColor);
        ctx.fillStyle = '#FFF'; ctx.fillRect(2, -34, 8, 8);
        ctx.fillStyle = '#000'; ctx.fillRect(6, -32, 4, 4);

        drawLeg(-runAnim * 0.6, this.mainColor);

        // Braccio e Spada
        ctx.save();
        ctx.translate(0, -10);
        ctx.rotate(armAngle);
        drawBlock(-4, 0, 8, 22, this.mainColor);

        ctx.translate(0, 20);
        ctx.rotate(-armAngle);
        ctx.rotate(swordAngle);

        // Dettaglio Spada (Sincronizzata)
        ctx.fillStyle = '#111'; ctx.fillRect(-3, -8, 6, 8);
        ctx.fillStyle = outline; ctx.fillRect(-8, 0, 16, 6);
        ctx.fillStyle = '#050505'; ctx.fillRect(-5, 6, 10, 42);
        ctx.fillStyle = '#DDDDDD'; ctx.fillRect(-2, 6, 4, 40);

        ctx.restore();

        // --- DISEGNO SCUDO (Sincronizzato) ---
        ctx.save();
        let shieldSway = (this.isGrounded && Math.abs(this.vx) > 5) ? Math.sin(Date.now() / 150) * 3 : 0;
        ctx.translate(this.direction === 1 ? shieldSway : -shieldSway, 0);

        ctx.translate(-5, 5);
        ctx.rotate(0.3);

        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(0, -25, 32, 50);
        ctx.fillStyle = '#95a5a6';
        ctx.fillRect(4, -21, 24, 42);
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(14, -15, 4, 30);
        ctx.fillRect(6, -2, 20, 4);
        ctx.restore();

        ctx.restore(); // Fine Pivot Corpo

        // Barra Vita
        ctx.fillStyle = '#111';
        ctx.fillRect(screenX, screenY - 20, 40, 6);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(screenX + 1, screenY - 19, (Math.max(0, this.hp) / 200) * 38, 4);
    }

}

// ==========================================
// CLASSE NEMICO: ZOMBIE (Fasi diurne, Scavo d'Alba, Salute a tacche)
// ==========================================
class Zombie {
    constructor(x, y, type = 'surface') {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 80;
        this.type = type; // 'surface' o 'cave'

        this.vx = 0;
        this.vy = 0;
        this.speed = (this.type === 'cave') ? 75 : 100;
        this.gravity = 1500;

        let isCaveType = (this.type === 'cave' || this.type === 'white');
        this.state = isCaveType ? 'dormant' : 'emerging';
        this.timer = 2.0;

        this.hp = isCaveType ? 5 : 3;
        this.isHit = 0;

        this.direction = 1;
        this.isGrounded = false;
        this.isClimbing = false; // Permette agli zombie di usare le scale appena implementate
        this.climbTimer = 0; // Cooldown per non "balbettare" sulla scala


        // Meccaniche AI Avanzata
        this.jumpPower = -600;
        this.jumpDelay = 0;
        this.lungeTimer = 0;
        this.lungeCooldown = 2.0 + Math.random() * 3.0;
        this.targetOffset = (Math.random() - 0.5) * 60;
        this.isDodging = false;

        // --- MECCANICHE DIFENSIVE (ALLEATO) ---
        this.isAlly = false;
        this.targetEnemy = null;
        this.isSaluting = false;
        this.saluteTimer = 0;

        // --- PROPRIETÀ ANIMAZIONE ---
        this.visualScaleX = 1;
        this.visualScaleY = 1;
        this.wasGrounded = false;
        this.deadRotation = 0;
        this.deadOpacity = 1;
    }

    update(dt, world, player) {
        if (this.isHit > 0) {
            this.isHit -= dt;
            // Se colpito mentre sale, cade dalla scala e ha un cooldown
            if (this.isClimbing) {
                this.isClimbing = false;
                this.climbTimer = 0.8;
            }
        }
        if (this.climbTimer > 0) this.climbTimer -= dt;

        if (this.isGrounded && Math.abs(this.vx) > this.speed) {
            this.vx *= 0.8; // Freno inerziale dopo uno sbalzo Knockback
        }


        switch (this.state) {
            case 'dormant':
                // Respira lentamente stando seduto / immobile
                // --- RILEVAMENTO LIMITATO (Fix Suicidio degli Zombie Bianchi) ---
                let d = Math.abs(player.x - this.x);
                let playerInCave = player.y > 650;

                // Se è uno zombie bianco, si sveglia solo se il giocatore entra nella grotta
                let shouldWake = (this.type === 'white') ? (d < 350 && playerInCave) : (d < 300);

                if (shouldWake) {
                    playSound('wake', this.x, this.y);
                    this.state = 'emerging';
                    this.timer = 1.0;
                }
                break;

            case 'emerging':
                this.timer -= dt;
                if (this.timer <= 0) this.state = 'chasing';
                break;

            case 'chasing':
                // --- VULNERABILITÀ AL SOLE (ZOMBIE BIANCHI) ---
                if (this.type === 'white' && timeOfDay > 5 && timeOfDay < 19 && this.y < 650) {
                    // Gli zombie bianchi evaporano all'istante sotto la luce solare
                    this.hp = 0;
                    this.state = 'dead';
                    playSound('zombie_hit', this.x, this.y);
                    // Effetto Dissoluzione Pixel Art Professional
                    createPixelDissolve(this.x, this.y, this.width, this.height, ['#FFFFFF', '#F0F0F0', '#CCCCCC']);
                    return;
                }

                if (this.isAlly) {
                    // --- IA ALLEATO (Protezione e Attacco) ---
                    let nearestEnemy = null;
                    let minDist = 450; // Range di avvistamento nemici

                    enemies.forEach(z => {
                        if (!z.isAlly && z.state !== 'dead' && z.state !== 'emerging') {
                            let dist = Math.abs(z.x - this.x);
                            if (dist < minDist) {
                                minDist = dist;
                                nearestEnemy = z;
                            }
                        }
                    });

                    let targetX = player.x; // Di default segue il player
                    if (nearestEnemy) {
                        targetX = nearestEnemy.x;
                        this.targetEnemy = nearestEnemy;
                    } else {
                        this.targetEnemy = null;
                        // Resta a distanza Sociale dal player per non intralciarlo
                        if (Math.abs(player.x - this.x) < 80) targetX = this.x;
                    }

                    // Logica di attacco alleato (Semplificata: si scaglia addosso)
                    if (nearestEnemy && minDist < 60 && !this.isClimbing) {
                        if (Math.random() > 0.95) { // Attacco casuale
                            nearestEnemy.hp -= 1;
                            nearestEnemy.isHit = 0.5;
                            playSound('hit', nearestEnemy.x, nearestEnemy.y);
                            createDust(nearestEnemy.x, nearestEnemy.y, 2);
                        }
                    }

                    // Movimento IA Alleato
                    if (this.x < targetX - 40) {
                        this.direction = 1;
                        this.vx = this.speed * 1.1;
                    } else if (this.x > targetX + 40) {
                        this.direction = -1;
                        this.vx = -this.speed * 1.1;
                    } else {
                        this.vx *= 0.8;
                    }

                } else if (this.type === 'surface' && timeOfDay > 5 && timeOfDay < 19 && this.y < 650) {
                    // Solo gli zombie di superficie scavano al sole (e solo se fuori)
                    this.state = 'digging';
                    this.timer = 2.5;
                    this.vx = 0;
                } else {
                    // --- SISTEMA DI NAVIGAZIONE INTELLIGENTE (Fix Ping-Pong) ---
                    let targetX = player.x;
                    let pCenterX = this.x + this.width / 2;
                    let distToPlayerY = Math.abs(player.y - this.y);
                    let isTrappedInCave = this.y > 650;

                    let playerInCave = player.y > 650;

                    let bestPathX = null;
                    if (distToPlayerY > 100) {
                        let minPathDist = 4000;

                        // 1. Cerca la scala più vicina che porti nella direzione giusta
                        world.interactables.forEach(i => {
                            if (i.type === 'ladder') {
                                // SICUREZZA: Se è giorno e siamo sotto terra, non prendiamo scale verso l'alto (Suicidio)
                                let isSunlightDanger = (timeOfDay > 5 && timeOfDay < 19 && this.y > 650 && i.y < 650);
                                if (this.type === 'white' && isSunlightDanger && !playerInCave) return;

                                let connectsToPlayer = (player.y < this.y) ? (i.y < this.y - 40) : (i.y + i.height > this.y + 40);
                                if (connectsToPlayer) {
                                    let d = Math.abs(i.x + i.width / 2 - pCenterX);
                                    if (d < minPathDist) {
                                        minPathDist = d;
                                        bestPathX = i.x + i.width / 2;
                                    }
                                }
                            }
                        });

                        // 2. Se non ci sono scale o sono lontane, cerca mensole nelle grotte
                        if (isTrappedInCave && (!bestPathX || minPathDist > 800)) {
                            world.platforms.forEach(p => {
                                if (p.isStairs || (p.y < this.y - 20 && p.y > player.y - 50)) {
                                    let d = Math.abs(p.x + p.width / 2 - pCenterX);
                                    if (d < minPathDist) {
                                        minPathDist = d;
                                        bestPathX = p.x + p.width / 2;
                                    }
                                }
                            });
                        }

                        // Se abbiamo trovato un percorso, lo seguiamo ossessivamente finché non siamo vicini
                        if (bestPathX !== null) {
                            targetX = bestPathX;
                        }
                    }

                    // --- IA DI NAVIGAZIONE CON SCALE (Lancio Arrampicata) ---
                    let nearLadder = null;
                    world.interactables.forEach(i => {
                        if (i.type === 'ladder') {
                            // Hitbox di aggancio scala leggermente più generosa per gli zombie
                            if (pCenterX > i.x - 30 && pCenterX < i.x + i.width + 30) {
                                if (this.y + this.height > i.y && this.y < i.y + i.height) {
                                    nearLadder = i;
                                }
                            }
                        }
                    });

                    // Decisione: Salire o camminare?
                    let heightDiff = player.y - this.y;
                    let nearTop = nearLadder && (this.y < nearLadder.y + 20 && heightDiff < 0);

                    // Se siamo vicini a una scala e dobbiamo cambiare livello verticale
                    if (nearLadder && !nearTop && this.climbTimer <= 0 && this.isHit <= 0 && Math.abs(heightDiff) > 20 && Math.abs(nearLadder.x + nearLadder.width / 2 - pCenterX) < 60) {
                        this.isClimbing = true;
                        this.x += (nearLadder.x + nearLadder.width / 2 - pCenterX) * 0.2; // Centratura
                        this.vx = 0;
                        this.vy = (heightDiff > 0) ? 160 : -180; // Salita leggermente più rapida
                    } else if (this.isClimbing) {
                        // --- LOGICA DI SBARCO (Hoping off) ---
                        // Se siamo arrivati in cima o vicini al target, facciamo un balzello per atterrare sulla piattaforma
                        if (nearTop || Math.abs(heightDiff) <= 25) {
                            this.vy = -350; // Piccolo salto verso l'alto
                            this.vx = (player.x > this.x) ? 250 : -250; // Salto verso il giocatore per sbarcare
                            this.isGrounded = false;
                        }
                        this.isClimbing = false;
                        this.climbTimer = 0.6; // Cooldown per evitare di riagganciarsi subito
                    }


                    if (this.isClimbing) {
                        this.y += this.vy * dt;
                        this.isGrounded = false;
                        return;
                    }

                    // Insegue il target scelto (Player o Scala) con sparpagliamento di gruppo
                    let finalTargetX = targetX + this.targetOffset;

                    // --- LOGICA ATTACCO A BALZO (LUNGE) ---
                    let distToPlayerX = Math.abs(player.x - pCenterX);
                    this.lungeCooldown -= dt; // Gestione cooldown globale del balzo

                    if (this.isGrounded && distToPlayerX > 150 && distToPlayerX < 350 && distToPlayerY < 100 && !this.isClimbing && this.lungeCooldown <= 0) {
                        this.lungeTimer += dt;
                        if (this.lungeTimer > 1.0) {
                            // BALZO!
                            this.vy = -450;
                            this.vx = this.direction * 450; // Scatto in avanti potente
                            this.isGrounded = false;
                            this.lungeTimer = 0;
                            this.lungeCooldown = 3.0 + Math.random() * 2.0; // Pausa tra un balzo e l'altro
                            playSound('jump', this.x, this.y);
                            this.visualScaleY = 1.6; // Si allunga nel balzo estremo
                        } else {
                            // CARICA (Si schiaccia a terra indicando l'attacco imminente)
                            this.visualScaleY = 0.55;
                            this.visualScaleX = 1.4;
                            this.vx *= 0.3; // Quasi si ferma mentre carica la molla
                        }
                    } else {
                        if (this.lungeTimer > 0) {
                            // Se il player esce dal range mentre carichiamo, resettiamo
                            this.lungeTimer = 0;
                        }
                        if (this.x < finalTargetX - 5) {
                            this.direction = 1;
                            if (this.vx < this.speed) this.vx += 25;
                        } else if (this.x > finalTargetX + 5) {
                            this.direction = -1;
                            if (this.vx > -this.speed) this.vx -= 25;
                        }
                    }

                    // --- SCHIVATA EVASIVA (Dopo essere stati colpiti) ---
                    if (this.isHit > 0.25 && this.isGrounded && !this.isDodging) {
                        if (Math.random() > 0.7) { // 30% di probabilità di schivata
                            this.isDodging = true;
                            this.vy = -350;
                            this.vx = -this.direction * 450; // Salto all'indietro
                            this.isGrounded = false;
                            playSound('jump', this.x, this.y);
                        }
                    }
                    if (this.isGrounded) this.isDodging = false;

                    // -- IA SMART (Salto) --
                    if (this.isGrounded) {
                        let lookAheadX = this.direction === 1 ? this.x + this.width + 40 : this.x - 40;
                        let hasFloor = false;
                        let obstacleAhead = false;

                        world.platforms.forEach(p => {
                            if (lookAheadX >= p.x && lookAheadX <= p.x + p.width) {
                                if (p.y >= this.y + this.height - 30 && p.y <= this.y + this.height + 150) {
                                    hasFloor = true;
                                }
                            }
                            if (lookAheadX >= p.x && lookAheadX <= p.x + p.width) {
                                if (p.y < this.y + this.height - 10 && p.y > this.y - 50) {
                                    obstacleAhead = true;
                                }
                            }
                        });

                        let shouldJump = false;
                        if (!hasFloor && Math.abs(targetX - this.x) < 600) {
                            // Salta i buchi solo se necessario e con un pizzico di incertezza
                            if (Math.random() > 0.3) shouldJump = true;
                        }
                        if (obstacleAhead) shouldJump = true;

                        // Salta verso l'alto (piattaforme) solo se il target è decisamente sopra
                        if ((player.y < this.y - 120 && Math.abs(player.x - this.x) < 200) || (isTrappedInCave && targetX !== player.x)) {
                            shouldJump = true;
                        }

                        if (shouldJump) {
                            this.jumpDelay += dt;
                            // Aumentato il ritardo a 0.8s per farli "camminare" di più contro gli ostacoli
                            if (this.jumpDelay > 0.8) {
                                let finalPower = this.jumpPower * (0.85 + Math.random() * 0.2);
                                this.vy = finalPower;
                                this.vx = this.direction * (this.speed * 1.2 + (Math.random() * 30));
                                this.isGrounded = false;
                                playSound('jump', this.x, this.y);
                                this.jumpDelay = -0.5; // Cooldown dopo il salto
                            } else {
                                // Mentre decidono se saltare, rallentano invece di fermarsi del tutto
                                this.vx *= 0.6;
                            }
                        } else {
                            this.jumpDelay = 0;
                            if (!hasFloor) this.vx = 0; // Si fermano sull'orlo del baratro se decidono di non saltare
                        }
                    }
                }
                break;

            case 'digging':
                this.timer -= dt;
                // Costringerlo ad affondare ignorando il terreno duro per l'animazione mortale
                this.vy += this.gravity * dt;
                this.y += 12 * dt;
                if (this.timer <= 0) this.state = 'dead';
                break;

            case 'dead':
                this.vy += this.gravity * dt; // Cade preda dell'abisso
                break;
        }

        if (this.state !== 'dead' && this.state !== 'digging') {
            this.vy += this.gravity * dt;
        }

        // 1. FISICA ORIZZONTALE & COLLISIONE
        this.x += this.vx * dt;
        world.platforms.forEach(p => {
            // "Piattaforme Unidirezionali" (One-Way) per Zombie
            let isOneWay = p.height <= 30 || p.isStairs || p.isBridge;
            if (isOneWay) return;

            if (this.y + this.height > p.y + 5 && this.y < p.y + p.height - 5) {
                if (this.vx > 0 && this.x + this.width > p.x && this.x < p.x + 10) {
                    this.x = p.x - this.width;
                    this.vx = 0;
                }
                else if (this.vx < 0 && this.x < p.x + p.width && this.x + this.width > p.x + p.width - 10) {
                    this.x = p.x + p.width;
                    this.vx = 0;
                }
            }
        });

        // 2. FISICA VERTICALE & COLLISIONE
        if (this.state !== 'digging') {
            this.y += this.vy * dt;
        }

        if (this.state !== 'digging' && this.state !== 'dead') {
            this.isGrounded = false;
            world.platforms.forEach(p => {
                if (this.x < p.x + p.width - 5 && this.x + this.width > p.x + 5) {
                    if (this.vy >= 0 && this.y + this.height >= p.y && this.y + this.height <= p.y + 20 + this.vy * dt) {
                        this.isGrounded = true;
                        this.vy = 0;
                        this.y = p.y - this.height;
                    }
                    else if (this.vy < 0 && this.y <= p.y + p.height && this.y >= p.y + p.height - 20) {
                        let isOneWay = p.height <= 30 || p.isStairs || p.isBridge;
                        if (!isOneWay) {
                            this.vy = 0;
                            this.y = p.y + p.height;
                        }
                    }
                }
            });

            // --- GESTIONE SQUASH & STRETCH (Atterraggio Zombie) ---
            if (this.isGrounded && !this.wasGrounded) {
                this.visualScaleY = 0.75;
                this.visualScaleX = 1.2;
                createDust(this.x + this.width / 2, this.y + this.height, 3);
            }
            this.wasGrounded = this.isGrounded;

            // Logica Morte Alleato (Saluto)
            if (this.isAlly && this.hp <= 0 && !this.isSaluting) {
                this.isSaluting = true;
                this.state = 'dead';
                this.saluteTimer = 2.0;
                this.vx = 0;
            }

            // Logica Morte Alleato (Saluto)
            if (this.isAlly && this.hp <= 0 && !this.isSaluting) {
                this.isSaluting = true;
                this.state = 'dead';
                this.saluteTimer = 2.0;
                this.vx = 0;
            }

            this.visualScaleY += (1 - this.visualScaleY) * 0.1;
            this.visualScaleX += (1 - this.visualScaleX) * 0.1;

        } else if (this.state === 'dead') {
            if (this.isSaluting) {
                this.saluteTimer -= dt;
                this.deadOpacity = Math.max(0, this.saluteTimer / 2.0);
                this.deadRotation = 0; // Sta dritto per salutare l'eroe
                if (this.saluteTimer <= 0) {
                    this.state = 'dead';
                }
            } else {
                this.deadRotation += (Math.PI / 2 - this.deadRotation) * 0.1;
                this.deadOpacity -= dt * 0.5;
            }
            this.vx *= 0.9;
        }
    }

    draw(ctx, camera) {
        if (this.state === 'dead') return;

        let screenX = this.x - camera.x;
        let screenY = this.y - camera.y;

        ctx.save();

        // TRUCCO MAGIC: Taglio CLIP inferiore durante Emersione
        if (this.state === 'emerging') {
            let perc = this.timer / 2.0;
            ctx.beginPath();
            ctx.rect(screenX - 50, screenY - 50, 150, 150 - (perc * 80));
            ctx.clip();
        } else if (this.state === 'digging') {
            let perc = this.timer / 3.0;
            ctx.globalAlpha = Math.max(0, perc); // Si decompone nell'aria e nebbia
        }

        let bob = (this.isGrounded && this.state === 'chasing' && Math.abs(this.vx) > 5) ? Math.abs(Math.sin(Date.now() / 150)) * 4 : 0;

        if (this.state === 'dead') {
            ctx.globalAlpha = Math.max(0, this.deadOpacity);
            bob = 0;
        }

        ctx.translate(screenX + this.width / 2, screenY + this.height / 2 - bob);
        if (this.direction === -1) ctx.scale(-1, 1);

        // Applica Squash & Stretch e Rotazione Morte
        ctx.scale(this.visualScaleX, this.visualScaleY);
        if (this.state === 'dead') ctx.rotate(this.deadRotation);

        // Cromaticità Putrefatta Zombie (Variante Pallida per Grotte)
        let isWhite = this.type === 'white' || this.type === 'cave';
        let mainColor = (this.isHit > 0) ? '#FFFFFF' : (isWhite ? '#F5F5F7' : '#3E7D32');
        let shadowColor = (this.isHit > 0) ? '#FF4444' : (isWhite ? '#D0D0D5' : '#1B5E20');
        let eyeColor = (this.isHit > 0) ? '#000' : (isWhite ? '#FFFFFF' : '#DD0000');
        let outline = isWhite ? '#202025' : '#0A1C0A';

        function drawZBlock(bx, by, bw, bh, color) {
            ctx.fillStyle = outline;
            ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
            ctx.fillStyle = color;
            ctx.fillRect(bx, by, bw, bh);
        }

        // Gambe incerte (Unite in marcia trascinata)
        drawZBlock(-6, 15, 12, 28, shadowColor);

        // Braccio Dietro (Lanciato rigido parallelo alla terra!)
        ctx.save();
        ctx.translate(0, -10);
        ctx.rotate(-Math.PI / 2.5); // Braccio dritto da Infezione
        drawZBlock(-4, 0, 8, 34, shadowColor); // Allungate le braccia (da 22 a 34px)!
        ctx.restore();

        // Torso Rigonfio
        ctx.save();
        ctx.rotate(0.1);
        drawZBlock(-10, -15, 20, 32, mainColor);
        ctx.restore();

        // Cranio inclinato avido di cervelli
        ctx.save();
        ctx.rotate(0.25);
        drawZBlock(-14, -40, 28, 26, mainColor);
        // Occhio Infetto!
        ctx.fillStyle = eyeColor;
        ctx.fillRect(4, -34, 10, 8);
        ctx.restore();

        // Braccio Avanti Identico e Mostruoso
        // Braccio Avanti Identico (Saluto se l'alleato sta morendo)
        ctx.save();
        ctx.translate(0, -10);
        if (this.isSaluting) {
            ctx.rotate(-Math.PI * 0.8); // Braccio alzato verso l'alto (Saluto Finale)
        } else {
            ctx.rotate(-Math.PI / 2.2);
        }
        drawZBlock(-4, 0, 8, 34, mainColor);
        ctx.restore();

        // --- DISEGNO EQUIPAGGIAMENTO ALLEATO ---
        if (this.isAlly) {
            // DISEGNO SPADA
            ctx.save();
            ctx.translate(15, -15);
            ctx.rotate(Math.sin(Date.now() / 120) * 0.2 + 0.5);
            ctx.fillStyle = '#bdc3c7'; // Lama
            ctx.fillRect(0, -32, 6, 32);
            ctx.fillStyle = '#7f8c8d'; // Elsa
            ctx.fillRect(-2, -5, 10, 4);
            ctx.restore();

            // DISEGNO SCUDO
            ctx.save();
            ctx.translate(-15, -10);
            ctx.fillStyle = '#2980b9'; // Scudo Blu Reale
            ctx.fillRect(0, -20, 18, 32);
            ctx.strokeStyle = '#3498db';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, -20, 18, 32);
            ctx.restore();
        }

        ctx.restore(); // Fine zona Effetti Voxel!

        // HUD - MicroBarra di Salute dello Zombie!
        if (this.state !== 'emerging' && this.state !== 'digging' && this.hp > 0) {
            ctx.fillStyle = '#111';
            ctx.fillRect(screenX, screenY - 20, 40, 8); // Base Oscura
            let maxHP = this.isAlly ? 10 : 3; // Gli alleati hanno più vita visiva? No, usiamo tacche diverse
            let barW = 36 / (this.isAlly ? 5 : 3);
            for (let b = 0; b < (this.isAlly ? 5 : 3); b++) {
                ctx.fillStyle = (b < (this.isAlly ? this.hp / 20 : this.hp)) ? (this.isAlly ? '#3498db' : '#DD0000') : '#440000';
                ctx.fillRect(screenX + 2 + (b * barW), screenY - 18, barW - 2, 4);
            }
        }
    }
}

// ==========================================
// 5. THE GAME DIRECTOR (Logica e Game Loop)
// ==========================================

let isShopOpen = false;

// ==========================================
// 4.5 HELPER FUNCTIONS (Particle Systems & FX)
// ==========================================

function createDust(x, y, count = 12) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 120,
            vy: (Math.random() - 0.5) * 50 - 20,
            life: 0.8 + Math.random() * 0.4,
            size: 2 + Math.random() * 4,
            color: '#bdc3c7'
        });
    }
}

function createPixelDissolve(x, y, w, h, colors = ['#FFF', '#CCC', '#888']) {
    for (let i = 0; i < 24; i++) {
        particles.push({
            x: x + Math.random() * w,
            y: y + Math.random() * h,
            vx: (Math.random() - 0.5) * 150,
            vy: (Math.random() - 0.5) * 150 - 50,
            life: 1.2 + Math.random() * 0.8,
            size: 3 + Math.random() * 5,
            color: colors[Math.floor(Math.random() * colors.length)]
        });
    }
}

function openShop() {
    isShopOpen = true;
    document.getElementById('shopMenu').style.display = 'flex';
}

function closeShop() {
    isShopOpen = false;
    document.getElementById('shopMenu').style.display = 'none';
}

// Rendiamo buyItem globale per l'onclick dell'HTML
window.buyItem = function (item) {
    let cost = 0;
    if (item === 'heal') cost = 40;
    if (item === 'shield') cost = 60;
    if (item === 'boots') cost = 120;
    if (item === 'armor') cost = 150;
    if (item === 'ally') cost = 200;

    if (player.score >= cost) {
        player.score -= cost;
        document.getElementById('scoreUI').innerText = `Punti: ${player.score}`;

        if (item === 'heal') {
            player.health = 100;
            document.getElementById('healthUI').innerText = `Salute: ${player.health}`;
            playSound('loot');
        } else if (item === 'shield') {
            player.hasShield = true;
            player.shieldDurability = 5;
            playSound('loot');
        } else if (item === 'boots') {
            player.speed *= 1.2;
            playSound('jump');
        } else if (item === 'armor') {
            player.hasArmor = true;
            playSound('castle_loot');
        } else if (item === 'ally') {
            let hero = new HeroAlly(player.x - 50, player.y);
            allies.push(hero);
            playSound('wake', player.x, player.y);
        }
        closeShop();
    }
};

const world = new World();
const player = new Player(100, 400);

function update(dt) {
    if (gameState === 'MENU') return;

    // Se lo shop è aperto, il tempo scorre al 20% (Effetto Slow-Mo)
    if (isShopOpen) dt *= 0.2;
    if (keys['Escape'] && isShopOpen) closeShop();

    // 1. MOTORE TEMPORALE DINAMICO
    let timeSpeed = 0.1;
    if (timeOfDay > 5 && timeOfDay <= 19) {
        timeSpeed = 14 / 30; // 30 sec per il giorno
    } else {
        timeSpeed = 10 / 60; // 60 sec per la notte
    }

    let prevTime = timeOfDay;
    timeOfDay += dt * timeSpeed;
    if (timeOfDay >= 24) timeOfDay -= 24;
    if (prevTime <= 5 && timeOfDay > 5) currentDay++;

    // 2. HUD Orologio e Statistiche
    let elapsedSecs = 0;
    let maxTimeStr = (timeOfDay > 5 && timeOfDay <= 19) ? "0:30" : "1:00";
    if (timeOfDay > 5 && timeOfDay <= 19) {
        elapsedSecs = ((timeOfDay - 5) / 14) * 30;
    } else {
        let nightHrs = (timeOfDay > 19) ? (timeOfDay - 19) : (timeOfDay + 5);
        elapsedSecs = (nightHrs / 10) * 60;
    }
    let timerMin = Math.floor(elapsedSecs / 60);
    let timerSec = Math.floor(elapsedSecs % 60).toString().padStart(2, '0');
    let timeUI = document.getElementById('timeUI');
    if (timeUI) timeUI.innerText = `Giorno ${currentDay} - Timer: ${timerMin}:${timerSec} / ${maxTimeStr}`;

    // 3. ESECUZIONE CORPO FISICO
    player.update(dt, world);

    // 3.1 AGGIORNAMENTO ALLEATI
    for (let i = allies.length - 1; i >= 0; i--) {
        let a = allies[i];
        a.update(dt, world, player, enemies);
        if (a.hp <= 0 && !a.isSaluting) {
            a.isSaluting = true;
            a.saluteTimer = 2.0;
        }
        if (a.isSaluting && a.saluteTimer <= 0) {
            allies.splice(i, 1);
        }
    }

    // 3.2 AGGIORNAMENTO PARTICELLE
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
    }

    // 3.3 AGGIORNAMENTO NEMICI (Il Grande Trito-ossa)
    // Genera l'ondata notturna
    if (timeOfDay >= 19 && currentDay > lastSpawnNight) {
        lastSpawnNight = currentDay;
        for (let i = 0; i < currentDay; i++) {
            let spawnDir = Math.random() > 0.5 ? 1 : -1;
            let spawnX = player.x + (550 * spawnDir) + (Math.random() * 200 - 100);
            let spawnY = Math.min(player.y - 120, 350);
            enemies.push(new Zombie(spawnX, spawnY));
        }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        let z = enemies[i];

        // Logica Morte Universale
        if (z.hp <= 0 && z.state !== 'dead') {
            playSound('kill', z.x, z.y);
            z.state = 'dead';
            player.score += (z.type === 'white' || z.type === 'cave') ? 10 : 5;
            let scoreUI = document.getElementById('scoreUI');
            if (scoreUI) scoreUI.innerText = `Punti: ${player.score}`;
            createDust(z.x + z.width / 2, z.y + z.height, 8);
        }

        z.update(dt, world, player);
        if (z.state === 'dead') continue;

        // Combattimento: Giocatore vs Zombie
        if (player.isAttacking && z.state !== 'digging') {
            let pProg = 1 - (player.attackTimer / player.attackDuration);
            if (pProg > 0.1 && pProg < 0.7) {
                let dx = Math.abs(player.x - z.x);
                let dy = Math.abs(player.y - z.y);
                if (dx < 75 && dy < 75) {
                    let facciale = (z.x >= player.x && player.direction === 1) || (z.x <= player.x && player.direction === -1);
                    if (facciale && z.isHit <= 0) {
                        playSound('zombie_hit', z.x, z.y);
                        z.hp--;
                        z.isHit = 0.3;
                        z.vx = player.direction * 350;
                        z.vy = -180;
                    }
                }
            }
        }

        // Combattimento: Zombie vs Giocatore
        if (!player.isHitTimer) player.isHitTimer = 0;
        if (z.state === 'chasing' && player.isHitTimer <= 0 && z.hp > 0 && z.isHit <= 0) {
            let pDx = Math.abs(player.x - z.x);
            let pDy = Math.abs(player.y - z.y);
            if (pDx < 35 && pDy < 45) {
                let facingEnemy = (z.x > player.x && player.direction === 1) || (z.x < player.x && player.direction === -1);
                if (player.isParrying && facingEnemy) {
                    playSound('hit', z.x, z.y);
                    player.shieldDurability--;
                    z.vx = -z.vx * 1.5;
                    player.isHitTimer = 0.5;
                    createDust(player.x + 20 * player.direction, player.y + 20, 3);
                    if (player.shieldDurability <= 0) {
                        player.hasShield = false;
                        playSound('break', player.x, player.y);
                        createPixelDissolve(player.x, player.y, 40, 80, ['#2c3e50', '#95a5a6', '#7f8c8d']);
                    }
                } else {
                    playSound('player_hit');
                    let dmg = 15;
                    if (player.hasArmor) dmg *= 0.5;
                    player.health -= dmg;
                    player.vy = -350;
                    player.isHitTimer = 1.0;
                    let healthUI = document.getElementById('healthUI');
                    if (healthUI) healthUI.innerText = `Salute: ${player.health}`;
                }
            }
        }

        // Combattimento: Zombie vs Alleati
        allies.forEach(a => {
            if (z.state === 'chasing' && a.hp > 0 && a.isHitTimer <= 0 && z.hp > 0 && z.isHit <= 0) {
                let dAx = Math.abs(a.x - z.x);
                let dAy = Math.abs(a.y - z.y);
                if (dAx < 40 && dAy < 50) {
                    playSound('player_hit', a.x, a.y); // Usiamo lo stesso suono per semplicità
                    a.hp -= 10;
                    a.isHitTimer = 0.8;
                    a.vy = -200;
                    a.vx = (a.x > z.x ? 100 : -100);
                    createDust(a.x + a.width / 2, a.y + a.height, 5);
                }
            }
        });
    }

    if (player.isHitTimer > 0) player.isHitTimer -= dt;

    // Pulizia cadaveri
    enemies = enemies.filter(z => !(z.state === 'dead' && z.y > player.y + 1000));

    // 4. CAMERAMAN DIGITALE (Coordinate Logiche - Calcolate in Draw per supporto Scaling)
    // Rimosso da qui per centralizzare la logica di scaling in draw()


    // 5. INTERAZIONE CON IL MONDO
    currentInteractable = null;
    world.interactables.forEach(b => {
        if (player.x + player.width / 2 > b.doorX &&
            player.x + player.width / 2 < b.doorX + b.doorWidth &&
            player.y + player.height > b.y + b.height - 20) {

            currentInteractable = b;
            if (keys['KeyE'] && !b.looted) {
                if (b.type === 'house') {
                    timeOfDay = 5.0001;
                    currentDay++;
                    player.health = 100;
                    let hUI = document.getElementById('healthUI');
                    if (hUI) hUI.innerText = `Salute: ${player.health}`;
                } else if (b.type === 'castle') {
                    player.score += 100;
                    let sUI = document.getElementById('scoreUI');
                    if (sUI) sUI.innerText = `Punti: ${player.score}`;
                    playSound('castle_loot');
                    openShop();
                } else if (b.type === 'chest' && !player.hasShield) {
                    player.hasShield = true;
                    player.shieldDurability = 5;
                    playSound('wake', player.x, player.y);
                } else if (b.type === 'chest' && player.hasShield) {
                    return;
                }
                b.looted = true;
                keys['KeyE'] = false;
            }
        }
    });

    if (player.health <= 0) {
        gameOver = true;
        let gOver = document.getElementById('gameOver');
        if (gOver) {
            gOver.style.display = 'block';
            document.getElementById('finalScore').innerText = `Punteggio: ${player.score}`;
            document.getElementById('finalDays').innerText = `Sopravvivenza: ${currentDay} Giorni`;
            
            // Focus automatico sull'input del nome
            setTimeout(() => {
                document.getElementById('playerNameInput').focus();
            }, 100);
        }
    }
}

// ==========================================
// 6. ARCADE LEADERBOARD SYSTEM
// ==========================================

function getHighScores() {
    const scores = localStorage.getItem('stickman_highscores');
    return scores ? JSON.parse(scores) : [];
}

function saveHighScore(name, score, days) {
    let scores = getHighScores();
    scores.push({ name: name.toUpperCase(), score: score, days: days });
    // Ordina per punteggio (primario) e giorni (secondario)
    scores.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.days - a.days;
    });
    // Tieni solo la Top 10
    scores = scores.slice(0, 10);
    localStorage.setItem('stickman_highscores', JSON.stringify(scores));
    updateMiniLeaderboard(); // Aggiorna anche la mini classifica live
}

function updateMiniLeaderboard() {
    const miniList = document.getElementById('miniLeaderboardList');
    if (!miniList) return;

    const scores = getHighScores().slice(0, 5); // Solo la Top 5 per il riquadro mini
    
    if (scores.length === 0) {
        miniList.innerHTML = "<div style='color: #666; text-align: center;'>- Vuoto -</div>";
        return;
    }

    miniList.innerHTML = scores.map((s, index) => `
        <div class="mini-lb-item">
            <span class="mini-name">${index + 1}. ${s.name}</span>
            <span class="mini-days">GIORNO ${s.days}</span>
            <span class="mini-score">${s.score}</span>
        </div>
    `).join('');
}




function showLeaderboard() {
    const nameEntry = document.getElementById('nameEntry');
    const lbContainer = document.getElementById('leaderboardContainer');
    if (nameEntry) nameEntry.style.display = 'none';
    if (lbContainer) lbContainer.style.display = 'block';
    
    const list = document.getElementById('leaderboardList');
    if (!list) return;

    const scores = getHighScores();
    
    if (scores.length === 0) {
        list.innerHTML = "<p style='color: #666;'>Nessun record ancora!</p>";
    } else {
        list.innerHTML = scores.map((s, index) => `
            <div class="leaderboard-item">
                <span class="leaderboard-name">${index + 1}. ${s.name}</span>
                <span class="leaderboard-days">${s.days} GG</span>
                <span class="leaderboard-score">${s.score} PTS</span>
            </div>
        `).join('');
    }
}

// Event Listeners per il sistema di salvataggio
document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('saveScoreBtn');
    const nameInput = document.getElementById('playerNameInput');
    const restartBtn = document.getElementById('restartBtn');

    const fullscreenBtn = document.getElementById('fullscreenBtn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.log("Errore Fullscreen:", err);
                });
            } else {
                document.exitFullscreen();
            }
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const name = nameInput.value.trim() || "???";
            saveHighScore(name, player.score, currentDay);
            showLeaderboard();
        });
    }

    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            location.reload();
        });
    }

    if (nameInput) {
        // Forza maiuscole e limita a 3 caratteri (Stile vecchio arcade)
        nameInput.addEventListener('input', (e) => {
            let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (val.length > 3) val = val.slice(0, 3);
            e.target.value = val;
        });

        // Permetti l'invio con il tasto ENTER
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') saveBtn.click();
        });
    }

    // Inizializza la mini classifica live al caricamento
    updateMiniLeaderboard();
});

let cachedDarknessGradient = null;
let lastDarknessAlpha = -1;

function drawDarkness(ctx) {
    let darknessAlpha = 0;

    // Buio Superficie
    if ((timeOfDay > 19 || timeOfDay < 5) && player.y < 800) {
        darknessAlpha = 0.6;
    }

    // Buio Cave Profondo
    if (player.y >= 800) {
        darknessAlpha = 0.85;
    }

    if (darknessAlpha > 0) {
        let px = player.x - camera.x + player.width / 2;
        let py = player.y - camera.y + player.height / 2;

        // Ottimizzazione: Ridisegniamo il gradiente solo se cambia l'opacità
        if (darknessAlpha !== lastDarknessAlpha) {
            let offCanvas = document.createElement('canvas');
            offCanvas.width = 700;
            offCanvas.height = 700;
            let offCtx = offCanvas.getContext('2d');
            
            let grad = offCtx.createRadialGradient(350, 350, 40, 350, 350, 350);
            grad.addColorStop(0, 'rgba(0,0,0,0)');
            grad.addColorStop(0.5, `rgba(0,0,0, ${darknessAlpha * 0.4})`);
            grad.addColorStop(1, `rgba(0,0,0, ${darknessAlpha})`);
            
            offCtx.fillStyle = grad;
            offCtx.fillRect(0, 0, 700, 700);
            cachedDarknessGradient = offCanvas;
            lastDarknessAlpha = darknessAlpha;
        }

        if (cachedDarknessGradient) {
            // Disegniamo il gradiente centrato sul player
            ctx.drawImage(cachedDarknessGradient, px - 350, py - 350);
            
            // Riempiamo i bordi esterni con nero solido (molto più performante di un gradiente gigante)
            ctx.fillStyle = `rgba(0,0,0, ${darknessAlpha})`;
            if (py - 350 > 0) ctx.fillRect(0, 0, width, py - 350); // Sopra
            if (py + 350 < height) ctx.fillRect(0, py + 350, width, height - (py + 350)); // Sotto
            if (px - 350 > 0) ctx.fillRect(0, py - 350, px - 350, 700); // Sinistra
            if (px + 350 < width) ctx.fillRect(px + 350, py - 350, width - (px + 350), 700); // Destra
        }
    }
}


function draw() {
    // Aggiornamento Camera basato su dimensioni fisse (Già stabilito 1440x810)
    camera.x = player.x - width / 2;
    camera.y = player.y - height / 1.5;

    let windSpeed = 25;
    let cloudOffset = ((Date.now() / 1000) * windSpeed) % width;

    let dayAlpha = 1;
    if (timeOfDay >= 5 && timeOfDay <= 7) {
        dayAlpha = (timeOfDay - 5) / 2;
    } else if (timeOfDay > 17 && timeOfDay <= 19) {
        dayAlpha = 1 - ((timeOfDay - 17) / 2);
    } else if (timeOfDay > 19 || timeOfDay < 5) {
        dayAlpha = 0;
    }
    dayAlpha = Math.max(0, Math.min(1, dayAlpha));

    // Pulizia Sfondo (Fisica 1440x810)
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, width, height);

    if (gfx.sky_night.complete && gfx.sky_night.naturalWidth > 0) {
        ctx.globalAlpha = 1 - dayAlpha;
        if (ctx.globalAlpha > 0) {
            ctx.drawImage(gfx.sky_night, -cloudOffset, 0, width, height);
            ctx.drawImage(gfx.sky_night, width - cloudOffset, 0, width, height);
        }
    }

    if (gfx.sky_day.complete && gfx.sky_day.naturalWidth > 0) {
        ctx.globalAlpha = dayAlpha;
        if (ctx.globalAlpha > 0) {
            ctx.drawImage(gfx.sky_day, -cloudOffset, 0, width, height);
            ctx.drawImage(gfx.sky_day, width - cloudOffset, 0, width, height);
        }
    }

    ctx.globalAlpha = 1.0;

    world.drawParallax(ctx, camera);
    world.drawForeground(ctx, camera);

    particles.forEach(p => {
        let sx = p.x - camera.x;
        let sy = p.y - camera.y;
        if (sx > -50 && sx < width + 50) {
            ctx.globalAlpha = p.life / 1.2;
            ctx.fillStyle = p.color;
            ctx.fillRect(sx, sy, p.size, p.size);
        }
    });
    ctx.globalAlpha = 1.0;

    allies.forEach(a => a.draw(ctx, camera));
    enemies.forEach(z => z.draw(ctx, camera)); 

    if (player.isHitTimer && player.isHitTimer > 0) {
        ctx.globalAlpha = 0.5 + Math.abs(Math.sin(Date.now() / 60)) * 0.5;
    }
    player.draw(ctx, camera);
    ctx.globalAlpha = 1.0; 

    drawDarkness(ctx);

    if (currentInteractable && !currentInteractable.looted) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';

        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        let text = currentInteractable.type === 'house' ? "Premi E per Riposare in Taverna" : "Premi E per Ispezionare il Tesoro Antico";
        ctx.fillText(text, player.x - camera.x + player.width / 2, player.y - camera.y - 50);

        ctx.shadowColor = "transparent";
        ctx.textAlign = 'left';
    }
}




// IL GRANDE PULSANTE START (Loop a 60 FPS o Refresh Sync)
function gameLoop(timestamp) {
    if (gameOver) return;

    // Fix vitale per evitare Delta Time impazziti al primo frame che farebbero teletrasportare e incastrare l'omino
    if (!lastTime) lastTime = timestamp;

    let dt = (timestamp - lastTime) / 1000;

    // Caps Rigido: Se il PC lagga, frena la fisica al massimo a 20 Frame al secondo simulati (0.05 dt) evitando teleporting!
    if (dt > 0.05) dt = 0.05;

    lastTime = timestamp;

    update(dt);
    draw();

    requestAnimationFrame(gameLoop);
}
