/**
 * PPDB SD SALATIGA 03
 * Shared Audio Sound Effects & Theme (Light/Dark Mode) Manager
 */

// Audio Context Singleton
let audioCtx = null;

function getAudioContext() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

// Sound enabled flag in localStorage (default true)
function isSoundEnabled() {
    return localStorage.getItem('ppdb_sound_enabled') !== 'false';
}

function setSoundEnabled(val) {
    localStorage.setItem('ppdb_sound_enabled', val ? 'true' : 'false');
    updateSoundIcons();
}

/**
 * Play synthesized crisp micro-interaction sounds
 */
function playClickSound(type = 'click') {
    if (!isSoundEnabled()) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        if (type === 'click') {
            // Crisp soft UI click (satisfying tactile tap)
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(160, now + 0.045);

            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.045);
        } else if (type === 'pop') {
            // Subtle pop sound for navigation / tabs
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(450, now);
            osc.frequency.exponentialRampToValueAtTime(650, now + 0.05);

            gain.gain.setValueAtTime(0.10, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'success') {
            // Joyful chime for successful submit / verification
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gainNode = ctx.createGain();

            osc1.type = 'sine';
            osc2.type = 'sine';
            osc1.frequency.setValueAtTime(523.25, now); // C5
            osc1.frequency.setValueAtTime(659.25, now + 0.08); // E5
            osc2.frequency.setValueAtTime(783.99, now + 0.16); // G5

            gainNode.gain.setValueAtTime(0.15, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

            osc1.connect(gainNode);
            osc2.connect(gainNode);
            gainNode.connect(ctx.destination);

            osc1.start(now);
            osc2.start(now + 0.16);
            osc1.stop(now + 0.35);
            osc2.stop(now + 0.35);
        }
    } catch (e) {
        // Silently fail if audio not allowed by browser autoplay policy
    }
}

/**
 * Theme Manager: Dark / Light Mode
 */
function getTheme() {
    return localStorage.getItem('ppdb_theme') || 'light';
}

function setTheme(theme) {
    localStorage.setItem('ppdb_theme', theme);
    applyTheme(theme);
    updateThemeIcons();
}

function toggleTheme() {
    playClickSound('pop');
    const newTheme = getTheme() === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'light') {
        root.classList.add('light-mode');
        root.classList.remove('dark-mode');
        root.classList.remove('dark');
    } else {
        root.classList.remove('light-mode');
        root.classList.add('dark-mode');
        root.classList.add('dark');
    }
}

function updateThemeIcons() {
    const isLight = getTheme() === 'light';
    document.querySelectorAll('.theme-toggle-icon').forEach(icon => {
        if (isLight) {
            icon.className = 'fa-solid fa-moon text-amber-500 theme-toggle-icon';
        } else {
            icon.className = 'fa-solid fa-sun text-amber-400 theme-toggle-icon';
        }
    });
    document.querySelectorAll('.theme-toggle-text').forEach(el => {
        el.innerText = isLight ? 'Mode Gelap' : 'Mode Terang';
    });

    // Update capsule switch thumb position & background
    const thumb = document.getElementById('themeToggleThumb');
    if (thumb) {
        if (isLight) {
            thumb.style.transform = 'translateX(0px)';
            thumb.className = 'w-6 h-6 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center text-xs shadow-md transition-transform duration-300';
            thumb.innerHTML = '<i class="fa-solid fa-sun text-[11px]"></i>';
        } else {
            thumb.style.transform = 'translateX(30px)';
            thumb.className = 'w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs shadow-md transition-transform duration-300';
            thumb.innerHTML = '<i class="fa-solid fa-moon text-[11px]"></i>';
        }
    }
}

function updateSoundIcons() {
    const enabled = isSoundEnabled();
    document.querySelectorAll('.sound-toggle-icon').forEach(icon => {
        if (enabled) {
            icon.className = 'fa-solid fa-volume-high text-emerald-400 sound-toggle-icon';
        } else {
            icon.className = 'fa-solid fa-volume-xmark text-slate-400 sound-toggle-icon';
        }
    });
    document.querySelectorAll('.sound-toggle-text').forEach(el => {
        el.innerText = enabled ? 'Suara Aktif' : 'Suara Senyap';
    });
}

function toggleSound() {
    const current = isSoundEnabled();
    setSoundEnabled(!current);
    if (!current) playClickSound('pop');
}

// Attach automatic click audio to interactive elements
function attachAudioListeners() {
    document.addEventListener('click', (e) => {
        const target = e.target.closest('button, a, input[type="radio"], input[type="checkbox"], select, .clickable-sound');
        if (target) {
            // Avoid double sound on sound toggle button itself
            if (!target.classList.contains('sound-toggle-btn')) {
                playClickSound('click');
            }
        }
    }, { passive: true });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    applyTheme(getTheme());
    updateThemeIcons();
    updateSoundIcons();
    attachAudioListeners();
});
