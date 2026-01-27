/**
 * Pixel Park Tycoon - Rendering System
 * All drawing functions for sprites, icons, and effects
 */

(function() {
    'use strict';
    
    const C = PPT.config.C;
    const TILE_SIZE = PPT.config.TILE_SIZE;
    const GRID_WIDTH = PPT.config.GRID_WIDTH;
    const GRID_HEIGHT = PPT.config.GRID_HEIGHT;
    
    // Canvas contexts (set during init)
    let parkCtx = null;
    let partCtx = null;
    let confCtx = null;
    
    /**
     * Initialize canvas contexts
     */
    PPT.render.init = function(park, particle, confetti) {
        parkCtx = park;
        partCtx = particle;
        confCtx = confetti;
        PPT.ctx.park = park;
        PPT.ctx.particle = particle;
        PPT.ctx.confetti = confetti;
    };
    
    // ==================== HELPER FUNCTIONS ====================
    
    function isPathAt(x, y) {
        if (!G || !G.grid) return false;
        if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return false;
        const c = G.grid[y][x];
        return c && PPT.config.PATH_TYPES.includes(c.type);
    }
    
    function isWaterAt(x, y) {
        if (!G || !G.grid) return false;
        if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return false;
        const c = G.grid[y][x];
        return c && c.type === 'water';
    }
    
    function getDayPart() {
        if (!G) return 'morning';
        return PPT.config.getDayPeriod(G.tick);
    }
    
    function getDayTint() {
        if (!G) return { r: 255, g: 255, b: 255, a: 0 };
        var tpd = PPT.config.TICKS_PER_DAY;
        var p = PPT.config.getPeriodTicks();
        var t = G.tick % tpd;
        
        // Night (early)
        if (t < p.night1End) return { r: 10, g: 10, b: 40, a: 0.55 };
        
        // Dawn transition (night1End to a bit into morning)
        var dawnEnd = p.night1End + Math.floor(tpd * 0.07); // 7% of day for dawn
        if (t < dawnEnd) {
            var dawnProgress = (t - p.night1End) / (dawnEnd - p.night1End);
            return { r: 10, g: 10, b: 40, a: 0.55 * (1 - dawnProgress) };
        }
        
        // Day (morning to afternoon)
        if (t < p.afternoonEnd) return { r: 255, g: 255, b: 255, a: 0 };
        
        // Evening transition
        if (t < p.eveningEnd) {
            var eveningProgress = (t - p.afternoonEnd) / (p.eveningEnd - p.afternoonEnd);
            return {
                r: Math.round(255 - eveningProgress * 245),
                g: Math.round(180 - eveningProgress * 170),
                b: Math.round(120 - eveningProgress * 80),
                a: 0.15 + eveningProgress * 0.4
            };
        }
        
        // Night (late)
        return { r: 10, g: 10, b: 40, a: 0.55 };
    }
    
    // Export helpers
    PPT.render.isPathAt = isPathAt;
    PPT.render.isWaterAt = isWaterAt;
    PPT.render.getDayPart = getDayPart;
    PPT.render.getDayTint = getDayTint;
    
    // ==================== ICON DRAWING ====================
    
    PPT.render.drawIcon = function(ctx, type, sz, hover) {
        if (!ctx) return;
        ctx.clearRect(0, 0, sz, sz);
        const s = sz / 24;
        
        switch(type) {
            case 'speaker':
                const spkColor = sz === 16 && hover ? '#1a1a2e' : C.yellow;
                ctx.fillStyle = spkColor;
                ctx.fillRect(3*s, 8*s, 6*s, 8*s);
                ctx.beginPath(); ctx.moveTo(9*s, 8*s); ctx.lineTo(16*s, 4*s); ctx.lineTo(16*s, 20*s); ctx.lineTo(9*s, 16*s); ctx.fill();
                ctx.strokeStyle = spkColor; ctx.lineWidth = 2*s;
                ctx.beginPath(); ctx.arc(16*s, 12*s, 4*s, -0.5, 0.5); ctx.stroke();
                ctx.beginPath(); ctx.arc(16*s, 12*s, 7*s, -0.5, 0.5); ctx.stroke();
                break;
            case 'music':
                ctx.fillStyle = sz === 16 && hover ? '#1a1a2e' : C.yellow;
                ctx.beginPath(); ctx.ellipse(6*s, 18*s, 4*s, 3*s, -0.3, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(16*s, 16*s, 4*s, 3*s, -0.3, 0, Math.PI*2); ctx.fill();
                ctx.fillRect(9*s, 4*s, 2*s, 14*s); ctx.fillRect(19*s, 4*s, 2*s, 12*s); ctx.fillRect(9*s, 4*s, 12*s, 3*s);
                break;
            case 'pause':
                ctx.fillStyle = sz === 16 && hover ? '#1a1a2e' : C.yellow;
                ctx.fillRect(5*s, 4*s, 5*s, 16*s); ctx.fillRect(14*s, 4*s, 5*s, 16*s);
                break;
            case 'play':
                ctx.fillStyle = sz === 16 && hover ? '#1a1a2e' : C.yellow;
                ctx.beginPath(); ctx.moveTo(6*s, 4*s); ctx.lineTo(20*s, 12*s); ctx.lineTo(6*s, 20*s); ctx.closePath(); ctx.fill();
                break;
            case 'target':
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(12*s, 12*s, 10*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(12*s, 12*s, 8*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(12*s, 12*s, 5*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(12*s, 12*s, 2*s, 0, Math.PI*2); ctx.fill();
                break;
            case 'arrow-up':
                ctx.fillStyle = C.green;
                ctx.beginPath(); ctx.moveTo(12*s, 4*s); ctx.lineTo(20*s, 14*s); ctx.lineTo(15*s, 14*s); ctx.lineTo(15*s, 20*s);
                ctx.lineTo(9*s, 20*s); ctx.lineTo(9*s, 14*s); ctx.lineTo(4*s, 14*s); ctx.fill();
                break;
            case 'coaster':
                ctx.fillStyle = '#8b4513'; ctx.fillRect(3*s, 16*s, 3*s, 6*s); ctx.fillRect(18*s, 10*s, 3*s, 12*s);
                ctx.strokeStyle = C.purple; ctx.lineWidth = 3*s;
                ctx.beginPath(); ctx.moveTo(4*s, 16*s); ctx.quadraticCurveTo(12*s, 0, 20*s, 10*s); ctx.stroke();
                ctx.fillStyle = C.red; ctx.beginPath(); ctx.roundRect(9*s, 4*s, 8*s, 5*s, 2*s); ctx.fill();
                ctx.fillStyle = '#ffd5b8';
                ctx.beginPath(); ctx.arc(11*s, 3*s, 2*s, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(15*s, 3*s, 2*s, 0, Math.PI*2); ctx.fill();
                break;
            case 'path':
                ctx.fillStyle = '#c8bca8'; ctx.fillRect(2*s, 2*s, 20*s, 20*s);
                for (let row = 0; row < 3; row++) {
                    const off = row % 2 ? 2.5 : 0;
                    for (let col = 0; col < 3; col++) {
                        let sx = 2 + col * 7 + off, sw = 6;
                        if (sx + sw > 22) sw = 22 - sx;
                        ctx.fillStyle = '#b8a898';
                        ctx.beginPath(); ctx.roundRect(sx*s, 2*s + row*7*s, sw*s, 6*s, 1.5*s); ctx.fill();
                        ctx.fillStyle = '#d0c4b4'; ctx.fillRect((sx + 0.5)*s, (2.5 + row*7)*s, (sw - 1)*s, 1*s);
                    }
                }
                break;
            case 'asphalt':
                ctx.fillStyle = C.asphalt1; ctx.fillRect(2*s, 2*s, 20*s, 20*s);
                ctx.fillStyle = C.asphalt2;
                for (let i = 0; i < 5; i++) ctx.fillRect((4 + i*4)*s, (4 + i*3 % 8)*s, 2*s, 2*s);
                break;
            case 'wooden-path':
                ctx.fillStyle = C.wood1; ctx.fillRect(2*s, 2*s, 20*s, 20*s);
                for (let i = 0; i < 4; i++) { ctx.fillStyle = C.wood2; ctx.fillRect(2*s, (2 + i*5)*s, 20*s, 1*s); }
                break;
            case 'sand-path':
                ctx.fillStyle = C.sand1; ctx.fillRect(2*s, 2*s, 20*s, 20*s);
                for (let i = 0; i < 8; i++) { ctx.fillStyle = C.sand2; ctx.fillRect((4 + i*2.5)*s, (4 + (i % 3)*5)*s, 2*s, 2*s); }
                break;
            case 'gravel-path':
                ctx.fillStyle = C.gravel1; ctx.fillRect(2*s, 2*s, 20*s, 20*s);
                for (let i = 0; i < 12; i++) {
                    ctx.fillStyle = i % 2 ? C.gravel2 : C.gravel3;
                    ctx.beginPath(); ctx.arc((4 + i*1.6)*s, (6 + (i % 4)*4)*s, 1.5*s, 0, Math.PI*2); ctx.fill();
                }
                break;
            case 'merry-go-round':
                ctx.fillStyle = C.pink;
                ctx.beginPath(); ctx.moveTo(12*s, 2*s); ctx.lineTo(22*s, 12*s); ctx.lineTo(2*s, 12*s); ctx.fill();
                ctx.fillStyle = C.yellow; ctx.fillRect(10*s, 8*s, 4*s, 12*s);
                ctx.fillStyle = C.red; ctx.fillRect(5*s, 14*s, 4*s, 6*s);
                ctx.fillStyle = C.dblue; ctx.fillRect(15*s, 14*s, 4*s, 6*s);
                break;
            case 'ferris-wheel':
                ctx.strokeStyle = C.pink; ctx.lineWidth = 2*s;
                ctx.beginPath(); ctx.arc(12*s, 10*s, 8*s, 0, Math.PI*2); ctx.stroke();
                ctx.fillStyle = C.yellow; ctx.fillRect(10*s, 8*s, 4*s, 4*s);
                ctx.fillStyle = C.red; ctx.fillRect(3*s, 8*s, 3*s, 3*s);
                ctx.fillStyle = C.dblue; ctx.fillRect(18*s, 8*s, 3*s, 3*s);
                ctx.fillStyle = C.green; ctx.fillRect(10*s, 1*s, 3*s, 3*s);
                ctx.fillStyle = C.purple;
                ctx.fillRect(6*s, 18*s, 4*s, 4*s); ctx.fillRect(14*s, 18*s, 4*s, 4*s);
                break;
            case 'spiral-slide':
                ctx.fillStyle = '#666'; ctx.fillRect(5*s, 4*s, 2*s, 16*s); ctx.fillRect(17*s, 4*s, 2*s, 16*s);
                ctx.fillStyle = '#555'; ctx.fillRect(7*s, 6*s, 10*s, 2*s); ctx.fillRect(7*s, 12*s, 10*s, 2*s);
                ctx.fillStyle = C.red; ctx.fillRect(4*s, 2*s, 16*s, 3*s);
                ctx.fillStyle = C.yellow;
                ctx.beginPath(); ctx.moveTo(12*s, 0); ctx.lineTo(20*s, 2*s); ctx.lineTo(4*s, 2*s); ctx.fill();
                ctx.strokeStyle = C.pink; ctx.lineWidth = 2.5*s; ctx.lineCap = 'round';
                ctx.beginPath();
                for (let i = 0; i <= 12; i++) {
                    const t = i / 12, sy = (5 + t*14)*s, a = t*Math.PI*2, r = 3 + t*4, sx = 12*s + Math.cos(a)*r*s;
                    if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
                }
                ctx.stroke();
                break;
            case 'haunted-house':
                ctx.fillStyle = C.haunted; ctx.fillRect(4*s, 8*s, 16*s, 14*s);
                ctx.fillStyle = C.hauntedDark;
                ctx.beginPath(); ctx.moveTo(4*s, 8*s); ctx.lineTo(12*s, 2*s); ctx.lineTo(20*s, 8*s); ctx.fill();
                ctx.fillStyle = C.yellow; ctx.fillRect(7*s, 12*s, 3*s, 3*s); ctx.fillRect(14*s, 12*s, 3*s, 3*s);
                ctx.fillStyle = '#3a2a4a'; ctx.fillRect(10*s, 16*s, 4*s, 6*s);
                break;
            case 'junior-coaster':
                ctx.fillStyle = '#4ecdc4'; ctx.fillRect(4*s, 14*s, 16*s, 4*s);
                ctx.strokeStyle = '#4ecdc4'; ctx.lineWidth = 3*s;
                ctx.beginPath(); ctx.moveTo(4*s, 14*s); ctx.quadraticCurveTo(12*s, 4*s, 20*s, 14*s); ctx.stroke();
                ctx.fillStyle = '#4ecdc4'; ctx.beginPath(); ctx.roundRect(9*s, 5*s, 7*s, 5*s, 2*s); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.fillRect(11*s, 6*s, 3*s, 2*s);
                break;
            case 'steel-coaster':
                ctx.fillStyle = C.purple; ctx.fillRect(2*s, 14*s, 3*s, 8*s); ctx.fillRect(19*s, 10*s, 3*s, 12*s);
                ctx.strokeStyle = C.purple; ctx.lineWidth = 3*s;
                ctx.beginPath(); ctx.moveTo(4*s, 14*s); ctx.quadraticCurveTo(6*s, 2*s, 12*s, 6*s); ctx.stroke();
                ctx.beginPath(); ctx.arc(14*s, 14*s, 5*s, 0, Math.PI*2); ctx.stroke();
                ctx.fillStyle = C.dblue; ctx.beginPath(); ctx.roundRect(9*s, 3*s, 6*s, 4*s, 2*s); ctx.fill();
                break;
            case 'wooden-coaster':
                ctx.fillStyle = '#d9b87c'; ctx.fillRect(2*s, 14*s, 4*s, 8*s); ctx.fillRect(18*s, 8*s, 4*s, 14*s);
                ctx.strokeStyle = '#d9b87c'; ctx.lineWidth = 3*s;
                ctx.beginPath(); ctx.moveTo(4*s, 14*s); ctx.lineTo(10*s, 4*s); ctx.lineTo(15*s, 10*s); ctx.lineTo(20*s, 8*s); ctx.stroke();
                ctx.fillStyle = C.red; ctx.beginPath(); ctx.roundRect(8*s, 2*s, 6*s, 4*s, 1*s); ctx.fill();
                break;
            case 'hyper-coaster':
                ctx.fillStyle = C.orange; ctx.fillRect(2*s, 4*s, 3*s, 18*s); ctx.fillRect(18*s, 14*s, 4*s, 8*s);
                ctx.strokeStyle = C.orange; ctx.lineWidth = 3*s;
                ctx.beginPath(); ctx.moveTo(4*s, 4*s); ctx.lineTo(12*s, 4*s); ctx.quadraticCurveTo(16*s, 4*s, 18*s, 14*s); ctx.stroke();
                ctx.fillStyle = C.red; ctx.beginPath(); ctx.roundRect(8*s, 1*s, 6*s, 4*s, 1*s); ctx.fill();
                break;
            case 'ice-cream':
                ctx.fillStyle = '#f4d4a4';
                ctx.beginPath(); ctx.moveTo(12*s, 22*s); ctx.lineTo(6*s, 10*s); ctx.lineTo(18*s, 10*s); ctx.fill();
                ctx.fillStyle = C.pink; ctx.beginPath(); ctx.arc(12*s, 8*s, 5*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(12*s, 5*s, 4*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = C.red; ctx.fillRect(11*s, 2*s, 2*s, 3*s);
                break;
            case 'soft-drinks':
                ctx.fillStyle = C.red; ctx.fillRect(6*s, 6*s, 12*s, 16*s);
                ctx.fillStyle = '#fff'; ctx.fillRect(8*s, 8*s, 8*s, 4*s);
                ctx.fillStyle = C.yellow; ctx.fillRect(10*s, 2*s, 4*s, 6*s);
                ctx.fillStyle = C.blue; ctx.fillRect(8*s, 14*s, 8*s, 6*s);
                break;
            case 'waffles':
                ctx.fillStyle = '#d4a056'; ctx.fillRect(4*s, 8*s, 16*s, 12*s);
                ctx.fillStyle = '#c49046';
                for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) ctx.fillRect((5 + x*4)*s, (9 + y*4)*s, 3*s, 3*s);
                ctx.fillStyle = '#fff'; ctx.fillRect(8*s, 4*s, 8*s, 6*s);
                ctx.fillStyle = C.red; ctx.fillRect(10*s, 2*s, 4*s, 4*s);
                break;
            case 'burger-joint':
                ctx.fillStyle = '#8B4513'; ctx.fillRect(4*s, 12*s, 16*s, 10*s);
                ctx.fillStyle = '#a05a2c'; ctx.fillRect(6*s, 14*s, 12*s, 6*s);
                for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? C.yellow : C.red; ctx.fillRect((4 + i*4)*s, 8*s, 4*s, 6*s); }
                ctx.fillStyle = '#d4a056'; ctx.beginPath(); ctx.arc(12*s, 4*s, 4*s, Math.PI, 0); ctx.fill();
                ctx.fillStyle = C.green; ctx.fillRect(8*s, 4*s, 8*s, 2*s);
                ctx.fillStyle = '#8B4513'; ctx.fillRect(8*s, 5*s, 8*s, 2*s);
                ctx.fillStyle = '#d4a056'; ctx.fillRect(8*s, 7*s, 8*s, 2*s);
                break;
            case 'bush':
                ctx.fillStyle = 'rgba(0,40,20,0.25)';
                ctx.beginPath(); ctx.ellipse(12*s, 18*s, 9*s, 4*s, 0, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = C.bush2;
                ctx.beginPath(); ctx.arc(8*s, 14*s, 5*s, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(16*s, 14*s, 5*s, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(12*s, 15*s, 6*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = C.bush1;
                ctx.beginPath(); ctx.arc(7*s, 11*s, 4*s, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(12*s, 12*s, 5*s, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(17*s, 11*s, 4*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = C.bush4;
                ctx.beginPath(); ctx.arc(10*s, 8*s, 4*s, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(14*s, 8*s, 4*s, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(12*s, 6*s, 3*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#8fd9a8'; ctx.fillRect(9*s, 6*s, 2*s, 2*s); ctx.fillRect(14*s, 5*s, 2*s, 2*s);
                break;
            case 'hedge':
                ctx.fillStyle = C.hedge1; ctx.beginPath(); ctx.roundRect(4*s, 8*s, 16*s, 14*s, 3*s); ctx.fill();
                ctx.fillStyle = C.hedge2; ctx.beginPath(); ctx.roundRect(6*s, 6*s, 12*s, 12*s, 3*s); ctx.fill();
                ctx.fillStyle = C.hedge3; ctx.fillRect(8*s, 10*s, 2*s, 2*s); ctx.fillRect(14*s, 10*s, 2*s, 2*s);
                break;
            case 'flowers':
                const flCols = [C.pink, C.yellow, C.blue, C.purple];
                for (let fi = 0; fi < 4; fi++) {
                    const flx = 5*s + (fi % 2)*9*s, fly = 6*s + Math.floor(fi / 2)*9*s;
                    ctx.fillStyle = flCols[fi];
                    for (let p = 0; p < 5; p++) {
                        const pa = p * Math.PI * 2 / 5 - Math.PI / 2;
                        ctx.beginPath(); ctx.arc(flx + Math.cos(pa)*3*s, fly + Math.sin(pa)*3*s, 2*s, 0, Math.PI*2); ctx.fill();
                    }
                    ctx.fillStyle = C.yellow; ctx.beginPath(); ctx.arc(flx, fly, 1.5*s, 0, Math.PI*2); ctx.fill();
                }
                break;
            case 'tree-oak':
                ctx.fillStyle = C.trunk; ctx.fillRect(10*s, 14*s, 4*s, 8*s);
                ctx.fillStyle = C.tree1; ctx.beginPath(); ctx.arc(12*s, 10*s, 8*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = C.tree3; ctx.beginPath(); ctx.arc(12*s, 8*s, 6*s, 0, Math.PI*2); ctx.fill();
                break;
            case 'tree-pine':
                ctx.fillStyle = '#7d5c4a'; ctx.fillRect(11*s, 17*s, 2*s, 5*s);
                ctx.fillStyle = C.tree1;
                ctx.beginPath(); ctx.moveTo(12*s, 3*s); ctx.quadraticCurveTo(22*s, 12*s, 12*s, 17*s); ctx.quadraticCurveTo(2*s, 12*s, 12*s, 3*s); ctx.fill();
                ctx.fillStyle = C.tree2;
                ctx.beginPath(); ctx.moveTo(12*s, 5*s); ctx.quadraticCurveTo(19*s, 10*s, 12*s, 14*s); ctx.quadraticCurveTo(5*s, 10*s, 12*s, 5*s); ctx.fill();
                ctx.fillStyle = C.tree3;
                ctx.beginPath(); ctx.moveTo(12*s, 7*s); ctx.quadraticCurveTo(17*s, 10*s, 12*s, 12*s); ctx.quadraticCurveTo(7*s, 10*s, 12*s, 7*s); ctx.fill();
                break;
            case 'tree-cherry':
                ctx.fillStyle = C.trunk; ctx.fillRect(10*s, 14*s, 4*s, 8*s);
                ctx.fillStyle = '#ffb7c5'; ctx.beginPath(); ctx.arc(12*s, 10*s, 8*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#ffd9e6'; ctx.beginPath(); ctx.arc(12*s, 8*s, 5*s, 0, Math.PI*2); ctx.fill();
                break;
            case 'fountain':
                ctx.fillStyle = C.purple; ctx.fillRect(4*s, 16*s, 16*s, 6*s);
                ctx.fillStyle = C.water1; ctx.fillRect(6*s, 18*s, 12*s, 3*s);
                ctx.fillStyle = '#b3e5fc'; ctx.fillRect(10*s, 8*s, 4*s, 10*s); ctx.fillRect(8*s, 4*s, 8*s, 6*s);
                break;
            case 'tiles':
                ctx.fillStyle = C.path1; ctx.fillRect(2*s, 2*s, 20*s, 20*s);
                ctx.strokeStyle = C.path3; ctx.lineWidth = 1*s;
                for (let ty = 0; ty < 4; ty++) {
                    ctx.beginPath(); ctx.moveTo(2*s, 2*s + ty*5*s); ctx.lineTo(22*s, 2*s + ty*5*s); ctx.stroke();
                    const off = ty % 2 ? 2.5*s : 0;
                    for (let tx = 0; tx < 4; tx++) {
                        ctx.beginPath(); ctx.moveTo(2*s + tx*5*s + off, 2*s + ty*5*s); ctx.lineTo(2*s + tx*5*s + off, 2*s + ty*5*s + 5*s); ctx.stroke();
                    }
                }
                break;
            case 'pirate-ship':
                ctx.fillStyle = '#8b4513'; ctx.fillRect(4*s, 12*s, 16*s, 6*s);
                ctx.fillStyle = '#654321'; ctx.fillRect(10*s, 4*s, 4*s, 10*s);
                ctx.fillStyle = '#222';
                ctx.beginPath(); ctx.moveTo(14*s, 4*s); ctx.lineTo(22*s, 10*s); ctx.lineTo(14*s, 10*s); ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.arc(6*s, 18*s, 4*s, Math.PI, 0); ctx.fill();
                ctx.beginPath(); ctx.arc(18*s, 18*s, 4*s, Math.PI, 0); ctx.fill();
                break;
            case 'observation-tower':
                ctx.fillStyle = '#666'; ctx.fillRect(10*s, 8*s, 4*s, 14*s);
                ctx.fillStyle = '#888'; ctx.fillRect(6*s, 4*s, 12*s, 6*s);
                ctx.fillStyle = C.blue; ctx.fillRect(7*s, 5*s, 4*s, 4*s); ctx.fillRect(13*s, 5*s, 4*s, 4*s);
                ctx.fillStyle = C.red; ctx.fillRect(8*s, 2*s, 8*s, 3*s);
                break;
            case 'wild-mouse':
                ctx.fillStyle = '#ff69b4'; ctx.fillRect(4*s, 16*s, 16*s, 4*s);
                ctx.strokeStyle = '#ff69b4'; ctx.lineWidth = 3*s;
                ctx.beginPath(); ctx.moveTo(4*s, 16*s); ctx.lineTo(8*s, 8*s); ctx.lineTo(16*s, 8*s); ctx.lineTo(20*s, 16*s); ctx.stroke();
                ctx.fillStyle = '#ff69b4'; ctx.beginPath(); ctx.roundRect(10*s, 5*s, 6*s, 5*s, 2*s); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.fillRect(12*s, 6*s, 2*s, 2*s);
                break;
            case 'giga-coaster':
                ctx.fillStyle = '#00ced1'; ctx.fillRect(2*s, 2*s, 4*s, 20*s); ctx.fillRect(18*s, 10*s, 4*s, 12*s);
                ctx.strokeStyle = '#00ced1'; ctx.lineWidth = 3*s;
                ctx.beginPath(); ctx.moveTo(4*s, 2*s); ctx.lineTo(12*s, 2*s); ctx.quadraticCurveTo(18*s, 2*s, 20*s, 10*s); ctx.stroke();
                ctx.fillStyle = C.red; ctx.beginPath(); ctx.roundRect(6*s, 0*s, 6*s, 4*s, 1*s); ctx.fill();
                break;
            case 'cotton-candy':
                ctx.fillStyle = '#deb887'; ctx.fillRect(10*s, 12*s, 4*s, 10*s);
                ctx.fillStyle = '#ffb6c1'; ctx.beginPath(); ctx.arc(12*s, 8*s, 7*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#ffc0cb';
                ctx.beginPath(); ctx.arc(10*s, 6*s, 4*s, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(14*s, 10*s, 4*s, 0, Math.PI*2); ctx.fill();
                break;
            case 'coffee-stand':
                ctx.fillStyle = '#8b4513'; ctx.fillRect(4*s, 10*s, 16*s, 12*s);
                ctx.fillStyle = '#654321'; ctx.fillRect(6*s, 12*s, 12*s, 8*s);
                ctx.fillStyle = '#fff'; ctx.fillRect(8*s, 6*s, 8*s, 6*s);
                ctx.fillStyle = '#8b4513'; ctx.fillRect(10*s, 8*s, 4*s, 3*s);
                ctx.fillStyle = C.orange; ctx.fillRect(8*s, 4*s, 8*s, 3*s);
                break;
            case 'water':
                ctx.fillStyle = C.water1; ctx.beginPath(); ctx.roundRect(4*s, 4*s, 16*s, 16*s, 4*s); ctx.fill();
                ctx.fillStyle = C.water2; ctx.beginPath(); ctx.roundRect(6*s, 6*s, 12*s, 12*s, 3*s); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.5;
                ctx.fillRect(8*s, 8*s, 3*s, 2*s); ctx.fillRect(14*s, 12*s, 2*s, 2*s);
                ctx.globalAlpha = 1;
                break;
            case 'statue':
                ctx.fillStyle = '#a0a0a0'; ctx.fillRect(8*s, 16*s, 8*s, 6*s);
                ctx.fillStyle = '#b0b0b0'; ctx.fillRect(10*s, 8*s, 4*s, 8*s);
                ctx.beginPath(); ctx.arc(12*s, 6*s, 4*s, 0, Math.PI*2); ctx.fill();
                ctx.fillRect(6*s, 10*s, 4*s, 2*s); ctx.fillRect(14*s, 10*s, 4*s, 2*s);
                break;
            case 'hammer':
                ctx.fillStyle = '#9b6a3b'; ctx.fillRect(10*s, 8*s, 4*s, 14*s);
                ctx.fillStyle = '#666'; ctx.fillRect(6*s, 2*s, 12*s, 8*s);
                ctx.fillStyle = '#888'; ctx.fillRect(8*s, 4*s, 8*s, 4*s);
                break;
            case 'demolish':
                ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 3*s; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(6*s, 6*s); ctx.lineTo(18*s, 18*s); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(18*s, 6*s); ctx.lineTo(6*s, 18*s); ctx.stroke();
                break;
            case 'trophy':
                ctx.fillStyle = C.yellow;
                ctx.fillRect(8*s, 4*s, 8*s, 10*s); ctx.fillRect(4*s, 4*s, 6*s, 6*s); ctx.fillRect(14*s, 4*s, 6*s, 6*s);
                ctx.fillRect(10*s, 14*s, 4*s, 4*s); ctx.fillRect(6*s, 18*s, 12*s, 4*s);
                ctx.fillStyle = '#ffa500'; ctx.fillRect(10*s, 6*s, 4*s, 6*s);
                break;
            case 'lightbulb':
                ctx.fillStyle = C.yellow; ctx.beginPath(); ctx.arc(12*s, 10*s, 7*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(12*s, 9*s, 4*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#888'; ctx.fillRect(9*s, 17*s, 6*s, 5*s);
                break;
            case 'warning':
                ctx.fillStyle = C.orange;
                ctx.beginPath(); ctx.moveTo(12*s, 2*s); ctx.lineTo(22*s, 20*s); ctx.lineTo(2*s, 20*s); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.fillRect(10*s, 8*s, 4*s, 6*s); ctx.fillRect(10*s, 16*s, 4*s, 3*s);
                break;
            case 'error':
                ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(12*s, 12*s, 10*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.fillRect(6*s, 10*s, 12*s, 4*s);
                break;
            case 'coin':
                ctx.fillStyle = C.yellow; ctx.beginPath(); ctx.arc(12*s, 12*s, 9*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = C.orange; ctx.beginPath(); ctx.arc(12*s, 12*s, 6*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.fillRect(10*s, 8*s, 4*s, 8*s); ctx.fillRect(8*s, 10*s, 8*s, 4*s);
                break;
            case 'guest':
                ctx.fillStyle = C.pink; ctx.beginPath(); ctx.roundRect(6*s, 8*s, 12*s, 12*s, 4*s); ctx.fill();
                ctx.fillStyle = '#ffd5b8'; ctx.beginPath(); ctx.arc(12*s, 6*s, 5*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#1a1a2e'; ctx.fillRect(9*s, 4*s, 2*s, 2*s); ctx.fillRect(13*s, 4*s, 2*s, 2*s);
                ctx.fillStyle = C.pink; ctx.fillRect(10*s, 7*s, 4*s, 2*s);
                ctx.fillStyle = '#6c5043'; ctx.beginPath(); ctx.ellipse(12*s, 3*s, 5*s, 2*s, 0, 0, Math.PI*2); ctx.fill();
                break;
            case 'sun':
                ctx.fillStyle = C.orange; ctx.beginPath(); ctx.arc(12*s, 12*s, 6*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = C.yellow; ctx.beginPath(); ctx.arc(12*s, 12*s, 4*s, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = C.yellow; ctx.lineWidth = s;
                for (let i = 0; i < 8; i++) {
                    const a = i * Math.PI / 4;
                    ctx.beginPath(); ctx.moveTo(12*s + Math.cos(a)*7*s, 12*s + Math.sin(a)*7*s);
                    ctx.lineTo(12*s + Math.cos(a)*10*s, 12*s + Math.sin(a)*10*s); ctx.stroke();
                }
                break;
            case 'moon':
                ctx.fillStyle = '#fffde7'; ctx.beginPath(); ctx.arc(12*s, 12*s, 7*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#1a1a3a'; ctx.beginPath(); ctx.arc(16*s, 10*s, 5*s, 0, Math.PI*2); ctx.fill();
                break;
        }
    };
    
    // ==================== SPRITE DRAWING ====================
    
    function drawGrass(x, y) {
        const l = (x + y) % 2 === 0;
        parkCtx.fillStyle = l ? C.grass1 : C.grass2;
        parkCtx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        for (let i = 0; i < 4; i++) {
            const gx = x * TILE_SIZE + (Math.sin(x * 7 + y * 11 + i * 13) * 0.5 + 0.5) * 28;
            const gy = y * TILE_SIZE + (Math.cos(x * 11 + y * 7 + i * 17) * 0.5 + 0.5) * 26 + 4;
            const sw = G.paused ? 0 : Math.sin(G.frame * 0.015 + x + y + i) * 0.5;
            parkCtx.fillStyle = i % 2 ? C.grassDark : C.grassLight;
            parkCtx.fillRect(gx + sw, gy, 2, 3);
        }
    }
    
    function drawTree(x, y, type) {
        const c = G.grid[y][x], sw = G.paused ? 0 : Math.sin(G.frame * 0.008 + (c.sway || 0)) * 1.5;
        parkCtx.fillStyle = 'rgba(0,40,20,0.25)';
        parkCtx.beginPath(); parkCtx.ellipse(x * TILE_SIZE + 16 + sw * 0.3, y * TILE_SIZE + 30, 12, 4, 0, 0, Math.PI * 2); parkCtx.fill();
        parkCtx.fillStyle = C.trunk; parkCtx.fillRect(x * TILE_SIZE + 12, y * TILE_SIZE + 18, 8, 14);
        if (type === 'tree-oak') {
            parkCtx.fillStyle = C.tree1; parkCtx.beginPath(); parkCtx.ellipse(x * TILE_SIZE + 16 + sw, y * TILE_SIZE + 14, 14, 12, 0, 0, Math.PI * 2); parkCtx.fill();
            parkCtx.fillStyle = C.tree2;
            parkCtx.beginPath(); parkCtx.ellipse(x * TILE_SIZE + 10 + sw * 0.8, y * TILE_SIZE + 10, 10, 9, 0, 0, Math.PI * 2); parkCtx.fill();
            parkCtx.beginPath(); parkCtx.ellipse(x * TILE_SIZE + 22 + sw * 0.8, y * TILE_SIZE + 10, 10, 9, 0, 0, Math.PI * 2); parkCtx.fill();
            parkCtx.fillStyle = C.tree3; parkCtx.beginPath(); parkCtx.ellipse(x * TILE_SIZE + 16 + sw * 0.5, y * TILE_SIZE + 6, 11, 9, 0, 0, Math.PI * 2); parkCtx.fill();
        } else if (type === 'tree-pine') {
            parkCtx.fillStyle = '#7d5c4a'; parkCtx.fillRect(x * TILE_SIZE + 14, y * TILE_SIZE + 22, 4, 10);
            for (let i = 0; i < 4; i++) {
                const lw = 36 - i * 7, lx = x * TILE_SIZE + 16 - lw / 2 + sw * (1 - i * 0.2), ly = y * TILE_SIZE + 24 - i * 6;
                parkCtx.fillStyle = i % 2 ? C.tree1 : C.tree2;
                parkCtx.beginPath(); parkCtx.moveTo(lx + lw / 2, ly - 6); parkCtx.quadraticCurveTo(lx + lw + 4, ly + 3, lx + lw / 2, ly + 6);
                parkCtx.quadraticCurveTo(lx - 4, ly + 3, lx + lw / 2, ly - 6); parkCtx.fill();
            }
            parkCtx.fillStyle = C.tree3;
            parkCtx.beginPath(); parkCtx.moveTo(x * TILE_SIZE + 16 + sw * 0.3, y * TILE_SIZE + 2);
            parkCtx.quadraticCurveTo(x * TILE_SIZE + 28, y * TILE_SIZE + 10, x * TILE_SIZE + 16, y * TILE_SIZE + 12);
            parkCtx.quadraticCurveTo(x * TILE_SIZE + 4, y * TILE_SIZE + 10, x * TILE_SIZE + 16 + sw * 0.3, y * TILE_SIZE + 2); parkCtx.fill();
        } else {
            parkCtx.fillStyle = '#ffb7c5'; parkCtx.beginPath(); parkCtx.ellipse(x * TILE_SIZE + 16 + sw, y * TILE_SIZE + 12, 15, 13, 0, 0, Math.PI * 2); parkCtx.fill();
            parkCtx.fillStyle = '#ffc8d6';
            parkCtx.beginPath(); parkCtx.ellipse(x * TILE_SIZE + 10 + sw * 0.7, y * TILE_SIZE + 8, 11, 10, 0, 0, Math.PI * 2); parkCtx.fill();
            parkCtx.beginPath(); parkCtx.ellipse(x * TILE_SIZE + 22 + sw * 0.7, y * TILE_SIZE + 8, 11, 10, 0, 0, Math.PI * 2); parkCtx.fill();
            parkCtx.fillStyle = '#ffd9e6'; parkCtx.beginPath(); parkCtx.ellipse(x * TILE_SIZE + 16 + sw * 0.4, y * TILE_SIZE + 4, 10, 8, 0, 0, Math.PI * 2); parkCtx.fill();
        }
    }
    
    function drawPathTile(x, y, c1, detail) {
        const hT = isPathAt(x, y - 1), hB = isPathAt(x, y + 1), hL = isPathAt(x - 1, y), hR = isPathAt(x + 1, y);
        parkCtx.fillStyle = c1; parkCtx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        const r = 6;
        if (!hT && !hL) { parkCtx.fillStyle = C.grass1; parkCtx.fillRect(x * TILE_SIZE, y * TILE_SIZE, r, r); parkCtx.fillStyle = c1; parkCtx.beginPath(); parkCtx.arc(x * TILE_SIZE + r, y * TILE_SIZE + r, r, Math.PI, Math.PI * 1.5); parkCtx.lineTo(x * TILE_SIZE + r, y * TILE_SIZE); parkCtx.lineTo(x * TILE_SIZE, y * TILE_SIZE + r); parkCtx.fill(); }
        if (!hT && !hR) { parkCtx.fillStyle = C.grass1; parkCtx.fillRect(x * TILE_SIZE + TILE_SIZE - r, y * TILE_SIZE, r, r); parkCtx.fillStyle = c1; parkCtx.beginPath(); parkCtx.arc(x * TILE_SIZE + TILE_SIZE - r, y * TILE_SIZE + r, r, Math.PI * 1.5, 0); parkCtx.lineTo(x * TILE_SIZE + TILE_SIZE, y * TILE_SIZE + r); parkCtx.lineTo(x * TILE_SIZE + TILE_SIZE - r, y * TILE_SIZE); parkCtx.fill(); }
        if (!hB && !hL) { parkCtx.fillStyle = C.grass1; parkCtx.fillRect(x * TILE_SIZE, y * TILE_SIZE + TILE_SIZE - r, r, r); parkCtx.fillStyle = c1; parkCtx.beginPath(); parkCtx.arc(x * TILE_SIZE + r, y * TILE_SIZE + TILE_SIZE - r, r, Math.PI * 0.5, Math.PI); parkCtx.lineTo(x * TILE_SIZE, y * TILE_SIZE + TILE_SIZE - r); parkCtx.lineTo(x * TILE_SIZE + r, y * TILE_SIZE + TILE_SIZE); parkCtx.fill(); }
        if (!hB && !hR) { parkCtx.fillStyle = C.grass1; parkCtx.fillRect(x * TILE_SIZE + TILE_SIZE - r, y * TILE_SIZE + TILE_SIZE - r, r, r); parkCtx.fillStyle = c1; parkCtx.beginPath(); parkCtx.arc(x * TILE_SIZE + TILE_SIZE - r, y * TILE_SIZE + TILE_SIZE - r, r, 0, Math.PI * 0.5); parkCtx.lineTo(x * TILE_SIZE + TILE_SIZE - r, y * TILE_SIZE + TILE_SIZE); parkCtx.lineTo(x * TILE_SIZE + TILE_SIZE, y * TILE_SIZE + TILE_SIZE - r); parkCtx.fill(); }
        if (detail) detail(x, y);
    }
    
    function drawPath(x, y) {
        drawPathTile(x, y, '#c8bca8', (x, y) => {
            for (let row = 0; row < 4; row++) {
                const sy = row * 8;
                if (row % 2 === 0) {
                    for (let col = 0; col < 4; col++) {
                        const sx = col * 8;
                        parkCtx.fillStyle = '#b8a898'; parkCtx.beginPath(); parkCtx.roundRect(x * TILE_SIZE + sx, y * TILE_SIZE + sy, 7, 7, 2); parkCtx.fill();
                        parkCtx.fillStyle = '#d0c4b4'; parkCtx.fillRect(x * TILE_SIZE + sx + 1, y * TILE_SIZE + sy + 1, 5, 1);
                        parkCtx.fillStyle = '#a09080'; parkCtx.fillRect(x * TILE_SIZE + sx + 1, y * TILE_SIZE + sy + 5, 5, 1);
                    }
                } else {
                    parkCtx.fillStyle = '#b8a898'; parkCtx.fillRect(x * TILE_SIZE, y * TILE_SIZE + sy, 3, 7);
                    parkCtx.fillStyle = '#d0c4b4'; parkCtx.fillRect(x * TILE_SIZE, y * TILE_SIZE + sy + 1, 2, 1);
                    parkCtx.fillStyle = '#a09080'; parkCtx.fillRect(x * TILE_SIZE, y * TILE_SIZE + sy + 5, 2, 1);
                    for (let col = 0; col < 3; col++) {
                        const sx = 4 + col * 8;
                        parkCtx.fillStyle = '#b8a898'; parkCtx.beginPath(); parkCtx.roundRect(x * TILE_SIZE + sx, y * TILE_SIZE + sy, 7, 7, 2); parkCtx.fill();
                        parkCtx.fillStyle = '#d0c4b4'; parkCtx.fillRect(x * TILE_SIZE + sx + 1, y * TILE_SIZE + sy + 1, 5, 1);
                        parkCtx.fillStyle = '#a09080'; parkCtx.fillRect(x * TILE_SIZE + sx + 1, y * TILE_SIZE + sy + 5, 5, 1);
                    }
                    parkCtx.fillStyle = '#b8a898'; parkCtx.fillRect(x * TILE_SIZE + 28, y * TILE_SIZE + sy, 4, 7);
                    parkCtx.fillStyle = '#d0c4b4'; parkCtx.fillRect(x * TILE_SIZE + 29, y * TILE_SIZE + sy + 1, 2, 1);
                    parkCtx.fillStyle = '#a09080'; parkCtx.fillRect(x * TILE_SIZE + 29, y * TILE_SIZE + sy + 5, 2, 1);
                }
            }
        });
    }
    
    function drawAsphalt(x, y) { drawPathTile(x, y, C.asphalt1, (x, y) => { parkCtx.fillStyle = C.asphalt2; for (let i = 0; i < 6; i++) parkCtx.fillRect(x * TILE_SIZE + 4 + (i % 3) * 10, y * TILE_SIZE + 4 + Math.floor(i / 3) * 14, 3, 3); parkCtx.strokeStyle = C.asphalt3; parkCtx.lineWidth = 2; parkCtx.setLineDash([4, 4]); parkCtx.beginPath(); parkCtx.moveTo(x * TILE_SIZE + 16, y * TILE_SIZE); parkCtx.lineTo(x * TILE_SIZE + 16, y * TILE_SIZE + 32); parkCtx.stroke(); parkCtx.setLineDash([]); }); }
    function drawWoodenPath(x, y) { drawPathTile(x, y, C.wood1, (x, y) => { for (let i = 0; i < 4; i++) { parkCtx.fillStyle = C.wood2; parkCtx.fillRect(x * TILE_SIZE, y * TILE_SIZE + i * 8, TILE_SIZE, 2); parkCtx.fillStyle = C.wood3; for (let j = 0; j < 3; j++) parkCtx.fillRect(x * TILE_SIZE + 2 + j * 10, y * TILE_SIZE + i * 8 + 3, 8, 1); } }); }
    function drawSandPath(x, y) { drawPathTile(x, y, C.sand1, (x, y) => { for (let i = 0; i < 10; i++) { parkCtx.fillStyle = C.sand2; parkCtx.fillRect(x * TILE_SIZE + (Math.sin(i * 47) * 0.5 + 0.5) * 26, y * TILE_SIZE + (Math.cos(i * 31) * 0.5 + 0.5) * 26, 3, 3); } }); }
    function drawGravelPath(x, y) { drawPathTile(x, y, C.gravel1, (x, y) => { for (let i = 0; i < 16; i++) { parkCtx.fillStyle = i % 2 ? C.gravel2 : C.gravel3; parkCtx.beginPath(); parkCtx.arc(x * TILE_SIZE + 4 + (i % 4) * 7, y * TILE_SIZE + 4 + Math.floor(i / 4) * 7, 2 + (i % 3), 0, Math.PI * 2); parkCtx.fill(); } }); }
    function drawTiles(x, y) { parkCtx.fillStyle = C.path1; parkCtx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE); parkCtx.strokeStyle = C.path3; parkCtx.lineWidth = 1; for (let ty = 0; ty < 4; ty++) { parkCtx.beginPath(); parkCtx.moveTo(x * TILE_SIZE, y * TILE_SIZE + ty * 8); parkCtx.lineTo(x * TILE_SIZE + TILE_SIZE, y * TILE_SIZE + ty * 8); parkCtx.stroke(); const off = ty % 2 ? 4 : 0; for (let tx = 0; tx < 4; tx++) { parkCtx.beginPath(); parkCtx.moveTo(x * TILE_SIZE + tx * 8 + off, y * TILE_SIZE + ty * 8); parkCtx.lineTo(x * TILE_SIZE + tx * 8 + off, y * TILE_SIZE + ty * 8 + 8); parkCtx.stroke(); } } }
    function drawEntrance(x, y) {
        parkCtx.fillStyle = C.purple; parkCtx.beginPath(); parkCtx.roundRect(x * TILE_SIZE, y * TILE_SIZE - 16, 8, 48, 3); parkCtx.fill(); parkCtx.beginPath(); parkCtx.roundRect(x * TILE_SIZE + 24, y * TILE_SIZE - 16, 8, 48, 3); parkCtx.fill();
        parkCtx.fillStyle = C.pink; parkCtx.beginPath(); parkCtx.roundRect(x * TILE_SIZE, y * TILE_SIZE - 20, 32, 8, 4); parkCtx.fill();
        parkCtx.fillStyle = C.yellow; parkCtx.beginPath(); parkCtx.roundRect(x * TILE_SIZE + 2, y * TILE_SIZE - 18, 28, 4, 2); parkCtx.fill();
        parkCtx.fillStyle = '#fff'; parkCtx.font = '7px "Press Start 2P"'; parkCtx.fillText('PARK', x * TILE_SIZE + 3, y * TILE_SIZE - 10);
        var on = getDayPart() === 'evening' || getDayPart() === 'night';
        parkCtx.fillStyle = on ? C.yellow : '#887700'; parkCtx.beginPath(); parkCtx.arc(x * TILE_SIZE + 4, y * TILE_SIZE - 20, 3, 0, Math.PI * 2); parkCtx.fill(); parkCtx.beginPath(); parkCtx.arc(x * TILE_SIZE + 28, y * TILE_SIZE - 20, 3, 0, Math.PI * 2); parkCtx.fill();
        drawTiles(x, y);
    }
    
    // Rides and attractions
    function drawMerryGoRound(x, y) { const f = G.paused ? 0 : G.frame; drawGrass(x, y); parkCtx.fillStyle = C.pink; parkCtx.beginPath(); parkCtx.moveTo(x * TILE_SIZE + 16, y * TILE_SIZE + 4); parkCtx.lineTo(x * TILE_SIZE + 30, y * TILE_SIZE + 14); parkCtx.lineTo(x * TILE_SIZE + 2, y * TILE_SIZE + 14); parkCtx.fill(); parkCtx.fillStyle = C.yellow; parkCtx.fillRect(x * TILE_SIZE + 12, y * TILE_SIZE + 10, 8, 16); const cols = [C.red, C.dblue, C.green, C.purple], angs = [0, Math.PI / 2, Math.PI, Math.PI * 1.5]; for (let i = 0; i < 4; i++) { const a = angs[i] + f * 0.03, hx = x * TILE_SIZE + 16 + Math.cos(a) * 10, hy = y * TILE_SIZE + 20 + Math.sin(a) * 4; parkCtx.fillStyle = cols[i]; parkCtx.beginPath(); parkCtx.roundRect(hx - 3, hy - 2, 6, 8, 2); parkCtx.fill(); } }
    function drawFerrisWheel(x, y) { const f = G.paused ? 0 : G.frame; drawGrass(x, y); parkCtx.fillStyle = C.pink; parkCtx.fillRect(x * TILE_SIZE + 6, y * TILE_SIZE + 22, 4, 10); parkCtx.fillRect(x * TILE_SIZE + 22, y * TILE_SIZE + 22, 4, 10); parkCtx.strokeStyle = C.pink; parkCtx.lineWidth = 3; parkCtx.beginPath(); parkCtx.arc(x * TILE_SIZE + 16, y * TILE_SIZE + 14, 12, 0, Math.PI * 2); parkCtx.stroke(); const cols = [C.red, C.dblue, C.yellow, C.green, C.purple, C.orange]; for (let i = 0; i < 6; i++) { const a = (f * 0.02 + i / 6) * Math.PI * 2, gx = x * TILE_SIZE + 16 + Math.cos(a) * 12, gy = y * TILE_SIZE + 14 + Math.sin(a) * 12; parkCtx.strokeStyle = C.pink; parkCtx.lineWidth = 1; parkCtx.beginPath(); parkCtx.moveTo(x * TILE_SIZE + 16, y * TILE_SIZE + 14); parkCtx.lineTo(gx, gy); parkCtx.stroke(); const sw = Math.sin(f * 0.03 + i); parkCtx.fillStyle = cols[i]; parkCtx.beginPath(); parkCtx.roundRect(gx - 4 + sw, gy, 8, 6, 2); parkCtx.fill(); } parkCtx.fillStyle = C.yellow; parkCtx.beginPath(); parkCtx.arc(x * TILE_SIZE + 16, y * TILE_SIZE + 14, 4, 0, Math.PI * 2); parkCtx.fill(); }
    function drawSpiralSlide(x, y) { const f = G.paused ? 0 : G.frame; drawGrass(x, y); parkCtx.fillStyle = '#666'; parkCtx.fillRect(x * TILE_SIZE + 6, y * TILE_SIZE + 4, 3, 26); parkCtx.fillRect(x * TILE_SIZE + 23, y * TILE_SIZE + 4, 3, 26); parkCtx.fillStyle = '#555'; parkCtx.fillRect(x * TILE_SIZE + 9, y * TILE_SIZE + 8, 14, 2); parkCtx.fillRect(x * TILE_SIZE + 9, y * TILE_SIZE + 16, 14, 2); parkCtx.fillStyle = C.red; parkCtx.fillRect(x * TILE_SIZE + 5, y * TILE_SIZE + 2, 22, 4); parkCtx.fillStyle = C.yellow; parkCtx.beginPath(); parkCtx.moveTo(x * TILE_SIZE + 16, y * TILE_SIZE); parkCtx.lineTo(x * TILE_SIZE + 26, y * TILE_SIZE + 2); parkCtx.lineTo(x * TILE_SIZE + 6, y * TILE_SIZE + 2); parkCtx.fill(); parkCtx.strokeStyle = C.pink; parkCtx.lineWidth = 4; parkCtx.lineCap = 'round'; parkCtx.beginPath(); for (let i = 0; i <= 25; i++) { const t = i / 25, sy = (6 + t * 22), a = t * Math.PI * 5, r = 3 + t * 6, sx = 16 + Math.cos(a) * r; if (i === 0) parkCtx.moveTo(x * TILE_SIZE + sx, y * TILE_SIZE + sy); else parkCtx.lineTo(x * TILE_SIZE + sx, y * TILE_SIZE + sy); } parkCtx.stroke(); parkCtx.strokeStyle = '#ffb0c8'; parkCtx.lineWidth = 2; parkCtx.beginPath(); for (let i = 0; i <= 25; i++) { const t = i / 25, sy = (6 + t * 22), a = t * Math.PI * 5, r = 2 + t * 5, sx = 16 + Math.cos(a) * r; if (i === 0) parkCtx.moveTo(x * TILE_SIZE + sx, y * TILE_SIZE + sy); else parkCtx.lineTo(x * TILE_SIZE + sx, y * TILE_SIZE + sy); } parkCtx.stroke(); parkCtx.fillStyle = C.pink; parkCtx.beginPath(); parkCtx.roundRect(x * TILE_SIZE + 20, y * TILE_SIZE + 26, 10, 4, 2); parkCtx.fill(); }
    function drawHauntedHouse(x, y) { drawGrass(x, y); parkCtx.fillStyle = C.haunted; parkCtx.fillRect(x * TILE_SIZE + 4, y * TILE_SIZE + 10, 24, 20); parkCtx.fillStyle = C.hauntedDark; parkCtx.beginPath(); parkCtx.moveTo(x * TILE_SIZE + 4, y * TILE_SIZE + 10); parkCtx.lineTo(x * TILE_SIZE + 16, y * TILE_SIZE + 2); parkCtx.lineTo(x * TILE_SIZE + 28, y * TILE_SIZE + 10); parkCtx.fill(); parkCtx.fillStyle = C.yellow; parkCtx.fillRect(x * TILE_SIZE + 8, y * TILE_SIZE + 14, 4, 4); parkCtx.fillRect(x * TILE_SIZE + 20, y * TILE_SIZE + 14, 4, 4); parkCtx.fillStyle = '#3a2a4a'; parkCtx.fillRect(x * TILE_SIZE + 13, y * TILE_SIZE + 22, 6, 8); parkCtx.fillStyle = C.orange; parkCtx.beginPath(); parkCtx.arc(x * TILE_SIZE + 16, y * TILE_SIZE + 6, 3, 0, Math.PI * 2); parkCtx.fill(); }
    function drawPirateShip(x, y) { const f = G.paused ? 0 : G.frame; drawGrass(x, y); const swing = Math.sin(f * 0.04) * 0.3; parkCtx.save(); parkCtx.translate(x * TILE_SIZE + 16, y * TILE_SIZE + 8); parkCtx.rotate(swing); parkCtx.fillStyle = '#8b4513'; parkCtx.fillRect(-12, 0, 24, 10); parkCtx.fillStyle = '#654321'; parkCtx.fillRect(-2, -12, 4, 14); parkCtx.fillStyle = '#222'; parkCtx.beginPath(); parkCtx.moveTo(2, -12); parkCtx.lineTo(12, -4); parkCtx.lineTo(2, -4); parkCtx.fill(); parkCtx.fillStyle = '#a0522d'; parkCtx.beginPath(); parkCtx.moveTo(-12, 10); parkCtx.quadraticCurveTo(-14, 16, -8, 14); parkCtx.lineTo(8, 14); parkCtx.quadraticCurveTo(14, 16, 12, 10); parkCtx.closePath(); parkCtx.fill(); parkCtx.restore(); parkCtx.fillStyle = '#666'; parkCtx.fillRect(x * TILE_SIZE + 4, y * TILE_SIZE + 26, 8, 4); parkCtx.fillRect(x * TILE_SIZE + 20, y * TILE_SIZE + 26, 8, 4); }
    function drawObservationTower(x, y) { const f = G.paused ? 0 : G.frame; drawGrass(x, y); parkCtx.fillStyle = '#666'; parkCtx.fillRect(x * TILE_SIZE + 12, y * TILE_SIZE + 8, 8, 22); parkCtx.fillStyle = '#888'; for (let i = 0; i < 5; i++) parkCtx.fillRect(x * TILE_SIZE + 10, y * TILE_SIZE + 10 + i * 4, 12, 2); const cabY = y * TILE_SIZE + 6 + Math.sin(f * 0.02) * 4; parkCtx.fillStyle = '#444'; parkCtx.beginPath(); parkCtx.roundRect(x * TILE_SIZE + 6, cabY, 20, 10, 3); parkCtx.fill(); parkCtx.fillStyle = C.blue; parkCtx.fillRect(x * TILE_SIZE + 8, cabY + 2, 6, 5); parkCtx.fillRect(x * TILE_SIZE + 18, cabY + 2, 6, 5); parkCtx.fillStyle = C.red; parkCtx.fillRect(x * TILE_SIZE + 10, y * TILE_SIZE + 2, 12, 5); }
    
    // Coasters
    function drawCoaster(x, y, type) { drawGrass(x, y); drawGrass(x + 1, y); const cl = { 'wild-mouse': '#ff69b4', 'junior-coaster': '#4ecdc4', 'steel-coaster': C.purple, 'wooden-coaster': '#d9b87c', 'hyper-coaster': C.orange, 'giga-coaster': '#00ced1' }[type] || C.purple; parkCtx.fillStyle = cl; parkCtx.fillRect(x * TILE_SIZE + 4, y * TILE_SIZE + 24, 4, 8); parkCtx.fillRect(x * TILE_SIZE + 56, y * TILE_SIZE + 16, 4, 16); parkCtx.strokeStyle = cl; parkCtx.lineWidth = 4; parkCtx.beginPath(); parkCtx.moveTo(x * TILE_SIZE + 6, y * TILE_SIZE + 24); parkCtx.quadraticCurveTo(x * TILE_SIZE + 16, y * TILE_SIZE + 4, x * TILE_SIZE + 32, y * TILE_SIZE + 8); parkCtx.quadraticCurveTo(x * TILE_SIZE + 48, y * TILE_SIZE + 12, x * TILE_SIZE + 58, y * TILE_SIZE + 16); parkCtx.stroke(); const f = G.paused ? 0 : G.frame, t = (f % 120) / 120, cx = x * TILE_SIZE + 6 + t * 52, cy = y * TILE_SIZE + 24 - Math.sin(t * Math.PI) * 16; parkCtx.fillStyle = C.red; parkCtx.beginPath(); parkCtx.roundRect(cx - 6, cy - 4, 12, 8, 3); parkCtx.fill(); parkCtx.fillStyle = '#ffd5b8'; parkCtx.beginPath(); parkCtx.arc(cx - 2, cy - 6, 3, 0, Math.PI * 2); parkCtx.fill(); parkCtx.beginPath(); parkCtx.arc(cx + 2, cy - 6, 3, 0, Math.PI * 2); parkCtx.fill(); }
    
    // Food stalls
    function drawFoodStall(x, y, type) {
        var night = getDayPart() === 'night';
        if (type === 'burger-joint') {
            parkCtx.fillStyle = '#8B4513'; parkCtx.beginPath(); parkCtx.roundRect(x * TILE_SIZE + 2, y * TILE_SIZE + 12, 28, 18, 3); parkCtx.fill();
            parkCtx.fillStyle = '#a05a2c'; parkCtx.beginPath(); parkCtx.roundRect(x * TILE_SIZE + 4, y * TILE_SIZE + 14, 24, 14, 2); parkCtx.fill();
            for (var i = 0; i < 4; i++) { parkCtx.fillStyle = i % 2 ? C.yellow : C.red; parkCtx.fillRect(x * TILE_SIZE + 2 + i * 7, y * TILE_SIZE + 6, 7, 8); }
            parkCtx.fillStyle = '#d4a056'; parkCtx.beginPath(); parkCtx.arc(x * TILE_SIZE + 16, y * TILE_SIZE + 2, 5, Math.PI, 0); parkCtx.fill();
            parkCtx.fillStyle = C.green; parkCtx.fillRect(x * TILE_SIZE + 11, y * TILE_SIZE + 2, 10, 2);
            parkCtx.fillStyle = '#8B4513'; parkCtx.fillRect(x * TILE_SIZE + 11, y * TILE_SIZE + 4, 10, 2);
            parkCtx.fillStyle = '#d4a056'; parkCtx.fillRect(x * TILE_SIZE + 11, y * TILE_SIZE + 6, 10, 2);
            if (night) { parkCtx.fillStyle = C.yellow; parkCtx.beginPath(); parkCtx.ellipse(x * TILE_SIZE + 16, y * TILE_SIZE + 18, 4, 3, 0, 0, Math.PI * 2); parkCtx.fill(); }
        } else if (type === 'cotton-candy') {
            parkCtx.fillStyle = '#deb887'; parkCtx.beginPath(); parkCtx.roundRect(x * TILE_SIZE + 2, y * TILE_SIZE + 14, 28, 16, 4); parkCtx.fill();
            parkCtx.fillStyle = '#c9a86c'; parkCtx.beginPath(); parkCtx.roundRect(x * TILE_SIZE + 4, y * TILE_SIZE + 16, 24, 12, 3); parkCtx.fill();
            parkCtx.fillStyle = '#ffb6c1'; parkCtx.beginPath(); parkCtx.arc(x * TILE_SIZE + 12, y * TILE_SIZE + 8, 6, 0, Math.PI * 2); parkCtx.fill();
            parkCtx.fillStyle = '#ffc0cb'; parkCtx.beginPath(); parkCtx.arc(x * TILE_SIZE + 20, y * TILE_SIZE + 10, 5, 0, Math.PI * 2); parkCtx.fill();
            for (var i = 0; i < 4; i++) { parkCtx.fillStyle = i % 2 ? '#ffb6c1' : '#fff'; parkCtx.fillRect(x * TILE_SIZE + 2 + i * 7, y * TILE_SIZE + 4, 7, 10); }
            if (night) { parkCtx.fillStyle = C.yellow; parkCtx.beginPath(); parkCtx.ellipse(x * TILE_SIZE + 16, y * TILE_SIZE + 18, 4, 3, 0, 0, Math.PI * 2); parkCtx.fill(); }
        } else if (type === 'coffee-stand') {
            parkCtx.fillStyle = '#8b4513'; parkCtx.beginPath(); parkCtx.roundRect(x * TILE_SIZE + 2, y * TILE_SIZE + 12, 28, 18, 3); parkCtx.fill();
            parkCtx.fillStyle = '#654321'; parkCtx.beginPath(); parkCtx.roundRect(x * TILE_SIZE + 4, y * TILE_SIZE + 14, 24, 14, 2); parkCtx.fill();
            for (var i = 0; i < 4; i++) { parkCtx.fillStyle = i % 2 ? '#8b4513' : '#fff'; parkCtx.fillRect(x * TILE_SIZE + 2 + i * 7, y * TILE_SIZE + 4, 7, 10); }
            parkCtx.fillStyle = '#fff'; parkCtx.beginPath(); parkCtx.roundRect(x * TILE_SIZE + 10, y * TILE_SIZE + 6, 12, 6, 2); parkCtx.fill();
            parkCtx.fillStyle = '#654321'; parkCtx.fillRect(x * TILE_SIZE + 12, y * TILE_SIZE + 8, 6, 3);
            if (night) { parkCtx.fillStyle = C.yellow; parkCtx.beginPath(); parkCtx.ellipse(x * TILE_SIZE + 16, y * TILE_SIZE + 18, 4, 3, 0, 0, Math.PI * 2); parkCtx.fill(); }
        } else {
            var cols = { 'ice-cream': { m: C.pink, s: '#fff', a: C.blue }, 'soft-drinks': { m: C.red, s: '#fff', a: C.yellow }, 'waffles': { m: C.yellow, s: '#fff', a: C.orange } };
            var c = cols[type]; if (!c) return;
            parkCtx.fillStyle = c.m; parkCtx.beginPath(); parkCtx.roundRect(x * TILE_SIZE + 2, y * TILE_SIZE + 14, 28, 16, 4); parkCtx.fill();
            parkCtx.fillStyle = c.a; parkCtx.beginPath(); parkCtx.roundRect(x * TILE_SIZE + 4, y * TILE_SIZE + 16, 24, 12, 3); parkCtx.fill();
            for (var i = 0; i < 8; i++) { parkCtx.fillStyle = i % 2 ? c.m : c.s; parkCtx.beginPath(); parkCtx.roundRect(x * TILE_SIZE + i * 4, y * TILE_SIZE + 4, 4, 12, 1); parkCtx.fill(); }
            parkCtx.fillStyle = c.m; parkCtx.beginPath(); parkCtx.roundRect(x * TILE_SIZE - 1, y * TILE_SIZE + 2, 34, 4, 2); parkCtx.fill();
            if (night) { parkCtx.fillStyle = C.yellow; parkCtx.beginPath(); parkCtx.ellipse(x * TILE_SIZE + 16, y * TILE_SIZE + 18, 4, 3, 0, 0, Math.PI * 2); parkCtx.fill(); }
        }
    }
    
    // Decor
    function drawBush(x, y) { drawGrass(x, y); parkCtx.fillStyle = 'rgba(0,40,20,0.25)'; parkCtx.beginPath(); parkCtx.ellipse(x * TILE_SIZE + 16, y * TILE_SIZE + 26, 12, 4, 0, 0, Math.PI * 2); parkCtx.fill(); parkCtx.fillStyle = C.bush2; parkCtx.beginPath(); parkCtx.arc(x * TILE_SIZE + 10, y * TILE_SIZE + 20, 7, 0, Math.PI * 2); parkCtx.fill(); parkCtx.beginPath(); parkCtx.arc(x * TILE_SIZE + 22, y * TILE_SIZE + 20, 7, 0, Math.PI * 2); parkCtx.fill(); parkCtx.beginPath(); parkCtx.arc(x * TILE_SIZE + 16, y * TILE_SIZE + 21, 8, 0, Math.PI * 2); parkCtx.fill(); parkCtx.fillStyle = C.bush1; parkCtx.beginPath(); parkCtx.arc(x * TILE_SIZE + 9, y * TILE_SIZE + 15, 6, 0, Math.PI * 2); parkCtx.fill(); parkCtx.beginPath(); parkCtx.arc(x * TILE_SIZE + 16, y * TILE_SIZE + 16, 7, 0, Math.PI * 2); parkCtx.fill(); parkCtx.beginPath(); parkCtx.arc(x * TILE_SIZE + 23, y * TILE_SIZE + 15, 6, 0, Math.PI * 2); parkCtx.fill(); parkCtx.fillStyle = C.bush4; parkCtx.beginPath(); parkCtx.arc(x * TILE_SIZE + 12, y * TILE_SIZE + 10, 5, 0, Math.PI * 2); parkCtx.fill(); parkCtx.beginPath(); parkCtx.arc(x * TILE_SIZE + 20, y * TILE_SIZE + 10, 5, 0, Math.PI * 2); parkCtx.fill(); parkCtx.beginPath(); parkCtx.arc(x * TILE_SIZE + 16, y * TILE_SIZE + 7, 4, 0, Math.PI * 2); parkCtx.fill(); parkCtx.fillStyle = '#8fd9a8'; parkCtx.fillRect(x * TILE_SIZE + 11, y * TILE_SIZE + 7, 2, 2); parkCtx.fillRect(x * TILE_SIZE + 18, y * TILE_SIZE + 5, 2, 2); parkCtx.fillRect(x * TILE_SIZE + 14, y * TILE_SIZE + 11, 2, 2); parkCtx.fillRect(x * TILE_SIZE + 21, y * TILE_SIZE + 12, 2, 2); }
    function drawHedge(x, y) { drawGrass(x, y); parkCtx.fillStyle = C.hedge1; parkCtx.beginPath(); parkCtx.roundRect(x * TILE_SIZE + 4, y * TILE_SIZE + 8, 24, 22, 4); parkCtx.fill(); parkCtx.fillStyle = C.hedge2; parkCtx.beginPath(); parkCtx.roundRect(x * TILE_SIZE + 6, y * TILE_SIZE + 6, 20, 18, 4); parkCtx.fill(); parkCtx.fillStyle = C.hedge3; parkCtx.fillRect(x * TILE_SIZE + 10, y * TILE_SIZE + 12, 3, 3); parkCtx.fillRect(x * TILE_SIZE + 19, y * TILE_SIZE + 12, 3, 3); }
    function drawFlowers(x, y) { drawGrass(x, y); const flCols = [C.pink, C.yellow, C.blue, C.purple, C.red, C.orange, C.white, '#9de8a5']; for (let fi = 0; fi < 6; fi++) { const flx = x * TILE_SIZE + 6 + (fi % 3) * 10, fly = y * TILE_SIZE + 8 + Math.floor(fi / 3) * 12; parkCtx.fillStyle = C.grassDark; parkCtx.fillRect(flx, fly + 4, 1, 6); parkCtx.fillStyle = flCols[fi % flCols.length]; for (let p = 0; p < 5; p++) { const pa = p * Math.PI * 2 / 5 - Math.PI / 2; parkCtx.beginPath(); parkCtx.arc(flx + Math.cos(pa) * 3, fly + Math.sin(pa) * 3, 2, 0, Math.PI * 2); parkCtx.fill(); } parkCtx.fillStyle = C.yellow; parkCtx.beginPath(); parkCtx.arc(flx, fly, 1.5, 0, Math.PI * 2); parkCtx.fill(); } }
    function drawStatue(x, y) { drawGrass(x, y); parkCtx.fillStyle = '#808080'; parkCtx.fillRect(x * TILE_SIZE + 8, y * TILE_SIZE + 24, 16, 6); parkCtx.fillStyle = '#a0a0a0'; parkCtx.fillRect(x * TILE_SIZE + 10, y * TILE_SIZE + 22, 12, 4); parkCtx.fillStyle = '#b0b0b0'; parkCtx.fillRect(x * TILE_SIZE + 12, y * TILE_SIZE + 12, 8, 10); parkCtx.beginPath(); parkCtx.arc(x * TILE_SIZE + 16, y * TILE_SIZE + 10, 5, 0, Math.PI * 2); parkCtx.fill(); parkCtx.fillRect(x * TILE_SIZE + 6, y * TILE_SIZE + 14, 6, 3); parkCtx.fillRect(x * TILE_SIZE + 20, y * TILE_SIZE + 14, 6, 3); }
    function drawFountain(x, y) { const f = G.paused ? 0 : G.frame, night = getDayPart() === 'night'; parkCtx.fillStyle = C.purple; parkCtx.beginPath(); parkCtx.roundRect(x * TILE_SIZE + 4, y * TILE_SIZE + 20, 24, 10, 5); parkCtx.fill(); parkCtx.fillStyle = C.pink; parkCtx.beginPath(); parkCtx.roundRect(x * TILE_SIZE + 6, y * TILE_SIZE + 18, 20, 4, 3); parkCtx.fill(); parkCtx.fillStyle = C.water1; parkCtx.beginPath(); parkCtx.ellipse(x * TILE_SIZE + 16, y * TILE_SIZE + 24, 10, 4, 0, 0, Math.PI * 2); parkCtx.fill(); if (!night && !G.paused) { const wh = 10 + Math.sin(f * 0.015) * 2; for (let i = 0; i < wh; i++) { const sp = Math.sin((wh - i) * 0.3) * 1.5, al = 0.6 - i / wh * 0.4; parkCtx.fillStyle = 'rgba(109,213,247,' + al + ')'; parkCtx.beginPath(); parkCtx.ellipse(x * TILE_SIZE + 16, y * TILE_SIZE + 18 - i, 2 + sp, 2, 0, 0, Math.PI * 2); parkCtx.fill(); } } }
    function drawWater(x, y) { const f = G.paused ? 0 : G.frame; const hT = isWaterAt(x, y - 1), hB = isWaterAt(x, y + 1), hL = isWaterAt(x - 1, y), hR = isWaterAt(x + 1, y); const r = 10; parkCtx.fillStyle = C.water1; parkCtx.beginPath(); parkCtx.moveTo(x * TILE_SIZE + ((!hT && !hL) ? r : 0), y * TILE_SIZE); if (!hT && !hL) parkCtx.arc(x * TILE_SIZE + r, y * TILE_SIZE + r, r, Math.PI * 1.5, Math.PI, true); parkCtx.lineTo(x * TILE_SIZE, y * TILE_SIZE + TILE_SIZE - ((!hB && !hL) ? r : 0)); if (!hB && !hL) parkCtx.arc(x * TILE_SIZE + r, y * TILE_SIZE + TILE_SIZE - r, r, Math.PI, Math.PI * 0.5, true); parkCtx.lineTo(x * TILE_SIZE + TILE_SIZE - ((!hB && !hR) ? r : 0), y * TILE_SIZE + TILE_SIZE); if (!hB && !hR) parkCtx.arc(x * TILE_SIZE + TILE_SIZE - r, y * TILE_SIZE + TILE_SIZE - r, r, Math.PI * 0.5, 0, true); parkCtx.lineTo(x * TILE_SIZE + TILE_SIZE, y * TILE_SIZE + ((!hT && !hR) ? r : 0)); if (!hT && !hR) parkCtx.arc(x * TILE_SIZE + TILE_SIZE - r, y * TILE_SIZE + r, r, 0, Math.PI * 1.5, true); parkCtx.closePath(); parkCtx.fill(); const m = 4, ir = r - m; const tl = !hT && !hL ? ir : 0, tr = !hT && !hR ? ir : 0, bl = !hB && !hL ? ir : 0, br = !hB && !hR ? ir : 0; parkCtx.fillStyle = C.water2; parkCtx.beginPath(); parkCtx.moveTo(x * TILE_SIZE + (hL ? 0 : m) + tl, y * TILE_SIZE + (hT ? 0 : m)); if (!hT && !hL) parkCtx.arc(x * TILE_SIZE + m + tl, y * TILE_SIZE + m + tl, tl, Math.PI * 1.5, Math.PI, true); parkCtx.lineTo(x * TILE_SIZE + (hL ? 0 : m), y * TILE_SIZE + TILE_SIZE - (hB ? 0 : m) - bl); if (!hB && !hL) parkCtx.arc(x * TILE_SIZE + m + bl, y * TILE_SIZE + TILE_SIZE - m - bl, bl, Math.PI, Math.PI * 0.5, true); parkCtx.lineTo(x * TILE_SIZE + TILE_SIZE - (hR ? 0 : m) - br, y * TILE_SIZE + TILE_SIZE - (hB ? 0 : m)); if (!hB && !hR) parkCtx.arc(x * TILE_SIZE + TILE_SIZE - m - br, y * TILE_SIZE + TILE_SIZE - m - br, br, Math.PI * 0.5, 0, true); parkCtx.lineTo(x * TILE_SIZE + TILE_SIZE - (hR ? 0 : m), y * TILE_SIZE + (hT ? 0 : m) + tr); if (!hT && !hR) parkCtx.arc(x * TILE_SIZE + TILE_SIZE - m - tr, y * TILE_SIZE + m + tr, tr, 0, Math.PI * 1.5, true); parkCtx.closePath(); parkCtx.fill(); const wx = Math.sin(f * 0.02) * 2; parkCtx.fillStyle = 'rgba(255,255,255,0.3)'; parkCtx.fillRect(x * TILE_SIZE + 8 + wx, y * TILE_SIZE + 10, 4, 2); parkCtx.fillRect(x * TILE_SIZE + 18 + wx, y * TILE_SIZE + 18, 3, 2); }
    
    // Guests and effects
    function drawGuest(g) { const f = G.paused ? 0 : G.frame, wf = Math.floor(f / 12) % 4, bob = wf % 2; parkCtx.fillStyle = g.color; parkCtx.beginPath(); parkCtx.roundRect(g.x, g.y + bob, 8, 10, 3); parkCtx.fill(); parkCtx.fillStyle = '#ffd5b8'; parkCtx.beginPath(); parkCtx.ellipse(g.x + 4, g.y - 2 + bob, 4, 4, 0, 0, Math.PI * 2); parkCtx.fill(); parkCtx.fillStyle = '#1a1a2e'; parkCtx.fillRect(g.x + 2, g.y - 3 + bob, 1, 2); parkCtx.fillRect(g.x + 5, g.y - 3 + bob, 1, 2); parkCtx.fillStyle = C.pink; parkCtx.fillRect(g.x + 3, g.y - 1 + bob, 2, 1); parkCtx.fillStyle = g.hair; parkCtx.beginPath(); parkCtx.ellipse(g.x + 4, g.y - 4 + bob, 4, 2, 0, 0, Math.PI * 2); parkCtx.fill(); }
    function drawBird(b) { const wu = Math.sin(G.frame * 0.08 + b.wing) > 0, sz = b.size; parkCtx.fillStyle = b.color; parkCtx.beginPath(); parkCtx.ellipse(b.x + sz, b.y + sz / 2, sz, sz / 2, 0, 0, Math.PI * 2); parkCtx.fill(); if (wu) { parkCtx.beginPath(); parkCtx.ellipse(b.x, b.y - sz * 0.3, sz * 0.8, sz * 0.5, 0, 0, Math.PI * 2); parkCtx.fill(); parkCtx.beginPath(); parkCtx.ellipse(b.x + sz * 2, b.y - sz * 0.3, sz * 0.8, sz * 0.5, 0, 0, Math.PI * 2); parkCtx.fill(); } else { parkCtx.beginPath(); parkCtx.ellipse(b.x, b.y + sz * 0.6, sz * 0.8, sz * 0.5, 0, 0, Math.PI * 2); parkCtx.fill(); parkCtx.beginPath(); parkCtx.ellipse(b.x + sz * 2, b.y + sz * 0.6, sz * 0.8, sz * 0.5, 0, 0, Math.PI * 2); parkCtx.fill(); } parkCtx.fillStyle = C.orange; parkCtx.beginPath(); parkCtx.ellipse(b.x + sz * 2.3, b.y + sz * 0.3, sz * 0.3, sz * 0.2, 0, 0, Math.PI * 2); parkCtx.fill(); }
    function drawLeaf(l) { parkCtx.save(); parkCtx.translate(l.x, l.y); parkCtx.rotate(l.rot); parkCtx.fillStyle = l.color; parkCtx.beginPath(); parkCtx.ellipse(0, 0, l.size, l.size * 0.6, 0, 0, Math.PI * 2); parkCtx.fill(); parkCtx.restore(); }
    function drawSparkle(s) { const pu = Math.sin(G.frame * 0.04 + s.x) * 0.5 + 0.5, al = s.life * pu * 0.4, sz = s.size * (0.5 + pu * 0.5); parkCtx.fillStyle = 'rgba(255,255,220,' + al + ')'; parkCtx.beginPath(); parkCtx.moveTo(s.x, s.y - sz); parkCtx.lineTo(s.x + sz * 0.3, s.y - sz * 0.3); parkCtx.lineTo(s.x + sz, s.y); parkCtx.lineTo(s.x + sz * 0.3, s.y + sz * 0.3); parkCtx.lineTo(s.x, s.y + sz); parkCtx.lineTo(s.x - sz * 0.3, s.y + sz * 0.3); parkCtx.lineTo(s.x - sz, s.y); parkCtx.lineTo(s.x - sz * 0.3, s.y - sz * 0.3); parkCtx.closePath(); parkCtx.fill(); }
    
    // ==================== MAIN RENDER ====================
    
    PPT.render.renderPark = function() {
        if (!parkCtx) return;
        if (!G.paused) G.frame++;
        const night = getDayPart() === 'night';
        
        // Sky and background
        if (night) {
            parkCtx.fillStyle = C.nightSky; parkCtx.fillRect(0, 0, 640, 384);
            for (let i = 0; i < 40; i++) {
                const sx = (Math.sin(i * 73.5) * 0.5 + 0.5) * 640, sy = (Math.cos(i * 91.3) * 0.5 + 0.5) * 290;
                const tw = Math.sin(Date.now() * 0.002 + i * 1.5) * 0.4 + 0.6;
                parkCtx.fillStyle = 'rgba(255,255,220,' + (tw * 0.8) + ')';
                parkCtx.beginPath(); parkCtx.arc(sx, sy, 1 + (i % 3) * 0.5, 0, Math.PI * 2); parkCtx.fill();
            }
            parkCtx.fillStyle = '#fffde7'; parkCtx.beginPath(); parkCtx.arc(590, 40, 20, 0, Math.PI * 2); parkCtx.fill();
            parkCtx.fillStyle = C.nightSky; parkCtx.beginPath(); parkCtx.arc(598, 36, 16, 0, Math.PI * 2); parkCtx.fill();
        } else {
            parkCtx.fillStyle = C.grass1; parkCtx.fillRect(0, 0, 640, 384);
        }
        
        // Draw grass
        for (let y = 0; y < GRID_HEIGHT; y++) for (let x = 0; x < GRID_WIDTH; x++) drawGrass(x, y);
        
        // Draw grid objects
        const BUILDINGS = PPT.currentScenario ? PPT.currentScenario.buildings : {};
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                const c = G.grid[y][x];
                if (!c || c.parent) continue;
                switch(c.type) {
                    case 'water': drawWater(x, y); break;
                    case 'tree-oak': case 'tree-pine': case 'tree-cherry': drawTree(x, y, c.type); break;
                    case 'entrance': drawEntrance(x, y); break;
                    case 'path': drawPath(x, y); break;
                    case 'asphalt': drawAsphalt(x, y); break;
                    case 'wooden-path': drawWoodenPath(x, y); break;
                    case 'sand-path': drawSandPath(x, y); break;
                    case 'gravel-path': drawGravelPath(x, y); break;
                    case 'tiles': drawTiles(x, y); break;
                    case 'merry-go-round': drawMerryGoRound(x, y); break;
                    case 'ferris-wheel': drawFerrisWheel(x, y); break;
                    case 'spiral-slide': drawSpiralSlide(x, y); break;
                    case 'haunted-house': drawHauntedHouse(x, y); break;
                    case 'pirate-ship': drawPirateShip(x, y); break;
                    case 'observation-tower': drawObservationTower(x, y); break;
                    case 'wooden-coaster': case 'steel-coaster': case 'junior-coaster':
                    case 'hyper-coaster': case 'wild-mouse': case 'giga-coaster':
                        drawCoaster(x, y, c.type); break;
                    case 'ice-cream': case 'soft-drinks': case 'waffles':
                    case 'burger-joint': case 'cotton-candy': case 'coffee-stand':
                        drawFoodStall(x, y, c.type); break;
                    case 'bush': drawBush(x, y); break;
                    case 'hedge': drawHedge(x, y); break;
                    case 'flowers': drawFlowers(x, y); break;
                    case 'statue': drawStatue(x, y); break;
                    case 'fountain': drawFountain(x, y); break;
                }
            }
        }
        
        // Effects
        if (!night) G.sparkles.forEach(s => drawSparkle(s));
        G.guestSprites.forEach(g => drawGuest(g));
        G.leaves.forEach(l => drawLeaf(l));
        if (!night) G.birds.forEach(b => drawBird(b));
        
        // Placement preview
        if (G.selected && G.hover) {
            const can = PPT.game.canPlace(G.hover.x, G.hover.y, G.selected);
            const sz = BUILDINGS[G.selected]?.size || 1;
            parkCtx.fillStyle = can ? 'rgba(107,203,119,0.5)' : 'rgba(255,107,157,0.5)';
            parkCtx.beginPath(); parkCtx.roundRect(G.hover.x * TILE_SIZE, G.hover.y * TILE_SIZE, TILE_SIZE * sz, TILE_SIZE * sz, 6); parkCtx.fill();
        }
        
        // Demolish preview
        if (G.demolishMode && G.hover) {
            const c = G.grid[G.hover.y]?.[G.hover.x];
            const canDem = c && !c.perm;
            parkCtx.fillStyle = canDem ? 'rgba(255,68,68,0.5)' : 'rgba(100,100,100,0.3)';
            parkCtx.beginPath(); parkCtx.roundRect(G.hover.x * TILE_SIZE, G.hover.y * TILE_SIZE, TILE_SIZE, TILE_SIZE, 6); parkCtx.fill();
            if (canDem) {
                parkCtx.strokeStyle = '#ff4444'; parkCtx.lineWidth = 2;
                parkCtx.beginPath();
                parkCtx.moveTo(G.hover.x * TILE_SIZE + 8, G.hover.y * TILE_SIZE + 8);
                parkCtx.lineTo(G.hover.x * TILE_SIZE + 24, G.hover.y * TILE_SIZE + 24);
                parkCtx.moveTo(G.hover.x * TILE_SIZE + 24, G.hover.y * TILE_SIZE + 8);
                parkCtx.lineTo(G.hover.x * TILE_SIZE + 8, G.hover.y * TILE_SIZE + 24);
                parkCtx.stroke();
            }
        }
        
        // Day tint
        const tn = getDayTint();
        if (tn.a > 0) {
            parkCtx.fillStyle = 'rgba(' + tn.r + ',' + tn.g + ',' + tn.b + ',' + tn.a + ')';
            parkCtx.fillRect(0, 0, 640, 384);
        }
    };
    
    // Particle rendering
    PPT.render.updateParticles = function() {
        if (!partCtx) return;
        partCtx.clearRect(0, 0, 640, 384);
        for (let i = G.particles.length - 1; i >= 0; i--) {
            const p = G.particles[i];
            p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life -= 0.005;
            if (p.life <= 0) { G.particles.splice(i, 1); continue; }
            partCtx.globalAlpha = p.life;
            if (p.type === 'coin') {
                partCtx.fillStyle = C.yellow;
                partCtx.beginPath(); partCtx.arc(p.x, p.y, 5, 0, Math.PI * 2); partCtx.fill();
            } else {
                partCtx.fillStyle = p.type === 'neg' ? C.pink : C.green;
                partCtx.font = '12px "Press Start 2P"';
                partCtx.fillText(p.text, p.x, p.y);
            }
        }
        partCtx.globalAlpha = 1;
    };
    
    // Confetti rendering
    PPT.render.updateConfetti = function() {
        if (!confCtx) return;
        confCtx.canvas.width = window.innerWidth;
        confCtx.canvas.height = window.innerHeight;
        confCtx.clearRect(0, 0, confCtx.canvas.width, confCtx.canvas.height);
        for (let i = G.confetti.length - 1; i >= 0; i--) {
            const c = G.confetti[i];
            c.x += c.vx; c.y += c.vy; c.rot += c.rotSpd; c.life -= 0.005;
            if (c.life <= 0 || c.y > confCtx.canvas.height) { G.confetti.splice(i, 1); continue; }
            confCtx.save();
            confCtx.translate(c.x, c.y);
            confCtx.rotate(c.rot);
            confCtx.globalAlpha = c.life;
            confCtx.fillStyle = c.color;
            confCtx.beginPath(); confCtx.roundRect(-5, -3, 10, 6, 2); confCtx.fill();
            confCtx.restore();
        }
    };
    
})();

