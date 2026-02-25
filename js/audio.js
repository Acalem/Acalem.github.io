/**
 * Pixel Park Paradise - Audio System
 * Sound effects and procedural ambient music
 */

(function() {
    'use strict';
    
    // Audio context and music state
    let audioCtx = null;
    let musicInt = null;
    let musicSeed = 1;
    let musicBus, musicOut, musicWet, musicDl, musicFb, musicRv, musicRlp, musicDlp, musicSt;
    
    /**
     * Initialize the Web Audio API context
     */
    PPT.audio.init = function() {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch(e) {
            console.warn('Web Audio not supported');
        }
    };
    
    /**
     * Get the audio context
     */
    PPT.audio.getContext = function() {
        return audioCtx;
    };
    
    /**
     * Play a sound effect
     * @param {string} type - Sound type: 'build', 'error', 'click', 'notification', 'achievement'
     */
    PPT.audio.playSound = function(type) {
        if (!G || !G.sfx || !audioCtx) return;
        
        try {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.connect(g);
            g.connect(audioCtx.destination);
            const n = audioCtx.currentTime;
            
            switch(type) {
                case 'build':
                    o.frequency.setValueAtTime(400, n);
                    o.frequency.setValueAtTime(600, n + 0.05);
                    g.gain.setValueAtTime(0.15, n);
                    g.gain.linearRampToValueAtTime(0.01, n + 0.1);
                    o.start(n);
                    o.stop(n + 0.1);
                    break;
                    
                case 'error':
                    o.type = 'square';
                    o.frequency.setValueAtTime(150, n);
                    g.gain.setValueAtTime(0.12, n);
                    g.gain.linearRampToValueAtTime(0.01, n + 0.15);
                    o.start(n);
                    o.stop(n + 0.15);
                    break;
                    
                case 'click':
                    o.type = 'square';
                    o.frequency.setValueAtTime(600, n);
                    g.gain.setValueAtTime(0.06, n);
                    g.gain.linearRampToValueAtTime(0.01, n + 0.03);
                    o.start(n);
                    o.stop(n + 0.03);
                    break;
                    
                case 'notification':
                    o.type = 'sine';
                    o.frequency.setValueAtTime(880, n);
                    g.gain.setValueAtTime(0.08, n);
                    g.gain.linearRampToValueAtTime(0.01, n + 0.1);
                    o.start(n);
                    o.stop(n + 0.1);
                    break;
                    
                case 'achievement':
                    [523, 659, 784, 1047].forEach((f, i) => {
                        const o2 = audioCtx.createOscillator();
                        const g2 = audioCtx.createGain();
                        o2.connect(g2);
                        g2.connect(audioCtx.destination);
                        o2.type = 'square';
                        o2.frequency.setValueAtTime(f, n + i * 0.12);
                        g2.gain.setValueAtTime(0.1, n + i * 0.12);
                        g2.gain.linearRampToValueAtTime(0.01, n + i * 0.12 + 0.2);
                        o2.start(n + i * 0.12);
                        o2.stop(n + i * 0.12 + 0.2);
                    });
                    break;
            }
        } catch(e) {}
    };
    
    // Music helper functions
    const musicR = () => ((musicSeed = (musicSeed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const musicHz = m => 440 * Math.pow(2, (m - 69) / 12);
    
    const musicTone = (t, m, d, v, cut, sp = 0.18) => {
        if (!audioCtx || !musicBus) return;
        
        const o = audioCtx.createOscillator();
        const o2 = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        const g2 = audioCtx.createGain();
        const lp = audioCtx.createBiquadFilter();
        const base = musicHz(m) * (1 + (musicR() - 0.5) * 0.002);
        
        o.type = "triangle";
        o2.type = "sine";
        o.frequency.setValueAtTime(base, t);
        o2.frequency.setValueAtTime(base * 2, t);
        
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(cut, t);
        lp.Q.value = 0.2;
        
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(v, t + 0.012);
        g.gain.linearRampToValueAtTime(v * 0.55, t + d * 0.55);
        g.gain.linearRampToValueAtTime(0.0001, t + d + 0.55);
        
        g2.gain.setValueAtTime(0.0001, t);
        g2.gain.linearRampToValueAtTime(v * sp, t + 0.015);
        g2.gain.linearRampToValueAtTime(0.0001, t + d * 0.35);
        
        o.connect(g);
        o2.connect(g2);
        g.connect(lp);
        g2.connect(lp);
        lp.connect(musicBus);
        
        o.start(t);
        o.stop(t + d + 0.6);
        o2.start(t);
        o2.stop(t + d * 0.4);
    };
    
    const setupMusicFX = () => {
        if (!audioCtx || musicBus) return;
        
        musicBus = audioCtx.createGain();
        musicBus.gain.value = 0.7;
        musicOut = audioCtx.createGain();
        musicOut.gain.value = 0.65;
        musicWet = audioCtx.createGain();
        musicWet.gain.value = 0.46;
        
        const sec = 3.3, dec = 3.0, L = (sec * audioCtx.sampleRate) | 0;
        const b = audioCtx.createBuffer(2, L, audioCtx.sampleRate);
        
        for (let c = 0; c < 2; c++) {
            const d = b.getChannelData(c);
            for (let i = 0; i < L; i++) {
                const t = i / L;
                d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, dec);
            }
        }
        
        musicRv = audioCtx.createConvolver();
        musicRv.buffer = b;
        musicRlp = audioCtx.createBiquadFilter();
        musicRlp.type = "lowpass";
        musicRlp.frequency.value = 2300;
        
        musicDl = audioCtx.createDelay(1);
        musicDl.delayTime.value = 0.32;
        musicFb = audioCtx.createGain();
        musicFb.gain.value = 0.23;
        musicDlp = audioCtx.createBiquadFilter();
        musicDlp.type = "lowpass";
        musicDlp.frequency.value = 2100;
        
        musicBus.connect(musicOut);
        musicBus.connect(musicWet);
        musicWet.connect(musicRv);
        musicRv.connect(musicRlp);
        musicRlp.connect(musicOut);
        musicBus.connect(musicDl);
        musicDl.connect(musicDlp);
        musicDlp.connect(musicFb);
        musicFb.connect(musicDl);
        musicDlp.connect(musicOut);
        musicOut.connect(audioCtx.destination);
    };
    
    /**
     * Start the ambient music
     */
    PPT.audio.startMusic = function() {
        if (musicInt) clearInterval(musicInt);
        if (!audioCtx) return;
        
        setupMusicFX();
        
        const bpm = 86, beat = 60 / bpm, step = beat / 4;
        const CH = [
            [60,64,67], [57,60,64], [62,65,69], [67,71,74], [65,69,72], [60,64,67], [67,71,74], [60,64,67],
            [60,64,67], [57,60,64], [62,65,69], [67,71,74], [65,69,72], [60,64,67], [69,72,76], [67,71,74],
            [57,60,64], [65,69,72], [60,64,67], [67,71,74], [62,65,69], [57,60,64], [65,69,72], [60,64,67],
            [60,64,67], [57,60,64], [62,65,69], [67,71,74], [65,69,72], [60,64,67], [67,71,74], [60,64,67]
        ];
        const P1 = [0,2,1,2,0,2,1,2,0,2,1,2,0,1,2,1];
        const P2 = [0,1,2,1,0,1,2,1,0,2,1,2,0,1,2,0];
        const P3 = [0,2,1,0,2,1,2,1,0,1,2,1,2,1,0,1];
        
        musicSt = {
            t: audioCtx.currentTime + 0.10,
            i: 0,
            mode: "tune",
            nextTuneAt: audioCtx.currentTime + 9999,
            driftUntil: 0,
            spurtAt: 0,
            spurtBarsLeft: 0
        };
        
        const toTune = () => {
            musicSt.mode = "tune";
            musicSt.i = 0;
            musicSt.driftUntil = 0;
            musicSt.nextTuneAt = audioCtx.currentTime + (120 + musicR() * 120);
        };
        
        const toDrift = () => {
            musicSt.mode = "drift";
            musicSt.driftUntil = audioCtx.currentTime + (140 + musicR() * 90);
            musicSt.spurtAt = audioCtx.currentTime + (25 + musicR() * 35);
            musicSt.spurtBarsLeft = 0;
        };
        
        toTune();
        
        musicInt = setInterval(() => {
            if (!G || !G.music || G.paused || !audioCtx) return;
            
            const now = audioCtx.currentTime, look = 0.25, w = 0.35 + 0.25 * Math.sin(now * 0.03);
            musicWet.gain.setTargetAtTime(0.38 + w * 0.35, now, 0.10);
            musicFb.gain.setTargetAtTime(0.18 + w * 0.10, now, 0.10);
            musicDlp.frequency.setTargetAtTime(1800 + (1 - w) * 700, now, 0.12);
            musicRlp.frequency.setTargetAtTime(2000 + (1 - w) * 700, now, 0.12);
            
            while (musicSt.t < now + look) {
                const bar = (musicSt.i / 16) | 0;
                const pos = musicSt.i % 16;
                const block = ((bar / 8) | 0) % 4;
                const ch = CH[bar % CH.length];
                const pat = (block === 2) ? P3 : (bar % 2 ? P2 : P1);
                
                if (musicSt.mode === "tune" && bar >= 32 && pos === 0) toDrift();
                if (musicSt.mode === "drift" && now > musicSt.driftUntil && pos === 0) toTune();
                
                const inSpurt = musicSt.spurtBarsLeft > 0;
                if (musicSt.mode === "drift" && !inSpurt && now > musicSt.spurtAt && pos === 0) {
                    musicSt.spurtBarsLeft = 2 + (musicR() * 3 | 0);
                    musicSt.spurtAt = now + (45 + musicR() * 65);
                }
                if (inSpurt && pos === 0) musicSt.spurtBarsLeft--;
                
                const tune = musicSt.mode === "tune" || inSpurt;
                const vBase = tune ? 0.052 : 0.020;
                const cut = tune ? 1950 : 1450;
                const dens = tune ? 1.00 : 0.28;
                
                if ((pos === 0 || pos === 8) && (tune ? 1 : (musicR() < 0.35))) {
                    musicTone(musicSt.t, ch[0] - 24, step * (tune ? 7 : 10), tune ? 0.033 : 0.014, tune ? 1200 : 950, tune ? 0.10 : 0.06);
                }
                
                if (pos % 2 === 0 && musicR() < dens) {
                    const idx = pat[pos];
                    const lift = (tune && block === 1 && musicR() < 0.10) ? 12 : 0;
                    const sparse = (!tune && (pos === 6 || pos === 14) && musicR() < 0.75);
                    if (!sparse) musicTone(musicSt.t, ch[idx] + lift, step * (tune ? 6 : 10), vBase * (0.85 + musicR() * 0.25), cut, tune ? 0.18 : 0.08);
                }
                
                if (tune && pos === 15 && (bar % 8 === 7) && musicR() < 0.22) {
                    musicTone(musicSt.t + step * 0.5, ch[2] + 12, step * 5, 0.020, 3000, 0.10);
                }
                
                musicSt.t += step;
                musicSt.i++;
                
                if (musicSt.mode === "drift" && musicSt.i % 512 === 0) {
                    musicSeed = (musicSeed + ((Date.now() >>> 0) + musicSt.i)) >>> 0;
                }
            }
        }, 25);
        
        musicSeed = (musicSeed + ((Date.now() | 0) >>> 0)) >>> 0;
    };
    
    /**
     * Stop the music
     */
    PPT.audio.stopMusic = function() {
        if (musicInt) {
            clearInterval(musicInt);
            musicInt = null;
        }
        if (musicOut && audioCtx) {
            try {
                musicOut.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.15);
            } catch(e) {}
        }
    };
    
    /**
     * Toggle sound effects
     */
    PPT.audio.toggleSFX = function() {
        if (!G) return;
        G.sfx = !G.sfx;
        document.getElementById('sfx-btn')?.classList.toggle('muted', !G.sfx);
        if (G.sfx) PPT.audio.playSound('click');
    };
    
    /**
     * Toggle music
     */
    PPT.audio.toggleMusic = function() {
        if (!G) return;
        G.music = !G.music;
        document.getElementById('music-btn')?.classList.toggle('muted', !G.music);
        if (G.music) {
            PPT.audio.startMusic();
        } else {
            PPT.audio.stopMusic();
        }
        PPT.audio.playSound('click');
    };
    
})();
