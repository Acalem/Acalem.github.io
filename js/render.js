/**
 * Pixel Park Paradise - Rendering System
 * All drawing functions for sprites, icons, and effects
 */

(function() {
    'use strict';
    
    const C = PPT.config.C;
    const TILE_SIZE = PPT.config.TILE_SIZE;
    const GRID_WIDTH = PPT.config.GRID_WIDTH;
    const GRID_HEIGHT = PPT.config.GRID_HEIGHT;

    // ===== Haunted House palette =====
    var HH_H1='#4a3a5a', HH_H2='#3a2a4a', HH_H3='#5a4a6a', HH_H4='#2a1a3a';
    var HH_ROOF='#2a2035', HH_ROOF_L='#3a3048';
    var HH_WOOD='#5a4030', HH_IRON='#4a4a55', HH_FOG='rgba(180,170,220,';

    // ===== Spiral Slide palette =====
    var SS_SL='#22c1c3', SS_SL_D='#1a9a9c', SS_SL_L='#55e0e0';
    var SS_STRUC='#8a7060', SS_STRUC_D='#6a5040', SS_STRUC_L='#a08a78';
    var SS_PLAT='#9a8878', SS_PLAT_L='#b0a090';

    // ===== Pirate Ship palette =====
    var PS_HULL='#6a3a22', PS_HULL_D='#4a2212', PS_HULL_L='#8a5538', PS_HULL_BOT='#3a1a0a';
    var PS_DECK='#8a6a48', PS_DECK_L='#a88a68';
    var PS_MAST='#5a4020', PS_MAST_L='#7a5a38';
    var PS_SAIL='#f0e8d8', PS_SAIL_D='#d8d0c0', PS_SAIL_DK='#c0b8a8';
    var PS_RAIL='#8a6040', PS_RAIL_L='#a07850';
    var PS_GOLD='#f0c040', PS_GOLD_D='#c8a030';
    var PS_IRON='#5a5a68', PS_IRON_D='#3a3a48';
    var PS_FLAG_R='#1a1a1a', PS_SKULL='#e8e0d0', PS_ROPE='#b09060';
    var PS_WATER='#3a8abd', PS_WATER_L='#5aaae0', PS_WATER_D='#2a6a9a', PS_FOAM='#d0eef8';
    var PS_STRUC='#6a6a78', PS_STRUC_L='#8a8a98', PS_STRUC_D='#4a4a58';

    // Canvas contexts (set during init)
    let parkCtx = null;
    let partCtx = null;
    let confCtx = null;
    let overlayCtx = null;
    let glowCtx = null;
    const OVERLAY_HEADROOM = 64;  // extra pixels above park for tree canopies
    const OVERLAY_LEFT = 192;     // extra pixels left of park for entrance path guests
    
    // Building openings: map of "gx,gy" → Set of directions path should open
    var buildingOpenings = {};
    
    // Lantern positions collected during path rendering (screen px)
    var lanternPositions = [];
    
    // ===== PERFORMANCE: Grid version & cache invalidation =====
    // Incremented on any grid change (place/demolish/load) to invalidate caches.
    var _gridVersion = 0;
    PPT.render._gridVersion = 0;
    
    PPT.render.invalidateGrid = function() {
        _gridVersion++;
        PPT.render._gridVersion = _gridVersion;
        _pathTileCache = {};
        _tileSpriteCache = {};
        _buildingOpeningsVersion = -1;
    };
    
    // ===== PERFORMANCE: Building openings cache =====
    var _buildingOpeningsVersion = -1;
    
    // ===== PERFORMANCE: Path tile cache =====
    // Per-tile cache: key "x,y" → { canvas, ver, clean, lanterns }
    var _pathTileCache = {};
    
    // ===== PERFORMANCE: Animated tile sprite cache =====
    // Caches the rendered output of animated buildings/decorations to offscreen
    // canvases. Each tile only re-renders every TILE_ANIM_INTERVAL frames
    // (staggered across tiles), reducing per-frame draw calls by ~75%.
    // Animations still play at ~15fps, which is visually identical for pixel art.
    var _tileSpriteCache = {};
    var TILE_ANIM_INTERVAL = 4; // re-render every 4th frame = 15fps animation
    
    function cachedTileDraw(x, y, sz, drawFn, arg1) {
        var key = x + ',' + y;
        var entry = _tileSpriteCache[key];
        // Stagger refresh so not all tiles update on the same frame
        var shouldRefresh = !entry ||
            ((G.frame + ((x * 3 + y * 7) & 15)) % TILE_ANIM_INTERVAL === 0);
        
        if (shouldRefresh) {
            if (!entry) {
                var pw = sz * TILE_SIZE;
                var cvs = document.createElement('canvas');
                cvs.width = pw; cvs.height = pw;
                entry = { canvas: cvs, ctx: cvs.getContext('2d'), pw: pw };
                _tileSpriteCache[key] = entry;
            }
            entry.ctx.clearRect(0, 0, entry.pw, entry.pw);
            entry.ctx.save();
            entry.ctx.translate(-x * TILE_SIZE, -y * TILE_SIZE);
            var saved = parkCtx;
            parkCtx = entry.ctx;
            drawFn(x, y, arg1);
            parkCtx = saved;
            entry.ctx.restore();
        }
        
        parkCtx.drawImage(entry.canvas, x * TILE_SIZE, y * TILE_SIZE);
    }
    
    // ===== PERFORMANCE: Pre-rendered lantern glow sprite =====
    var _glowSprite = null;
    var _GLOW_SIZE = 56;
    
    function getGlowSprite() {
        if (_glowSprite) return _glowSprite;
        var c = document.createElement('canvas');
        c.width = _GLOW_SIZE; c.height = _GLOW_SIZE;
        var cx2 = _GLOW_SIZE / 2;
        var ctx = c.getContext('2d');
        var grad = ctx.createRadialGradient(cx2, cx2, 0, cx2, cx2, cx2);
        grad.addColorStop(0, 'rgba(255,230,140,0.55)');
        grad.addColorStop(0.3, 'rgba(255,200,80,0.30)');
        grad.addColorStop(0.6, 'rgba(255,160,40,0.12)');
        grad.addColorStop(1, 'rgba(255,120,20,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, _GLOW_SIZE, _GLOW_SIZE);
        _glowSprite = c;
        return c;
    }
    
    /**
     * Initialize canvas contexts
     */
    PPT.render.init = function(park, particle, confetti, overlay) {
        parkCtx = park;
        partCtx = particle;
        confCtx = confetti;
        overlayCtx = overlay;
        PPT.ctx.park = park;
        PPT.ctx.particle = particle;
        PPT.ctx.confetti = confetti;
        // Init lantern glow canvas
        var glowCanvas = document.getElementById('lantern-glow-canvas');
        if (glowCanvas) glowCtx = glowCanvas.getContext('2d');
    };
    
    // ==================== HELPER FUNCTIONS ====================
    
    function isPathAt(x, y) {
        if (!G || !G.grid) return false;
        // Outside entrance path connects to the left of the entrance at (0, 5)
        if (x === -1 && y === 5) return true;
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
    
    /**
     * Compute which path tiles should "open" toward adjacent buildings.
     * Each building (ride/food/coaster) gets exactly one path opening.
     * Priority: below > right > left > above.
     * For multi-tile buildings: prefer leftmost (x) / lowest (y).
     */
    function computeBuildingOpenings() {
        if (_buildingOpeningsVersion === _gridVersion) return;
        _buildingOpeningsVersion = _gridVersion;
        
        buildingOpenings = {};
        if (!G || !G.buildings) return;
        var scenario = PPT.currentScenario;
        if (!scenario) return;
        var BLDGS = scenario.buildings;
        
        G.buildings.forEach(function(b) {
            var d = BLDGS[b.type];
            if (!d) return;
            var cat = d.cat;
            // Only rides, coasters, and food stalls get path openings
            if (cat !== 'ride' && cat !== 'coaster' && cat !== 'food') return;
            
            var sz = d.size || 1;
            var bx = b.x, by = b.y;
            var found = false;
            
            // Priority 1: Below (y = by + sz), prefer leftmost x
            for (var x = bx; x < bx + sz && !found; x++) {
                if (isPathAt(x, by + sz)) {
                    var key = x + ',' + (by + sz);
                    if (!buildingOpenings[key]) buildingOpenings[key] = {};
                    buildingOpenings[key].t = true;
                    found = true;
                }
            }
            
            // Priority 2: Right (x = bx + sz), prefer lowest y (by + sz - 1 down to by)
            for (var y = by + sz - 1; y >= by && !found; y--) {
                if (isPathAt(bx + sz, y)) {
                    var key = (bx + sz) + ',' + y;
                    if (!buildingOpenings[key]) buildingOpenings[key] = {};
                    buildingOpenings[key].l = true;
                    found = true;
                }
            }
            
            // Priority 3: Left (x = bx - 1), prefer lowest y
            for (var y = by + sz - 1; y >= by && !found; y--) {
                if (isPathAt(bx - 1, y)) {
                    var key = (bx - 1) + ',' + y;
                    if (!buildingOpenings[key]) buildingOpenings[key] = {};
                    buildingOpenings[key].r = true;
                    found = true;
                }
            }
            
            // Priority 4: Above (y = by - 1), prefer leftmost x
            for (var x = bx; x < bx + sz && !found; x++) {
                if (isPathAt(x, by - 1)) {
                    var key = x + ',' + (by - 1);
                    if (!buildingOpenings[key]) buildingOpenings[key] = {};
                    buildingOpenings[key].b = true;
                    found = true;
                }
            }
        });
    }
    
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
                // Paths tab icon - generic paved path look
                ctx.fillStyle = '#d0c4b4'; ctx.fillRect(2*s, 2*s, 20*s, 20*s);
                ctx.fillStyle = '#b8ac9c'; ctx.globalAlpha = 0.2;
                for (var ty = 0; ty < 3; ty++) { ctx.fillRect(2*s, (2 + ty * 7) * s, 20*s, 0.8*s); var off2 = ty % 2 ? 5 : 0; for (var tx = 0; tx < 3; tx++) ctx.fillRect((2 + tx * 7 + off2) * s, (2 + ty * 7) * s, 0.8*s, 7*s); }
                ctx.globalAlpha = 1;
                break;
            case 'dirt-trail': case 'gravel-trail': case 'dirt-lane': case 'gravel-walk':
            case 'stone-paving': case 'tarmac': case 'park-walkway': case 'park-road':
            case 'promenade': case 'grand-avenue':
                drawPathThumbnail(ctx, type, sz);
                break;
            case 'merry-go-round':
                // Detailed 3/4 perspective carousel icon (no grass bg)
                // Stone base platform
                ctx.fillStyle = '#b0a090';
                ctx.beginPath(); ctx.ellipse(12*s, 21*s, 11*s, 3.5*s, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#c8b8a8';
                ctx.beginPath(); ctx.ellipse(12*s, 20.5*s, 10*s, 3*s, 0, 0, Math.PI); ctx.fill();
                // Rotating floor disc
                ctx.fillStyle = '#e85080';
                ctx.beginPath(); ctx.ellipse(12*s, 19*s, 9*s, 3*s, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#ff90b0';
                ctx.beginPath(); ctx.ellipse(12*s, 19*s, 6*s, 2*s, 0, 0, Math.PI * 2); ctx.fill();
                // Horses (4 small colored ones)
                var mgrHC = [C.red, C.dblue, C.green, C.purple];
                var mgrHA = [0, Math.PI/2, Math.PI, Math.PI*1.5];
                for (var mi = 0; mi < 4; mi++) {
                    var mha = mgrHA[mi], mhx = 12*s + Math.cos(mha)*7*s, mhy = 17*s + Math.sin(mha)*2.5*s;
                    ctx.fillStyle = '#d4aa7c'; ctx.fillRect(mhx - 0.3*s, mhy - 5*s, 0.7*s, 5*s);
                    ctx.fillStyle = mgrHC[mi];
                    ctx.beginPath(); ctx.roundRect(mhx - 2*s, mhy - 1*s, 4*s, 5*s, 1*s); ctx.fill();
                }
                // Center pole
                ctx.fillStyle = '#d4aa7c'; ctx.fillRect(11*s, 5*s, 2.5*s, 14*s);
                ctx.fillStyle = '#e8c090'; ctx.fillRect(11*s, 5*s, 0.8*s, 14*s);
                ctx.fillStyle = C.yellow; ctx.fillRect(10.5*s, 9*s, 3.5*s, 0.7*s); ctx.fillRect(10.5*s, 13*s, 3.5*s, 0.7*s);
                // Canopy cone
                ctx.fillStyle = '#d04070';
                ctx.beginPath(); ctx.ellipse(12*s, 7*s, 11*s, 2.5*s, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = C.pink;
                ctx.beginPath(); ctx.moveTo(12*s, 1*s); ctx.lineTo(23*s, 7*s); ctx.lineTo(1*s, 7*s); ctx.closePath(); ctx.fill();
                // Roof stripes
                for (var rri = 0; rri < 6; rri++) {
                    ctx.fillStyle = rri % 2 === 0 ? '#ff90b8' : '#e06090';
                    ctx.beginPath(); ctx.moveTo(12*s, 1*s); ctx.lineTo((1 + rri*3.7)*s, 7*s); ctx.lineTo((1 + (rri+1)*3.7)*s, 7*s); ctx.closePath(); ctx.fill();
                }
                // Rim scallop
                ctx.fillStyle = C.yellow;
                ctx.beginPath(); ctx.ellipse(12*s, 7.5*s, 11.5*s, 1.5*s, 0, 0, Math.PI); ctx.fill();
                ctx.fillStyle = C.pink;
                ctx.beginPath(); ctx.ellipse(12*s, 7*s, 11*s, 1*s, 0, 0, Math.PI); ctx.fill();
                // Finial
                ctx.fillStyle = C.yellow;
                ctx.beginPath(); ctx.arc(12*s, 1*s, 1.5*s, 0, Math.PI * 2); ctx.fill();
                break;
            case 'ferris-wheel':
                // Detailed 3/4 perspective ferris wheel icon (no grass bg)
                // A-frame legs
                ctx.strokeStyle = '#c06088'; ctx.lineWidth = 1.8*s;
                ctx.beginPath(); ctx.moveTo(4*s, 22*s); ctx.lineTo(11.5*s, 10.5*s); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(20*s, 22*s); ctx.lineTo(12.5*s, 10.5*s); ctx.stroke();
                ctx.strokeStyle = '#e880a8'; ctx.lineWidth = 0.5*s;
                ctx.beginPath(); ctx.moveTo(5*s, 22*s); ctx.lineTo(12*s, 10.5*s); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(19*s, 22*s); ctx.lineTo(12*s, 10.5*s); ctx.stroke();
                // Cross brace
                ctx.strokeStyle = '#b05878'; ctx.lineWidth = 0.5*s;
                ctx.beginPath(); ctx.moveTo(7*s, 18*s); ctx.lineTo(17*s, 18*s); ctx.stroke();
                // Base pads
                ctx.fillStyle = '#9a8e80';
                ctx.beginPath(); ctx.roundRect(2*s, 21*s, 7*s, 2*s, 0.6*s); ctx.fill();
                ctx.beginPath(); ctx.roundRect(15*s, 21*s, 7*s, 2*s, 0.6*s); ctx.fill();
                // Outer rim
                ctx.strokeStyle = '#d06090'; ctx.lineWidth = 1.5*s;
                ctx.beginPath(); ctx.ellipse(12*s, 10*s, 9*s, 8.5*s, 0, 0, Math.PI * 2); ctx.stroke();
                ctx.strokeStyle = '#e880a8'; ctx.lineWidth = 0.5*s;
                ctx.beginPath(); ctx.ellipse(12*s, 10*s, 8*s, 7.5*s, 0, 0, Math.PI * 2); ctx.stroke();
                // Spokes + gondolas
                var fwgc = [C.red, C.dblue, C.yellow, C.green, C.purple, C.orange, C.pink, C.blue];
                for (var fwi = 0; fwi < 8; fwi++) {
                    var fwa = (fwi / 8) * Math.PI * 2 - Math.PI / 2;
                    var fwgx = 12*s + Math.cos(fwa) * 9*s, fwgy = 10*s + Math.sin(fwa) * 8.5*s;
                    ctx.strokeStyle = '#c06088'; ctx.lineWidth = 0.5*s;
                    ctx.beginPath(); ctx.moveTo(12*s, 10*s); ctx.lineTo(fwgx, fwgy); ctx.stroke();
                    ctx.fillStyle = fwgc[fwi];
                    ctx.beginPath(); ctx.roundRect(fwgx - 1.8*s, fwgy + 0.5*s, 3.6*s, 2.8*s, 0.8*s); ctx.fill();
                }
                // Hub
                ctx.fillStyle = '#c06088'; ctx.beginPath(); ctx.arc(12*s, 10*s, 2.5*s, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = C.yellow; ctx.beginPath(); ctx.arc(12*s, 10*s, 1.8*s, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#fff8e0'; ctx.beginPath(); ctx.arc(11.7*s, 9.7*s, 0.8*s, 0, Math.PI * 2); ctx.fill();
                break;
            case 'spiral-slide': {
                var cx_ss=11*s;
                // Center pole
                ctx.fillStyle=SS_STRUC;
                ctx.fillRect(cx_ss-1*s, 3*s, 2*s, 18*s);
                ctx.fillStyle=SS_STRUC_L;
                ctx.fillRect(cx_ss-1*s, 3*s, 0.7*s, 18*s);
                // Diagonal struts
                ctx.strokeStyle=SS_STRUC;ctx.lineWidth=0.6*s;
                ctx.beginPath();ctx.moveTo(cx_ss-0.5*s,4*s);ctx.lineTo(cx_ss-3*s,20*s);ctx.stroke();
                ctx.beginPath();ctx.moveTo(cx_ss+0.5*s,4*s);ctx.lineTo(cx_ss+3*s,20*s);ctx.stroke();
                // Spiral tube back
                ctx.strokeStyle=SS_SL_D;ctx.lineWidth=2.5*s;ctx.lineCap='round';
                ctx.beginPath();
                for(var i_ss=0;i_ss<=40;i_ss++){var t_ss=i_ss/40,y_ss=3*s+t_ss*17*s,a_ss=t_ss*2.5*Math.PI*2,r_ss=(2+t_ss*4)*s,x_ss=cx_ss+Math.cos(a_ss)*r_ss,yO_ss=Math.sin(a_ss)*r_ss*0.2;if(Math.sin(a_ss)<0){if(i_ss===0||Math.sin((i_ss-1)/40*2.5*Math.PI*2)>=0)ctx.moveTo(x_ss,y_ss+yO_ss);else ctx.lineTo(x_ss,y_ss+yO_ss);}}
                ctx.stroke();
                // Spiral tube front
                ctx.strokeStyle=SS_SL;ctx.lineWidth=3*s;
                ctx.beginPath();
                for(var i_ss2=0;i_ss2<=40;i_ss2++){var t_ss2=i_ss2/40,y_ss2=3*s+t_ss2*17*s,a_ss2=t_ss2*2.5*Math.PI*2,r_ss2=(2+t_ss2*4)*s,x_ss2=cx_ss+Math.cos(a_ss2)*r_ss2,yO_ss2=Math.sin(a_ss2)*r_ss2*0.2;if(Math.sin(a_ss2)>=0){if(i_ss2===0||Math.sin((i_ss2-1)/40*2.5*Math.PI*2)<0)ctx.moveTo(x_ss2,y_ss2+yO_ss2);else ctx.lineTo(x_ss2,y_ss2+yO_ss2);}}
                ctx.stroke();
                // Highlight
                ctx.strokeStyle=SS_SL_L;ctx.lineWidth=1*s;
                ctx.beginPath();
                for(var i_ss3=0;i_ss3<=40;i_ss3++){var t_ss3=i_ss3/40,y_ss3=3*s+t_ss3*17*s,a_ss3=t_ss3*2.5*Math.PI*2,r_ss3=(2+t_ss3*4)*s,x_ss3=cx_ss+Math.cos(a_ss3)*r_ss3,yO_ss3=Math.sin(a_ss3)*r_ss3*0.2;if(Math.sin(a_ss3)>=0){if(i_ss3===0||Math.sin((i_ss3-1)/40*2.5*Math.PI*2)<0)ctx.moveTo(x_ss3,y_ss3+yO_ss3);else ctx.lineTo(x_ss3,y_ss3+yO_ss3);}}
                ctx.stroke();
                // Platform
                ctx.fillStyle=SS_PLAT;
                ctx.beginPath();ctx.ellipse(cx_ss, 3*s, 5*s, 1.8*s, 0, 0, Math.PI*2);ctx.fill();
                // Roof
                ctx.fillStyle=C.red;
                ctx.beginPath();ctx.moveTo(cx_ss, 0);ctx.lineTo(cx_ss+6*s, 2.5*s);ctx.lineTo(cx_ss-6*s, 2.5*s);ctx.closePath();ctx.fill();
                ctx.fillStyle=C.yellow;
                ctx.beginPath();ctx.ellipse(cx_ss, 2.5*s, 6*s, 0.8*s, 0, 0, Math.PI);ctx.fill();
                // Finial
                ctx.fillStyle=C.yellow;
                ctx.beginPath();ctx.arc(cx_ss, 0, 0.8*s, 0, Math.PI*2);ctx.fill();
                // Landing pad
                ctx.fillStyle=SS_PLAT;
                ctx.beginPath();ctx.roundRect(14*s, 20*s, 8*s, 2.5*s, 0.8*s);ctx.fill();
                ctx.fillStyle=SS_SL;
                ctx.beginPath();ctx.roundRect(13*s, 19.5*s, 4*s, 2*s, 0.6*s);ctx.fill();
                break;
            }
            case 'haunted-house': {
                // Right side wall
                ctx.fillStyle=HH_H2;
                ctx.beginPath();ctx.moveTo(19*s,9*s);ctx.lineTo(22*s,11*s);ctx.lineTo(22*s,22*s);ctx.lineTo(19*s,22*s);ctx.closePath();ctx.fill();
                // Front wall
                ctx.fillStyle=HH_H1;
                ctx.beginPath();ctx.roundRect(2*s,9*s,17*s,13*s,0.6*s);ctx.fill();
                ctx.fillStyle=HH_H3;ctx.fillRect(2*s,9*s,1*s,13*s);
                // Roof
                ctx.fillStyle=HH_ROOF;
                ctx.beginPath();ctx.moveTo(12*s,2*s);ctx.lineTo(1*s,9*s);ctx.lineTo(19*s,9*s);ctx.closePath();ctx.fill();
                ctx.fillStyle=HH_ROOF_L;
                ctx.beginPath();ctx.moveTo(12*s,2*s);ctx.lineTo(1*s,9*s);ctx.lineTo(7*s,9*s);ctx.closePath();ctx.fill();
                // Right roof
                ctx.fillStyle='#221828';
                ctx.beginPath();ctx.moveTo(12*s,2*s);ctx.lineTo(19*s,9*s);ctx.lineTo(23*s,11*s);ctx.lineTo(15*s,4*s);ctx.closePath();ctx.fill();
                // Tower
                ctx.fillStyle=HH_H1;
                ctx.beginPath();ctx.roundRect(16*s,3*s,5*s,19*s,0.5*s);ctx.fill();
                ctx.fillStyle=HH_H3;ctx.fillRect(16*s,3*s,0.8*s,19*s);
                // Tower spire
                ctx.fillStyle=HH_ROOF;
                ctx.beginPath();ctx.moveTo(18.5*s,0);ctx.lineTo(15.5*s,4*s);ctx.lineTo(21.5*s,4*s);ctx.closePath();ctx.fill();
                ctx.fillStyle=HH_ROOF_L;
                ctx.beginPath();ctx.moveTo(18.5*s,0);ctx.lineTo(16*s,4*s);ctx.lineTo(17.5*s,4*s);ctx.closePath();ctx.fill();
                // Tower window
                ctx.fillStyle='rgba(200,180,50,0.5)';
                ctx.fillRect(17.5*s,7*s,1.5*s,3*s);
                ctx.fillStyle=HH_H4;ctx.fillRect(18*s,7*s,0.3*s,3*s);
                // Front windows
                ctx.fillStyle='rgba(200,170,40,0.45)';
                ctx.beginPath();ctx.roundRect(4*s,12*s,4*s,3*s,0.3*s);ctx.fill();
                ctx.beginPath();ctx.roundRect(10*s,12*s,4*s,3*s,0.3*s);ctx.fill();
                ctx.fillStyle=HH_H4;
                ctx.fillRect(5.8*s,12*s,0.3*s,3*s);ctx.fillRect(4*s,13.3*s,4*s,0.3*s);
                ctx.fillRect(11.8*s,12*s,0.3*s,3*s);ctx.fillRect(10*s,13.3*s,4*s,0.3*s);
                // Gable window
                ctx.fillStyle='rgba(180,50,50,0.4)';
                ctx.beginPath();ctx.arc(10*s,6*s,1.5*s,0,Math.PI*2);ctx.fill();
                ctx.strokeStyle=HH_H4;ctx.lineWidth=0.3*s;
                ctx.beginPath();ctx.arc(10*s,6*s,1.5*s,0,Math.PI*2);ctx.stroke();
                // Door
                ctx.fillStyle=HH_WOOD;
                ctx.beginPath();ctx.roundRect(8*s,17*s,5*s,5*s,0.6*s);ctx.fill();
                ctx.fillStyle='#3a2820';
                ctx.beginPath();ctx.roundRect(8.5*s,17.5*s,4*s,4.5*s,0.5*s);ctx.fill();
                ctx.fillStyle=C.yellow;
                ctx.beginPath();ctx.arc(11.5*s,20*s,0.3*s,0,Math.PI*2);ctx.fill();
                // Ghost (static, faint)
                ctx.globalAlpha=0.2;
                ctx.fillStyle='#e0d8f0';
                ctx.beginPath();ctx.moveTo(4*s,4*s);ctx.quadraticCurveTo(2.5*s,5*s,3*s,7*s);ctx.quadraticCurveTo(3.5*s,6.5*s,4*s,7*s);ctx.quadraticCurveTo(5*s,5*s,4*s,4*s);ctx.fill();
                ctx.globalAlpha=1;
                break;
            }
            case 'junior-coaster':
                // Supports with bases
                ctx.fillStyle='#4ecdc4';
                ctx.fillRect(3*s,12*s,1*s,10.5*s); ctx.fillRect(10*s,10*s,1*s,12.5*s); ctx.fillRect(17*s,11*s,1*s,11.5*s);
                ctx.fillStyle='#3ab0a8';
                ctx.fillRect(2*s,22*s,3*s,1.2*s); ctx.fillRect(9*s,22*s,3*s,1.2*s); ctx.fillRect(16*s,22*s,3*s,1.2*s);
                // Track - gentle hills
                ctx.strokeStyle='#7a8a8a'; ctx.lineWidth=1.2*s; ctx.lineCap='round'; ctx.lineJoin='round';
                ctx.beginPath();
                ctx.moveTo(3*s,20*s); ctx.lineTo(3*s,12*s); ctx.quadraticCurveTo(3*s,6*s,8*s,5*s);
                ctx.quadraticCurveTo(12*s,4*s,14*s,8*s); ctx.quadraticCurveTo(16*s,12*s,19*s,10*s);
                ctx.lineTo(20*s,14*s); ctx.quadraticCurveTo(18*s,18*s,14*s,17*s);
                ctx.quadraticCurveTo(10*s,16*s,8*s,18*s); ctx.lineTo(6*s,20*s); ctx.lineTo(3*s,20*s);
                ctx.stroke();
                ctx.strokeStyle='#4ecdc4'; ctx.lineWidth=0.6*s;
                ctx.beginPath();
                ctx.moveTo(3*s,20*s); ctx.lineTo(3*s,12*s); ctx.quadraticCurveTo(3*s,6*s,8*s,5*s);
                ctx.quadraticCurveTo(12*s,4*s,14*s,8*s); ctx.quadraticCurveTo(16*s,12*s,19*s,10*s);
                ctx.lineTo(20*s,14*s); ctx.quadraticCurveTo(18*s,18*s,14*s,17*s);
                ctx.quadraticCurveTo(10*s,16*s,8*s,18*s); ctx.lineTo(6*s,20*s); ctx.lineTo(3*s,20*s);
                ctx.stroke();
                // Station
                ctx.fillStyle='#4ecdc4';
                ctx.beginPath(); ctx.roundRect(1*s,18*s,5*s,2.5*s,0.6*s); ctx.fill();
                ctx.fillStyle='#7aded8'; ctx.fillRect(1.5*s,18*s,4*s,0.8*s);
                // Stars on station
                ctx.fillStyle=C.yellow;
                ctx.beginPath();ctx.arc(2.5*s,17.5*s,1*s,0,Math.PI*2);ctx.fill();
                ctx.beginPath();ctx.arc(4.5*s,17.5*s,1*s,0,Math.PI*2);ctx.fill();
                ctx.beginPath();ctx.arc(3.5*s,17*s,1.2*s,0,Math.PI*2);ctx.fill();
                // Car with riders
                ctx.fillStyle='#ffe94d';
                ctx.beginPath(); ctx.roundRect(8*s,3*s,5*s,3.5*s,1*s); ctx.fill();
                ctx.fillStyle='#ddcc30';
                ctx.beginPath(); ctx.roundRect(8.5*s,2.5*s,4*s,1.5*s,0.6*s); ctx.fill();
                ctx.fillStyle='#ffd5b8';
                ctx.beginPath(); ctx.arc(9.5*s,1.5*s,1.1*s,0,Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(11.5*s,1.5*s,1.1*s,0,Math.PI*2); ctx.fill();
                break;
            case 'steel-coaster':
                // Supports with X-bracing
                ctx.fillStyle='#888898';
                ctx.fillRect(3*s,10*s,1*s,12.5*s); ctx.fillRect(11*s,8*s,1*s,14.5*s); ctx.fillRect(18*s,12*s,1*s,10.5*s);
                ctx.fillStyle='#686878';
                ctx.fillRect(2*s,22*s,3*s,1.2*s); ctx.fillRect(10*s,22*s,3*s,1.2*s); ctx.fillRect(17*s,22*s,3*s,1.2*s);
                // X-bracing on tall support
                ctx.strokeStyle='#686878';ctx.lineWidth=0.3*s;
                ctx.beginPath();ctx.moveTo(3*s,12*s);ctx.lineTo(4*s,18*s);ctx.stroke();
                ctx.beginPath();ctx.moveTo(4*s,12*s);ctx.lineTo(3*s,18*s);ctx.stroke();
                // Track with loop
                ctx.strokeStyle='#888898'; ctx.lineWidth=1.2*s; ctx.lineCap='round'; ctx.lineJoin='round';
                ctx.beginPath();
                ctx.moveTo(3*s,20*s); ctx.lineTo(3*s,10*s); ctx.quadraticCurveTo(3*s,3*s,9*s,3*s);
                ctx.lineTo(14*s,3*s); ctx.quadraticCurveTo(19*s,3*s,19*s,8*s);
                ctx.stroke();
                // Loop
                ctx.beginPath(); ctx.arc(15*s,14*s,4*s, -Math.PI*0.5, Math.PI*1.5); ctx.stroke();
                // Return track
                ctx.beginPath();
                ctx.moveTo(19*s,14*s); ctx.quadraticCurveTo(21*s,18*s,17*s,19*s);
                ctx.quadraticCurveTo(12*s,20*s,8*s,19*s); ctx.lineTo(3*s,20*s);
                ctx.stroke();
                // Colored center rail
                ctx.strokeStyle='#7b68ee'; ctx.lineWidth=0.6*s;
                ctx.beginPath();
                ctx.moveTo(3*s,20*s); ctx.lineTo(3*s,10*s); ctx.quadraticCurveTo(3*s,3*s,9*s,3*s);
                ctx.lineTo(14*s,3*s); ctx.quadraticCurveTo(19*s,3*s,19*s,8*s);
                ctx.stroke();
                ctx.beginPath(); ctx.arc(15*s,14*s,4*s, -Math.PI*0.5, Math.PI*1.5); ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(19*s,14*s); ctx.quadraticCurveTo(21*s,18*s,17*s,19*s);
                ctx.quadraticCurveTo(12*s,20*s,8*s,19*s); ctx.lineTo(3*s,20*s);
                ctx.stroke();
                // Station
                ctx.fillStyle='#7b68ee';
                ctx.beginPath(); ctx.roundRect(1*s,18*s,5*s,2.5*s,0.6*s); ctx.fill();
                ctx.fillStyle='#9d8eff'; ctx.fillRect(1.5*s,18*s,4*s,0.8*s);
                // Orbs on station
                ctx.fillStyle='#5a48cc';
                ctx.beginPath();ctx.arc(2.5*s,17.5*s,1.2*s,0,Math.PI*2);ctx.fill();
                ctx.beginPath();ctx.arc(4.5*s,17.5*s,1.2*s,0,Math.PI*2);ctx.fill();
                ctx.fillStyle='#7b68ee';
                ctx.beginPath();ctx.arc(2.5*s,17.5*s,0.7*s,0,Math.PI*2);ctx.fill();
                ctx.beginPath();ctx.arc(4.5*s,17.5*s,0.7*s,0,Math.PI*2);ctx.fill();
                // Car with riders
                ctx.fillStyle='#ff4444';
                ctx.beginPath(); ctx.roundRect(9*s,1*s,5.5*s,3.5*s,1*s); ctx.fill();
                ctx.fillStyle='#cc2222';
                ctx.beginPath(); ctx.roundRect(9.5*s,0.5*s,4.5*s,1.5*s,0.6*s); ctx.fill();
                ctx.fillStyle='#ffd5b8';
                ctx.beginPath(); ctx.arc(10.5*s,-0.5*s,1.1*s,0,Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(13*s,-0.5*s,1.1*s,0,Math.PI*2); ctx.fill();
                break;
            case 'wooden-coaster':
                // Double wooden supports with lattice bracing
                ctx.fillStyle='#8a7050';
                ctx.fillRect(2.5*s,10*s,0.8*s,12.5*s); ctx.fillRect(4*s,10*s,0.8*s,12.5*s);
                ctx.fillRect(10*s,7*s,0.8*s,15.5*s); ctx.fillRect(11.5*s,7*s,0.8*s,15.5*s);
                ctx.fillRect(17.5*s,11*s,0.8*s,11.5*s); ctx.fillRect(19*s,11*s,0.8*s,11.5*s);
                ctx.fillStyle='#6a5038';
                ctx.fillRect(2*s,22*s,3.5*s,1.2*s); ctx.fillRect(9.5*s,22*s,3.5*s,1.2*s); ctx.fillRect(17*s,22*s,3.5*s,1.2*s);
                // Diagonal lattice bracing
                ctx.strokeStyle='#6a5038';ctx.lineWidth=0.4*s;
                // Left support
                ctx.beginPath();ctx.moveTo(2.5*s,12*s);ctx.lineTo(4.8*s,17*s);ctx.stroke();
                ctx.beginPath();ctx.moveTo(4.8*s,12*s);ctx.lineTo(2.5*s,17*s);ctx.stroke();
                ctx.beginPath();ctx.moveTo(2.5*s,17*s);ctx.lineTo(4.8*s,22*s);ctx.stroke();
                ctx.beginPath();ctx.moveTo(4.8*s,17*s);ctx.lineTo(2.5*s,22*s);ctx.stroke();
                // Center support
                ctx.beginPath();ctx.moveTo(10*s,9*s);ctx.lineTo(12.3*s,14*s);ctx.stroke();
                ctx.beginPath();ctx.moveTo(12.3*s,9*s);ctx.lineTo(10*s,14*s);ctx.stroke();
                ctx.beginPath();ctx.moveTo(10*s,14*s);ctx.lineTo(12.3*s,19*s);ctx.stroke();
                ctx.beginPath();ctx.moveTo(12.3*s,14*s);ctx.lineTo(10*s,19*s);ctx.stroke();
                // Horizontal bars
                ctx.fillStyle='#6a5038';
                ctx.fillRect(2.5*s,14*s,2.3*s,0.4*s);ctx.fillRect(2.5*s,18*s,2.3*s,0.4*s);
                ctx.fillRect(10*s,11*s,2.3*s,0.4*s);ctx.fillRect(10*s,15*s,2.3*s,0.4*s);
                // Track - angular wooden coaster style
                ctx.strokeStyle='#d9b87c'; ctx.lineWidth=1.6*s; ctx.lineCap='round'; ctx.lineJoin='round';
                ctx.beginPath();
                ctx.moveTo(3*s,20*s); ctx.lineTo(3*s,10*s); ctx.lineTo(7*s,4*s); ctx.lineTo(11*s,3*s);
                ctx.lineTo(16*s,6*s); ctx.lineTo(19*s,5*s); ctx.lineTo(21*s,11*s);
                ctx.lineTo(18*s,13*s); ctx.lineTo(14*s,10*s); ctx.lineTo(10*s,13*s);
                ctx.lineTo(14*s,16*s); ctx.lineTo(19*s,15*s); ctx.lineTo(20*s,18*s);
                ctx.lineTo(15*s,19*s); ctx.lineTo(8*s,18*s); ctx.lineTo(3*s,20*s);
                ctx.stroke();
                // Ledger board
                ctx.strokeStyle='#b89858'; ctx.lineWidth=0.5*s;
                ctx.beginPath();
                ctx.moveTo(3*s,20*s); ctx.lineTo(3*s,10*s); ctx.lineTo(7*s,4*s); ctx.lineTo(11*s,3*s);
                ctx.lineTo(16*s,6*s); ctx.lineTo(19*s,5*s); ctx.lineTo(21*s,11*s);
                ctx.lineTo(18*s,13*s); ctx.lineTo(14*s,10*s); ctx.lineTo(10*s,13*s);
                ctx.lineTo(14*s,16*s); ctx.lineTo(19*s,15*s); ctx.lineTo(20*s,18*s);
                ctx.lineTo(15*s,19*s); ctx.lineTo(8*s,18*s); ctx.lineTo(3*s,20*s);
                ctx.stroke();
                // Station - rustic wood
                ctx.fillStyle='#d9b87c';
                ctx.beginPath(); ctx.roundRect(1*s,18*s,5*s,2.5*s,0.6*s); ctx.fill();
                ctx.fillStyle='#f0d8a0'; ctx.fillRect(1.5*s,18*s,4*s,0.8*s);
                // Wooden peaked roof
                ctx.fillStyle='#8a7050';
                ctx.beginPath();ctx.moveTo(1.5*s,17.5*s);ctx.lineTo(3.5*s,15.5*s);ctx.lineTo(5.5*s,17.5*s);ctx.closePath();ctx.fill();
                ctx.fillStyle='#a08868';
                ctx.beginPath();ctx.moveTo(2*s,17.5*s);ctx.lineTo(3.5*s,16*s);ctx.lineTo(5*s,17.5*s);ctx.closePath();ctx.fill();
                // Car with riders
                ctx.fillStyle='#cc3030';
                ctx.beginPath(); ctx.roundRect(8*s,1*s,5*s,3.5*s,1*s); ctx.fill();
                ctx.fillStyle='#aa2020';
                ctx.beginPath(); ctx.roundRect(8.5*s,0.5*s,4*s,1.5*s,0.6*s); ctx.fill();
                ctx.fillStyle='#ffd5b8';
                ctx.beginPath(); ctx.arc(9.5*s,-0.5*s,1.1*s,0,Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(12*s,-0.5*s,1.1*s,0,Math.PI*2); ctx.fill();
                break;
            case 'hyper-coaster':
                // Tall supports with heavy X-bracing
                ctx.fillStyle='#8a8a9a';
                ctx.fillRect(3*s,2*s,1.2*s,20.5*s); ctx.fillRect(11*s,10*s,1*s,12.5*s); ctx.fillRect(18*s,14*s,1*s,8.5*s);
                ctx.fillStyle='#6a6a7a';
                ctx.fillRect(2*s,22*s,3.5*s,1.2*s); ctx.fillRect(10*s,22*s,3*s,1.2*s); ctx.fillRect(17*s,22*s,3*s,1.2*s);
                // X-bracing on tall support
                ctx.strokeStyle='#6a6a7a';ctx.lineWidth=0.3*s;
                ctx.beginPath();ctx.moveTo(3*s,4*s);ctx.lineTo(4.2*s,10*s);ctx.stroke();
                ctx.beginPath();ctx.moveTo(4.2*s,4*s);ctx.lineTo(3*s,10*s);ctx.stroke();
                ctx.beginPath();ctx.moveTo(3*s,10*s);ctx.lineTo(4.2*s,16*s);ctx.stroke();
                ctx.beginPath();ctx.moveTo(4.2*s,10*s);ctx.lineTo(3*s,16*s);ctx.stroke();
                ctx.beginPath();ctx.moveTo(3*s,16*s);ctx.lineTo(4.2*s,22*s);ctx.stroke();
                ctx.beginPath();ctx.moveTo(4.2*s,16*s);ctx.lineTo(3*s,22*s);ctx.stroke();
                // Horizontal bars
                ctx.fillStyle='#6a6a7a';
                ctx.fillRect(2.5*s,7*s,2*s,0.4*s);ctx.fillRect(2.5*s,13*s,2*s,0.4*s);ctx.fillRect(2.5*s,19*s,2*s,0.4*s);
                // Track - steep first drop, airtime hills
                ctx.strokeStyle='#8a8a9a'; ctx.lineWidth=1.2*s; ctx.lineCap='round'; ctx.lineJoin='round';
                ctx.beginPath();
                ctx.moveTo(3*s,20*s); ctx.lineTo(3*s,2*s); ctx.lineTo(10*s,2*s);
                ctx.quadraticCurveTo(15*s,2*s,16*s,10*s); ctx.quadraticCurveTo(17*s,16*s,19*s,14*s);
                ctx.quadraticCurveTo(21*s,12*s,20*s,16*s);
                ctx.quadraticCurveTo(19*s,20*s,15*s,19*s);
                ctx.quadraticCurveTo(10*s,18*s,8*s,19*s); ctx.lineTo(3*s,20*s);
                ctx.stroke();
                ctx.strokeStyle='#ff8c42'; ctx.lineWidth=0.6*s;
                ctx.beginPath();
                ctx.moveTo(3*s,20*s); ctx.lineTo(3*s,2*s); ctx.lineTo(10*s,2*s);
                ctx.quadraticCurveTo(15*s,2*s,16*s,10*s); ctx.quadraticCurveTo(17*s,16*s,19*s,14*s);
                ctx.quadraticCurveTo(21*s,12*s,20*s,16*s);
                ctx.quadraticCurveTo(19*s,20*s,15*s,19*s);
                ctx.quadraticCurveTo(10*s,18*s,8*s,19*s); ctx.lineTo(3*s,20*s);
                ctx.stroke();
                // Station
                ctx.fillStyle='#ff8c42';
                ctx.beginPath(); ctx.roundRect(1*s,18*s,5*s,2.5*s,0.6*s); ctx.fill();
                ctx.fillStyle='#ffaa68'; ctx.fillRect(1.5*s,18*s,4*s,0.8*s);
                // Flame decorations
                ctx.fillStyle='#ff4422';
                ctx.beginPath();ctx.moveTo(2.5*s,17.5*s);ctx.quadraticCurveTo(2*s,15.5*s,2.5*s,15*s);ctx.quadraticCurveTo(3*s,15.5*s,3.5*s,17.5*s);ctx.closePath();ctx.fill();
                ctx.fillStyle=C.yellow;
                ctx.beginPath();ctx.moveTo(2.7*s,17.5*s);ctx.quadraticCurveTo(2.5*s,16*s,2.7*s,15.8*s);ctx.quadraticCurveTo(3*s,16*s,3.3*s,17.5*s);ctx.closePath();ctx.fill();
                ctx.fillStyle='#ff4422';
                ctx.beginPath();ctx.moveTo(4*s,17.5*s);ctx.quadraticCurveTo(3.5*s,15.5*s,4*s,15*s);ctx.quadraticCurveTo(4.5*s,15.5*s,5*s,17.5*s);ctx.closePath();ctx.fill();
                ctx.fillStyle=C.yellow;
                ctx.beginPath();ctx.moveTo(4.2*s,17.5*s);ctx.quadraticCurveTo(4*s,16*s,4.2*s,15.8*s);ctx.quadraticCurveTo(4.5*s,16*s,4.8*s,17.5*s);ctx.closePath();ctx.fill();
                // Car with riders
                ctx.fillStyle='#ff2222';
                ctx.beginPath(); ctx.roundRect(7*s,0*s,5.5*s,3.5*s,1*s); ctx.fill();
                ctx.fillStyle='#cc1111';
                ctx.beginPath(); ctx.roundRect(7.5*s,-0.5*s,4.5*s,1.5*s,0.6*s); ctx.fill();
                ctx.fillStyle='#ffcc88';ctx.fillRect(7.5*s,2*s,4.5*s,0.5*s);
                ctx.fillStyle='#ffd5b8';
                ctx.beginPath(); ctx.arc(8.5*s,-1.5*s,1.1*s,0,Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(11*s,-1.5*s,1.1*s,0,Math.PI*2); ctx.fill();
                break;
            case 'ice-cream':
                // Cone
                ctx.fillStyle = '#d4a056';
                ctx.beginPath(); ctx.moveTo(12*s, 20*s); ctx.lineTo(8*s, 10*s); ctx.lineTo(16*s, 10*s); ctx.fill();
                ctx.strokeStyle='#c49046';ctx.lineWidth=0.3*s;
                ctx.beginPath();ctx.moveTo(9*s,11*s);ctx.lineTo(14*s,19*s);ctx.stroke();
                ctx.beginPath();ctx.moveTo(15*s,11*s);ctx.lineTo(10*s,19*s);ctx.stroke();
                // Scoops
                ctx.fillStyle = '#ff90a0'; ctx.beginPath(); ctx.arc(10*s, 9*s, 3.5*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#f5e6c8'; ctx.beginPath(); ctx.arc(14*s, 9*s, 3.5*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#7a5030'; ctx.beginPath(); ctx.arc(12*s, 6*s, 3.5*s, 0, Math.PI*2); ctx.fill();
                // Highlights
                ctx.fillStyle='rgba(255,255,255,0.35)';
                ctx.beginPath();ctx.arc(9*s,8*s,1.2*s,0,Math.PI*2);ctx.fill();
                ctx.beginPath();ctx.arc(11*s,5*s,1*s,0,Math.PI*2);ctx.fill();
                // Cherry
                ctx.fillStyle='#e02040';ctx.beginPath();ctx.arc(12*s,3.5*s,1.5*s,0,Math.PI*2);ctx.fill();
                ctx.fillStyle='#4a8030';ctx.fillRect(11.8*s,2*s,0.5*s,1.5*s);
                break;
            case 'soft-drinks':
                // Cup body
                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.moveTo(6*s, 20*s); ctx.lineTo(7*s, 8*s); ctx.lineTo(17*s, 8*s); ctx.lineTo(18*s, 20*s); ctx.closePath(); ctx.fill();
                // Red stripe
                ctx.fillStyle='#dd2020';
                ctx.beginPath();ctx.moveTo(6.3*s,18*s);ctx.lineTo(6.8*s,12*s);ctx.lineTo(17.2*s,12*s);ctx.lineTo(16.7*s,18*s);ctx.closePath();ctx.fill();
                // Lid
                ctx.fillStyle = '#e0e0e0'; ctx.beginPath(); ctx.roundRect(5.5*s, 7*s, 13*s, 2*s, 1*s); ctx.fill();
                // Straw
                ctx.fillStyle='#dd2020'; ctx.fillRect(14*s, 2*s, 1.5*s, 7*s);
                ctx.fillStyle='#ffc020'; ctx.fillRect(14*s, 2*s, 1.5*s, 1*s); ctx.fillRect(14*s, 4*s, 1.5*s, 1*s);
                // Condensation
                ctx.fillStyle='rgba(180,220,255,0.5)';
                ctx.beginPath();ctx.arc(9*s,14*s,0.7*s,0,Math.PI*2);ctx.fill();
                ctx.beginPath();ctx.arc(15*s,15*s,0.5*s,0,Math.PI*2);ctx.fill();
                break;
            case 'waffles':
                // Waffle base
                ctx.fillStyle = '#d4a056'; ctx.beginPath(); ctx.roundRect(4*s, 8*s, 16*s, 10*s, 2*s); ctx.fill();
                // Grid pattern
                ctx.fillStyle = '#c49046';
                for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) ctx.fillRect((5 + x*4)*s, (9 + y*3)*s, 3*s, 2*s);
                // Grid lines
                ctx.strokeStyle='#b08036';ctx.lineWidth=0.4*s;
                for(var gl=0;gl<5;gl++){ctx.beginPath();ctx.moveTo((5+gl*3.5)*s,8*s);ctx.lineTo((5+gl*3.5)*s,18*s);ctx.stroke();}
                // Whipped cream
                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.arc(10*s, 7*s, 3*s, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(14*s, 7*s, 2.5*s, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(12*s, 5.5*s, 2*s, 0, Math.PI*2); ctx.fill();
                // Strawberry
                ctx.fillStyle = '#e02040'; ctx.beginPath(); ctx.arc(12*s, 4*s, 2*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle='rgba(255,255,255,0.3)';ctx.fillRect(11.5*s,3.5*s,0.8*s,0.8*s);
                ctx.fillStyle='#4a8030';ctx.fillRect(11.5*s,2.5*s,1*s,1.5*s);
                // Syrup drip
                ctx.fillStyle='#c08030';
                ctx.beginPath();ctx.moveTo(6*s,12*s);ctx.quadraticCurveTo(5*s,15*s,5*s,17*s);ctx.lineTo(6*s,17*s);ctx.quadraticCurveTo(6*s,15*s,6.5*s,12*s);ctx.fill();
                break;
            case 'burger-joint':
                // Bun top
                ctx.fillStyle = '#d4a056'; ctx.beginPath(); ctx.arc(12*s, 6*s, 5*s, Math.PI, 0); ctx.fill();
                // Sesame seeds
                ctx.fillStyle='#f5e6c8';ctx.fillRect(9*s,4*s,1.2*s,0.8*s);ctx.fillRect(13*s,5*s,1.2*s,0.8*s);ctx.fillRect(11*s,3*s,1*s,0.8*s);
                // Lettuce
                ctx.fillStyle='#4caf50';ctx.beginPath();ctx.moveTo(6*s,8*s);ctx.quadraticCurveTo(9*s,6*s,12*s,8*s);ctx.quadraticCurveTo(15*s,6*s,18*s,8*s);ctx.lineTo(18*s,9*s);ctx.lineTo(6*s,9*s);ctx.closePath();ctx.fill();
                // Patty
                ctx.fillStyle='#6d3a1a';ctx.beginPath();ctx.roundRect(7*s,9*s,10*s,3*s,1*s);ctx.fill();
                ctx.fillStyle='#8B4513';ctx.fillRect(8*s,9*s,8*s,1*s);
                // Cheese
                ctx.fillStyle='#ffc107';ctx.beginPath();ctx.moveTo(6*s,10*s);ctx.lineTo(7*s,12*s);ctx.lineTo(17*s,12*s);ctx.lineTo(18*s,10*s);ctx.closePath();ctx.fill();
                // Bun bottom
                ctx.fillStyle='#c89040';ctx.beginPath();ctx.roundRect(7*s,12*s,10*s,3*s,1*s);ctx.fill();
                // Plate
                ctx.fillStyle='#e8e0d8';ctx.beginPath();ctx.ellipse(12*s,17*s,8*s,2*s,0,0,Math.PI*2);ctx.fill();
                ctx.fillStyle='#d8d0c8';ctx.beginPath();ctx.ellipse(12*s,17*s,6*s,1.5*s,0,0,Math.PI*2);ctx.fill();
                break;
            case 'bush':
                // Ground shadow
                ctx.fillStyle='rgba(0,30,10,0.2)';ctx.beginPath();ctx.ellipse(12*s,20*s,9*s,2.5*s,0,0,Math.PI*2);ctx.fill();
                // Back foliage
                ctx.fillStyle='#3a7a40';
                ctx.beginPath();ctx.arc(8*s,16*s,5*s,0,Math.PI*2);ctx.fill();
                ctx.beginPath();ctx.arc(16*s,16*s,5*s,0,Math.PI*2);ctx.fill();
                ctx.beginPath();ctx.arc(12*s,17*s,6*s,0,Math.PI*2);ctx.fill();
                // Middle foliage
                ctx.fillStyle='#4d9e5d';
                ctx.beginPath();ctx.arc(7*s,12*s,4.5*s,0,Math.PI*2);ctx.fill();
                ctx.beginPath();ctx.arc(12*s,13*s,5*s,0,Math.PI*2);ctx.fill();
                ctx.beginPath();ctx.arc(17*s,12*s,4.5*s,0,Math.PI*2);ctx.fill();
                // Top foliage
                ctx.fillStyle='#5aae6a';
                ctx.beginPath();ctx.arc(10*s,9*s,4*s,0,Math.PI*2);ctx.fill();
                ctx.beginPath();ctx.arc(15*s,9*s,4*s,0,Math.PI*2);ctx.fill();
                ctx.fillStyle='#6dbe7a';
                ctx.beginPath();ctx.arc(12*s,7*s,3.5*s,0,Math.PI*2);ctx.fill();
                // Highlights
                ctx.fillStyle='#8fd9a8';ctx.fillRect(10*s,6*s,1.5*s,1.5*s);ctx.fillRect(15*s,5*s,1.5*s,1.5*s);
                // Berry accents
                ctx.fillStyle='#e06070';ctx.fillRect(7*s,11*s,1.5*s,1.5*s);ctx.fillRect(16*s,12*s,1.5*s,1.5*s);
                break;
            case 'hedge':
                // Shadow
                ctx.fillStyle='rgba(0,30,10,0.18)';ctx.beginPath();ctx.ellipse(12*s,21*s,9*s,2*s,0,0,Math.PI*2);ctx.fill();
                // Dark base
                ctx.fillStyle='#2d7a37';ctx.beginPath();ctx.roundRect(3*s,8*s,18*s,14*s,2*s);ctx.fill();
                // Mid layer
                ctx.fillStyle='#3d8a47';ctx.beginPath();ctx.roundRect(4*s,6*s,16*s,12*s,2*s);ctx.fill();
                // Top face
                ctx.fillStyle='#4d9a57';ctx.beginPath();ctx.roundRect(4*s,6*s,16*s,7*s,2*s);ctx.fill();
                // Highlight ridge
                ctx.fillStyle='#5daa67';ctx.beginPath();ctx.roundRect(5*s,6*s,14*s,3.5*s,1.5*s);ctx.fill();
                // Leaf texture dark
                ctx.fillStyle='#3a8242';ctx.fillRect(7*s,10*s,1.5*s,1.5*s);ctx.fillRect(12*s,12*s,1.5*s,1.5*s);ctx.fillRect(16*s,10*s,1.5*s,1.5*s);
                ctx.fillRect(9*s,15*s,1.5*s,1.5*s);ctx.fillRect(14*s,16*s,1.5*s,1*s);
                // Leaf texture light
                ctx.fillStyle='#6dbe7a';ctx.fillRect(8*s,7*s,1.5*s,1.5*s);ctx.fillRect(14*s,7*s,1.5*s,1*s);ctx.fillRect(11*s,8.5*s,1*s,1*s);
                break;
            case 'flowers':
                var flIcCols = ['#ff6b8a','#ffcc44','#6baeff','#c06bff','#ff5544'];
                // Leaf bed
                ctx.fillStyle='#5aae6a';
                ctx.beginPath();ctx.ellipse(12*s,18*s,9*s,3*s,0,0,Math.PI*2);ctx.fill();
                ctx.fillStyle='#4d9e5d';
                ctx.beginPath();ctx.ellipse(12*s,19*s,7*s,2*s,0,0,Math.PI*2);ctx.fill();
                // 5 flowers
                var fIcPos=[{x:6,y:8},{x:12,y:5},{x:18,y:8},{x:8,y:14},{x:16,y:13}];
                for(var fi2=0;fi2<5;fi2++){var fx2=fIcPos[fi2].x*s,fy2=fIcPos[fi2].y*s;
                    // Stem
                    ctx.strokeStyle='#4a8a50';ctx.lineWidth=0.7*s;ctx.beginPath();ctx.moveTo(fx2,fy2+2*s);ctx.lineTo(fx2,fy2+5*s);ctx.stroke();
                    // Petals
                    ctx.fillStyle=flIcCols[fi2];
                    for(var p2=0;p2<5;p2++){var pa2=p2*Math.PI*2/5-Math.PI/2;ctx.beginPath();ctx.arc(fx2+Math.cos(pa2)*2*s,fy2+Math.sin(pa2)*2*s,1.3*s,0,Math.PI*2);ctx.fill();}
                    // Center
                    ctx.fillStyle='#ffdd44';ctx.beginPath();ctx.arc(fx2,fy2,1*s,0,Math.PI*2);ctx.fill();
                }
                break;
            case 'tree-oak':
                // Shadow
                ctx.fillStyle='rgba(0,30,10,0.2)';ctx.beginPath();ctx.ellipse(12*s,21*s,10*s,3*s,0,0,Math.PI*2);ctx.fill();
                // Trunk
                ctx.fillStyle='#6a4a28';ctx.fillRect(10*s,15*s,4*s,7*s);
                ctx.fillStyle='#7d5c3a';ctx.fillRect(10*s,15*s,3*s,7*s);
                ctx.fillStyle='#946e48';ctx.fillRect(10*s,15*s,1.5*s,7*s);
                // Canopy layers (dark to light, matching in-game oak)
                ctx.fillStyle='#2d6a22';ctx.beginPath();ctx.ellipse(12*s,12*s,10*s,9*s,0,0,Math.PI*2);ctx.fill();
                ctx.fillStyle='#3d8a47';ctx.beginPath();ctx.ellipse(12*s,10*s,9*s,7.5*s,0,0,Math.PI*2);ctx.fill();
                ctx.fillStyle='#4d9a57';ctx.beginPath();ctx.arc(8*s,7*s,5.5*s,0,Math.PI*2);ctx.fill();
                ctx.beginPath();ctx.arc(16*s,7*s,5.5*s,0,Math.PI*2);ctx.fill();
                ctx.fillStyle='#5daa67';ctx.beginPath();ctx.ellipse(12*s,6*s,7*s,5*s,0,0,Math.PI*2);ctx.fill();
                ctx.fillStyle='#6dba77';ctx.beginPath();ctx.ellipse(12*s,4*s,5*s,3.5*s,0,0,Math.PI*2);ctx.fill();
                // Leaf highlights
                ctx.fillStyle='#88dc80';ctx.fillRect(9*s,4*s,1.5*s,1.5*s);ctx.fillRect(14*s,3*s,1.5*s,1*s);ctx.fillRect(11*s,7*s,1*s,1*s);
                break;
            case 'tree-pine':
                // Shadow
                ctx.fillStyle='rgba(0,30,10,0.18)';ctx.beginPath();ctx.ellipse(12*s,21*s,8*s,2.5*s,0,0,Math.PI*2);ctx.fill();
                // Trunk
                ctx.fillStyle='#5a3a1a';ctx.fillRect(11*s,17*s,2.5*s,5*s);
                ctx.fillStyle='#6d4c2a';ctx.fillRect(11*s,17*s,1.5*s,5*s);
                // Tiered canopy (dark to light, matching in-game pine)
                ctx.fillStyle='#1e5520';ctx.beginPath();ctx.ellipse(12*s,16*s,9*s,4*s,0,0,Math.PI*2);ctx.fill();
                ctx.fillStyle='#2a6a2e';ctx.beginPath();ctx.ellipse(12*s,12*s,8*s,4*s,0,0,Math.PI*2);ctx.fill();
                ctx.fillStyle='#347a38';ctx.beginPath();ctx.ellipse(12*s,8.5*s,7*s,4*s,0,0,Math.PI*2);ctx.fill();
                ctx.fillStyle='#3e8a42';ctx.beginPath();ctx.ellipse(12*s,5.5*s,5.5*s,3.5*s,0,0,Math.PI*2);ctx.fill();
                ctx.fillStyle='#48994c';ctx.beginPath();ctx.ellipse(12*s,3*s,3.5*s,2.5*s,0,0,Math.PI*2);ctx.fill();
                // Highlights
                ctx.fillStyle='#5cb05c';ctx.fillRect(10*s,4*s,1.5*s,1*s);ctx.fillRect(14*s,7*s,1*s,1*s);ctx.fillRect(8*s,10*s,1*s,1*s);
                break;
            case 'tree-cherry':
                // Shadow
                ctx.fillStyle='rgba(0,30,10,0.2)';ctx.beginPath();ctx.ellipse(12*s,21*s,10*s,3*s,0,0,Math.PI*2);ctx.fill();
                // Trunk
                ctx.fillStyle='#6a4a28';ctx.fillRect(10*s,15*s,4*s,7*s);
                ctx.fillStyle='#7d5c3a';ctx.fillRect(10*s,15*s,3*s,7*s);
                ctx.fillStyle='#946e48';ctx.fillRect(10*s,15*s,1.5*s,7*s);
                // Canopy layers (pink cherry blossom)
                ctx.fillStyle='#c87898';ctx.beginPath();ctx.ellipse(12*s,12*s,10*s,9*s,0,0,Math.PI*2);ctx.fill();
                ctx.fillStyle='#e898b0';ctx.beginPath();ctx.ellipse(12*s,10*s,9*s,7.5*s,0,0,Math.PI*2);ctx.fill();
                ctx.fillStyle='#f0a8c0';ctx.beginPath();ctx.arc(8*s,7*s,5.5*s,0,Math.PI*2);ctx.fill();
                ctx.beginPath();ctx.arc(16*s,7*s,5.5*s,0,Math.PI*2);ctx.fill();
                ctx.fillStyle='#f8b8d0';ctx.beginPath();ctx.ellipse(12*s,6*s,7*s,5*s,0,0,Math.PI*2);ctx.fill();
                ctx.fillStyle='#fdd0e0';ctx.beginPath();ctx.ellipse(12*s,4*s,5*s,3.5*s,0,0,Math.PI*2);ctx.fill();
                // Petal highlights
                ctx.fillStyle='#ffe8f0';ctx.fillRect(9*s,4*s,1.5*s,1.5*s);ctx.fillRect(14*s,3*s,1.5*s,1*s);
                // Falling petals
                ctx.fillStyle='#f2c0c8';ctx.fillRect(5*s,16*s,1*s,1*s);ctx.fillRect(18*s,14*s,1*s,1*s);ctx.fillRect(7*s,19*s,1*s,1*s);
                break;
            case 'fountain':
                // Shadow
                ctx.fillStyle='rgba(0,20,30,0.15)';ctx.beginPath();ctx.ellipse(12*s,21*s,10*s,2.5*s,0,0,Math.PI*2);ctx.fill();
                // Outer basin
                ctx.fillStyle='#8878a0';ctx.beginPath();ctx.ellipse(12*s,19*s,10*s,4*s,0,0,Math.PI*2);ctx.fill();
                ctx.fillStyle='#9888b0';ctx.beginPath();ctx.ellipse(12*s,18.5*s,9*s,3.5*s,0,0,Math.PI*2);ctx.fill();
                // Basin rim
                ctx.fillStyle='#a898c0';ctx.beginPath();ctx.ellipse(12*s,18*s,8.5*s,3*s,0,0,Math.PI*2);ctx.fill();
                // Water surface
                ctx.fillStyle='#6dd5f7';ctx.beginPath();ctx.ellipse(12*s,18*s,7.5*s,2.5*s,0,0,Math.PI*2);ctx.fill();
                ctx.fillStyle='#5dc5e7';ctx.beginPath();ctx.ellipse(12*s,18*s,6*s,2*s,0,0,Math.PI*2);ctx.fill();
                // Water shimmer
                ctx.fillStyle='rgba(180,230,255,0.4)';ctx.beginPath();ctx.ellipse(10*s,17.5*s,2*s,0.8*s,0.3,0,Math.PI*2);ctx.fill();
                // Central pillar
                ctx.fillStyle='#9080a8';ctx.fillRect(11*s,12*s,2.5*s,7*s);
                ctx.fillStyle='#a090b8';ctx.fillRect(11*s,12*s,1.5*s,6*s);
                // Upper bowl
                ctx.fillStyle='#a898c0';ctx.beginPath();ctx.ellipse(12*s,12*s,4*s,1.5*s,0,0,Math.PI*2);ctx.fill();
                ctx.fillStyle='#6dd5f7';ctx.beginPath();ctx.ellipse(12*s,12*s,3*s,1*s,0,0,Math.PI*2);ctx.fill();
                // Water jet
                ctx.fillStyle='rgba(109,213,247,0.5)';
                ctx.fillRect(11.5*s,4*s,1.5*s,8*s);
                ctx.fillStyle='rgba(109,213,247,0.35)';
                ctx.fillRect(11.5*s,3*s,1.5*s,2*s);
                // Splash at top
                ctx.fillStyle='rgba(180,230,255,0.5)';ctx.beginPath();ctx.arc(12*s,3.5*s,2*s,0,Math.PI*2);ctx.fill();
                break;
            case 'pirate-ship': {
                // Water pool
                ctx.fillStyle=PS_WATER;
                ctx.beginPath();ctx.ellipse(12*s,21*s,10*s,2.5*s,0,0,Math.PI*2);ctx.fill();
                ctx.fillStyle=PS_WATER_L;ctx.fillRect(5*s,20.5*s,14*s,0.4*s);
                // A-frame
                ctx.strokeStyle=PS_STRUC;ctx.lineWidth=1.2*s;
                ctx.beginPath();ctx.moveTo(4*s,22*s);ctx.lineTo(12*s,3*s);ctx.stroke();
                ctx.beginPath();ctx.moveTo(20*s,22*s);ctx.lineTo(12*s,3*s);ctx.stroke();
                ctx.strokeStyle=PS_STRUC_L;ctx.lineWidth=0.4*s;
                ctx.beginPath();ctx.moveTo(4.5*s,22*s);ctx.lineTo(12*s,3*s);ctx.stroke();
                // Cross brace
                ctx.strokeStyle=PS_STRUC;ctx.lineWidth=0.6*s;
                ctx.beginPath();ctx.moveTo(7*s,15*s);ctx.lineTo(17*s,15*s);ctx.stroke();
                // Pivot arm
                ctx.strokeStyle=PS_IRON;ctx.lineWidth=0.8*s;
                ctx.beginPath();ctx.moveTo(12*s,3*s);ctx.lineTo(12*s,11*s);ctx.stroke();
                // Pivot hub
                ctx.fillStyle=PS_IRON;
                ctx.beginPath();ctx.arc(12*s,3*s,1.2*s,0,Math.PI*2);ctx.fill();
                // Ship hull
                ctx.fillStyle=PS_HULL;
                ctx.beginPath();ctx.moveTo(3*s,13*s);ctx.lineTo(21*s,13*s);ctx.lineTo(20*s,17*s);ctx.lineTo(4*s,17*s);ctx.closePath();ctx.fill();
                ctx.fillStyle=PS_HULL_L;ctx.fillRect(4*s,14.5*s,16*s,0.5*s);
                ctx.fillStyle=PS_HULL_BOT;
                ctx.beginPath();ctx.moveTo(4*s,17*s);ctx.lineTo(20*s,17*s);ctx.lineTo(18*s,18.5*s);ctx.lineTo(6*s,18.5*s);ctx.closePath();ctx.fill();
                // Gold trim
                ctx.strokeStyle=PS_GOLD;ctx.lineWidth=0.4*s;
                ctx.beginPath();ctx.moveTo(2*s,13*s);ctx.lineTo(22*s,13*s);ctx.stroke();
                // Bowsprit
                ctx.strokeStyle=PS_MAST;ctx.lineWidth=0.5*s;
                ctx.beginPath();ctx.moveTo(3*s,13*s);ctx.lineTo(1*s,11.5*s);ctx.stroke();
                // Stern rise
                ctx.fillStyle=PS_HULL;
                ctx.beginPath();ctx.moveTo(21*s,13*s);ctx.lineTo(22*s,11*s);ctx.lineTo(21*s,11*s);ctx.closePath();ctx.fill();
                // Deck
                ctx.fillStyle=PS_DECK;ctx.fillRect(4*s,12.5*s,16*s,0.8*s);
                ctx.fillStyle=PS_DECK_L;ctx.fillRect(4*s,12.5*s,16*s,0.3*s);
                // Mast
                ctx.strokeStyle=PS_MAST;ctx.lineWidth=0.8*s;
                ctx.beginPath();ctx.moveTo(12*s,12*s);ctx.lineTo(12*s,5*s);ctx.stroke();
                ctx.strokeStyle=PS_MAST_L;ctx.lineWidth=0.3*s;
                ctx.beginPath();ctx.moveTo(11.7*s,12*s);ctx.lineTo(11.7*s,5*s);ctx.stroke();
                // Yard arm
                ctx.strokeStyle=PS_MAST;ctx.lineWidth=0.5*s;
                ctx.beginPath();ctx.moveTo(7*s,6.5*s);ctx.lineTo(17*s,6.5*s);ctx.stroke();
                // Sail
                ctx.fillStyle=PS_SAIL;
                ctx.beginPath();ctx.moveTo(7.5*s,6.5*s);ctx.lineTo(16.5*s,6.5*s);ctx.lineTo(15.5*s,12*s);ctx.lineTo(8.5*s,12*s);ctx.closePath();ctx.fill();
                ctx.fillStyle=PS_SAIL_D;
                ctx.beginPath();ctx.moveTo(8*s,9*s);ctx.lineTo(16*s,9*s);ctx.lineTo(15.5*s,12*s);ctx.lineTo(8.5*s,12*s);ctx.closePath();ctx.fill();
                // Skull on sail
                ctx.fillStyle='#333';
                ctx.beginPath();ctx.arc(12*s,8.5*s,1*s,0,Math.PI*2);ctx.fill();
                // Flag
                ctx.fillStyle=PS_FLAG_R;
                ctx.beginPath();ctx.moveTo(12.3*s,5*s);ctx.lineTo(16*s,4.5*s);ctx.lineTo(16*s,6*s);ctx.lineTo(12.3*s,6.5*s);ctx.closePath();ctx.fill();
                ctx.fillStyle=PS_SKULL;
                ctx.beginPath();ctx.arc(14*s,5.3*s,0.4*s,0,Math.PI*2);ctx.fill();
                // Railings
                ctx.strokeStyle=PS_RAIL;ctx.lineWidth=0.3*s;
                for(var rpi=0;rpi<5;rpi++){var rpx=5*s+rpi*3*s;ctx.beginPath();ctx.moveTo(rpx,12.5*s);ctx.lineTo(rpx,11.5*s);ctx.stroke();}
                ctx.strokeStyle=PS_RAIL_L;ctx.lineWidth=0.25*s;
                ctx.beginPath();ctx.moveTo(5*s,11.5*s);ctx.lineTo(19*s,11.5*s);ctx.stroke();
                // Rigging
                ctx.strokeStyle=PS_ROPE;ctx.lineWidth=0.2*s;
                ctx.beginPath();ctx.moveTo(12*s,6.5*s);ctx.lineTo(5*s,12.5*s);ctx.stroke();
                ctx.beginPath();ctx.moveTo(12*s,6.5*s);ctx.lineTo(19*s,12.5*s);ctx.stroke();
                // Cannons
                ctx.fillStyle=PS_IRON_D;
                ctx.fillRect(6*s,14.5*s,0.6*s,0.5*s);ctx.fillRect(11*s,14.5*s,0.6*s,0.5*s);ctx.fillRect(16*s,14.5*s,0.6*s,0.5*s);
                // Pool rim
                ctx.strokeStyle='#5a7a5a';ctx.lineWidth=0.4*s;
                ctx.beginPath();ctx.ellipse(12*s,21*s,10.5*s,2.8*s,0,0,Math.PI*2);ctx.stroke();
                break;
            }
            case 'observation-tower':
                ctx.fillStyle = '#666'; ctx.fillRect(10*s, 8*s, 4*s, 14*s);
                ctx.fillStyle = '#888'; ctx.fillRect(6*s, 4*s, 12*s, 6*s);
                ctx.fillStyle = C.blue; ctx.fillRect(7*s, 5*s, 4*s, 4*s); ctx.fillRect(13*s, 5*s, 4*s, 4*s);
                ctx.fillStyle = C.red; ctx.fillRect(8*s, 2*s, 8*s, 3*s);
                break;
            case 'wild-mouse':
                // Supports
                ctx.fillStyle='#7a7a8a';
                ctx.fillRect(3*s,14*s,1*s,8.5*s); ctx.fillRect(10*s,10*s,1*s,12.5*s); ctx.fillRect(18*s,12*s,1*s,10.5*s);
                ctx.fillStyle='#5a5a6a';
                ctx.fillRect(2*s,22*s,3*s,1.2*s); ctx.fillRect(9*s,22*s,3*s,1.2*s); ctx.fillRect(17*s,22*s,3*s,1.2*s);
                // Track
                ctx.strokeStyle='#7a7a8a'; ctx.lineWidth=1.2*s; ctx.lineCap='round'; ctx.lineJoin='round';
                ctx.beginPath();
                ctx.moveTo(3*s,20*s); ctx.lineTo(3*s,6*s); ctx.lineTo(12*s,4*s); ctx.lineTo(20*s,4*s);
                ctx.lineTo(21*s,8*s); ctx.lineTo(10*s,9*s); ctx.lineTo(8*s,13*s); ctx.lineTo(21*s,14*s);
                ctx.lineTo(21*s,18*s); ctx.lineTo(12*s,16*s); ctx.lineTo(8*s,20*s); ctx.lineTo(3*s,20*s);
                ctx.stroke();
                ctx.strokeStyle='#f0a030'; ctx.lineWidth=0.6*s;
                ctx.beginPath();
                ctx.moveTo(3*s,20*s); ctx.lineTo(3*s,6*s); ctx.lineTo(12*s,4*s); ctx.lineTo(20*s,4*s);
                ctx.lineTo(21*s,8*s); ctx.lineTo(10*s,9*s); ctx.lineTo(8*s,13*s); ctx.lineTo(21*s,14*s);
                ctx.lineTo(21*s,18*s); ctx.lineTo(12*s,16*s); ctx.lineTo(8*s,20*s); ctx.lineTo(3*s,20*s);
                ctx.stroke();
                // Station
                ctx.fillStyle='#f0a030';
                ctx.beginPath(); ctx.roundRect(1*s,18*s,5*s,2.5*s,0.6*s); ctx.fill();
                ctx.fillStyle='#ffc060'; ctx.fillRect(1.5*s,18*s,4*s,0.8*s);
                // Mouse ears
                ctx.fillStyle='#c07820';
                ctx.beginPath();ctx.arc(2.5*s,17.5*s,1.2*s,0,Math.PI*2);ctx.fill();
                ctx.beginPath();ctx.arc(4.5*s,17.5*s,1.2*s,0,Math.PI*2);ctx.fill();
                ctx.fillStyle='#f0a030';
                ctx.beginPath();ctx.arc(2.5*s,17.5*s,0.7*s,0,Math.PI*2);ctx.fill();
                ctx.beginPath();ctx.arc(4.5*s,17.5*s,0.7*s,0,Math.PI*2);ctx.fill();
                // Car
                ctx.fillStyle='#4ecdc4';
                ctx.beginPath(); ctx.roundRect(14*s,2*s,5.5*s,3.5*s,1*s); ctx.fill();
                ctx.fillStyle='#3ab0a8';
                ctx.beginPath(); ctx.roundRect(14.5*s,1.5*s,4.5*s,1.5*s,0.6*s); ctx.fill();
                ctx.fillStyle='#ffd5b8';
                ctx.beginPath(); ctx.arc(15.5*s,0.8*s,1.1*s,0,Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(18*s,0.8*s,1.1*s,0,Math.PI*2); ctx.fill();
                break;
            case 'giga-coaster':
                // Massive supports with heavy structure
                ctx.fillStyle='#8a8a9a';
                ctx.fillRect(3*s,0*s,1.4*s,22.5*s); ctx.fillRect(11*s,8*s,1*s,14.5*s); ctx.fillRect(18*s,12*s,1*s,10.5*s);
                ctx.fillStyle='#6a6a7a';
                ctx.fillRect(1.5*s,22*s,4*s,1.2*s); ctx.fillRect(10*s,22*s,3*s,1.2*s); ctx.fillRect(17*s,22*s,3*s,1.2*s);
                // Heavy X-bracing on main support
                ctx.strokeStyle='#6a6a7a';ctx.lineWidth=0.35*s;
                for(var gbi=0;gbi<4;gbi++){var gby=1+gbi*5;
                    ctx.beginPath();ctx.moveTo(3*s,gby*s);ctx.lineTo(4.4*s,(gby+5)*s);ctx.stroke();
                    ctx.beginPath();ctx.moveTo(4.4*s,gby*s);ctx.lineTo(3*s,(gby+5)*s);ctx.stroke();
                }
                // Horizontal bars
                ctx.fillStyle='#6a6a7a';
                for(var ghi=0;ghi<4;ghi++) ctx.fillRect(2.5*s,(4+ghi*5)*s,2.3*s,0.4*s);
                // Track - extreme height, sweeping turns
                ctx.strokeStyle='#8a8a9a'; ctx.lineWidth=1.3*s; ctx.lineCap='round'; ctx.lineJoin='round';
                ctx.beginPath();
                ctx.moveTo(3*s,20*s); ctx.lineTo(3*s,0*s); ctx.lineTo(10*s,0*s);
                ctx.quadraticCurveTo(16*s,0*s,17*s,8*s);
                ctx.quadraticCurveTo(18*s,14*s,20*s,12*s);
                ctx.quadraticCurveTo(22*s,10*s,21*s,15*s);
                ctx.quadraticCurveTo(20*s,19*s,16*s,18*s);
                ctx.quadraticCurveTo(12*s,17*s,10*s,18*s);
                ctx.lineTo(6*s,20*s); ctx.lineTo(3*s,20*s);
                ctx.stroke();
                ctx.strokeStyle='#00ced1'; ctx.lineWidth=0.6*s;
                ctx.beginPath();
                ctx.moveTo(3*s,20*s); ctx.lineTo(3*s,0*s); ctx.lineTo(10*s,0*s);
                ctx.quadraticCurveTo(16*s,0*s,17*s,8*s);
                ctx.quadraticCurveTo(18*s,14*s,20*s,12*s);
                ctx.quadraticCurveTo(22*s,10*s,21*s,15*s);
                ctx.quadraticCurveTo(20*s,19*s,16*s,18*s);
                ctx.quadraticCurveTo(12*s,17*s,10*s,18*s);
                ctx.lineTo(6*s,20*s); ctx.lineTo(3*s,20*s);
                ctx.stroke();
                // Lift chain detail
                ctx.strokeStyle='#555';ctx.lineWidth=0.2*s;
                for(var lci=0;lci<8;lci++){var ly=2+lci*2.2;ctx.beginPath();ctx.moveTo(2.5*s,ly*s);ctx.lineTo(4*s,(ly-0.3)*s);ctx.stroke();}
                // Station
                ctx.fillStyle='#00ced1';
                ctx.beginPath(); ctx.roundRect(1*s,18*s,5*s,2.5*s,0.6*s); ctx.fill();
                ctx.fillStyle='#40eef0'; ctx.fillRect(1.5*s,18*s,4*s,0.8*s);
                // Lightning bolt decorations
                ctx.fillStyle='#80ffff';
                ctx.beginPath();ctx.moveTo(2.5*s,17.5*s);ctx.lineTo(1.8*s,16.5*s);ctx.lineTo(2.3*s,16.5*s);ctx.lineTo(1.5*s,15*s);ctx.lineTo(3*s,16.2*s);ctx.lineTo(2.5*s,16.2*s);ctx.closePath();ctx.fill();
                ctx.beginPath();ctx.moveTo(4.5*s,17.5*s);ctx.lineTo(3.8*s,16.5*s);ctx.lineTo(4.3*s,16.5*s);ctx.lineTo(3.5*s,15*s);ctx.lineTo(5*s,16.2*s);ctx.lineTo(4.5*s,16.2*s);ctx.closePath();ctx.fill();
                // Car with riders - large
                ctx.fillStyle='#2244ff';
                ctx.beginPath(); ctx.roundRect(7*s,-2*s,6*s,4*s,1.5*s); ctx.fill();
                ctx.fillStyle='#1133cc';
                ctx.beginPath(); ctx.roundRect(7.5*s,-2.5*s,5*s,1.8*s,0.6*s); ctx.fill();
                ctx.fillStyle='#80ffff';ctx.fillRect(7.5*s,0.5*s,5*s,0.5*s);
                // Headlight
                ctx.fillStyle=C.yellow;ctx.fillRect(12.5*s,-1*s,0.8*s,1*s);
                ctx.fillStyle='#ffd5b8';
                ctx.beginPath(); ctx.arc(9*s,-3.5*s,1.1*s,0,Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(11.5*s,-3.5*s,1.1*s,0,Math.PI*2); ctx.fill();
                break;
            case 'cotton-candy':
                // Stick
                ctx.fillStyle = '#deb887'; ctx.fillRect(11*s, 12*s, 2*s, 10*s);
                // Cotton candy cloud - pink layers
                ctx.fillStyle = '#ffb6c1'; ctx.beginPath(); ctx.arc(12*s, 8*s, 6*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#ffc8d6'; ctx.beginPath(); ctx.arc(10*s, 6*s, 3.5*s, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(14*s, 10*s, 3*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#ff9ab5'; ctx.beginPath(); ctx.arc(13*s, 7*s, 2.5*s, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(10*s, 10*s, 2.5*s, 0, Math.PI*2); ctx.fill();
                // Highlight
                ctx.fillStyle='rgba(255,255,255,0.3)';
                ctx.beginPath();ctx.arc(10*s,5*s,2*s,0,Math.PI*2);ctx.fill();
                break;
            case 'coffee-stand':
                // Cup body
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(5*s, 6*s, 12*s, 12*s, 2*s); ctx.fill();
                ctx.fillStyle='#f0e8e0'; ctx.beginPath(); ctx.roundRect(6*s, 7*s, 10*s, 10*s, 1.5*s); ctx.fill();
                // Coffee liquid
                ctx.fillStyle = '#5a3018'; ctx.beginPath(); ctx.roundRect(6.5*s, 8*s, 9*s, 7*s, 1*s); ctx.fill();
                // Handle
                ctx.strokeStyle='#fff';ctx.lineWidth=1.5*s;
                ctx.beginPath();ctx.arc(18*s,12*s,3*s,Math.PI*1.5,Math.PI*0.5);ctx.stroke();
                // Steam
                ctx.strokeStyle='rgba(200,190,180,0.5)';ctx.lineWidth=0.7*s;
                ctx.beginPath();ctx.moveTo(9*s,6*s);ctx.quadraticCurveTo(8*s,3*s,9*s,1*s);ctx.stroke();
                ctx.beginPath();ctx.moveTo(13*s,6*s);ctx.quadraticCurveTo(14*s,3*s,13*s,1*s);ctx.stroke();
                // Sleeve
                ctx.fillStyle='#d4a056';ctx.beginPath();ctx.roundRect(6*s,12*s,10*s,4*s,1*s);ctx.fill();
                break;
            case 'water':
                // Water body with rounded edges
                ctx.fillStyle='#5db8d8';ctx.beginPath();ctx.roundRect(3*s,3*s,18*s,18*s,5*s);ctx.fill();
                ctx.fillStyle='#6dd5f7';ctx.beginPath();ctx.roundRect(4*s,4*s,16*s,16*s,4*s);ctx.fill();
                // Lighter center
                ctx.fillStyle='#80e0ff';ctx.beginPath();ctx.roundRect(6*s,6*s,12*s,12*s,3*s);ctx.fill();
                // Shimmer highlights
                ctx.fillStyle='rgba(180,230,255,0.5)';
                ctx.beginPath();ctx.ellipse(9*s,9*s,3*s,1.5*s,0.3,0,Math.PI*2);ctx.fill();
                ctx.fillStyle='rgba(255,255,255,0.35)';
                ctx.beginPath();ctx.ellipse(15*s,13*s,2*s,1*s,-0.2,0,Math.PI*2);ctx.fill();
                // Subtle wave lines
                ctx.strokeStyle='rgba(255,255,255,0.2)';ctx.lineWidth=0.5*s;
                ctx.beginPath();ctx.moveTo(6*s,11*s);ctx.quadraticCurveTo(12*s,9*s,18*s,11*s);ctx.stroke();
                ctx.beginPath();ctx.moveTo(6*s,15*s);ctx.quadraticCurveTo(12*s,13*s,18*s,15*s);ctx.stroke();
                break;
            case 'statue':
                // Shadow
                ctx.fillStyle='rgba(0,20,10,0.15)';ctx.beginPath();ctx.ellipse(12*s,21*s,7*s,2*s,0,0,Math.PI*2);ctx.fill();
                // Pedestal base
                ctx.fillStyle='#707070';ctx.beginPath();ctx.roundRect(6*s,18*s,12*s,4*s,1*s);ctx.fill();
                ctx.fillStyle='#808080';ctx.beginPath();ctx.roundRect(7*s,17*s,10*s,2.5*s,0.8*s);ctx.fill();
                ctx.fillStyle='#909090';ctx.fillRect(7.5*s,17*s,9*s,1*s);
                // Pedestal middle
                ctx.fillStyle='#858585';ctx.beginPath();ctx.roundRect(8*s,15*s,8*s,3*s,0.8*s);ctx.fill();
                // Body
                ctx.fillStyle='#a8a8a8';ctx.beginPath();ctx.roundRect(9*s,9*s,6*s,7*s,1.5*s);ctx.fill();
                ctx.fillStyle='#b8b8b8';ctx.fillRect(9.5*s,10*s,5*s,5.5*s);
                // Head
                ctx.fillStyle='#b0b0b0';ctx.beginPath();ctx.arc(12*s,7*s,3.5*s,0,Math.PI*2);ctx.fill();
                ctx.fillStyle='#c0c0c0';ctx.beginPath();ctx.arc(11.8*s,6.5*s,2.8*s,0,Math.PI*2);ctx.fill();
                // Hair
                ctx.fillStyle='#a0a0a0';ctx.beginPath();ctx.arc(12*s,5*s,2.2*s,Math.PI,0);ctx.fill();
                // Left arm with torch
                ctx.fillStyle='#b0b0b0';ctx.save();ctx.translate(9*s,10*s);ctx.rotate(-0.5);ctx.fillRect(-0.5*s,0,2*s,6*s);ctx.restore();
                // Torch glow
                ctx.fillStyle='#d0c070';ctx.beginPath();ctx.arc(5.5*s,6*s,1.5*s,0,Math.PI*2);ctx.fill();
                ctx.fillStyle='#e8d888';ctx.beginPath();ctx.arc(5.5*s,5.5*s,0.8*s,0,Math.PI*2);ctx.fill();
                // Right arm
                ctx.fillStyle='#a8a8a8';ctx.fillRect(15*s,10*s,2*s,5*s);
                // Plaque
                ctx.fillStyle='#7a6a50';ctx.beginPath();ctx.roundRect(9*s,18.5*s,6*s,1.5*s,0.3*s);ctx.fill();
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
            case 'sell':
                // Wrecking ball - crane arm + chain + heavy ball
                // Crane arm (diagonal beam)
                ctx.strokeStyle = '#ff8c42'; ctx.lineWidth = 2.5*s; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(4*s, 3*s); ctx.lineTo(16*s, 3*s); ctx.stroke();
                // Vertical post
                ctx.beginPath(); ctx.moveTo(5*s, 3*s); ctx.lineTo(5*s, 8*s); ctx.stroke();
                // Chain (dashed line)
                ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1.2*s;
                ctx.setLineDash([2*s, 1.5*s]);
                ctx.beginPath(); ctx.moveTo(14*s, 3*s); ctx.lineTo(14*s, 10*s); ctx.stroke();
                ctx.setLineDash([]);
                // Wrecking ball
                ctx.fillStyle = '#666';
                ctx.beginPath(); ctx.arc(14*s, 15*s, 5*s, 0, Math.PI*2); ctx.fill();
                // Ball highlight
                ctx.fillStyle = '#888';
                ctx.beginPath(); ctx.arc(12.5*s, 13.5*s, 2*s, 0, Math.PI*2); ctx.fill();
                // Impact lines
                ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 1.2*s; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(20*s, 12*s); ctx.lineTo(22*s, 10*s); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(20*s, 16*s); ctx.lineTo(22*s, 17*s); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(19*s, 19*s); ctx.lineTo(21*s, 21*s); ctx.stroke();
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
            case 'entry-fee':
                // Gold ticket/coin with € symbol
                ctx.fillStyle = '#ffd93d'; ctx.beginPath(); ctx.arc(12*s, 12*s, 9*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#daa520'; ctx.beginPath(); ctx.arc(12*s, 12*s, 7*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#ffd93d'; ctx.beginPath(); ctx.arc(12*s, 12*s, 6*s, 0, Math.PI*2); ctx.fill();
                // € sign
                ctx.strokeStyle = '#8b6914'; ctx.lineWidth = 2*s; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.arc(13*s, 12*s, 4*s, 0.5, Math.PI*2 - 0.5); ctx.stroke();
                ctx.strokeStyle = '#8b6914'; ctx.lineWidth = 1.5*s;
                ctx.beginPath(); ctx.moveTo(8*s, 11*s); ctx.lineTo(14*s, 11*s); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(8*s, 13*s); ctx.lineTo(14*s, 13*s); ctx.stroke();
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
            case 'reset':
                // Circular arrow (refresh/reset icon)
                const resetColor = sz === 16 && hover ? '#1a1a2e' : C.yellow;
                ctx.strokeStyle = resetColor;
                ctx.lineWidth = 2.5*s;
                ctx.lineCap = 'round';
                // Draw circular arc
                ctx.beginPath();
                ctx.arc(12*s, 12*s, 7*s, -0.5, Math.PI * 1.5);
                ctx.stroke();
                // Draw arrow head
                ctx.fillStyle = resetColor;
                ctx.beginPath();
                ctx.moveTo(5*s, 8*s);
                ctx.lineTo(5*s, 14*s);
                ctx.lineTo(11*s, 11*s);
                ctx.closePath();
                ctx.fill();
                break;
            case 'gear':
                // Gear/settings icon
                const gearColor = sz === 16 && hover ? '#1a1a2e' : C.yellow;
                ctx.fillStyle = gearColor;
                // Center circle
                ctx.beginPath();
                ctx.arc(12*s, 12*s, 4*s, 0, Math.PI * 2);
                ctx.fill();
                // Gear teeth (6 teeth)
                for (let i = 0; i < 6; i++) {
                    const angle = (i * Math.PI / 3) - Math.PI / 6;
                    const x1 = 12*s + Math.cos(angle) * 6*s;
                    const y1 = 12*s + Math.sin(angle) * 6*s;
                    ctx.beginPath();
                    ctx.arc(x1, y1, 3*s, 0, Math.PI * 2);
                    ctx.fill();
                }
                // Inner hole
                ctx.fillStyle = sz === 16 && hover ? C.yellow : '#1a1a2e';
                ctx.beginPath();
                ctx.arc(12*s, 12*s, 2*s, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'exit':
                // Exit/door icon
                ctx.fillStyle = C.yellow;
                // Door frame
                ctx.fillRect(4*s, 4*s, 10*s, 16*s);
                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(6*s, 6*s, 6*s, 12*s);
                // Arrow pointing out
                ctx.fillStyle = C.yellow;
                ctx.beginPath();
                ctx.moveTo(14*s, 12*s);
                ctx.lineTo(20*s, 12*s);
                ctx.lineTo(17*s, 8*s);
                ctx.moveTo(20*s, 12*s);
                ctx.lineTo(17*s, 16*s);
                ctx.lineWidth = 2*s;
                ctx.strokeStyle = C.yellow;
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(14*s, 12*s);
                ctx.lineTo(20*s, 12*s);
                ctx.stroke();
                break;
            
            // ==================== GOAL ICONS ====================
            case 'goal-build':
                // Hammer with sparkle
                ctx.fillStyle = '#8b6914';
                ctx.save(); ctx.translate(12*s, 12*s); ctx.rotate(-0.7);
                ctx.fillRect(-2*s, -8*s, 4*s, 16*s);
                ctx.fillStyle = '#888';
                ctx.fillRect(-4*s, -10*s, 8*s, 5*s);
                ctx.restore();
                ctx.fillStyle = '#ffd93d';
                ctx.beginPath(); ctx.arc(18*s, 5*s, 2*s, 0, Math.PI*2); ctx.fill();
                break;
            case 'goal-ticket':
                // Ticket stub with star
                ctx.fillStyle = '#ffd93d';
                ctx.beginPath(); ctx.roundRect(4*s, 6*s, 16*s, 12*s, 2*s); ctx.fill();
                ctx.fillStyle = '#daa520';
                ctx.setLineDash([2*s, 2*s]);
                ctx.beginPath(); ctx.moveTo(14*s, 6*s); ctx.lineTo(14*s, 18*s); ctx.strokeStyle = '#daa520'; ctx.lineWidth = 1*s; ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = '#e02030';
                ctx.beginPath(); var sx=9*s,sy=10*s; for(var i=0;i<5;i++){var a=-Math.PI/2+i*Math.PI*2/5,ia=a+Math.PI/5;ctx.lineTo(sx+Math.cos(a)*3*s,sy+Math.sin(a)*3*s);ctx.lineTo(sx+Math.cos(ia)*1.2*s,sy+Math.sin(ia)*1.2*s);} ctx.fill();
                break;
            case 'goal-staff':
                // Person with badge
                ctx.fillStyle = '#ffd5b8'; ctx.beginPath(); ctx.arc(12*s, 7*s, 4*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#4488cc'; ctx.beginPath(); ctx.roundRect(7*s, 12*s, 10*s, 9*s, 3*s); ctx.fill();
                ctx.fillStyle = '#ffd93d'; ctx.beginPath(); ctx.arc(16*s, 14*s, 2.5*s, 0, Math.PI*2); ctx.fill();
                break;
            case 'goal-happy':
                // Smiley face
                ctx.fillStyle = '#ffd93d'; ctx.beginPath(); ctx.arc(12*s, 12*s, 9*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#1a1a2e'; ctx.beginPath(); ctx.arc(9*s, 10*s, 1.5*s, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(15*s, 10*s, 1.5*s, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 1.5*s; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.arc(12*s, 13*s, 4*s, 0.2, Math.PI-0.2); ctx.stroke();
                break;
            case 'goal-coaster':
                // Small coaster loop
                ctx.strokeStyle = C.purple; ctx.lineWidth = 2.5*s;
                ctx.beginPath(); ctx.arc(12*s, 10*s, 8*s, Math.PI*0.8, Math.PI*2.2); ctx.stroke();
                ctx.fillStyle = C.red; ctx.beginPath(); ctx.roundRect(14*s, 16*s, 6*s, 4*s, 1.5*s); ctx.fill();
                ctx.fillStyle = '#888'; ctx.fillRect(5*s, 18*s, 3*s, 4*s); ctx.fillRect(16*s, 18*s, 3*s, 4*s);
                break;
            case 'goal-star':
                // Gold 5-pointed star
                ctx.fillStyle = '#ffd93d';
                ctx.beginPath();
                for(var i=0;i<5;i++){var a=-Math.PI/2+i*Math.PI*2/5,ia=a+Math.PI/5;ctx.lineTo(12*s+Math.cos(a)*9*s,12*s+Math.sin(a)*9*s);ctx.lineTo(12*s+Math.cos(ia)*4*s,12*s+Math.sin(ia)*4*s);}
                ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#ffe87a';
                ctx.beginPath();
                for(var i=0;i<5;i++){var a=-Math.PI/2+i*Math.PI*2/5,ia=a+Math.PI/5;ctx.lineTo(12*s+Math.cos(a)*5*s,12*s+Math.sin(a)*5*s);ctx.lineTo(12*s+Math.cos(ia)*2.5*s,12*s+Math.sin(ia)*2.5*s);}
                ctx.closePath(); ctx.fill();
                break;
            case 'goal-crown':
                // Gold crown
                ctx.fillStyle = '#ffd93d';
                ctx.beginPath();
                ctx.moveTo(4*s, 18*s); ctx.lineTo(4*s, 10*s); ctx.lineTo(8*s, 14*s);
                ctx.lineTo(12*s, 8*s); ctx.lineTo(16*s, 14*s); ctx.lineTo(20*s, 10*s);
                ctx.lineTo(20*s, 18*s); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#daa520'; ctx.fillRect(4*s, 16*s, 16*s, 3*s);
                // Gems
                ctx.fillStyle = '#e02030'; ctx.beginPath(); ctx.arc(8*s, 17*s, 1.5*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#50c8ff'; ctx.beginPath(); ctx.arc(12*s, 17*s, 1.5*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#6bcb77'; ctx.beginPath(); ctx.arc(16*s, 17*s, 1.5*s, 0, Math.PI*2); ctx.fill();
                break;
            case 'goal-globe':
                // Globe with lat/long
                ctx.strokeStyle = '#4488cc'; ctx.lineWidth = 2*s;
                ctx.beginPath(); ctx.arc(12*s, 12*s, 8*s, 0, Math.PI*2); ctx.stroke();
                ctx.fillStyle = '#4488cc'; ctx.beginPath(); ctx.arc(12*s, 12*s, 8*s, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = '#6bb8ff'; ctx.lineWidth = 1*s;
                ctx.beginPath(); ctx.ellipse(12*s, 12*s, 4*s, 8*s, 0, 0, Math.PI*2); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(4*s, 12*s); ctx.lineTo(20*s, 12*s); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(12*s, 4*s); ctx.lineTo(12*s, 20*s); ctx.stroke();
                break;
            case 'goal-tiny':
                // Magnifying glass
                ctx.strokeStyle = '#aaa'; ctx.lineWidth = 2.5*s;
                ctx.beginPath(); ctx.arc(10*s, 10*s, 6*s, 0, Math.PI*2); ctx.stroke();
                ctx.fillStyle = 'rgba(100,200,255,0.15)'; ctx.beginPath(); ctx.arc(10*s, 10*s, 6*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#888'; ctx.save(); ctx.translate(15*s, 15*s); ctx.rotate(0.7);
                ctx.fillRect(-1.5*s, 0, 3*s, 8*s); ctx.restore();
                break;
            case 'goal-garden':
                // Flower with stem
                ctx.fillStyle = '#228b22'; ctx.fillRect(11*s, 12*s, 2*s, 10*s);
                var petals = ['#ff6b9d','#ff6b9d','#ff6b9d','#ff6b9d'];
                petals.forEach(function(c, i) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(12*s+Math.cos(i*Math.PI/2)*4*s, 10*s+Math.sin(i*Math.PI/2)*4*s, 3*s, 0, Math.PI*2); ctx.fill(); });
                ctx.fillStyle = '#ffd93d'; ctx.beginPath(); ctx.arc(12*s, 10*s, 2.5*s, 0, Math.PI*2); ctx.fill();
                break;
            case 'goal-foodie':
                // Fork + knife crossed
                ctx.strokeStyle = '#ccc'; ctx.lineWidth = 2*s; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(8*s, 4*s); ctx.lineTo(16*s, 20*s); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(16*s, 4*s); ctx.lineTo(8*s, 20*s); ctx.stroke();
                // Fork tines
                ctx.lineWidth = 1*s;
                ctx.beginPath(); ctx.moveTo(7*s, 4*s); ctx.lineTo(7*s, 8*s); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(9*s, 4*s); ctx.lineTo(9*s, 7*s); ctx.stroke();
                break;
            case 'goal-crowd':
                // Three silhouettes
                ctx.fillStyle = '#ffd5b8';
                ctx.beginPath(); ctx.arc(8*s, 8*s, 3*s, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(16*s, 8*s, 3*s, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(12*s, 6*s, 3*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = C.pink; ctx.beginPath(); ctx.roundRect(4*s, 12*s, 8*s, 8*s, 3*s); ctx.fill();
                ctx.fillStyle = C.blue; ctx.beginPath(); ctx.roundRect(12*s, 12*s, 8*s, 8*s, 3*s); ctx.fill();
                ctx.fillStyle = C.green; ctx.beginPath(); ctx.roundRect(8*s, 10*s, 8*s, 10*s, 3*s); ctx.fill();
                break;
            case 'roadmap':
                // Scroll
                ctx.fillStyle = '#d4b483';
                ctx.beginPath(); ctx.roundRect(6*s, 4*s, 12*s, 16*s, 2*s); ctx.fill();
                ctx.fillStyle = '#c4a473';
                ctx.beginPath(); ctx.ellipse(6*s, 6*s, 2*s, 3*s, 0, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(6*s, 18*s, 2*s, 3*s, 0, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(18*s, 6*s, 2*s, 3*s, 0, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(18*s, 18*s, 2*s, 3*s, 0, 0, Math.PI*2); ctx.fill();
                // Lines
                ctx.fillStyle = '#8b6914';
                for (var i = 0; i < 4; i++) ctx.fillRect(8*s, (7+i*3)*s, 8*s, 1*s);
                break;
            case 'check':
                ctx.strokeStyle = '#6bcb77'; ctx.lineWidth = 2.5*s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                ctx.beginPath(); ctx.moveTo(5*s, 12*s); ctx.lineTo(10*s, 17*s); ctx.lineTo(19*s, 7*s); ctx.stroke();
                break;
            case 'cross':
                ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 2.5*s; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(6*s, 6*s); ctx.lineTo(18*s, 18*s); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(18*s, 6*s); ctx.lineTo(6*s, 18*s); ctx.stroke();
                break;
            case 'trophy':
                // Cup on base
                ctx.fillStyle = '#ffd93d';
                ctx.beginPath(); ctx.moveTo(6*s, 4*s); ctx.lineTo(18*s, 4*s); ctx.lineTo(16*s, 12*s);
                ctx.lineTo(8*s, 12*s); ctx.closePath(); ctx.fill();
                // Handles
                ctx.strokeStyle = '#ffd93d'; ctx.lineWidth = 1.5*s;
                ctx.beginPath(); ctx.arc(5*s, 8*s, 3*s, -0.5, 1.5); ctx.stroke();
                ctx.beginPath(); ctx.arc(19*s, 8*s, 3*s, Math.PI-1.5, Math.PI+0.5); ctx.stroke();
                // Stem + base
                ctx.fillStyle = '#daa520';
                ctx.fillRect(10*s, 12*s, 4*s, 4*s);
                ctx.fillRect(7*s, 16*s, 10*s, 3*s);
                // Star
                ctx.fillStyle = '#ffe87a'; ctx.beginPath(); ctx.arc(12*s, 8*s, 2*s, 0, Math.PI*2); ctx.fill();
                break;
            
            case 'staff-janitor':
                // Broom handle
                ctx.fillStyle = '#8B6914';
                ctx.fillRect(11*s, 3*s, 2*s, 14*s);
                // Bristle fan
                ctx.fillStyle = '#5da6ff';
                ctx.beginPath();
                ctx.moveTo(7*s, 17*s); ctx.lineTo(12*s, 13*s); ctx.lineTo(17*s, 17*s);
                ctx.lineTo(17*s, 20*s); ctx.lineTo(7*s, 20*s);
                ctx.closePath(); ctx.fill();
                // Bristle lines
                ctx.strokeStyle = '#4890dd'; ctx.lineWidth = s;
                for (var bi = 0; bi < 4; bi++) { ctx.beginPath(); ctx.moveTo((8+bi*2.5)*s, 17*s); ctx.lineTo((8+bi*2.5)*s, 20*s); ctx.stroke(); }
                break;
            
            case 'staff-mechanic':
                // Wrench - open end
                ctx.fillStyle = '#ff9c52';
                ctx.fillRect(10*s, 5*s, 4*s, 12*s);
                // Head (open end)
                ctx.fillRect(7*s, 3*s, 10*s, 4*s);
                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(10*s, 4*s, 4*s, 2*s);
                // Handle end
                ctx.fillStyle = '#dd7c32';
                ctx.fillRect(9*s, 16*s, 6*s, 3*s);
                break;
            
            case 'staff-entertainer':
                // Party hat triangle
                ctx.fillStyle = '#c7a4f6';
                ctx.beginPath();
                ctx.moveTo(12*s, 2*s); ctx.lineTo(7*s, 14*s); ctx.lineTo(17*s, 14*s);
                ctx.closePath(); ctx.fill();
                // Stripes
                ctx.fillStyle = '#a07de0';
                ctx.fillRect(10*s, 6*s, 4*s, 2*s);
                ctx.fillRect(9*s, 10*s, 6*s, 2*s);
                // Pompom on top
                ctx.fillStyle = '#ffd93d';
                ctx.beginPath(); ctx.arc(12*s, 2*s, 2*s, 0, Math.PI*2); ctx.fill();
                // Brim
                ctx.fillStyle = '#9b71d9';
                ctx.fillRect(6*s, 14*s, 12*s, 2*s);
                break;
            
            case 'event-warning':
                // Warning triangle
                ctx.fillStyle = '#ffd93d';
                ctx.beginPath();
                ctx.moveTo(12*s, 3*s); ctx.lineTo(4*s, 19*s); ctx.lineTo(20*s, 19*s);
                ctx.closePath(); ctx.fill();
                // Dark outline
                ctx.strokeStyle = '#cc8800'; ctx.lineWidth = s;
                ctx.beginPath();
                ctx.moveTo(12*s, 3*s); ctx.lineTo(4*s, 19*s); ctx.lineTo(20*s, 19*s);
                ctx.closePath(); ctx.stroke();
                // Exclamation mark
                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(11*s, 8*s, 2*s, 6*s);
                ctx.fillRect(11*s, 16*s, 2*s, 2*s);
                break;
            
            case 'guest-thrill':
                // Zigzag lightning bolt
                ctx.fillStyle = '#ffe94d';
                ctx.beginPath();
                ctx.moveTo(10*s, 2*s); ctx.lineTo(6*s, 10*s); ctx.lineTo(11*s, 10*s);
                ctx.lineTo(8*s, 20*s); ctx.lineTo(18*s, 8*s); ctx.lineTo(13*s, 8*s);
                ctx.lineTo(16*s, 2*s);
                ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#ccb800';
                ctx.fillRect(11*s, 5*s, 2*s, 3*s);
                break;
            
            case 'guest-foodie':
                // Fork + knife crossed
                ctx.strokeStyle = '#e0e0e0'; ctx.lineWidth = 1.5*s; ctx.lineCap = 'round';
                // Fork
                ctx.beginPath(); ctx.moveTo(8*s, 4*s); ctx.lineTo(8*s, 10*s); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(6*s, 4*s); ctx.lineTo(6*s, 7*s); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(10*s, 4*s); ctx.lineTo(10*s, 7*s); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(8*s, 10*s); ctx.lineTo(8*s, 19*s); ctx.stroke();
                // Knife
                ctx.beginPath(); ctx.moveTo(16*s, 4*s); ctx.lineTo(16*s, 19*s); ctx.stroke();
                ctx.fillStyle = '#c0c0c0';
                ctx.beginPath(); ctx.moveTo(14*s, 4*s); ctx.lineTo(16*s, 4*s); ctx.lineTo(16*s, 10*s);
                ctx.quadraticCurveTo(14*s, 10*s, 14*s, 4*s); ctx.fill();
                break;
            
            case 'guest-family':
                // Two stick figures (tall + short)
                ctx.fillStyle = '#ffffff';
                // Tall figure
                ctx.beginPath(); ctx.arc(9*s, 5*s, 2.5*s, 0, Math.PI*2); ctx.fill();
                ctx.fillRect(8*s, 8*s, 2*s, 7*s);
                ctx.fillRect(6*s, 10*s, 6*s, 2*s);
                ctx.fillRect(7*s, 15*s, 1.5*s, 4*s);
                ctx.fillRect(9.5*s, 15*s, 1.5*s, 4*s);
                // Short figure
                ctx.beginPath(); ctx.arc(17*s, 8*s, 2*s, 0, Math.PI*2); ctx.fill();
                ctx.fillRect(16*s, 10*s, 2*s, 5*s);
                ctx.fillRect(14*s, 12*s, 5*s, 1.5*s);
                ctx.fillRect(15.5*s, 15*s, 1.2*s, 3*s);
                ctx.fillRect(17.5*s, 15*s, 1.2*s, 3*s);
                break;
            
            case 'guest-vip':
                // 5-pointed star
                ctx.fillStyle = '#ffd93d';
                ctx.beginPath();
                for (var si2 = 0; si2 < 5; si2++) {
                    var a1 = (si2 * 72 - 90) * Math.PI / 180;
                    var a2 = ((si2 * 72) + 36 - 90) * Math.PI / 180;
                    ctx.lineTo(12*s + Math.cos(a1) * 8*s, 11*s + Math.sin(a1) * 8*s);
                    ctx.lineTo(12*s + Math.cos(a2) * 3.5*s, 11*s + Math.sin(a2) * 3.5*s);
                }
                ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#e6c230';
                ctx.beginPath(); ctx.arc(12*s, 11*s, 2*s, 0, Math.PI*2); ctx.fill();
                break;
            
            case 'event-sun':
                // Yellow sun circle + rays
                ctx.fillStyle = '#ffd93d';
                ctx.beginPath(); ctx.arc(12*s, 12*s, 5*s, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = '#ffd93d'; ctx.lineWidth = 1.5*s; ctx.lineCap = 'round';
                for (var ri3 = 0; ri3 < 8; ri3++) {
                    var ra = ri3 * Math.PI / 4;
                    ctx.beginPath();
                    ctx.moveTo(12*s + Math.cos(ra)*7*s, 12*s + Math.sin(ra)*7*s);
                    ctx.lineTo(12*s + Math.cos(ra)*10*s, 12*s + Math.sin(ra)*10*s);
                    ctx.stroke();
                }
                break;
            
            case 'event-rain':
                // Cloud + rain drops
                ctx.fillStyle = '#8899aa';
                ctx.beginPath(); ctx.arc(9*s, 8*s, 4*s, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(15*s, 8*s, 4*s, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(12*s, 6*s, 4*s, 0, Math.PI*2); ctx.fill();
                ctx.fillRect(5*s, 6*s, 14*s, 4*s);
                ctx.strokeStyle = '#5da6ff'; ctx.lineWidth = 1.5*s; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(8*s, 14*s); ctx.lineTo(7*s, 18*s); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(12*s, 13*s); ctx.lineTo(11*s, 17*s); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(16*s, 14*s); ctx.lineTo(15*s, 18*s); ctx.stroke();
                break;
            
            case 'event-fog':
                // Three stacked gray horizontal bars
                ctx.fillStyle = 'rgba(180,190,200,0.8)';
                ctx.beginPath(); ctx.roundRect(4*s, 6*s, 16*s, 2.5*s, 1*s); ctx.fill();
                ctx.fillStyle = 'rgba(160,170,180,0.7)';
                ctx.beginPath(); ctx.roundRect(6*s, 11*s, 14*s, 2.5*s, 1*s); ctx.fill();
                ctx.fillStyle = 'rgba(140,150,160,0.6)';
                ctx.beginPath(); ctx.roundRect(3*s, 16*s, 16*s, 2.5*s, 1*s); ctx.fill();
                break;
            
            case 'event-crowd':
                // Three person silhouettes
                ctx.fillStyle = '#c7a4f6';
                ctx.beginPath(); ctx.arc(7*s, 7*s, 3*s, 0, Math.PI*2); ctx.fill();
                ctx.fillRect(5*s, 10*s, 4*s, 8*s);
                ctx.fillStyle = '#5da6ff';
                ctx.beginPath(); ctx.arc(12*s, 6*s, 3*s, 0, Math.PI*2); ctx.fill();
                ctx.fillRect(10*s, 9*s, 4*s, 9*s);
                ctx.fillStyle = '#7bdb87';
                ctx.beginPath(); ctx.arc(17*s, 7*s, 3*s, 0, Math.PI*2); ctx.fill();
                ctx.fillRect(15*s, 10*s, 4*s, 8*s);
                break;
            
            case 'event-money':
                // Coin with euro symbol
                ctx.fillStyle = '#ffd93d';
                ctx.beginPath(); ctx.arc(12*s, 12*s, 8*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#e6c230';
                ctx.beginPath(); ctx.arc(12*s, 12*s, 6*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#1a1a2e';
                ctx.font = (10*s) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('\u20ac', 12*s, 13*s);
                break;
            
            case 'event-wrench':
                // Wrench shape
                ctx.fillStyle = '#8899aa'; ctx.strokeStyle = '#8899aa'; ctx.lineWidth = 2.5*s; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(8*s, 16*s); ctx.lineTo(16*s, 8*s); ctx.stroke();
                ctx.beginPath(); ctx.arc(17*s, 7*s, 3.5*s, -0.5, Math.PI*1.2); ctx.stroke();
                ctx.beginPath(); ctx.arc(7*s, 17*s, 2.5*s, 1.5, Math.PI*2.8); ctx.stroke();
                break;
            
            case 'event-star':
                // Small 5-pointed star
                ctx.fillStyle = '#ffd93d';
                ctx.beginPath();
                for (var si3 = 0; si3 < 5; si3++) {
                    var a3 = (si3 * 72 - 90) * Math.PI / 180;
                    var a4 = ((si3 * 72) + 36 - 90) * Math.PI / 180;
                    ctx.lineTo(12*s + Math.cos(a3) * 7*s, 12*s + Math.sin(a3) * 7*s);
                    ctx.lineTo(12*s + Math.cos(a4) * 3*s, 12*s + Math.sin(a4) * 3*s);
                }
                ctx.closePath(); ctx.fill();
                break;
            
            case 'event-megaphone':
                // Megaphone shape
                ctx.fillStyle = '#ff9c52';
                ctx.beginPath();
                ctx.moveTo(6*s, 9*s); ctx.lineTo(18*s, 5*s); ctx.lineTo(18*s, 19*s); ctx.lineTo(6*s, 15*s);
                ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#cc7030';
                ctx.fillRect(4*s, 9*s, 3*s, 6*s);
                // Sound lines
                ctx.strokeStyle = '#ffd93d'; ctx.lineWidth = 1*s; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.arc(18*s, 12*s, 3*s, -0.6, 0.6); ctx.stroke();
                ctx.beginPath(); ctx.arc(18*s, 12*s, 5*s, -0.4, 0.4); ctx.stroke();
                break;
            
            case 'event-food':
                // Plate + steam
                ctx.fillStyle = '#e0e0e0';
                ctx.beginPath(); ctx.ellipse(12*s, 16*s, 8*s, 3*s, 0, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#c0c0c0';
                ctx.beginPath(); ctx.ellipse(12*s, 15*s, 6*s, 2*s, 0, 0, Math.PI); ctx.fill();
                // Steam lines
                ctx.strokeStyle = 'rgba(200,200,200,0.7)'; ctx.lineWidth = 1*s; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(8*s, 11*s); ctx.quadraticCurveTo(7*s, 8*s, 9*s, 5*s); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(12*s, 10*s); ctx.quadraticCurveTo(11*s, 7*s, 13*s, 4*s); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(16*s, 11*s); ctx.quadraticCurveTo(15*s, 8*s, 17*s, 5*s); ctx.stroke();
                break;
            
            case 'lock':
                // Shackle
                ctx.strokeStyle = '#888'; ctx.lineWidth = 2*s; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.arc(12*s, 10*s, 4*s, Math.PI, 0); ctx.stroke();
                // Body
                ctx.fillStyle = '#666';
                ctx.fillRect(6*s, 10*s, 12*s, 10*s);
                ctx.fillStyle = '#555';
                ctx.fillRect(7*s, 11*s, 10*s, 8*s);
                // Keyhole
                ctx.fillStyle = '#333';
                ctx.beginPath(); ctx.arc(12*s, 14*s, 2*s, 0, Math.PI*2); ctx.fill();
                ctx.fillRect(11*s, 14*s, 2*s, 4*s);
                break;
            
            case 'checkmark':
                ctx.strokeStyle = '#6bcb77'; ctx.lineWidth = 3*s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                ctx.beginPath(); ctx.moveTo(5*s, 12*s); ctx.lineTo(10*s, 18*s); ctx.lineTo(19*s, 6*s); ctx.stroke();
                break;
            
            case 'bug':
                // Body
                ctx.fillStyle = '#6bcb77';
                ctx.beginPath(); ctx.ellipse(12*s, 14*s, 5*s, 6*s, 0, 0, Math.PI*2); ctx.fill();
                // Head
                ctx.fillStyle = '#4a9e5a';
                ctx.beginPath(); ctx.arc(12*s, 7*s, 3.5*s, 0, Math.PI*2); ctx.fill();
                // Eyes
                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.arc(10*s, 6.5*s, 1.2*s, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(14*s, 6.5*s, 1.2*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#222';
                ctx.beginPath(); ctx.arc(10.3*s, 6.5*s, 0.6*s, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(14.3*s, 6.5*s, 0.6*s, 0, Math.PI*2); ctx.fill();
                // Antennae
                ctx.strokeStyle = '#4a9e5a'; ctx.lineWidth = 1*s; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(10*s, 4.5*s); ctx.lineTo(8*s, 2*s); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(14*s, 4.5*s); ctx.lineTo(16*s, 2*s); ctx.stroke();
                // Legs
                ctx.strokeStyle = '#3d8a47'; ctx.lineWidth = 1.2*s;
                for (var li = 0; li < 3; li++) {
                    var ly = (10 + li * 4) * s;
                    ctx.beginPath(); ctx.moveTo(7*s, ly); ctx.lineTo(4*s, ly + 1.5*s); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(17*s, ly); ctx.lineTo(20*s, ly + 1.5*s); ctx.stroke();
                }
                // Shell line
                ctx.strokeStyle = '#3d8a47'; ctx.lineWidth = 1*s;
                ctx.beginPath(); ctx.moveTo(12*s, 9*s); ctx.lineTo(12*s, 19*s); ctx.stroke();
                break;
            
            case 'happy-face':
                // Circle face
                ctx.fillStyle = '#6bcb77';
                ctx.beginPath(); ctx.arc(12*s, 12*s, 8*s, 0, Math.PI*2); ctx.fill();
                // Eyes
                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.arc(9*s, 10*s, 2*s, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(15*s, 10*s, 2*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#2d1b4e';
                ctx.beginPath(); ctx.arc(9.5*s, 10*s, 1*s, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(15.5*s, 10*s, 1*s, 0, Math.PI*2); ctx.fill();
                // Smile
                ctx.strokeStyle = '#2d1b4e'; ctx.lineWidth = 1.5*s; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.arc(12*s, 12*s, 5*s, 0.2, Math.PI - 0.2); ctx.stroke();
                break;
            
            case 'people':
                // Two people silhouettes
                ctx.fillStyle = '#5da6ff';
                ctx.beginPath(); ctx.arc(9*s, 8*s, 3.5*s, 0, Math.PI*2); ctx.fill();
                ctx.fillRect(5*s, 12*s, 8*s, 8*s);
                ctx.fillStyle = '#4d96ff';
                ctx.beginPath(); ctx.arc(16*s, 9*s, 3*s, 0, Math.PI*2); ctx.fill();
                ctx.fillRect(12*s, 13*s, 8*s, 7*s);
                break;
            
            case 'clock':
                // Clock face
                ctx.strokeStyle = '#ffd93d'; ctx.lineWidth = 2*s;
                ctx.beginPath(); ctx.arc(12*s, 12*s, 8*s, 0, Math.PI*2); ctx.stroke();
                // Center dot
                ctx.fillStyle = '#ffd93d';
                ctx.beginPath(); ctx.arc(12*s, 12*s, 1.5*s, 0, Math.PI*2); ctx.fill();
                // Hands
                ctx.strokeStyle = '#ffd93d'; ctx.lineWidth = 2*s; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(12*s, 12*s); ctx.lineTo(12*s, 6*s); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(12*s, 12*s); ctx.lineTo(17*s, 12*s); ctx.stroke();
                // Tick marks
                ctx.lineWidth = 1*s;
                for (var ti = 0; ti < 12; ti++) {
                    var ta = ti * Math.PI / 6;
                    ctx.beginPath();
                    ctx.moveTo(12*s + Math.sin(ta)*6.5*s, 12*s - Math.cos(ta)*6.5*s);
                    ctx.lineTo(12*s + Math.sin(ta)*8*s, 12*s - Math.cos(ta)*8*s);
                    ctx.stroke();
                }
                break;
            
            // ==================== MOBILE MENU ICONS (32x32) ====================
            case 'mob-build':
                // Construction scene: wooden frame with hammer
                // Ground
                ctx.fillStyle = '#8b7355'; ctx.fillRect(1*s, 20*s, 22*s, 3*s);
                ctx.fillStyle = '#a08868'; ctx.fillRect(1*s, 20*s, 22*s, 1*s);
                // Wooden frame (A-shape)
                ctx.fillStyle = '#c8a060'; ctx.lineWidth = 2.2*s; ctx.strokeStyle = '#a07830'; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(4*s, 20*s); ctx.lineTo(12*s, 5*s); ctx.lineTo(20*s, 20*s); ctx.stroke();
                // Crossbeam
                ctx.beginPath(); ctx.moveTo(7*s, 14*s); ctx.lineTo(17*s, 14*s); ctx.stroke();
                // Wood grain highlights
                ctx.strokeStyle = '#dbb878'; ctx.lineWidth = 0.8*s;
                ctx.beginPath(); ctx.moveTo(8*s, 12*s); ctx.lineTo(12*s, 5.5*s); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(10*s, 14*s); ctx.lineTo(15*s, 14*s); ctx.stroke();
                // Hammer (angled, resting against frame)
                ctx.save(); ctx.translate(17*s, 10*s); ctx.rotate(0.5);
                // Handle
                ctx.fillStyle = '#9a6c40'; ctx.fillRect(-1*s, -1*s, 2.5*s, 12*s);
                ctx.fillStyle = '#b8844c'; ctx.fillRect(-0.5*s, -1*s, 1*s, 12*s);
                // Head
                ctx.fillStyle = '#888'; ctx.fillRect(-3.5*s, -3*s, 7*s, 4*s);
                ctx.fillStyle = '#aaa'; ctx.fillRect(-3.5*s, -3*s, 7*s, 1.5*s);
                ctx.restore();
                // Sparkle
                ctx.fillStyle = '#ffd93d';
                ctx.fillRect(20*s, 4*s, 2*s, 0.8*s); ctx.fillRect(20.6*s, 3.4*s, 0.8*s, 2*s);
                ctx.fillRect(2*s, 8*s, 1.5*s, 0.6*s); ctx.fillRect(2.4*s, 7.7*s, 0.6*s, 1.2*s);
                break;
            case 'mob-manage':
                // Clipboard with checkmarks + gear
                // Clipboard body
                ctx.fillStyle = '#e8dcc8';
                ctx.beginPath(); ctx.roundRect(3*s, 4*s, 14*s, 18*s, 2*s); ctx.fill();
                // Paper edge shadow
                ctx.fillStyle = '#d4c8b0';
                ctx.fillRect(15*s, 6*s, 2*s, 14*s);
                ctx.fillRect(5*s, 20*s, 12*s, 2*s);
                // Clipboard clip
                ctx.fillStyle = '#8b8b8b';
                ctx.beginPath(); ctx.roundRect(7*s, 2*s, 6*s, 4*s, 1.5*s); ctx.fill();
                ctx.fillStyle = '#aaa';
                ctx.fillRect(8*s, 3*s, 4*s, 1.5*s);
                // Lines with checkmarks
                ctx.fillStyle = '#bbb'; 
                ctx.fillRect(8*s, 9*s, 7*s, 1*s);
                ctx.fillRect(8*s, 13*s, 7*s, 1*s);
                ctx.fillRect(8*s, 17*s, 7*s, 1*s);
                // Check marks (green)
                ctx.strokeStyle = '#50a050'; ctx.lineWidth = 1.5*s; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(4.5*s, 9*s); ctx.lineTo(5.5*s, 10.5*s); ctx.lineTo(7*s, 8*s); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(4.5*s, 13*s); ctx.lineTo(5.5*s, 14.5*s); ctx.lineTo(7*s, 12*s); ctx.stroke();
                // Pending (empty circle for 3rd)
                ctx.strokeStyle = '#cca040'; ctx.lineWidth = 1*s;
                ctx.beginPath(); ctx.arc(5.8*s, 17.3*s, 1.5*s, 0, Math.PI*2); ctx.stroke();
                // Gear (overlapping bottom-right)
                ctx.fillStyle = '#6a9fd8';
                ctx.beginPath(); ctx.arc(19*s, 18*s, 4*s, 0, Math.PI*2); ctx.fill();
                for (var gi = 0; gi < 6; gi++) {
                    var ga = gi * Math.PI / 3;
                    ctx.beginPath(); ctx.arc(19*s + Math.cos(ga)*5.5*s, 18*s + Math.sin(ga)*5.5*s, 2*s, 0, Math.PI*2); ctx.fill();
                }
                ctx.fillStyle = '#e8dcc8';
                ctx.beginPath(); ctx.arc(19*s, 18*s, 2*s, 0, Math.PI*2); ctx.fill();
                break;
            case 'mob-sell':
                // Wrecking ball with debris
                // Crane arm
                ctx.strokeStyle = '#ff8c42'; ctx.lineWidth = 2.5*s; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(3*s, 2*s); ctx.lineTo(18*s, 2*s); ctx.stroke();
                // Vertical mast
                ctx.beginPath(); ctx.moveTo(4*s, 2*s); ctx.lineTo(4*s, 9*s); ctx.stroke();
                ctx.strokeStyle = '#cc6a2a'; ctx.lineWidth = 1*s;
                ctx.beginPath(); ctx.moveTo(4*s, 4*s); ctx.lineTo(8*s, 2*s); ctx.stroke();
                // Chain
                ctx.strokeStyle = '#999'; ctx.lineWidth = 1.5*s;
                ctx.setLineDash([2*s, 1.5*s]);
                ctx.beginPath(); ctx.moveTo(16*s, 2*s); ctx.lineTo(16*s, 9*s); ctx.stroke();
                ctx.setLineDash([]);
                // Wrecking ball (big)
                ctx.fillStyle = '#555';
                ctx.beginPath(); ctx.arc(16*s, 14*s, 5.5*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#777';
                ctx.beginPath(); ctx.arc(14.5*s, 12.5*s, 2.5*s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#444';
                ctx.beginPath(); ctx.arc(17.5*s, 16*s, 1.5*s, 0, Math.PI*2); ctx.fill();
                // Debris/impact
                ctx.fillStyle = '#c06040';
                ctx.fillRect(1*s, 18*s, 4*s, 3*s);
                ctx.fillRect(6*s, 19*s, 3*s, 2.5*s);
                ctx.fillStyle = '#d88060';
                ctx.fillRect(2*s, 16*s, 3*s, 2*s);
                ctx.fillRect(8*s, 17*s, 2*s, 2*s);
                // Impact lines
                ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 1.2*s; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(21*s, 11*s); ctx.lineTo(23*s, 9*s); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(22*s, 15*s); ctx.lineTo(23.5*s, 16*s); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(20*s, 19*s); ctx.lineTo(22*s, 21*s); ctx.stroke();
                // Small debris flying
                ctx.fillStyle = '#c06040';
                ctx.fillRect(22*s, 12*s, 1.5*s, 1.5*s);
                ctx.fillRect(21*s, 19.5*s, 1.2*s, 1.2*s);
                break;
        }
    };
    
    // ==================== PIXEL SPRITE SYSTEM ====================
    
    // Hex-digit encoded sprites: each char = 1 pixel = palette index (0-C hex)
    // 0=transparent, 2=skin, 3=skinShadow, 4=hair, 5=hairDark, 6=hairLight,
    // 7=shirt, 8=shirtDark, 9=shirtLight, A=pants, B=pantsDark, C=shoe
    // No outline — shading only for soft, natural look
    
    var SPRITE_FRAMES = {
        man: [
          // f0: stand
          ["0000000000000000","0000004440000000","0000064444000000","0000044445000000","0000052225000000","0000003230000000","0000977778000000","0000087778000000","0000087778000000","0000077770000000","00000AAAA0000000","00000BAAB0000000","000000A0A0000000","000000A0A0000000","000000C0C0000000","0000000000000000"],
          // f1: walk (right arm fwd, legs apart)
          ["0000000000000000","0000004440000000","0000064444000000","0000044445000000","0000052225000000","0000003230000000","0000977778000000","0000087778300000","0000087778000000","0000077770000000","00000AAAA0000000","00000BAAB0000000","00000A00A0000000","00000A00A0000000","00000C00C0000000","0000000000000000"],
          // f2: stand (slight variation)
          ["0000000000000000","0000004440000000","0000064444000000","0000044445000000","0000052225000000","0000003230000000","0000977778000000","0000087778000000","0000087778000000","0000077770000000","00000AAAA0000000","00000BAAB0000000","000000A0A0000000","000000A0A0000000","000000C0C0000000","0000000000000000"],
          // f3: walk (left arm fwd, legs apart)
          ["0000000000000000","0000004440000000","0000064444000000","0000044445000000","0000052225000000","0000003230000000","0000977778000000","0000287778000000","0000087778000000","0000077770000000","00000AAAA0000000","00000BAAB0000000","00000A00A0000000","00000A00A0000000","00000C00C0000000","0000000000000000"]
        ],
        woman: [
          // f0: stand — long hair flows down sides, flared skirt
          ["0000004440000000","0000644444000000","0000444445000000","0000452254000000","0000403230400000","0000507770500000","0000487778000000","0000587778000000","0000007770000000","00000AAAAA000000","0000AAAAAA000000","0000AAAAAB000000","000000A0A0000000","000000A0A0000000","000000C0C0000000","0000000000000000"],
          // f1: walk
          ["0000004440000000","0000644444000000","0000444445000000","0000452254000000","0000403230400000","0000507770500000","0000487778300000","0000587778000000","0000007770000000","00000AAAAA000000","0000AAAAAB000000","0000AAAAAB000000","00000A000A000000","00000A000A000000","00000C000C000000","0000000000000000"],
          // f2: stand
          ["0000004440000000","0000644444000000","0000444445000000","0000452254000000","0000403230400000","0000507770500000","0000487778000000","0000587778000000","0000007770000000","00000AAAAA000000","0000AAAAAA000000","0000AAAAAB000000","000000A0A0000000","000000A0A0000000","000000C0C0000000","0000000000000000"],
          // f3: walk
          ["0000004440000000","0000644444000000","0000444445000000","0000452254000000","0000403230400000","0000507770500000","0000287778000000","0000587778000000","0000007770000000","00000AAAAA000000","0000AAAAAB000000","0000AAAAAB000000","00000A000A000000","00000A000A000000","00000C000C000000","0000000000000000"]
        ],
        boy: [
          // f0: stand — smaller, starts row 3, short hair, shorts
          ["0000000000000000","0000000000000000","0000000000000000","0000004440000000","0000064440000000","0000044450000000","0000052250000000","0000003230000000","0000097780000000","0000087780000000","0000077770000000","00000AAAA0000000","000000A0A0000000","000000A0A0000000","000000C0C0000000","0000000000000000"],
          // f1: walk
          ["0000000000000000","0000000000000000","0000000000000000","0000004440000000","0000064440000000","0000044450000000","0000052250000000","0000003230000000","0000097780000000","0000087783000000","0000077770000000","00000AAAA0000000","00000A00A0000000","00000A00A0000000","00000C00C0000000","0000000000000000"],
          // f2: stand
          ["0000000000000000","0000000000000000","0000000000000000","0000004440000000","0000064440000000","0000044450000000","0000052250000000","0000003230000000","0000097780000000","0000087780000000","0000077770000000","00000AAAA0000000","000000A0A0000000","000000A0A0000000","000000C0C0000000","0000000000000000"],
          // f3: walk
          ["0000000000000000","0000000000000000","0000000000000000","0000004440000000","0000064440000000","0000044450000000","0000052250000000","0000003230000000","0000097780000000","0000287780000000","0000077770000000","00000AAAA0000000","00000A00A0000000","00000A00A0000000","00000C00C0000000","0000000000000000"]
        ],
        girl: [
          // f0: stand — smaller, pigtail bumps, skirt
          ["0000000000000000","0000000000000000","0000400044000000","0000464444000000","0000444454000000","0000452254000000","0000003230000000","0000097780000000","0000087780000000","0000077770000000","00000AAAA0000000","0000AAAAA0000000","0000AAAAB0000000","000000A0A0000000","000000C0C0000000","0000000000000000"],
          // f1: walk
          ["0000000000000000","0000000000000000","0000400044000000","0000464444000000","0000444454000000","0000452254000000","0000003230000000","0000097780000000","0000087783000000","0000077770000000","00000AAAA0000000","0000AAAAB0000000","0000AAAAB0000000","00000A00A0000000","00000C00C0000000","0000000000000000"],
          // f2: stand
          ["0000000000000000","0000000000000000","0000400044000000","0000464444000000","0000444454000000","0000452254000000","0000003230000000","0000097780000000","0000087780000000","0000077770000000","00000AAAA0000000","0000AAAAA0000000","0000AAAAB0000000","000000A0A0000000","000000C0C0000000","0000000000000000"],
          // f3: walk
          ["0000000000000000","0000000000000000","0000400044000000","0000464444000000","0000444454000000","0000452254000000","0000003230000000","0000097780000000","0000287780000000","0000077770000000","00000AAAA0000000","0000AAAAB0000000","0000AAAAB0000000","00000A00A0000000","00000C00C0000000","0000000000000000"]
        ]
    };
    
    // Parse hex-digit sprite row: each char → palette index
    function parseSpriteRow(row) {
        var pixels = [];
        for (var i = 0; i < 16; i++) {
            pixels.push(parseInt(row.charAt(i), 16));
        }
        return pixels;
    }
    
    // Parsed frame cache
    var PARSED_SPRITES = {};
    function initSpriteData() {
        var types = ['man', 'woman', 'boy', 'girl'];
        for (var t = 0; t < types.length; t++) {
            var bt = types[t];
            PARSED_SPRITES[bt] = [];
            for (var f = 0; f < 4; f++) {
                var frame = [];
                for (var r = 0; r < 16; r++) {
                    frame.push(parseSpriteRow(SPRITE_FRAMES[bt][f][r]));
                }
                PARSED_SPRITES[bt].push(frame);
            }
        }
    }
    initSpriteData();
    
    // Color helpers
    function hexDarken(hex, amt) {
        var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
        r = Math.max(0, Math.round(r * (1 - amt)));
        g = Math.max(0, Math.round(g * (1 - amt)));
        b = Math.max(0, Math.round(b * (1 - amt)));
        return '#' + [r,g,b].map(function(c){ return c.toString(16).padStart(2,'0'); }).join('');
    }
    function hexLighten(hex, amt) {
        var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
        r = Math.min(255, Math.round(r + (255-r) * amt));
        g = Math.min(255, Math.round(g + (255-g) * amt));
        b = Math.min(255, Math.round(b + (255-b) * amt));
        return '#' + [r,g,b].map(function(c){ return c.toString(16).padStart(2,'0'); }).join('');
    }
    
    // Build color palette for a guest (no outline — shading only)
    function buildGuestPalette(skin, hair, outfitIdx) {
        var outfit = PPT.config.OUTFIT_COMBOS[outfitIdx] || PPT.config.OUTFIT_COMBOS[0];
        var shirt = outfit[0], pants = outfit[1], shoe = hexDarken(pants, 0.3);
        return [
            null,                    // 0: transparent
            null,                    // 1: unused
            skin,                    // 2: skin
            hexDarken(skin, 0.18),   // 3: skin shadow
            hair,                    // 4: hair
            hexDarken(hair, 0.22),   // 5: hair dark
            hexLighten(hair, 0.2),   // 6: hair light
            shirt,                   // 7: shirt
            hexDarken(shirt, 0.22),  // 8: shirt dark
            hexLighten(shirt, 0.15), // 9: shirt light
            pants,                   // 10: pants
            hexDarken(pants, 0.22),  // 11: pants dark
            shoe                     // 12: shoe
        ];
    }
    
    // Create sprite sheet canvas (64×16) with 4 walk frames
    function createGuestSheet(bodyType, skin, hair, outfitIdx) {
        var cvs = document.createElement('canvas');
        cvs.width = 64; cvs.height = 16;
        var ctx = cvs.getContext('2d');
        var palette = buildGuestPalette(skin, hair, outfitIdx);
        var frames = PARSED_SPRITES[bodyType] || PARSED_SPRITES.man;
        for (var f = 0; f < 4; f++) {
            var frame = frames[f];
            var ox = f * 16;
            for (var y = 0; y < 16; y++) {
                for (var x = 0; x < 16; x++) {
                    var idx = frame[y][x];
                    if (idx > 0 && palette[idx]) {
                        ctx.fillStyle = palette[idx];
                        ctx.fillRect(ox + x, y, 1, 1);
                    }
                }
            }
        }
        return cvs;
    }
    
    // Lazy sprite sheet cache per guest
    function getGuestSheet(g) {
        if (!g._sheet) {
            g._sheet = createGuestSheet(
                g.bodyType || 'man',
                g.skin || '#f5d0a9',
                g.hair || '#6c5043',
                g.outfitIdx != null ? g.outfitIdx : 0
            );
        }
        return g._sheet;
    }
    
    // Sprite draw offset — aligns 16×16 sprites with guest coordinate system
    var SPR_OX = -3, SPR_OY = -4;
    
    // ==================== GUEST SPRITE (public, for UI cards) ====================
    
    PPT.render.drawGuestSprite = function(ctx, guest, scale) {
        if (!ctx) return;
        var s = scale || 1.5;
        var sheet = getGuestSheet(guest);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sheet, 0, 0, 16, 16, 0, 0, 16 * s, 16 * s);
    };
    
    // ==================== GUEST PORTRAIT (32×32 detailed face) ====================
    
    PPT.render.drawGuestPortrait = function(ctx, guest) {
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;
        
        var skin = guest.skin || '#f5d0a9';
        var hair = guest.hair || '#6c5043';
        var outfitIdx = guest.outfitIdx != null ? guest.outfitIdx : 0;
        var outfit = PPT.config.OUTFIT_COMBOS[outfitIdx] || PPT.config.OUTFIT_COMBOS[0];
        var shirt = outfit[0];
        var bodyType = guest.bodyType || 'man';
        
        var skinDk = hexDarken(skin, 0.15);
        var skinLt = hexLighten(skin, 0.12);
        var skinSh = hexDarken(skin, 0.25);
        var hairDk = hexDarken(hair, 0.2);
        var hairLt = hexLighten(hair, 0.2);
        var hairSh = hexDarken(hair, 0.35);
        var shirtDk = hexDarken(shirt, 0.2);
        var shirtLt = hexLighten(shirt, 0.15);
        
        // Eye/mouth colors
        var eyeWhite = '#f0f0f0';
        var eyeIris = '#4a3a2a';
        var eyePupil = '#1a1a2a';
        var mouthCol = hexDarken(skin, 0.3);
        var lipCol = '#d07060';
        var blushCol = 'rgba(220,140,120,0.2)';
        
        // Is child
        var isChild = bodyType === 'boy' || bodyType === 'girl';
        var isFemale = bodyType === 'woman' || bodyType === 'girl';
        
        // --- Background circle (soft) ---
        ctx.fillStyle = 'rgba(0,0,0,0.03)';
        ctx.beginPath(); ctx.arc(16, 16, 15, 0, Math.PI * 2); ctx.fill();
        
        // --- NECK ---
        var neckW = isChild ? 4 : 5;
        var neckY = isChild ? 24 : 23;
        ctx.fillStyle = skinDk;
        ctx.fillRect(16 - neckW/2, neckY, neckW, 5);
        ctx.fillStyle = skin;
        ctx.fillRect(16 - neckW/2 + 1, neckY, neckW - 2, 5);
        
        // --- SHOULDERS / SHIRT ---
        ctx.fillStyle = shirtDk;
        ctx.beginPath(); ctx.roundRect(4, 27, 24, 6, 3); ctx.fill();
        ctx.fillStyle = shirt;
        ctx.beginPath(); ctx.roundRect(4, 27, 24, 5, 3); ctx.fill();
        ctx.fillStyle = shirtLt;
        ctx.fillRect(6, 27, 8, 2);
        // Collar / neckline
        if (isFemale) {
            ctx.fillStyle = skin;
            ctx.beginPath(); ctx.moveTo(12, 27); ctx.lineTo(16, 30); ctx.lineTo(20, 27); ctx.closePath(); ctx.fill();
        } else {
            ctx.fillStyle = shirtDk;
            ctx.fillRect(14, 27, 4, 2);
            ctx.fillStyle = shirtLt;
            ctx.fillRect(15, 27, 2, 2);
        }
        
        // --- HEAD shape ---
        var headW, headH, headY;
        if (isChild) {
            headW = 11; headH = 11; headY = 10;
        } else {
            headW = 12; headH = 13; headY = 8;
        }
        
        // Head shadow
        ctx.fillStyle = skinSh;
        ctx.beginPath(); ctx.roundRect(16 - headW/2, headY + 1, headW, headH, isChild ? 5 : 4); ctx.fill();
        // Head main
        ctx.fillStyle = skin;
        ctx.beginPath(); ctx.roundRect(16 - headW/2, headY, headW, headH, isChild ? 5 : 4); ctx.fill();
        // Forehead highlight
        ctx.fillStyle = skinLt;
        ctx.beginPath(); ctx.roundRect(16 - headW/2 + 2, headY + 1, headW - 4, 4, 3); ctx.fill();
        
        // Cheek shadow
        ctx.fillStyle = skinDk;
        ctx.fillRect(16 - headW/2 + 1, headY + headH - 5, 2, 3);
        ctx.fillRect(16 + headW/2 - 3, headY + headH - 5, 2, 3);
        
        // --- JAW (adults only) ---
        if (!isChild && !isFemale) {
            ctx.fillStyle = skinDk;
            ctx.fillRect(16 - headW/2 + 1, headY + headH - 3, headW - 2, 1);
        }
        
        // Blush
        ctx.fillStyle = blushCol;
        ctx.beginPath(); ctx.arc(16 - headW/2 + 3, headY + headH - 5, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(16 + headW/2 - 3, headY + headH - 5, 2.5, 0, Math.PI * 2); ctx.fill();
        
        // --- HAIR ---
        if (bodyType === 'man') {
            // Short styled hair
            ctx.fillStyle = hair;
            ctx.beginPath(); ctx.roundRect(16 - headW/2 - 1, headY - 3, headW + 2, 8, 4); ctx.fill();
            ctx.fillStyle = hairDk;
            ctx.beginPath(); ctx.roundRect(16 - headW/2, headY - 2, headW, 5, 3); ctx.fill();
            ctx.fillStyle = hair;
            ctx.beginPath(); ctx.roundRect(16 - headW/2 + 1, headY - 2, headW - 2, 4, 3); ctx.fill();
            // Part highlight
            ctx.fillStyle = hairLt;
            ctx.fillRect(12, headY - 1, 3, 2);
            // Sideburns
            ctx.fillStyle = hairDk;
            ctx.fillRect(16 - headW/2, headY + 3, 2, 3);
            ctx.fillRect(16 + headW/2 - 2, headY + 3, 2, 3);
        } else if (bodyType === 'woman') {
            // Long flowing hair behind head
            ctx.fillStyle = hairDk;
            ctx.beginPath(); ctx.roundRect(16 - headW/2 - 2, headY - 3, headW + 4, headH + 8, 5); ctx.fill();
            ctx.fillStyle = hair;
            ctx.beginPath(); ctx.roundRect(16 - headW/2 - 1, headY - 3, headW + 2, headH + 7, 5); ctx.fill();
            // Top volume
            ctx.fillStyle = hair;
            ctx.beginPath(); ctx.roundRect(16 - headW/2 - 1, headY - 4, headW + 2, 7, 4); ctx.fill();
            ctx.fillStyle = hairLt;
            ctx.fillRect(11, headY - 3, 4, 2);
            // Hair strands on shoulders
            ctx.fillStyle = hairDk;
            ctx.fillRect(5, 25, 3, 5); ctx.fillRect(24, 25, 3, 5);
            ctx.fillStyle = hair;
            ctx.fillRect(5, 25, 2, 4); ctx.fillRect(24, 25, 2, 4);
            // Re-draw face over hair
            ctx.fillStyle = skin;
            ctx.beginPath(); ctx.roundRect(16 - headW/2 + 1, headY + 2, headW - 2, headH - 3, 3); ctx.fill();
            ctx.fillStyle = skinLt;
            ctx.fillRect(16 - headW/2 + 3, headY + 3, headW - 6, 3);
            // Blush re-draw
            ctx.fillStyle = blushCol;
            ctx.beginPath(); ctx.arc(16 - headW/2 + 3, headY + headH - 5, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(16 + headW/2 - 3, headY + headH - 5, 2.5, 0, Math.PI * 2); ctx.fill();
        } else if (bodyType === 'boy') {
            // Short spiky/messy hair
            ctx.fillStyle = hair;
            ctx.beginPath(); ctx.roundRect(16 - headW/2 - 1, headY - 3, headW + 2, 7, 4); ctx.fill();
            ctx.fillStyle = hairDk;
            ctx.fillRect(16 - headW/2, headY - 2, headW, 4);
            ctx.fillStyle = hair;
            ctx.fillRect(16 - headW/2 + 1, headY - 2, headW - 2, 3);
            // Spiky tufts
            ctx.fillStyle = hairLt;
            ctx.fillRect(10, headY - 4, 2, 3);
            ctx.fillRect(14, headY - 5, 2, 3);
            ctx.fillRect(18, headY - 4, 2, 3);
            ctx.fillStyle = hair;
            ctx.fillRect(12, headY - 3, 2, 2);
            ctx.fillRect(16, headY - 4, 2, 2);
        } else { // girl
            // Pigtails + bangs
            ctx.fillStyle = hair;
            ctx.beginPath(); ctx.roundRect(16 - headW/2 - 1, headY - 3, headW + 2, 6, 4); ctx.fill();
            ctx.fillStyle = hairDk;
            ctx.fillRect(16 - headW/2, headY - 2, headW, 4);
            ctx.fillStyle = hair;
            ctx.fillRect(16 - headW/2 + 1, headY - 2, headW - 2, 3);
            // Bangs fringe
            ctx.fillStyle = hairLt;
            ctx.fillRect(10, headY - 1, 2, 2); ctx.fillRect(13, headY - 1, 2, 2); ctx.fillRect(16, headY - 1, 2, 2);
            // Pigtails
            ctx.fillStyle = hairDk;
            ctx.beginPath(); ctx.arc(16 - headW/2 - 2, headY + 3, 4, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(16 + headW/2 + 2, headY + 3, 4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = hair;
            ctx.beginPath(); ctx.arc(16 - headW/2 - 2, headY + 2, 3.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(16 + headW/2 + 2, headY + 2, 3.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = hairLt;
            ctx.fillRect(16 - headW/2 - 3, headY + 1, 2, 1);
            ctx.fillRect(16 + headW/2 + 1, headY + 1, 2, 1);
            // Hair ties
            ctx.fillStyle = shirt;
            ctx.beginPath(); ctx.arc(16 - headW/2 - 1, headY + 1, 1.2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(16 + headW/2 + 1, headY + 1, 1.2, 0, Math.PI * 2); ctx.fill();
        }
        
        // --- EYES ---
        var eyeY = headY + (isChild ? 5 : 6);
        var eyeSpacing = isChild ? 3 : 3.5;
        var eyeSize = isChild ? 2.8 : 3;
        
        // Eye whites
        ctx.fillStyle = eyeWhite;
        ctx.beginPath(); ctx.roundRect(16 - eyeSpacing - eyeSize/2, eyeY - eyeSize/2, eyeSize, eyeSize, 1); ctx.fill();
        ctx.beginPath(); ctx.roundRect(16 + eyeSpacing - eyeSize/2, eyeY - eyeSize/2, eyeSize, eyeSize, 1); ctx.fill();
        
        // Irises
        ctx.fillStyle = eyeIris;
        var irisR = isChild ? 1.2 : 1.3;
        ctx.beginPath(); ctx.arc(16 - eyeSpacing, eyeY, irisR, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(16 + eyeSpacing, eyeY, irisR, 0, Math.PI * 2); ctx.fill();
        
        // Pupils
        ctx.fillStyle = eyePupil;
        ctx.fillRect(16 - eyeSpacing - 0.5, eyeY - 0.5, 1, 1);
        ctx.fillRect(16 + eyeSpacing - 0.5, eyeY - 0.5, 1, 1);
        
        // Eye shine
        ctx.fillStyle = '#fff';
        ctx.fillRect(16 - eyeSpacing + 0.3, eyeY - 1, 1, 1);
        ctx.fillRect(16 + eyeSpacing + 0.3, eyeY - 1, 1, 1);
        
        // Eyelashes (female)
        if (isFemale) {
            ctx.fillStyle = hairDk;
            ctx.fillRect(16 - eyeSpacing - eyeSize/2, eyeY - eyeSize/2 - 0.5, eyeSize, 0.8);
            ctx.fillRect(16 + eyeSpacing - eyeSize/2, eyeY - eyeSize/2 - 0.5, eyeSize, 0.8);
        }
        
        // Eyebrows
        ctx.fillStyle = hairDk;
        var browY = eyeY - (isChild ? 3 : 3.5);
        var browW = isChild ? 3 : 4;
        ctx.fillRect(16 - eyeSpacing - browW/2, browY, browW, 1);
        ctx.fillRect(16 + eyeSpacing - browW/2, browY, browW, 1);
        
        // --- NOSE ---
        var noseY = headY + (isChild ? 8 : 9);
        ctx.fillStyle = skinDk;
        if (isChild) {
            ctx.fillRect(15.5, noseY, 1, 1);
        } else {
            ctx.fillRect(15, noseY, 2, 1.5);
            ctx.fillStyle = skinLt;
            ctx.fillRect(15, noseY, 1, 1);
        }
        
        // --- MOUTH ---
        var mouthY = headY + (isChild ? 10 : 12);
        if (isFemale) {
            ctx.fillStyle = lipCol;
            ctx.beginPath(); ctx.roundRect(14, mouthY, 4, 1.5, 0.8); ctx.fill();
            ctx.fillStyle = hexLighten(lipCol, 0.2);
            ctx.fillRect(14.5, mouthY, 1.5, 0.8);
        } else {
            ctx.fillStyle = mouthCol;
            ctx.fillRect(14.5, mouthY, 3, 1);
            ctx.fillStyle = skinLt;
            ctx.fillRect(14.5, mouthY + 1, 3, 0.5);
        }
        
        // --- EARS (peeking out) ---
        if (bodyType !== 'woman') {
            ctx.fillStyle = skin;
            ctx.fillRect(16 - headW/2 - 1, eyeY - 1, 1.5, 3);
            ctx.fillRect(16 + headW/2 - 0.5, eyeY - 1, 1.5, 3);
            ctx.fillStyle = skinDk;
            ctx.fillRect(16 - headW/2 - 1, eyeY, 0.8, 1.5);
            ctx.fillRect(16 + headW/2, eyeY, 0.8, 1.5);
        }
    };
    
    // ==================== STAFF PIXEL SPRITES ====================
    // Same hex-digit format as guests — no outlines, soft shading
    // Palette per type: 0=transparent, 1=hat, 2=skin, 3=skinShadow,
    //   4=hatDark, 5=hatLight, 6=accent, 7=uniform, 8=uniformDark,
    //   9=uniformLight, A=pants, B=pantsDark, C=shoe
    
    var STAFF_FRAMES = {
        janitor: [
          // f0: stand — blue cap with brim, blue polo, light apron panel, dark pants
          ["0000000000000000","0000005550000000","0000054445000000","0000014140000000","0000022220000000","0000003230000000","0000977798000000","0000087768000000","0000087778000000","0000077770000000","00000AAAA0000000","00000BAAB0000000","000000A0A0000000","000000A0A0000000","000000C0C0000000","0000000000000000"],
          // f1: walk right
          ["0000000000000000","0000005550000000","0000054445000000","0000014140000000","0000022220000000","0000003230000000","0000977798000000","0000087768300000","0000087778000000","0000077770000000","00000AAAA0000000","00000BAAB0000000","00000A00A0000000","00000A00A0000000","00000C00C0000000","0000000000000000"],
          // f2: stand alt
          ["0000000000000000","0000005550000000","0000054445000000","0000014140000000","0000022220000000","0000003230000000","0000977798000000","0000087768000000","0000087778000000","0000077770000000","00000AAAA0000000","00000BAAB0000000","000000A0A0000000","000000A0A0000000","000000C0C0000000","0000000000000000"],
          // f3: walk left
          ["0000000000000000","0000005550000000","0000054445000000","0000014140000000","0000022220000000","0000003230000000","0000977798000000","0000287768000000","0000087778000000","0000077770000000","00000AAAA0000000","00000BAAB0000000","00000A00A0000000","00000A00A0000000","00000C00C0000000","0000000000000000"]
        ],
        mechanic: [
          // f0: stand — wide orange hard hat, orange overalls, dark tool belt
          ["0000000000000000","0000055550000000","0000511115000000","0000044440000000","0000022220000000","0000003230000000","0000977779000000","0000087778000000","0000066660000000","0000077770000000","00000AAAA0000000","00000BAAB0000000","000000A0A0000000","000000A0A0000000","000000C0C0000000","0000000000000000"],
          // f1: walk right
          ["0000000000000000","0000055550000000","0000511115000000","0000044440000000","0000022220000000","0000003230000000","0000977779000000","0000087778300000","0000066660000000","0000077770000000","00000AAAA0000000","00000BAAB0000000","00000A00A0000000","00000A00A0000000","00000C00C0000000","0000000000000000"],
          // f2: stand alt
          ["0000000000000000","0000055550000000","0000511115000000","0000044440000000","0000022220000000","0000003230000000","0000977779000000","0000087778000000","0000066660000000","0000077770000000","00000AAAA0000000","00000BAAB0000000","000000A0A0000000","000000A0A0000000","000000C0C0000000","0000000000000000"],
          // f3: walk left
          ["0000000000000000","0000055550000000","0000511115000000","0000044440000000","0000022220000000","0000003230000000","0000977779000000","0000287778000000","0000066660000000","0000077770000000","00000AAAA0000000","00000BAAB0000000","00000A00A0000000","00000A00A0000000","00000C00C0000000","0000000000000000"]
        ],
        entertainer: [
          // f0: stand — pointed party hat with star on top, purple outfit, bright accents
          ["0000000600000000","0000001000000000","0000014410000000","0000011110000000","0000022220000000","0000003230000000","0000977679000000","0000087678000000","0000087778000000","0000077770000000","00000AAAA0000000","00000BAAB0000000","000000A0A0000000","000000A0A0000000","000000C0C0000000","0000000000000000"],
          // f1: walk right
          ["0000000600000000","0000001000000000","0000014410000000","0000011110000000","0000022220000000","0000003230000000","0000977679000000","0000087678300000","0000087778000000","0000077770000000","00000AAAA0000000","00000BAAB0000000","00000A00A0000000","00000A00A0000000","00000C00C0000000","0000000000000000"],
          // f2: stand alt
          ["0000000600000000","0000001000000000","0000014410000000","0000011110000000","0000022220000000","0000003230000000","0000977679000000","0000087678000000","0000087778000000","0000077770000000","00000AAAA0000000","00000BAAB0000000","000000A0A0000000","000000A0A0000000","000000C0C0000000","0000000000000000"],
          // f3: walk left
          ["0000000600000000","0000001000000000","0000014410000000","0000011110000000","0000022220000000","0000003230000000","0000977679000000","0000287678000000","0000087778000000","0000077770000000","00000AAAA0000000","00000BAAB0000000","00000A00A0000000","00000A00A0000000","00000C00C0000000","0000000000000000"]
        ]
    };
    
    // Parse and cache staff frames
    var PARSED_STAFF = {};
    (function initStaffData() {
        var types = ['janitor', 'mechanic', 'entertainer'];
        for (var t = 0; t < types.length; t++) {
            var st = types[t];
            PARSED_STAFF[st] = [];
            for (var f = 0; f < 4; f++) {
                var frame = [];
                for (var r = 0; r < 16; r++) {
                    frame.push(parseSpriteRow(STAFF_FRAMES[st][f][r]));
                }
                PARSED_STAFF[st].push(frame);
            }
        }
    })();
    
    // Fixed color palettes per staff type
    var STAFF_PALETTES = {
        janitor: [
            null,           // 0: transparent
            '#4a90d9',      // 1: cap main
            '#f5d0a9',      // 2: skin
            '#d4b08c',      // 3: skin shadow
            '#3b7dd8',      // 4: cap dark / stripe
            '#7ab8ff',      // 5: cap brim / light
            '#d8ecff',      // 6: apron panel
            '#5da6ff',      // 7: uniform
            '#3b80c8',      // 8: uniform dark
            '#8ec4ff',      // 9: uniform light
            '#2e4057',      // 10: pants
            '#1e3040',      // 11: pants dark
            '#2a2020'       // 12: shoes
        ],
        mechanic: [
            null,           // 0: transparent
            '#ff9c52',      // 1: hard hat main
            '#f5d0a9',      // 2: skin
            '#d4b08c',      // 3: skin shadow
            '#dd7c32',      // 4: hard hat dark / brim
            '#ffbe82',      // 5: hard hat highlight
            '#5a4030',      // 6: tool belt
            '#ff9c52',      // 7: coveralls
            '#cc7030',      // 8: coveralls dark
            '#ffbe82',      // 9: coveralls light
            '#cc7030',      // 10: coverall legs
            '#a05820',      // 11: coverall legs dark
            '#3a2a20'       // 12: boots
        ],
        entertainer: [
            null,           // 0: transparent
            '#c7a4f6',      // 1: hat main
            '#f5d0a9',      // 2: skin
            '#d4b08c',      // 3: skin shadow
            '#9b7cc8',      // 4: hat dark
            '#dfc4ff',      // 5: hat light
            '#ffd93d',      // 6: star / accent (yellow)
            '#c7a4f6',      // 7: outfit
            '#9b7cc8',      // 8: outfit dark
            '#dfc4ff',      // 9: outfit light
            '#a080d0',      // 10: pants
            '#8060a8',      // 11: pants dark
            '#3a2a30'       // 12: shoes
        ]
    };
    
    function createStaffSheet(staffType) {
        var cvs = document.createElement('canvas');
        cvs.width = 64; cvs.height = 16;
        var ctx = cvs.getContext('2d');
        var palette = STAFF_PALETTES[staffType] || STAFF_PALETTES.janitor;
        var frames = PARSED_STAFF[staffType] || PARSED_STAFF.janitor;
        for (var f = 0; f < 4; f++) {
            var frame = frames[f];
            var ox = f * 16;
            for (var y = 0; y < 16; y++) {
                for (var x = 0; x < 16; x++) {
                    var idx = frame[y][x];
                    if (idx > 0 && palette[idx]) {
                        ctx.fillStyle = palette[idx];
                        ctx.fillRect(ox + x, y, 1, 1);
                    }
                }
            }
        }
        return cvs;
    }
    
    // ==================== SPRITE DRAWING ====================
    
    // Cached pixel-art grass tiles (2 variants for checkerboard)
    var _grassTiles = [null, null, null, null];
    
    function buildGrassTile(variant) {
        var c = document.createElement('canvas');
        c.width = 32; c.height = 32;
        var cx = c.getContext('2d');
        
        // Seeded random per variant
        function sr(i) { return ((i * 9301 + 49297 + variant * 3571) % 233280) / 233280; }
        
        // Base greens (low contrast palette)
        var bases = ['#6cc478','#68c074','#70c87c','#64bc70'];
        var base = bases[variant];
        var bR = parseInt(base.slice(1,3),16);
        var bG = parseInt(base.slice(3,5),16);
        var bB = parseInt(base.slice(5,7),16);
        
        // Fill base
        cx.fillStyle = base;
        cx.fillRect(0, 0, 32, 32);
        
        // Layer 1: 2×2 subtle patches (very low contrast variation)
        for (var py2 = 0; py2 < 32; py2 += 2) {
            for (var px2 = 0; px2 < 32; px2 += 2) {
                var idx = (py2/2)*16 + (px2/2);
                var shift = Math.floor((sr(idx+50) - 0.5) * 7);
                cx.fillStyle = 'rgb('+
                    Math.max(0,Math.min(255, bR+shift-2))+','+
                    Math.max(0,Math.min(255, bG+shift))+','+
                    Math.max(0,Math.min(255, bB+shift-2))+')';
                cx.fillRect(px2, py2, 2, 2);
            }
        }
        
        // Layer 2: scattered single-pixel lighter grass tips
        for (var h = 0; h < 30; h++) {
            var hx = Math.floor(sr(h+200) * 32);
            var hy = Math.floor(sr(h+300) * 32);
            var bright = Math.floor(sr(h+400) * 6) + 2;
            cx.fillStyle = 'rgb('+
                Math.min(255,bR+bright)+','+
                Math.min(255,bG+bright+2)+','+
                Math.min(255,bB+bright)+')';
            cx.fillRect(hx, hy, 1, 1);
        }
        
        // Layer 3: scattered slightly darker pixels (soil showing)
        for (var d = 0; d < 15; d++) {
            var dx2 = Math.floor(sr(d+500) * 32);
            var dy2 = Math.floor(sr(d+600) * 32);
            var dark = Math.floor(sr(d+700) * 5) + 2;
            cx.fillStyle = 'rgb('+
                Math.max(0,bR-dark-2)+','+
                Math.max(0,bG-dark)+','+
                Math.max(0,bB-dark-2)+')';
            cx.fillRect(dx2, dy2, 1, 1);
        }
        
        // Layer 4: small grass blade pairs (1-3px tall, low contrast)
        for (var bl = 0; bl < 12; bl++) {
            var bx = Math.floor(sr(bl+800) * 30) + 1;
            var by = Math.floor(sr(bl+900) * 28) + 3;
            var bh = 1 + Math.floor(sr(bl+1000) * 3);
            var gShift = Math.floor(sr(bl+1100) * 6) - 2;
            cx.fillStyle = 'rgb('+
                Math.max(0,Math.min(255,bR+gShift-6))+','+
                Math.max(0,Math.min(255,bG+gShift+2))+','+
                Math.max(0,Math.min(255,bB+gShift-4))+')';
            cx.fillRect(bx, by-bh, 1, bh);
            // companion blade
            if (sr(bl+1200)>0.3) {
                cx.fillStyle = 'rgb('+
                    Math.max(0,Math.min(255,bR+gShift-3))+','+
                    Math.max(0,Math.min(255,bG+gShift+4))+','+
                    Math.max(0,Math.min(255,bB+gShift-2))+')';
                cx.fillRect(bx+1, by-bh+1, 1, Math.max(1,bh-1));
            }
        }
        
        // Layer 5: tiny clover/flower accents (very rare, very subtle)
        for (var fl = 0; fl < 3; fl++) {
            if (sr(fl+1300) > 0.5) {
                var fx = Math.floor(sr(fl+1310) * 30) + 1;
                var fy = Math.floor(sr(fl+1320) * 28) + 2;
                var flType = sr(fl+1330);
                if (flType > 0.7) {
                    // Tiny yellow dot (dandelion)
                    cx.fillStyle = 'rgb('+Math.min(255,bR+30)+','+Math.min(255,bG+25)+','+Math.max(0,bB-15)+')';
                    cx.fillRect(fx, fy, 1, 1);
                } else if (flType > 0.4) {
                    // Tiny white dot (clover)
                    cx.fillStyle = 'rgb('+Math.min(255,bR+20)+','+Math.min(255,bG+18)+','+Math.min(255,bB+22)+')';
                    cx.fillRect(fx, fy, 1, 1);
                } else {
                    // Darker clump (shadow between blades)
                    cx.fillStyle = 'rgb('+Math.max(0,bR-8)+','+Math.max(0,bG-5)+','+Math.max(0,bB-8)+')';
                    cx.fillRect(fx, fy, 2, 1);
                }
            }
        }
        
        return c;
    }
    
    function drawGrass(x, y) {
        var v = ((x * 3 + y * 7) & 3); // 4 variants via hash
        if (!_grassTiles[v]) _grassTiles[v] = buildGrassTile(v);
        parkCtx.drawImage(_grassTiles[v], x * TILE_SIZE, y * TILE_SIZE);
    }
    
    function drawTree(x, y, type) {
        drawTreeOnCtx(parkCtx, x, y, type, 0);
    }
    
    // ═══════════════ TREE SYSTEM v5 — PIXELATED ELLIPSES ═══════════════
    // Pre-renders v3 lush ellipse shapes onto 32×32 offscreen canvases,
    // post-processes to remove anti-aliasing (hard pixel edges),
    // caches results, stamps each frame with wind offset.
    
    function th(x,y,i){ return psr(x,y,(i||0)+7777); }
    
    // Cache: { 'tree-oak-0-canopy': canvas, 'tree-oak-0-trunk': canvas, ... }
    var _treeCache = {};
    var TREE_PAD = 14; // headroom above tile for canopy overflow
    
    // Build offscreen canvas, run drawFn, threshold alpha for pixel edges
    function renderTreeLayer(key, drawFn, tall) {
        if (_treeCache[key]) return _treeCache[key];
        var h = tall ? 32 + TREE_PAD : 32;
        var c = document.createElement('canvas');
        c.width = 32; c.height = h;
        var cx = c.getContext('2d');
        if (tall) cx.translate(0, TREE_PAD); // shift drawing down so canopy has room above
        drawFn(cx);
        // Post-process: threshold alpha for hard pixel edges, remove dark compositing artifacts
        var img = cx.getImageData(0, 0, 32, h);
        var d = img.data;
        for (var i = 0; i < d.length; i += 4) {
            // Remove low-alpha pixels AND very dark compositing artifacts
            if (d[i+3] < 128 || (d[i] + d[i+1] + d[i+2] < 40)) {
                d[i] = d[i+1] = d[i+2] = d[i+3] = 0;
            } else {
                d[i+3] = 255;
            }
        }
        cx.putImageData(img, 0, 0);
        _treeCache[key] = c;
        return c;
    }
    
    function drawTreeOnCtx(ctx, x, y, type, yOff, xOff) {
        var cell = G.grid[y] && G.grid[y][x];
        var sway = cell ? (cell.sway || 0) : x * 1.7 + y * 2.3;
        var f = G.paused ? 0 : G.frame;
        var w = Math.sin(f * 0.02 + sway) * 2.5;
        var w2 = Math.sin(f * 0.012 + sway * 0.6) * 1.2;
        var px = x * TILE_SIZE + (xOff || 0);
        var py = y * TILE_SIZE + yOff;
        var v = Math.floor(th(x,y,0) * 4);
        
        var tKey = type + '-' + v;
        
        // Ensure layers are cached
        ensureTreeCached(type, v);
        
        var trunkC = _treeCache[tKey + '-trunk'];
        var canopyC = _treeCache[tKey + '-canopy'];
        var shadowC = _treeCache[tKey + '-shadow'];
        
        // Draw shadow (slight wind drift)
        if (shadowC) {
            ctx.drawImage(shadowC, px + Math.round(w2 * 0.3), py);
        }
        
        // Draw trunk (minimal wind)
        if (trunkC) {
            ctx.drawImage(trunkC, px, py);
        }
        
        // Draw canopy with headroom offset (wind offset)
        if (canopyC) {
            ctx.drawImage(canopyC, px + Math.round(w * 0.5), py - TREE_PAD);
        }
        
        // Per-tree unique pixel details (highlights + edge pixels)
        addUniqueDetails(ctx, px, py, x, y, type, w);
        
        // Cherry: animated falling petals
        if (type === 'tree-cherry') {
            for (var fp = 0; fp < 3; fp++) {
                var fpB = psr(x,y,fp+950);
                var fpX = 6 + fpB * 20 + Math.sin(f * 0.025 + fp * 2.1) * 4;
                var fpY = 16 + fp * 5 + ((f * 0.035 + fpB * 40) % 16);
                if (fpY < 30) {
                    ctx.fillStyle = fp%2===0 ? '#f2c0c8' : '#fce8ee';
                    ctx.fillRect(px + Math.round(fpX + w * 0.3), py + Math.round(fpY), 1, 1);
                }
            }
        }
    }
    
    // Per-tree unique pixels (drawn every frame, on top of cached canopy)
    function addUniqueDetails(ctx, px, py, x, y, type, w) {
        var isCherry = type === 'tree-cherry';
        var isPine = type === 'tree-pine';
        var hlCol1 = isCherry ? '#fce8ee' : isPine ? '#5cb05c' : '#88dc80';
        var hlCol2 = isCherry ? '#fff0f4' : isPine ? '#6cc06c' : '#98ec90';
        var leafCol = isCherry ? '#4a8a3a' : null;
        var wOff = Math.round(w * 0.5);
        
        // Sun highlight dapples (top-left bias)
        for (var hi = 0; hi < 6; hi++) {
            var hx = Math.round(8 + psr(x,y,hi+100) * 14);
            var hy = Math.round(3 + psr(x,y,hi+110) * 10);
            if (psr(x,y,hi+120) > 0.35) {
                ctx.fillStyle = psr(x,y,hi+125) > 0.5 ? hlCol1 : hlCol2;
                ctx.fillRect(px + hx + wOff, py + hy, 1, 1);
                if (psr(x,y,hi+130) > 0.5) ctx.fillRect(px + hx + 1 + wOff, py + hy, 1, 1);
            }
        }
        // Green leaf accents on cherry
        if (leafCol) {
            for (var gi = 0; gi < 4; gi++) {
                var gx = Math.round(8 + psr(x,y,gi+300) * 14);
                var gy = Math.round(5 + psr(x,y,gi+310) * 8);
                ctx.fillStyle = leafCol;
                ctx.fillRect(px + gx + wOff, py + gy, 1, 1);
            }
        }
        // Ground details
        groundDetail5(ctx, px, py, x, y, type);
    }
    
    function groundDetail5(ctx, px, py, x, y, type) {
        if (th(x,y,20)>0.4) { ctx.fillStyle='#5aaa48'; ctx.fillRect(px+2+Math.floor(th(x,y,21)*5),py+29,1,2); ctx.fillStyle='#4d9a3c'; ctx.fillRect(px+3+Math.floor(th(x,y,21)*5),py+28,1,3); }
        if (th(x,y,22)>0.4) { ctx.fillStyle='#4d9a3c'; ctx.fillRect(px+25+Math.floor(th(x,y,23)*5),py+29,1,2); ctx.fillStyle='#68ba58'; ctx.fillRect(px+26+Math.floor(th(x,y,23)*5),py+28,1,3); }
        if (th(x,y,26)>0.7) { var rx=5+Math.floor(th(x,y,27)*22); ctx.fillStyle='#9a9088'; ctx.fillRect(px+rx,py+30,2,1); ctx.fillStyle='#aaa098'; ctx.fillRect(px+rx,py+29,2,1); }
        if (type === 'tree-cherry') {
            for (var i=0;i<5;i++) if(th(x,y,i+70)>0.3) { ctx.fillStyle=th(x,y,i+73)>0.5?'#f0c8d4':'#e8b8c8'; ctx.fillRect(px+Math.floor(2+th(x,y,i+71)*28),py+Math.floor(27+th(x,y,i+72)*4),1,1); }
        }
        if (type === 'tree-pine') {
            for (var j=0;j<4;j++) if(th(x,y,j+30)>0.35) { ctx.fillStyle='#7a6848'; ctx.fillRect(px+Math.floor(4+th(x,y,j+31)*24),py+29+Math.floor(th(x,y,j+33)*2),1,1); }
        }
    }
    
    // ════════════════════════════════════════════════════════════
    // Pre-render functions: same v3 ellipse shapes, just on 32×32 canvas
    // ════════════════════════════════════════════════════════════
    
    function ensureTreeCached(type, v) {
        var key = type + '-' + v;
        if (_treeCache[key + '-canopy']) return;
        
        if (type === 'tree-oak') cacheOak(v, key);
        else if (type === 'tree-pine') cachePine(v, key);
        else cacheCher(v, key);
    }
    
    // ──── OAK cache ────
    function cacheOak(v, key) {
        // Shadow layer
        renderTreeLayer(key + '-shadow', function(c) {
            c.fillStyle = 'rgba(0,30,10,0.22)';
            if (v === 3) {
                c.beginPath(); c.ellipse(10,30,10,3,0,0,Math.PI*2); c.fill();
                c.beginPath(); c.ellipse(25,30,7,2.5,0,0,Math.PI*2); c.fill();
            } else if (v === 1) {
                c.beginPath(); c.ellipse(16,30,15,4,0,0,Math.PI*2); c.fill();
            } else if (v === 2) {
                c.beginPath(); c.ellipse(16,30,10,3.5,0,0,Math.PI*2); c.fill();
            } else {
                c.beginPath(); c.ellipse(16,30,13,4,0,0,Math.PI*2); c.fill();
            }
        });
        
        // Trunk layer
        renderTreeLayer(key + '-trunk', function(c) {
            var TD='#6a4a28',TM='#7d5c3a',TL='#946e48';
            if (v === 3) {
                drTrunk(c,8,18,4,13,TD,TM,TL); drTrunk(c,24,23,3,8,TD,TM,TL);
            } else if (v === 1) {
                drTrunk(c,14,19,4,12,TD,TM,TL);
            } else if (v === 2) {
                drTrunk(c,14,15,4,16,TD,TM,TL);
            } else {
                drTrunk(c,13,18,5,13,TD,TM,TL);
            }
        });
        
        // Canopy layer
        renderTreeLayer(key + '-canopy', function(c) {
            if (v === 0) { // Classic round
                c.fillStyle='#2d6a22'; c.beginPath(); c.ellipse(16,14,14,12,0,0,Math.PI*2); c.fill();
                c.fillStyle='#3d8a47'; c.beginPath(); c.ellipse(16,11,13,10,0,0,Math.PI*2); c.fill();
                c.fillStyle='#4d9a57'; c.beginPath(); c.ellipse(10,8,9,8,0,0,Math.PI*2); c.fill();
                c.fillStyle='#4d9a57'; c.beginPath(); c.ellipse(22,8,9,8,0,0,Math.PI*2); c.fill();
                c.fillStyle='#5daa67'; c.beginPath(); c.ellipse(16,6,10,7,0,0,Math.PI*2); c.fill();
                c.fillStyle='#6dba77'; c.beginPath(); c.ellipse(16,3,7,5,0,0,Math.PI*2); c.fill();
            } else if (v === 1) { // Wide (fits within canvas)
                c.fillStyle='#2d6a22'; c.beginPath(); c.ellipse(16,16,13,9,0,0,Math.PI*2); c.fill();
                c.fillStyle='#3d8a47'; c.beginPath(); c.ellipse(16,13,12,8,0,0,Math.PI*2); c.fill();
                c.fillStyle='#4d9a57'; c.beginPath(); c.ellipse(10,10,8,7,0,0,Math.PI*2); c.fill();
                c.fillStyle='#4d9a57'; c.beginPath(); c.ellipse(22,10,8,7,0,0,Math.PI*2); c.fill();
                c.fillStyle='#5daa67'; c.beginPath(); c.ellipse(16,8,10,6,0,0,Math.PI*2); c.fill();
                c.fillStyle='#6dba77'; c.beginPath(); c.ellipse(16,5,7,4,0,0,Math.PI*2); c.fill();
            } else if (v === 2) { // Tall
                c.fillStyle='#2d6a22'; c.beginPath(); c.ellipse(16,12,11,14,0,0,Math.PI*2); c.fill();
                c.fillStyle='#3d8a47'; c.beginPath(); c.ellipse(16,9,10,12,0,0,Math.PI*2); c.fill();
                c.fillStyle='#4d9a57'; c.beginPath(); c.ellipse(16,5,9,9,0,0,Math.PI*2); c.fill();
                c.fillStyle='#5daa67'; c.beginPath(); c.ellipse(16,2,7,6,0,0,Math.PI*2); c.fill();
                c.fillStyle='#6dba77'; c.beginPath(); c.ellipse(16,-1,5,4,0,0,Math.PI*2); c.fill();
            } else { // Copse
                c.fillStyle='#2d6a22'; c.beginPath(); c.ellipse(10,13,10,10,0,0,Math.PI*2); c.fill();
                c.fillStyle='#3d8a47'; c.beginPath(); c.ellipse(10,10,9,8,0,0,Math.PI*2); c.fill();
                c.fillStyle='#4d9a57'; c.beginPath(); c.ellipse(7,7,7,6,0,0,Math.PI*2); c.fill();
                c.fillStyle='#4d9a57'; c.beginPath(); c.ellipse(14,7,7,6,0,0,Math.PI*2); c.fill();
                c.fillStyle='#5daa67'; c.beginPath(); c.ellipse(10,4,7,5,0,0,Math.PI*2); c.fill();
                c.fillStyle='#6dba77'; c.beginPath(); c.ellipse(10,2,4,3,0,0,Math.PI*2); c.fill();
                // Small companion
                c.fillStyle='#3d8a47'; c.beginPath(); c.ellipse(25,19,7,6,0,0,Math.PI*2); c.fill();
                c.fillStyle='#4d9a57'; c.beginPath(); c.ellipse(25,16,6,5,0,0,Math.PI*2); c.fill();
                c.fillStyle='#5daa67'; c.beginPath(); c.ellipse(25,14,4,4,0,0,Math.PI*2); c.fill();
            }
        }, true);
    }
    
    // ──── PINE cache ────
    function cachePine(v, key) {
        renderTreeLayer(key + '-shadow', function(c) {
            c.fillStyle = 'rgba(0,30,10,0.2)';
            if (v === 3) {
                c.beginPath(); c.ellipse(10,30,9,3,0,0,Math.PI*2); c.fill();
                c.beginPath(); c.ellipse(26,30,6,2,0,0,Math.PI*2); c.fill();
            } else if (v === 1) {
                c.beginPath(); c.ellipse(16,30,12,3.5,0,0,Math.PI*2); c.fill();
            } else {
                c.beginPath(); c.ellipse(16,30,11,3.5,0,0,Math.PI*2); c.fill();
            }
        });
        
        renderTreeLayer(key + '-trunk', function(c) {
            var TD='#5a3a1a',TM='#6d4c2a',TL='#82603c';
            if (v === 3) {
                drTrunk(c,9,17,3,14,TD,TM,TL); drTrunk(c,25,24,2,7,TD,TM,TL);
            } else if (v === 1) {
                drTrunk(c,14,19,4,12,TD,TM,TL);
            } else if (v === 2) {
                drTrunk(c,15,15,3,16,TD,TM,TL);
            } else {
                drTrunk(c,14,20,3,11,TD,TM,TL);
            }
        });
        
        renderTreeLayer(key + '-canopy', function(c) {
            if (v === 0) { // Fat tiered
                c.fillStyle='#1e5520'; c.beginPath(); c.ellipse(16,20,13,6,0,0,Math.PI*2); c.fill();
                c.fillStyle='#2a6a2e'; c.beginPath(); c.ellipse(16,15,12,6,0,0,Math.PI*2); c.fill();
                c.fillStyle='#347a38'; c.beginPath(); c.ellipse(16,10,10,6,0,0,Math.PI*2); c.fill();
                c.fillStyle='#3e8a42'; c.beginPath(); c.ellipse(16,6,8,5,0,0,Math.PI*2); c.fill();
                c.fillStyle='#48994c'; c.beginPath(); c.ellipse(16,3,5,3,0,0,Math.PI*2); c.fill();
            } else if (v === 1) { // Bushy round pine (smaller, organic lobes)
                c.fillStyle='#1e5520'; c.beginPath(); c.ellipse(16,15,11,9,0,0,Math.PI*2); c.fill();
                c.fillStyle='#2a6a2e'; c.beginPath(); c.ellipse(12,11,8,7,0,0,Math.PI*2); c.fill();
                c.fillStyle='#2a6a2e'; c.beginPath(); c.ellipse(20,11,8,7,0,0,Math.PI*2); c.fill();
                c.fillStyle='#347a38'; c.beginPath(); c.ellipse(16,9,9,7,0,0,Math.PI*2); c.fill();
                c.fillStyle='#3e8a42'; c.beginPath(); c.ellipse(16,6,7,5,0,0,Math.PI*2); c.fill();
                c.fillStyle='#48994c'; c.beginPath(); c.ellipse(16,4,4,3,0,0,Math.PI*2); c.fill();
            } else if (v === 2) { // Tall narrow
                c.fillStyle='#1e5520'; c.beginPath(); c.ellipse(16,20,9,5,0,0,Math.PI*2); c.fill();
                c.fillStyle='#2a6a2e'; c.beginPath(); c.ellipse(16,15,8,5,0,0,Math.PI*2); c.fill();
                c.fillStyle='#347a38'; c.beginPath(); c.ellipse(16,10,7,5,0,0,Math.PI*2); c.fill();
                c.fillStyle='#3e8a42'; c.beginPath(); c.ellipse(16,6,6,4,0,0,Math.PI*2); c.fill();
                c.fillStyle='#48994c'; c.beginPath(); c.ellipse(16,3,4,3,0,0,Math.PI*2); c.fill();
                c.fillStyle='#52a456'; c.beginPath(); c.ellipse(16,1,2,2,0,0,Math.PI*2); c.fill();
            } else { // Tall + short pair
                // Tall pine
                c.fillStyle='#1e5520'; c.beginPath(); c.ellipse(10,18,10,5,0,0,Math.PI*2); c.fill();
                c.fillStyle='#2a6a2e'; c.beginPath(); c.ellipse(10,13,9,5,0,0,Math.PI*2); c.fill();
                c.fillStyle='#347a38'; c.beginPath(); c.ellipse(10,9,7,5,0,0,Math.PI*2); c.fill();
                c.fillStyle='#3e8a42'; c.beginPath(); c.ellipse(10,5,5,4,0,0,Math.PI*2); c.fill();
                c.fillStyle='#48994c'; c.beginPath(); c.ellipse(10,2,3,2.5,0,0,Math.PI*2); c.fill();
                // Short bushy
                c.fillStyle='#2a6a2e'; c.beginPath(); c.ellipse(26,21,7,5,0,0,Math.PI*2); c.fill();
                c.fillStyle='#347a38'; c.beginPath(); c.ellipse(26,17,6,4,0,0,Math.PI*2); c.fill();
                c.fillStyle='#3e8a42'; c.beginPath(); c.ellipse(26,14,5,3.5,0,0,Math.PI*2); c.fill();
                c.fillStyle='#48994c'; c.beginPath(); c.ellipse(26,12,3,2.5,0,0,Math.PI*2); c.fill();
            }
        }, true);
    }
    
    // ──── CHERRY cache ────
    function cacheCher(v, key) {
        renderTreeLayer(key + '-shadow', function(c) {
            c.fillStyle = 'rgba(30,10,20,0.18)';
            if (v === 3) {
                c.beginPath(); c.ellipse(10,30,10,3,0,0,Math.PI*2); c.fill();
                c.beginPath(); c.ellipse(26,30,7,2.5,0,0,Math.PI*2); c.fill();
            } else if (v === 1) {
                c.beginPath(); c.ellipse(16,30,15,4,0,0,Math.PI*2); c.fill();
            } else if (v === 2) {
                c.beginPath(); c.ellipse(16,30,10,3.5,0,0,Math.PI*2); c.fill();
            } else {
                c.beginPath(); c.ellipse(16,30,13,4,0,0,Math.PI*2); c.fill();
            }
        });
        
        renderTreeLayer(key + '-trunk', function(c) {
            var TD='#6a5040',TM='#7d6350',TL='#907660';
            if (v === 3) {
                drTrunk(c,8,18,4,13,TD,TM,TL); drTrunk(c,24,23,3,8,TD,TM,TL);
            } else if (v === 1) {
                drTrunk(c,14,18,4,13,TD,TM,TL);
            } else if (v === 2) {
                drTrunk(c,14,16,4,15,TD,TM,TL);
            } else {
                drTrunk(c,13,17,5,14,TD,TM,TL);
            }
        });
        
        renderTreeLayer(key + '-canopy', function(c) {
            if (v === 0) { // Classic round
                c.fillStyle='#c87e92'; c.beginPath(); c.ellipse(16,13,14,12,0,0,Math.PI*2); c.fill();
                c.fillStyle='#d4949a'; c.beginPath(); c.ellipse(16,10,13,10,0,0,Math.PI*2); c.fill();
                c.fillStyle='#e0a0b0'; c.beginPath(); c.ellipse(10,7,9,8,0,0,Math.PI*2); c.fill();
                c.fillStyle='#e0a0b0'; c.beginPath(); c.ellipse(22,7,9,8,0,0,Math.PI*2); c.fill();
                c.fillStyle='#ecb8c4'; c.beginPath(); c.ellipse(16,5,10,7,0,0,Math.PI*2); c.fill();
                c.fillStyle='#f5d0d8'; c.beginPath(); c.ellipse(16,2,7,5,0,0,Math.PI*2); c.fill();
            } else if (v === 1) { // Wide (fits within canvas)
                c.fillStyle='#c87e92'; c.beginPath(); c.ellipse(16,15,13,9,0,0,Math.PI*2); c.fill();
                c.fillStyle='#d4949a'; c.beginPath(); c.ellipse(16,12,12,8,0,0,Math.PI*2); c.fill();
                c.fillStyle='#e0a0b0'; c.beginPath(); c.ellipse(10,9,8,7,0,0,Math.PI*2); c.fill();
                c.fillStyle='#e0a0b0'; c.beginPath(); c.ellipse(22,9,8,7,0,0,Math.PI*2); c.fill();
                c.fillStyle='#ecb8c4'; c.beginPath(); c.ellipse(16,7,10,5,0,0,Math.PI*2); c.fill();
                c.fillStyle='#f5d0d8'; c.beginPath(); c.ellipse(16,4,7,4,0,0,Math.PI*2); c.fill();
            } else if (v === 2) { // Tall
                c.fillStyle='#c87e92'; c.beginPath(); c.ellipse(16,11,11,13,0,0,Math.PI*2); c.fill();
                c.fillStyle='#d4949a'; c.beginPath(); c.ellipse(16,8,10,10,0,0,Math.PI*2); c.fill();
                c.fillStyle='#e0a0b0'; c.beginPath(); c.ellipse(16,5,8,8,0,0,Math.PI*2); c.fill();
                c.fillStyle='#ecb8c4'; c.beginPath(); c.ellipse(16,2,6,5,0,0,Math.PI*2); c.fill();
                c.fillStyle='#f5d0d8'; c.beginPath(); c.ellipse(16,-1,4,3,0,0,Math.PI*2); c.fill();
            } else { // Copse
                c.fillStyle='#c87e92'; c.beginPath(); c.ellipse(10,13,10,10,0,0,Math.PI*2); c.fill();
                c.fillStyle='#d4949a'; c.beginPath(); c.ellipse(10,10,9,8,0,0,Math.PI*2); c.fill();
                c.fillStyle='#e0a0b0'; c.beginPath(); c.ellipse(7,7,7,6,0,0,Math.PI*2); c.fill();
                c.fillStyle='#e0a0b0'; c.beginPath(); c.ellipse(14,7,7,6,0,0,Math.PI*2); c.fill();
                c.fillStyle='#ecb8c4'; c.beginPath(); c.ellipse(10,4,7,5,0,0,Math.PI*2); c.fill();
                c.fillStyle='#f5d0d8'; c.beginPath(); c.ellipse(10,2,4,3,0,0,Math.PI*2); c.fill();
                // Small companion
                c.fillStyle='#d4949a'; c.beginPath(); c.ellipse(26,19,7,6,0,0,Math.PI*2); c.fill();
                c.fillStyle='#e0a0b0'; c.beginPath(); c.ellipse(26,16,6,5,0,0,Math.PI*2); c.fill();
                c.fillStyle='#ecb8c4'; c.beginPath(); c.ellipse(26,14,5,4,0,0,Math.PI*2); c.fill();
                c.fillStyle='#f5d0d8'; c.beginPath(); c.ellipse(26,12,3,3,0,0,Math.PI*2); c.fill();
            }
        }, true);
    }
    
    // Simple pixelated trunk
    function drTrunk(c, tx, ty, tw, th2, dark, mid, light) {
        c.fillStyle = mid; c.fillRect(tx, ty, tw, th2);
        c.fillStyle = dark; c.fillRect(tx, ty, 1, th2); c.fillRect(tx+tw-1, ty, 1, th2);
        // Bark texture
        for (var i = 1; i < th2; i += 2) {
            c.fillStyle = light; c.fillRect(tx+1, ty+i, 1, 1);
        }
        // Roots
        c.fillStyle = dark;
        c.fillRect(tx-1, ty+th2-1, 1, 1); c.fillRect(tx+tw, ty+th2-1, 1, 1);
    }

    // ═══════════════ NEW PATH SYSTEM v4 ═══════════════
    var PATH_MAP = {
        'dirt-trail':   { tex: 'dirt',    grandeur: 0 },
        'gravel-trail': { tex: 'gravel',  grandeur: 0 },
        'dirt-lane':    { tex: 'dirt',    grandeur: 1 },
        'gravel-walk':  { tex: 'gravel',  grandeur: 1 },
        'stone-paving': { tex: 'tiles',   grandeur: 0 },
        'tarmac':       { tex: 'asphalt', grandeur: 0 },
        'park-walkway': { tex: 'tiles',   grandeur: 1 },
        'park-road':    { tex: 'asphalt', grandeur: 1 },
        'promenade':    { tex: 'tiles',   grandeur: 2 },
        'grand-avenue': { tex: 'asphalt', grandeur: 2 },
        'entrance':     { tex: 'tiles',   grandeur: 2 }
    };
    var PATH_CFG = {
        gravel: { levels: [
            { w:10,cr:3,base:'#b5a48e',edge:'#a3927a',hl:'#c7b8a2',sh:'#9a896f',decos:['edgeWeeds'] },
            { w:14,cr:4,base:'#bfae98',edge:'#a99880',hl:'#d1c2ac',sh:'#9e8d75',decos:['edgeWeeds','borderRocks','bench','trashCan'] }
        ]},
        dirt: { levels: [
            { w:10,cr:3,base:'#9e8868',edge:'#8a7656',hl:'#b09a78',sh:'#7a6848',decos:['edgeWeeds'] },
            { w:14,cr:4,base:'#a49070',edge:'#907c5c',hl:'#b8a280',sh:'#806c50',decos:['edgeWeeds','borderRocks','bench','trashCan'] }
        ]},
        tiles: { levels: [
            { w:10,cr:3,base:'#c8bcac',edge:'#b4a898',hl:'#d8ccc0',sh:'#a89c8c',decos:[] },
            { w:16,cr:4,base:'#d0c4b4',edge:'#beb2a2',hl:'#e0d4c8',sh:'#b0a494',decos:['curbEdge','bench','trashCan','lantern'] },
            { w:22,cr:4,base:'#d8ccbc',edge:'#c6baaa',hl:'#e8dcd0',sh:'#b8ac9c',decos:['curbEdge','bench','trashCan','lantern','hedge'] }
        ]},
        asphalt: { levels: [
            { w:10,cr:3,base:'#8a8488',edge:'#7a747a',hl:'#9a9498',sh:'#6a6468',decos:[] },
            { w:16,cr:4,base:'#8a8488',edge:'#7a747a',hl:'#9a9498',sh:'#6a6468',decos:['curbEdge','bench','trashCan','lantern'] },
            { w:22,cr:4,base:'#8a8488',edge:'#7a747a',hl:'#9a9498',sh:'#6a6468',decos:['curbEdge','bench','trashCan','lantern','fence'] }
        ]}
    };

    function psr(x,y,i){var s=(x*2654435761+y*2246822519+(i||0)*3266489917)>>>0;s=((s>>16)^s)*0x45d9f3b;s=((s>>16)^s)*0x45d9f3b;return((s>>16)^s)/0xFFFFFFFF;}

    function pathAdj(gx,gy){
        var a = {
            t: isPathAt(gx,gy-1), b: isPathAt(gx,gy+1),
            l: isPathAt(gx-1,gy), r: isPathAt(gx+1,gy)
        };
        // Merge building openings
        var bo = buildingOpenings[gx + ',' + gy];
        if (bo) {
            if (bo.t) a.t = true;
            if (bo.b) a.b = true;
            if (bo.l) a.l = true;
            if (bo.r) a.r = true;
        }
        return a;
    }

    function pathTexAt(gx,gy){
        if(!G||!G.grid)return null;
        // Outside entrance path is promenade
        if(gx===-1&&gy===5)return PATH_MAP['promenade'];
        if(gx<0||gx>=GRID_WIDTH||gy<0||gy>=GRID_HEIGHT)return null;
        var c=G.grid[gy][gx]; if(!c)return null;
        return PATH_MAP[c.type]||null;
    }

    function nbrPathEdge(gx,gy,edge,deco){
        var pm=pathTexAt(gx,gy); if(!pm)return false;
        var cfg=PATH_CFG[pm.tex],lv=cfg.levels[Math.min(pm.grandeur,cfg.levels.length-1)];
        if(!lv.decos.includes(deco))return false;
        return !pathAdj(gx,gy)[edge];
    }

    function buildPathMask(a,cl,ct,cr,cb,R){
        var m=new Uint8Array(1024);
        var f=function(x0,y0,x1,y1){for(var y=Math.max(0,y0);y<Math.min(32,y1);y++)for(var x=Math.max(0,x0);x<Math.min(32,x1);x++)m[y*32+x]=1;};
        f(cl,ct,cr,cb);
        if(a.t)f(cl,0,cr,ct);if(a.b)f(cl,cb,cr,32);if(a.l)f(0,ct,cl,cb);if(a.r)f(cr,ct,32,cb);
        for(var pass=0;pass<R;pass++){
            var rm=[];
            for(var y=0;y<32;y++)for(var x=0;x<32;x++){
                if(!m[y*32+x])continue;
                var gt=y>0?!m[(y-1)*32+x]:(a.t?0:1);
                var gb=y<31?!m[(y+1)*32+x]:(a.b?0:1);
                var gl=x>0?!m[y*32+x-1]:(a.l?0:1);
                var gr=x<31?!m[y*32+x+1]:(a.r?0:1);
                if((gt&&gr)||(gt&&gl)||(gb&&gr)||(gb&&gl))rm.push(y*32+x);
            }
            for(var i=0;i<rm.length;i++)m[rm[i]]=0;
        }
        return m;
    }

    function drawPathSurface(c,gx,gy,tex,lv){
        c.fillStyle=lv.base;c.fillRect(0,0,32,32);
        if(tex==='gravel') surfGravel(c,gx,gy,lv);
        else if(tex==='dirt') surfDirt(c,gx,gy,lv);
        else if(tex==='tiles') surfPaved(c,gx,gy,lv);
        else if(tex==='asphalt') surfAsphalt(c,gx,gy,lv);
    }
    function surfGravel(c,gx,gy,lv){for(var i=0;i<50;i++){c.fillStyle=psr(gx,gy,i*3+1002)>.7?lv.hl:psr(gx,gy,i*3+1002)>.4?lv.edge:lv.sh;c.globalAlpha=.25;c.fillRect(Math.floor(psr(gx,gy,i*3+1000)*31),Math.floor(psr(gx,gy,i*3+1001)*31),1,1);}c.globalAlpha=1;for(var i=0;i<12;i++){var px2=Math.floor(psr(gx,gy,i*4+1100)*29)+1,py2=Math.floor(psr(gx,gy,i*4+1101)*29)+1,sz=psr(gx,gy,i*4+1102);c.fillStyle=psr(gx,gy,i*4+1103)>.5?lv.hl:lv.sh;c.globalAlpha=.35;c.fillRect(px2,py2,sz>.5?2:1,sz>.7?2:1);}c.globalAlpha=1;c.fillStyle=lv.sh;c.globalAlpha=.06;for(var r=2;r<32;r+=5)c.fillRect(0,r,32,1);c.globalAlpha=1;}
    function surfDirt(c,gx,gy,lv){for(var i=0;i<25;i++){var v=psr(gx,gy,i*3+3002);c.fillStyle=v>.7?lv.hl:v>.3?lv.edge:lv.sh;c.globalAlpha=.5;c.fillRect(Math.floor(psr(gx,gy,i*3+3000)*31),Math.floor(psr(gx,gy,i*3+3001)*31),v>.5?2:1,v>.5?2:1);}c.globalAlpha=1;c.fillStyle=lv.sh;c.globalAlpha=.12;for(var r=3;r<32;r+=7)c.fillRect(Math.floor(psr(gx,gy,r+3100)*4),r,28,1);c.globalAlpha=1;}
    function surfPaved(c,gx,gy,lv){for(var i=0;i<15;i++){c.fillStyle=psr(gx,gy,i*3+4002)>.5?lv.hl:lv.edge;c.globalAlpha=.3;c.fillRect(Math.floor(psr(gx,gy,i*3+4000)*30)+1,Math.floor(psr(gx,gy,i*3+4001)*30)+1,2,2);}c.globalAlpha=1;c.fillStyle=lv.sh;c.globalAlpha=.12;for(var y2=0;y2<32;y2+=8)c.fillRect(0,y2,32,1);for(var y2=0;y2<32;y2+=8){var o=(Math.floor(y2/8)%2)*5;for(var x2=o;x2<32;x2+=10)c.fillRect(x2,y2,1,8);}c.globalAlpha=1;c.fillStyle=lv.hl;c.globalAlpha=.08;c.fillRect(0,0,32,16);c.globalAlpha=1;}
    function surfAsphalt(c,gx,gy,lv){for(var i=0;i<40;i++){c.fillStyle=psr(gx,gy,i*3+5002)>.5?lv.hl:lv.sh;c.globalAlpha=.2;c.fillRect(Math.floor(psr(gx,gy,i*3+5000)*31),Math.floor(psr(gx,gy,i*3+5001)*31),1,1);}c.globalAlpha=1;}

    function drawPathEdgeEffect(c,mask){var id=c.getImageData(0,0,32,32),d=id.data;for(var y=0;y<32;y++)for(var x=0;x<32;x++){var i=y*32+x;if(!mask[i])continue;var b=0,t=0,bo=0;for(var dy=-1;dy<=1;dy++)for(var dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;var nx=x+dx,ny=y+dy;if(nx<0||nx>=32||ny<0||ny>=32)continue;if(!mask[ny*32+nx]){b=1;if(dy<0)t=1;if(dy>0)bo=1;}}if(b){var adj2=bo||!t?-25:15;d[i*4]=Math.max(0,Math.min(255,d[i*4]+adj2));d[i*4+1]=Math.max(0,Math.min(255,d[i*4+1]+adj2));d[i*4+2]=Math.max(0,Math.min(255,d[i*4+2]+adj2));}}c.putImageData(id,0,0);}

    function drawPathDecos(c,gx,gy,tex,lv,a,mask,cl,ct,cr,cb){
        var D=lv.decos,exp=[];
        if(!a.t)exp.push('t');if(!a.b)exp.push('b');if(!a.l)exp.push('l');if(!a.r)exp.push('r');
        if(D.includes('edgeWeeds'))pDecoWeeds(c,gx,gy,cl,ct,cr,cb,a);
        if(D.includes('borderRocks'))pDecoRocks(c,gx,gy,cl,ct,cr,cb,a);
        if(D.includes('curbEdge')){
            for(var y=0;y<32;y++)for(var x=0;x<32;x++){
                if(!mask[y*32+x])continue;
                if(y>0&&!mask[(y-1)*32+x]){c.fillStyle='#d8d0c0';c.fillRect(x,y-1,1,1);}
                if(y<31&&!mask[(y+1)*32+x]){c.fillStyle='#a89888';c.fillRect(x,y+1,1,1);}
                if(x>0&&!mask[y*32+x-1]){c.fillStyle='#c0b8a8';c.fillRect(x-1,y,1,1);}
                if(x<31&&!mask[y*32+x+1]){c.fillStyle='#a89888';c.fillRect(x+1,y,1,1);}
            }
        }
        if(D.includes('hedge')){
            var hH=function(x0,y,x1){if(x1<=x0)return;var w=x1-x0;c.fillStyle='#3d8a2e';c.fillRect(x0,y,w,2);for(var xi=x0;xi<x1;xi++){var v=psr(gx,gy,xi*7+2000);c.fillStyle=v>.7?'#4fa040':v>.4?'#358028':'#2d7020';c.fillRect(xi,y,1,1);c.fillStyle=v>.5?'#3a8830':'#2e6e22';c.fillRect(xi,y+1,1,1);}c.fillStyle='#266818';c.fillRect(x0,y+2,w,1);c.fillStyle='#1e5514';c.fillRect(x0,y+3,w,1);for(var xi=x0;xi<x1;xi+=2){var v=psr(gx,gy,xi*9+2100);if(v>.6){c.fillStyle='#2e7820';c.fillRect(xi,y+2,1,1);}}c.fillStyle='#58b048';c.globalAlpha=0.4;c.fillRect(x0,y,w,1);c.globalAlpha=1;c.fillStyle='#00000020';c.fillRect(x0,y+4,w,1);};
            var hV=function(x,y0,y1){if(y1<=y0)return;var h=y1-y0;c.fillStyle='#3d8a2e';c.fillRect(x,y0,2,h);for(var yi=y0;yi<y1;yi++){var v=psr(gx,gy,yi*7+2200);c.fillStyle=v>.7?'#4fa040':v>.4?'#358028':'#2d7020';c.fillRect(x,yi,1,1);c.fillStyle=v>.5?'#3a8830':'#2e6e22';c.fillRect(x+1,yi,1,1);}c.fillStyle='#266818';c.fillRect(x+2,y0,1,h);c.fillStyle='#1e5514';c.fillRect(x,y1,2,1);c.fillStyle='#00000018';c.fillRect(x+3,y0,1,h);c.fillStyle='#58b048';c.globalAlpha=0.3;c.fillRect(x,y0,1,h);c.globalAlpha=1;};
            if(!a.t){var x0h=cl,x1h=cr;if(nbrPathEdge(gx-1,gy,'t','hedge'))x0h=0;if(nbrPathEdge(gx+1,gy,'t','hedge'))x1h=32;hH(x0h,ct-4,x1h);}
            if(!a.b){var x0h=cl,x1h=cr;if(nbrPathEdge(gx-1,gy,'b','hedge'))x0h=0;if(nbrPathEdge(gx+1,gy,'b','hedge'))x1h=32;hH(x0h,cb,x1h);}
            if(!a.l){var y0h=ct,y1h=cb;if(nbrPathEdge(gx,gy-1,'l','hedge'))y0h=0;if(nbrPathEdge(gx,gy+1,'l','hedge'))y1h=32;hV(cl-3,y0h,y1h);}
            if(!a.r){var y0h=ct,y1h=cb;if(nbrPathEdge(gx,gy-1,'r','hedge'))y0h=0;if(nbrPathEdge(gx,gy+1,'r','hedge'))y1h=32;hV(cr,y0h,y1h);}
            if(a.t&&!a.l)hV(cl-3,0,ct);if(a.t&&!a.r)hV(cr,0,ct);
            if(a.b&&!a.l)hV(cl-3,cb,32);if(a.b&&!a.r)hV(cr,cb,32);
            if(a.l&&!a.t)hH(0,ct-4,cl);if(a.l&&!a.b)hH(0,cb,cl);
            if(a.r&&!a.t)hH(cr,ct-4,32);if(a.r&&!a.b)hH(cr,cb,32);
        }
        if(D.includes('fence')){
            var fH=function(x0,y,x1,edge){var sx=x0,ex=x1;if(nbrPathEdge(gx-1,gy,edge,'fence')&&sx>0)sx=0;if(nbrPathEdge(gx+1,gy,edge,'fence')&&ex<32)ex=32;if(y<1||y>27||ex<=sx)return;c.fillStyle='#00000015';c.fillRect(sx,y+4,ex-sx,1);c.fillStyle='#383838';c.fillRect(sx,y+1,ex-sx,1);c.fillRect(sx,y+3,ex-sx,1);for(var x=sx;x<ex;x+=3){c.fillStyle='#404040';c.fillRect(x,y,1,4);c.fillStyle='#505858';c.fillRect(x,y,1,1);}if(sx>=1){c.fillStyle='#343434';c.fillRect(sx,y-1,2,5);c.fillStyle='#484848';c.fillRect(sx,y-1,2,1);}if(ex<=31){c.fillStyle='#343434';c.fillRect(ex-2,y-1,2,5);c.fillStyle='#484848';c.fillRect(ex-2,y-1,2,1);}};
            var fV=function(x,y0,y1,edge){var sy=y0,ey=y1;if(nbrPathEdge(gx,gy-1,edge,'fence')&&sy>0)sy=0;if(nbrPathEdge(gx,gy+1,edge,'fence')&&ey<32)ey=32;if(x<1||x>27||ey<=sy)return;c.fillStyle='#00000015';c.fillRect(x+2,sy,1,ey-sy);c.fillStyle='#383838';c.fillRect(x+1,sy,1,ey-sy);c.fillRect(x+3,sy,1,ey-sy);for(var y=sy;y<ey;y+=3){c.fillStyle='#404040';c.fillRect(x,y,4,1);c.fillStyle='#505858';c.fillRect(x,y,1,1);}if(sy>=1){c.fillStyle='#343434';c.fillRect(x,sy,4,2);c.fillStyle='#484848';c.fillRect(x,sy,4,1);}if(ey<=31){c.fillStyle='#343434';c.fillRect(x,ey-2,4,2);c.fillStyle='#484848';c.fillRect(x,ey-2,4,1);}};
            if(!a.t)fH(cl,ct-5,cr,'t');if(!a.b)fH(cl,cb+1,cr,'b');if(!a.l)fV(cl-5,ct,cb,'l');if(!a.r)fV(cr+1,ct,cb,'r');
            if(a.t&&!a.l)fV(cl-5,0,ct,'l');if(a.t&&!a.r)fV(cr+1,0,ct,'r');
            if(a.b&&!a.l)fV(cl-5,cb,32,'l');if(a.b&&!a.r)fV(cr+1,cb,32,'r');
            if(a.l&&!a.t)fH(0,ct-5,cl,'t');if(a.l&&!a.b)fH(0,cb+1,cl,'b');
            if(a.r&&!a.t)fH(cr,ct-5,32,'t');if(a.r&&!a.b)fH(cr,cb+1,32,'b');
        }
        var pts=D.filter(function(d){return['lantern','bench','trashCan'].includes(d);});
        if(!pts.length||!exp.length)return;
        var claimed={},margin=cl;
        var prio=['lantern','bench','trashCan'];
        for(var pi=0;pi<prio.length;pi++){
            var pd=prio[pi];if(!pts.includes(pd))continue;
            var avail=exp.filter(function(s){return !claimed[s];});if(!avail.length)break;
            var seed=pd==='lantern'?900:pd==='bench'?800:700;
            var side=avail[Math.floor(psr(gx,gy,seed)*avail.length)];
            claimed[side]=true;
            if(pd==='lantern')pDecoLantern(c,side,cl,ct,cr,cb,margin,tex,gx,gy);
            else if(pd==='bench')pDecoBench(c,side,cl,ct,cr,cb,margin);
            else pDecoBin(c,side,cl,ct,cr,cb,margin);
        }
    }

    function pDecoWeeds(c,gx,gy,cl,ct,cr,cb,a){for(var i=0;i<6;i++){var s=Math.floor(psr(gx,gy,i*6+500)*4);var px2,py2;var al=psr(gx,gy,i*6+501);if(s===0&&!a.l){px2=cl-3;py2=ct+Math.floor(al*(cb-ct));}else if(s===1&&!a.r){px2=cr+1;py2=ct+Math.floor(al*(cb-ct));}else if(s===2&&!a.t){px2=cl+Math.floor(al*(cr-cl));py2=ct-3;}else if(s===3&&!a.b){px2=cl+Math.floor(al*(cr-cl));py2=cb+1;}else continue;if(px2<0||py2<0||px2>30||py2>30)continue;c.fillStyle='#4da836';c.fillRect(px2,py2+1,1,2);c.fillRect(px2+1,py2,1,2);if(psr(gx,gy,i*6+502)>.6){c.fillStyle=['#e8e050','#e06080','#8080e0','#e0a040'][Math.floor(psr(gx,gy,i*6+503)*4)];c.fillRect(px2,py2,1,1);}}}
    function pDecoRocks(c,gx,gy,cl,ct,cr,cb,a){var rc=['#8a8078','#9a9088','#787068','#a8a098'];for(var i=0;i<5;i++){var s=Math.floor(psr(gx,gy,i*5+600)*4);var px2,py2;var al=psr(gx,gy,i*5+601);if(s===0&&!a.l){px2=cl-2;py2=ct+Math.floor(al*(cb-ct-2));}else if(s===1&&!a.r){px2=cr;py2=ct+Math.floor(al*(cb-ct-2));}else if(s===2&&!a.t){px2=cl+Math.floor(al*(cr-cl-2));py2=ct-2;}else if(s===3&&!a.b){px2=cl+Math.floor(al*(cr-cl-2));py2=cb;}else continue;if(px2<0||py2<0||px2>30||py2>30)continue;c.fillStyle=rc[Math.floor(psr(gx,gy,i*5+602)*4)];c.fillRect(px2,py2,2,2);c.fillStyle='#b0a898';c.fillRect(px2,py2,2,1);}}
    function pDecoBench(c,side,cl,ct,cr,cb,margin){if(margin<3)return;if(side==='t'||side==='b'){var bw=8,bh=5,bx=16-Math.floor(bw/2);var by=side==='t'?Math.max(0,ct-bh):Math.min(32-bh,cb);c.fillStyle='#00000018';c.fillRect(bx+1,by+bh,bw-1,1);c.fillStyle='#5a4a3a';c.fillRect(bx,by+bh-2,1,2);c.fillRect(bx+bw-1,by+bh-2,1,2);c.fillStyle='#8a6830';c.fillRect(bx,by,bw,1);c.fillStyle='#a07840';c.fillRect(bx,by+1,bw,3);c.fillStyle='#b08850';c.fillRect(bx+1,by+1,bw-2,1);c.fillStyle='#785828';c.fillRect(bx,by+2,bw,1);c.fillStyle='#906830';c.fillRect(bx+1,by+3,bw-2,1);c.fillStyle='#8a6020';c.fillRect(bx,by+4,bw,1);c.fillStyle='#7a5828';c.fillRect(bx,by+1,1,3);c.fillRect(bx+bw-1,by+1,1,3);}else{var bw=5,bh=8,by=16-Math.floor(bh/2);var bx=side==='l'?Math.max(0,cl-bw):Math.min(32-bw,cr);c.fillStyle='#00000018';c.fillRect(bx+1,by+bh,bw-1,1);c.fillStyle='#5a4a3a';c.fillRect(bx+bw-1,by,1,1);c.fillRect(bx+bw-1,by+bh-1,1,1);c.fillStyle='#8a6830';c.fillRect(bx,by,1,bh);c.fillStyle='#a07840';c.fillRect(bx+1,by,3,bh);c.fillStyle='#b08850';c.fillRect(bx+1,by,1,bh);c.fillStyle='#785828';c.fillRect(bx+2,by,1,bh);c.fillStyle='#a87848';c.fillRect(bx+3,by,1,bh);c.fillStyle='#8a6020';c.fillRect(bx+4,by,1,bh);c.fillStyle='#7a5828';c.fillRect(bx+1,by,3,1);c.fillRect(bx+1,by+bh-1,3,1);}}
    function pDecoBin(c,side,cl,ct,cr,cb,margin){if(margin<3)return;var tx,ty;if(side==='r'){tx=Math.min(32-4,cr+1);ty=14;}else if(side==='l'){tx=Math.max(0,cl-5);ty=14;}else if(side==='b'){tx=14;ty=Math.min(32-5,cb);}else{tx=14;ty=Math.max(0,ct-5);}c.fillStyle='#607058';c.fillRect(tx,ty+1,4,3);c.fillStyle='#708068';c.fillRect(tx,ty+3,4,1);c.fillStyle='#586850';c.fillRect(side==='r'?tx+3:tx,ty+1,1,3);c.fillStyle='#788870';c.fillRect(tx,ty,4,1);c.fillStyle='#90a088';c.fillRect(tx+1,ty,2,1);c.fillStyle='#586850';c.fillRect(tx+1,ty-1>=0?ty:ty,2,1);c.fillStyle='#506048';c.fillRect(tx,ty+4,4,1);c.fillStyle='#00000020';c.fillRect(tx+1,ty+5,3,1);}
    function pDecoLantern(c,side,cl,ct,cr,cb,margin,tex,gx,gy){if(margin<3)return;var lw=5,lh=10;var lx,ly;if(side==='r'){lx=Math.min(32-lw,cr);ly=16-Math.floor(lh/2);}else if(side==='l'){lx=Math.max(0,cl-lw);ly=16-Math.floor(lh/2);}else if(side==='t'){lx=16-Math.floor(lw/2);ly=Math.max(0,ct-lh);}else{lx=16-Math.floor(lw/2);ly=Math.min(32-lh,cb);}
        // Record lantern screen position (center of light)
        if(gx!==undefined)lanternPositions.push({px:gx*TILE_SIZE+lx+2,py:gy*TILE_SIZE+ly+1});
        if(tex==='tiles'){c.fillStyle='#ffee6010';c.fillRect(lx-1,ly-1,lw+2,5);c.fillStyle='#ffee6008';c.fillRect(lx-2,ly,lw+4,3);c.fillStyle='#ffe070';c.fillRect(lx+1,ly,2,1);c.fillStyle='#fff8b0';c.fillRect(lx+1,ly+1,2,1);c.fillStyle='#ffeecc';c.fillRect(lx+2,ly,1,1);c.fillStyle='#ffe070';c.fillRect(lx,ly+2,1,2);c.fillStyle='#fff8b0';c.fillRect(lx,ly+2,1,1);c.fillStyle='#ffe070';c.fillRect(lx+4,ly+2,1,2);c.fillStyle='#fff8b0';c.fillRect(lx+4,ly+2,1,1);c.fillStyle='#484040';c.fillRect(lx+1,ly+3,1,1);c.fillRect(lx+3,ly+3,1,1);c.fillStyle='#585048';c.fillRect(lx+1,ly-1>=0?ly-1:ly,3,1);c.fillStyle='#504848';c.fillRect(lx+2,ly+2,1,6);c.fillStyle='#605858';c.fillRect(lx+2,ly+2,1,1);c.fillStyle='#484040';c.fillRect(lx+2,ly+7,1,1);c.fillStyle='#585048';c.fillRect(lx+1,ly+8,3,1);c.fillStyle='#686058';c.fillRect(lx,ly+9,5,1);c.fillStyle='#00000020';c.fillRect(lx+1,ly+10<32?ly+10:ly+9,3,1);}
        else{c.fillStyle='#404848';c.fillRect(lx+1,ly,3,1);c.fillStyle='#485050';c.fillRect(lx+1,ly+1,3,1);c.fillStyle='#ffe880';c.fillRect(lx+1,ly+1,2,1);c.fillStyle='#fff8c0';c.fillRect(lx+2,ly+1,1,1);c.fillStyle='#ffee6010';c.fillRect(lx,ly-1>=0?ly-1:ly,5,3);c.fillStyle='#485050';c.fillRect(lx+2,ly+2,1,6);c.fillStyle='#586068';c.fillRect(lx+2,ly+2,1,1);c.fillStyle='#506058';c.fillRect(lx+1,ly+8,3,1);c.fillStyle='#5a6860';c.fillRect(lx,ly+9,5,1);c.fillStyle='#00000020';c.fillRect(lx+1,ly+10<32?ly+10:ly+9,3,1);}}

    function drawNewPath(x, y) {
        var c = G.grid[y][x];
        if (!c) return;
        
        // === Cache check ===
        var cleanBracket = Math.floor((G.cleanliness != null ? G.cleanliness : 100) / 10);
        var cacheKey = x + ',' + y;
        var cached = _pathTileCache[cacheKey];
        if (cached && cached.ver === _gridVersion && cached.clean === cleanBracket) {
            parkCtx.drawImage(cached.canvas, x * TILE_SIZE, y * TILE_SIZE);
            if (cached.lanterns) {
                for (var li = 0; li < cached.lanterns.length; li++) lanternPositions.push(cached.lanterns[li]);
            }
            return;
        }
        
        // === Render (stored to cache) ===
        var pm = PATH_MAP[c.type];
        if (!pm) return;
        var tex = pm.tex, g = pm.grandeur;
        var cfg = PATH_CFG[tex];
        var lv = cfg.levels[Math.min(g, cfg.levels.length - 1)];
        var w = lv.w, hw = w / 2;
        var a = pathAdj(x, y);
        var cl = 16 - hw, cr = 16 + hw, ct = 16 - hw, cb = 16 + hw;
        var R = lv.cr;
        var mask = buildPathMask(a, cl, ct, cr, cb, R);
        var off = document.createElement('canvas');
        off.width = 32; off.height = 32;
        var oc = off.getContext('2d', { willReadFrequently: true });
        oc.imageSmoothingEnabled = false;
        var px = x * TILE_SIZE, py = y * TILE_SIZE;
        var grassData = parkCtx.getImageData(px, py, 32, 32);
        oc.putImageData(grassData, 0, 0);
        var surfCvs = document.createElement('canvas');
        surfCvs.width = 32; surfCvs.height = 32;
        var sc = surfCvs.getContext('2d', { willReadFrequently: true });
        sc.imageSmoothingEnabled = false;
        drawPathSurface(sc, x, y, tex, lv);
        var surfData = sc.getImageData(0, 0, 32, 32);
        var finalData = oc.getImageData(0, 0, 32, 32);
        for (var i = 0; i < 1024; i++) {
            if (mask[i]) {
                finalData.data[i*4] = surfData.data[i*4];
                finalData.data[i*4+1] = surfData.data[i*4+1];
                finalData.data[i*4+2] = surfData.data[i*4+2];
                finalData.data[i*4+3] = 255;
            }
        }
        oc.putImageData(finalData, 0, 0);
        drawPathEdgeEffect(oc, mask);
        var lanternsBefore = lanternPositions.length;
        drawPathDecos(oc, x, y, tex, lv, a, mask, cl, ct, cr, cb);
        if (G && G.cleanliness < 70) {
            drawLitter(oc, x, y, G.cleanliness);
        }
        parkCtx.drawImage(off, px, py);
        
        // === Store in cache ===
        var newLanterns = lanternPositions.length > lanternsBefore
            ? lanternPositions.slice(lanternsBefore) : null;
        _pathTileCache[cacheKey] = {
            canvas: off,
            ver: _gridVersion,
            clean: cleanBracket,
            lanterns: newLanterns
        };
    }

    function drawPathThumbnail(ctx, pathType, sz) {
        var pm = PATH_MAP[pathType];
        if (!pm) return;
        var tex = pm.tex, g = pm.grandeur;
        var cfg = PATH_CFG[tex];
        var lv = cfg.levels[Math.min(g, cfg.levels.length - 1)];
        var s = sz / 24;
        ctx.fillStyle = lv.base;
        ctx.fillRect(2*s, 2*s, 20*s, 20*s);
        if (tex === 'gravel') {
            for (var i = 0; i < 12; i++) { ctx.fillStyle = i % 3 ? lv.hl : lv.sh; ctx.globalAlpha = 0.5; ctx.fillRect((3 + i * 1.7) * s, (4 + (i % 4) * 4.5) * s, 1.5*s, 1.5*s); }
            ctx.globalAlpha = 1;
        } else if (tex === 'dirt') {
            for (var i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? lv.hl : lv.sh; ctx.globalAlpha = 0.5; ctx.fillRect((4 + i * 2.2) * s, (4 + (i % 3) * 5.5) * s, 2*s, 2*s); }
            ctx.globalAlpha = 1;
        } else if (tex === 'tiles') {
            ctx.fillStyle = lv.sh; ctx.globalAlpha = 0.2;
            for (var ty = 0; ty < 3; ty++) { ctx.fillRect(2*s, (2 + ty * 7) * s, 20*s, 0.8*s); var off = ty % 2 ? 5 : 0; for (var tx = 0; tx < 3; tx++) ctx.fillRect((2 + tx * 7 + off) * s, (2 + ty * 7) * s, 0.8*s, 7*s); }
            ctx.globalAlpha = 1;
        } else if (tex === 'asphalt') {
            for (var i = 0; i < 15; i++) { ctx.fillStyle = i % 2 ? lv.hl : lv.sh; ctx.globalAlpha = 0.3; ctx.fillRect((3 + (i % 5) * 3.6) * s, (3 + Math.floor(i / 5) * 6) * s, 1*s, 1*s); }
            ctx.globalAlpha = 1;
        }
        if (g >= 1) { ctx.strokeStyle = lv.edge; ctx.lineWidth = 1.5 * s; ctx.strokeRect(1.5*s, 1.5*s, 21*s, 21*s); }
        if (g >= 2) { ctx.strokeStyle = lv.sh; ctx.lineWidth = 0.8 * s; ctx.strokeRect(0.8*s, 0.8*s, 22.4*s, 22.4*s); }
    }
    // ═══ END NEW PATH SYSTEM ═══

    function drawLitter(targetCtx, x, y, cleanliness) {
        var maxItems = cleanliness < 20 ? 5 : cleanliness < 40 ? 4 : cleanliness < 55 ? 3 : cleanliness < 65 ? 2 : 1;
        var seed = x * 7 + y * 13;
        for (var li = 0; li < maxItems; li++) {
            seed = (seed * 31 + 17 + li * 53) & 0xFFFF;
            var lx = 3 + (seed % 26);
            seed = (seed * 37 + 7) & 0xFFFF;
            var ly = 3 + (seed % 26);
            seed = (seed * 23 + 11) & 0xFFFF;
            var type = seed % 4;
            if (type === 0) {
                targetCtx.fillStyle = '#e8e0d0'; targetCtx.fillRect(lx, ly, 3, 3);
                targetCtx.fillStyle = '#c8c0b0'; targetCtx.fillRect(lx + 1, ly + 1, 2, 1);
            } else if (type === 1) {
                targetCtx.fillStyle = '#d44'; targetCtx.fillRect(lx, ly, 2, 4);
                targetCtx.fillStyle = '#eee'; targetCtx.fillRect(lx, ly, 2, 1);
            } else if (type === 2) {
                targetCtx.fillStyle = '#e8a030'; targetCtx.fillRect(lx, ly, 4, 2);
                targetCtx.fillStyle = '#d09020'; targetCtx.fillRect(lx + 1, ly, 2, 1);
            } else {
                targetCtx.fillStyle = '#8a7050'; targetCtx.fillRect(lx, ly, 2, 2);
                targetCtx.fillStyle = '#7a6040'; targetCtx.fillRect(lx + 1, ly + 1, 1, 1);
            }
        }
    }
    function drawEntrance(x, y) {
        const px = x * TILE_SIZE, py = y * TILE_SIZE;
        const f = G.paused ? 0 : G.frame;
        const night = getDayPart() === 'evening' || getDayPart() === 'night';
        
        // Base path tile — use the new path system (entrance maps to tiles/grandeur 2)
        drawNewPath(x, y);
        
        // === DRAW TWO CARNIVAL TENTS (above and below path) ===
        // Each tent: striped body + peaked roof + flag on top
        const tentColors = [['#e02030', '#fff5f0'], ['#2060d0', '#fff5f0']];
        const tentYs = [py - 28, py + 32]; // above and below the path tile
        
        for (let ti = 0; ti < 2; ti++) {
            const ty = tentYs[ti];
            const cols = tentColors[ti];
            
            // Shadow
            parkCtx.fillStyle = 'rgba(0,40,20,0.2)';
            parkCtx.beginPath();
            parkCtx.ellipse(px + 16, ty + 28, 15, 4, 0, 0, Math.PI * 2);
            parkCtx.fill();
            
            // Tent body - striped
            parkCtx.save();
            parkCtx.beginPath();
            parkCtx.roundRect(px + 3, ty + 10, 26, 18, 2);
            parkCtx.clip();
            for (let s = 0; s < 7; s++) {
                parkCtx.fillStyle = cols[s % 2];
                parkCtx.fillRect(px + 3 + s * 4, ty + 10, 4, 18);
            }
            parkCtx.restore();
            
            // Tent opening (dark slit in center)
            parkCtx.fillStyle = 'rgba(0,0,0,0.35)';
            parkCtx.fillRect(px + 13, ty + 16, 6, 12);
            
            // Roof - peaked triangle with scalloped edge
            parkCtx.fillStyle = cols[0];
            parkCtx.beginPath();
            parkCtx.moveTo(px + 16, ty - 2);
            parkCtx.lineTo(px + 32, ty + 12);
            parkCtx.lineTo(px, ty + 12);
            parkCtx.closePath();
            parkCtx.fill();
            // Roof stripe highlight
            parkCtx.fillStyle = cols[1];
            parkCtx.beginPath();
            parkCtx.moveTo(px + 16, ty + 1);
            parkCtx.lineTo(px + 26, ty + 12);
            parkCtx.lineTo(px + 20, ty + 12);
            parkCtx.lineTo(px + 16, ty + 6);
            parkCtx.lineTo(px + 12, ty + 12);
            parkCtx.lineTo(px + 6, ty + 12);
            parkCtx.closePath();
            parkCtx.fill();
            
            // Scalloped edge trim
            for (let sc = 0; sc < 6; sc++) {
                parkCtx.fillStyle = sc % 2 === 0 ? cols[0] : '#ffd93d';
                const sx = px + 3 + sc * 5;
                parkCtx.beginPath();
                parkCtx.moveTo(sx, ty + 11);
                parkCtx.lineTo(sx + 5, ty + 11);
                parkCtx.lineTo(sx + 2.5, ty + 14);
                parkCtx.closePath();
                parkCtx.fill();
            }
            
            // Pole + flag on top
            parkCtx.fillStyle = '#8b6914';
            parkCtx.fillRect(px + 15, ty - 8, 2, 8);
            // Waving flag
            const wave = Math.sin(f * 0.05 + ti * 2) * 1.5;
            parkCtx.fillStyle = '#ffd93d';
            parkCtx.beginPath();
            parkCtx.moveTo(px + 17, ty - 8);
            parkCtx.lineTo(px + 24, ty - 6 + wave);
            parkCtx.lineTo(px + 17, ty - 3);
            parkCtx.closePath();
            parkCtx.fill();
            // Flag detail stripe
            parkCtx.fillStyle = cols[0];
            parkCtx.beginPath();
            parkCtx.moveTo(px + 17, ty - 6);
            parkCtx.lineTo(px + 22, ty - 5 + wave * 0.6);
            parkCtx.lineTo(px + 17, ty - 4);
            parkCtx.closePath();
            parkCtx.fill();
        }
        
        // === PENNANT STRING between tents ===
        const flagCols = ['#ff6080', '#ffd93d', '#50c8ff', '#80ff80', '#d080ff'];
        parkCtx.strokeStyle = '#999';
        parkCtx.lineWidth = 0.5;
        parkCtx.beginPath();
        parkCtx.moveTo(px + 16, py - 12);
        parkCtx.quadraticCurveTo(px + 16, py + 16, px + 16, py + 44);
        parkCtx.stroke();
        // Flags along left edge
        for (let i = 0; i < 3; i++) {
            const fy = py - 6 + i * 16;
            const w = Math.sin(f * 0.04 + i * 1.5) * 1;
            parkCtx.fillStyle = flagCols[i];
            parkCtx.beginPath();
            parkCtx.moveTo(px + 15, fy + w);
            parkCtx.lineTo(px + 15, fy + 5 + w);
            parkCtx.lineTo(px + 10, fy + 2.5 + w);
            parkCtx.closePath();
            parkCtx.fill();
        }
        // Flags along right edge
        for (let i = 0; i < 3; i++) {
            const fy = py - 2 + i * 16;
            const w = Math.sin(f * 0.04 + i * 1.5 + 1) * 1;
            parkCtx.fillStyle = flagCols[i + 2];
            parkCtx.beginPath();
            parkCtx.moveTo(px + 17, fy + w);
            parkCtx.lineTo(px + 17, fy + 5 + w);
            parkCtx.lineTo(px + 22, fy + 2.5 + w);
            parkCtx.closePath();
            parkCtx.fill();
        }
        
        // Night: warm glow from tent openings
        if (night) {
            parkCtx.fillStyle = 'rgba(255,220,120,0.15)';
            parkCtx.beginPath(); parkCtx.arc(px + 16, tentYs[0] + 20, 12, 0, Math.PI * 2); parkCtx.fill();
            parkCtx.beginPath(); parkCtx.arc(px + 16, tentYs[1] + 20, 12, 0, Math.PI * 2); parkCtx.fill();
        }
    }
    
    // Rides and attractions (animations stop at night)
    function drawMerryGoRound(x, y) {
        var night = getDayPart() === 'night';
        var f = (G.paused || night) ? 0 : G.frame;
        var px = x * TILE_SIZE, py = y * TILE_SIZE;
        var ctx = parkCtx;
        drawGrass(x, y);

        // --- Ground shadow (3/4 ellipse) ---
        ctx.fillStyle = 'rgba(0,40,20,0.25)';
        ctx.beginPath(); ctx.ellipse(px + 16, py + 28, 14, 4, 0, 0, Math.PI * 2); ctx.fill();

        // --- Stone base platform (3/4 perspective ellipse) ---
        ctx.fillStyle = '#9a8a7a';
        ctx.beginPath(); ctx.ellipse(px + 16, py + 27, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#b0a090';
        ctx.beginPath(); ctx.ellipse(px + 16, py + 26, 13, 4.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c8b8a8';
        ctx.beginPath(); ctx.ellipse(px + 16, py + 25.5, 12, 4, 0, 0, Math.PI); ctx.fill();

        // --- Rotating floor disc with alternating wedges ---
        var rotAngle = f * 0.04;
        ctx.fillStyle = '#e85080';
        ctx.beginPath(); ctx.ellipse(px + 16, py + 24, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
        for (var wi = 0; wi < 8; wi++) {
            var wa1 = rotAngle + wi * Math.PI / 4;
            var wa2 = wa1 + Math.PI / 8;
            ctx.fillStyle = wi % 2 === 0 ? '#ff90b0' : '#d04070';
            ctx.beginPath(); ctx.moveTo(px + 16, py + 24);
            ctx.lineTo(px + 16 + Math.cos(wa1) * 11, py + 24 + Math.sin(wa1) * 4);
            ctx.lineTo(px + 16 + Math.cos((wa1 + wa2) / 2) * 11, py + 24 + Math.sin((wa1 + wa2) / 2) * 4);
            ctx.lineTo(px + 16 + Math.cos(wa2) * 11, py + 24 + Math.sin(wa2) * 4);
            ctx.closePath(); ctx.fill();
        }

        // --- Horses (depth-sorted for 3/4 view) ---
        var horseColors = [C.red, C.dblue, C.green, C.purple];
        var horses = [];
        for (var hi = 0; hi < 4; hi++) {
            var ha = hi * Math.PI / 2 + rotAngle;
            var hx = 16 + Math.cos(ha) * 8;
            var hy = 22 + Math.sin(ha) * 3;
            var hbob = Math.sin(ha * 2 + f * 0.06) * 2;
            horses.push({ x: hx, y: hy, bob: hbob, color: horseColors[hi], angle: ha, idx: hi });
        }
        horses.sort(function(a, b) { return a.y - b.y; });

        // Draw back horses (behind pole)
        var backHorses = horses.filter(function(h) { return h.y <= 22; });
        var frontHorses = horses.filter(function(h) { return h.y > 22; });

        function drawHorse(h) {
            var hxx = px + h.x, hyy = py + h.y + h.bob;
            var sc = 0.6 + (h.y - 19) * 0.05;
            // Connecting pole
            ctx.fillStyle = '#d4aa7c';
            ctx.fillRect(Math.round(hxx) - 0.5, Math.round(hyy - 8), 1, 8);
            // Body
            ctx.fillStyle = h.color;
            ctx.beginPath(); ctx.roundRect(Math.round(hxx - 2.5 * sc), Math.round(hyy - 1), Math.round(5 * sc), Math.round(7 * sc), 1.5); ctx.fill();
            // Head
            var hdir = Math.cos(h.angle) > 0 ? 1 : -1;
            ctx.beginPath(); ctx.roundRect(Math.round(hxx + hdir * 2 * sc - 1), Math.round(hyy - 3 * sc), Math.round(3 * sc), Math.round(3 * sc), 1); ctx.fill();
            // Ear
            ctx.fillRect(Math.round(hxx + hdir * 2.5 * sc), Math.round(hyy - 4 * sc), 1, 1);
            // Saddle
            ctx.fillStyle = C.yellow;
            ctx.fillRect(Math.round(hxx - 1.5 * sc), Math.round(hyy), Math.round(3 * sc), 1);
            // Legs
            ctx.fillStyle = h.color;
            var lp = Math.sin(f * 0.08 + h.idx * 1.5);
            ctx.fillRect(Math.round(hxx - 2 * sc + lp * 0.5), Math.round(hyy + 5 * sc), 1, Math.round(2 * sc));
            ctx.fillRect(Math.round(hxx + 1 * sc - lp * 0.5), Math.round(hyy + 5 * sc), 1, Math.round(2 * sc));
        }

        backHorses.forEach(drawHorse);

        // --- Center pole ---
        ctx.fillStyle = '#d4aa7c'; ctx.fillRect(px + 15, py + 8, 3, 17);
        ctx.fillStyle = '#e8c090'; ctx.fillRect(px + 15, py + 8, 1, 17);
        ctx.fillStyle = '#b08860'; ctx.fillRect(px + 17, py + 8, 1, 17);
        // Decorative rings
        ctx.fillStyle = C.yellow;
        ctx.fillRect(px + 14, py + 12, 5, 1);
        ctx.fillRect(px + 14, py + 16, 5, 1);
        ctx.fillRect(px + 14, py + 20, 5, 1);

        // Front horses (in front of pole)
        frontHorses.forEach(drawHorse);

        // --- Canopy / roof ---
        // Back ellipse
        ctx.fillStyle = '#d04070';
        ctx.beginPath(); ctx.ellipse(px + 16, py + 10, 13, 3.5, 0, 0, Math.PI * 2); ctx.fill();
        // Cone
        ctx.fillStyle = C.pink;
        ctx.beginPath(); ctx.moveTo(px + 16, py + 2); ctx.lineTo(px + 29, py + 10); ctx.lineTo(px + 3, py + 10); ctx.closePath(); ctx.fill();
        // Alternating stripes on roof
        for (var ri = 0; ri < 8; ri++) {
            var rx1 = 3 + ri * 3.25, rx2 = rx1 + 3.25;
            ctx.fillStyle = ri % 2 === 0 ? '#ff90b8' : '#e06090';
            ctx.beginPath(); ctx.moveTo(px + 16, py + 2); ctx.lineTo(px + rx1, py + 10); ctx.lineTo(px + rx2, py + 10); ctx.closePath(); ctx.fill();
        }
        // Roof rim (scalloped)
        ctx.fillStyle = C.yellow;
        ctx.beginPath(); ctx.ellipse(px + 16, py + 10.5, 13.5, 2, 0, 0, Math.PI); ctx.fill();
        ctx.fillStyle = C.pink;
        ctx.beginPath(); ctx.ellipse(px + 16, py + 10, 13, 1.5, 0, 0, Math.PI); ctx.fill();
        // Scallop dots
        ctx.fillStyle = C.yellow;
        for (var si = 0; si < 10; si++) {
            var sa = Math.PI * si / 9;
            ctx.beginPath(); ctx.arc(px + 16 + Math.cos(sa) * 13, py + 10.5 + Math.sin(sa) * 2, 0.8, 0, Math.PI * 2); ctx.fill();
        }

        // --- Top finial ---
        ctx.fillStyle = C.yellow;
        ctx.beginPath(); ctx.arc(px + 16, py + 2, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff8e0'; ctx.fillRect(px + 15, py + 1, 1, 1);

        // --- Flag ---
        if (!night) {
            var fw = Math.sin(f * 0.08) * 1.5;
            ctx.fillStyle = C.red;
            ctx.beginPath(); ctx.moveTo(px + 16, py); ctx.lineTo(px + 20 + fw, py); ctx.lineTo(px + 19 + fw * 0.5, py + 1.5); ctx.lineTo(px + 16, py + 1); ctx.closePath(); ctx.fill();
        }

        // --- Twinkling lights around rim ---
        if (!night) {
            var lightCols = [C.yellow, C.pink, C.blue, C.green];
            for (var li = 0; li < 12; li++) {
                var la = Math.PI + Math.PI * li / 11;
                var lx = px + 16 + Math.cos(la) * 12.5;
                var ly = py + 10 + Math.sin(la) * 1.8;
                var bright = 0.4 + 0.6 * Math.abs(Math.sin(f * 0.06 + li * 0.8));
                ctx.globalAlpha = bright;
                ctx.fillStyle = lightCols[li % 4];
                ctx.fillRect(Math.round(lx), Math.round(ly), 1, 1);
            }
            ctx.globalAlpha = 1;
        } else {
            // Night: warm glow from lights
            ctx.fillStyle = 'rgba(255,233,77,0.15)';
            ctx.beginPath(); ctx.ellipse(px + 16, py + 16, 14, 10, 0, 0, Math.PI * 2); ctx.fill();
            var nightLightCols = [C.yellow, C.pink, C.blue, C.green];
            for (var ni = 0; ni < 12; ni++) {
                var na = Math.PI + Math.PI * ni / 11;
                ctx.fillStyle = nightLightCols[ni % 4];
                ctx.fillRect(Math.round(px + 16 + Math.cos(na) * 12.5), Math.round(py + 10 + Math.sin(na) * 1.8), 1, 1);
            }
        }
    }
    function shadeColor(hex, amt) { var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16); return '#' + [r,g,b].map(function(c){ return Math.max(0, Math.min(255, c + amt)).toString(16).padStart(2,'0'); }).join(''); }
    function drawFerrisWheel(x, y) {
        var night = getDayPart() === 'night';
        var f = (G.paused || night) ? 0 : G.frame;
        var px = x * TILE_SIZE, py = y * TILE_SIZE;
        var ctx = parkCtx;
        drawGrass(x, y);

        var wcx = px + 16, wcy = py + 13, rx = 12, ry = 11, NUM = 8, rot = f * 0.015;

        // Ground shadow
        ctx.fillStyle = 'rgba(0,40,20,0.25)';
        ctx.beginPath(); ctx.ellipse(px + 16, py + 30, 13, 3, 0, 0, Math.PI * 2); ctx.fill();

        // Concrete base pads
        ctx.fillStyle = '#9a8e80';
        ctx.beginPath(); ctx.roundRect(px + 3, py + 28, 10, 3, 1); ctx.fill();
        ctx.beginPath(); ctx.roundRect(px + 19, py + 28, 10, 3, 1); ctx.fill();
        ctx.fillStyle = '#b0a498'; ctx.fillRect(px + 4, py + 28, 8, 1); ctx.fillRect(px + 20, py + 28, 8, 1);

        // A-frame support legs
        ctx.strokeStyle = '#c06088'; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(px + 7, py + 29); ctx.lineTo(wcx - 1, wcy + 1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px + 25, py + 29); ctx.lineTo(wcx + 1, wcy + 1); ctx.stroke();
        // Highlights
        ctx.strokeStyle = '#e880a8'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(px + 8, py + 29); ctx.lineTo(wcx - 0.5, wcy + 1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px + 24, py + 29); ctx.lineTo(wcx + 0.5, wcy + 1); ctx.stroke();
        // Cross bracing
        ctx.strokeStyle = '#b05878'; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(px + 10, py + 24); ctx.lineTo(px + 22, py + 24); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px + 12, py + 20); ctx.lineTo(px + 20, py + 20); ctx.stroke();

        // Outer rim (double ring)
        ctx.strokeStyle = '#d06090'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(wcx, wcy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#e880a8'; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.ellipse(wcx, wcy, rx - 1.2, ry - 1.2, 0, 0, Math.PI * 2); ctx.stroke();

        // Build & depth-sort gondolas
        var gonds = [];
        for (var gi = 0; gi < NUM; gi++) {
            var ga = rot + (gi / NUM) * Math.PI * 2;
            gonds.push({ x: wcx + Math.cos(ga) * rx, y: wcy + Math.sin(ga) * ry, a: ga, i: gi, d: Math.sin(ga) });
        }
        gonds.sort(function(a, b) { return a.d - b.d; });

        var gc = [C.red, C.dblue, C.yellow, C.green, C.purple, C.orange, C.pink, C.blue];
        var backG = gonds.filter(function(g) { return g.d <= 0; });
        var frontG = gonds.filter(function(g) { return g.d > 0; });

        function drawGond(g) {
            var col = gc[g.i % gc.length], gx = g.x, gy = g.y;
            var ds = 0.7 + g.d * 0.15;
            // Spoke
            ctx.strokeStyle = '#c06088'; ctx.lineWidth = 0.7;
            ctx.beginPath(); ctx.moveTo(wcx, wcy); ctx.lineTo(gx, gy); ctx.stroke();
            // Hanger wire
            var hl = 2.5 * ds;
            ctx.strokeStyle = '#a0a0a0'; ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + hl); ctx.stroke();
            // Gondola shadow
            var bw = 4 * ds, bh = 3.5 * ds, bx = gx - bw / 2, by = gy + hl;
            ctx.fillStyle = shadeColor(col, -40);
            ctx.beginPath(); ctx.roundRect(bx, by + 0.5, bw, bh, 1.2 * ds); ctx.fill();
            // Gondola body
            ctx.fillStyle = col;
            ctx.beginPath(); ctx.roundRect(bx, by, bw, bh - 0.5, 1.2 * ds); ctx.fill();
            // Window highlight
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.fillRect(Math.round(gx - 1), Math.round(by + 0.5), Math.ceil(2 * ds), Math.ceil(1.5 * ds));
            // Roof bar
            ctx.fillStyle = shadeColor(col, -30);
            ctx.fillRect(Math.round(bx + 0.3), Math.round(by), Math.round(bw - 0.6), 1);
        }

        // Back gondolas
        backG.forEach(drawGond);
        // Front spokes (behind front gondola bodies)
        frontG.forEach(function(g) {
            ctx.strokeStyle = '#c06088'; ctx.lineWidth = 0.7;
            ctx.beginPath(); ctx.moveTo(wcx, wcy); ctx.lineTo(g.x, g.y); ctx.stroke();
        });

        // Center hub
        ctx.fillStyle = '#c06088'; ctx.beginPath(); ctx.arc(wcx, wcy, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.yellow; ctx.beginPath(); ctx.arc(wcx, wcy, 2.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff8e0'; ctx.beginPath(); ctx.arc(wcx - 0.5, wcy - 0.5, 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#d4a020'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.arc(wcx, wcy, 1.8, 0, Math.PI * 2); ctx.stroke();

        // Front gondolas
        frontG.forEach(drawGond);

        // Rim lights
        var lc = [C.yellow, C.pink, C.blue, C.green, C.orange, C.red, C.purple, '#fff8f0'];
        for (var li = 0; li < 16; li++) {
            var la = (li / 16) * Math.PI * 2;
            var lx = wcx + Math.cos(la) * (rx + 0.5), ly = wcy + Math.sin(la) * (ry + 0.5);
            if (night) {
                ctx.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(f * 0.04 + li));
                ctx.fillStyle = lc[li % lc.length]; ctx.fillRect(Math.round(lx), Math.round(ly), 1, 1);
                ctx.globalAlpha = 0.15; ctx.beginPath(); ctx.arc(lx + 0.5, ly + 0.5, 2, 0, Math.PI * 2); ctx.fill();
            } else {
                ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(f * 0.05 + li * 1.2));
                ctx.fillStyle = lc[li % lc.length]; ctx.fillRect(Math.round(lx), Math.round(ly), 1, 1);
            }
        }
        ctx.globalAlpha = 1;

        // Night glow
        if (night) {
            ctx.fillStyle = 'rgba(255,233,77,0.08)';
            ctx.beginPath(); ctx.ellipse(wcx, wcy, rx + 3, ry + 3, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,125,173,0.06)';
            ctx.beginPath(); ctx.ellipse(wcx, wcy + 8, 14, 6, 0, 0, Math.PI * 2); ctx.fill();
        }
    }
    function drawSpiralSlide(x, y) {
        var f = G.paused ? 0 : G.frame;
        var night = getDayPart() === 'night';
        var ctx = parkCtx;
        drawGrass(x, y);
        ctx.save();
        ctx.translate(x * TILE_SIZE, y * TILE_SIZE);

        var cx=15, topY=1, botY=29;
        var totalH=botY-topY;
        var SPIRALS=3.5, tubeR=7, tubeRTop=3, NUM_PTS=80;

        // Ground shadow
        ctx.fillStyle='rgba(0,40,20,0.25)';
        ctx.beginPath();ctx.ellipse(cx,30,10,3,0,0,Math.PI*2);ctx.fill();

        // Landing pad
        ctx.fillStyle=SS_PLAT;
        ctx.beginPath();ctx.roundRect(19,27,11,4,1.5);ctx.fill();
        ctx.fillStyle=SS_PLAT_L;ctx.fillRect(20,27,9,1.2);
        ctx.fillStyle=SS_SL;
        ctx.beginPath();ctx.roundRect(18,26,6,3,1);ctx.fill();
        ctx.fillStyle=SS_SL_L;ctx.fillRect(19,26,4,1);

        // Center pole
        ctx.fillStyle=SS_STRUC;ctx.fillRect(cx-1.5, topY+2, 3, totalH-2);
        ctx.fillStyle=SS_STRUC_L;ctx.fillRect(cx-1.5, topY+2, 1, totalH-2);
        ctx.fillStyle=SS_STRUC_D;ctx.fillRect(cx+1, topY+2, 0.5, totalH-2);

        // Cross-braces
        ctx.strokeStyle=SS_STRUC_D;ctx.lineWidth=0.4;
        for(var bi=0;bi<6;bi++){var by=topY+4+bi*4.5;ctx.beginPath();ctx.moveTo(cx-3,by);ctx.lineTo(cx+3,by);ctx.stroke();}

        // Diagonal struts
        ctx.strokeStyle=SS_STRUC;ctx.lineWidth=0.8;
        ctx.beginPath();ctx.moveTo(cx-1,topY+4);ctx.lineTo(cx-5,botY-2);ctx.stroke();
        ctx.beginPath();ctx.moveTo(cx+1,topY+4);ctx.lineTo(cx+5,botY-2);ctx.stroke();
        ctx.strokeStyle=SS_STRUC_L;ctx.lineWidth=0.3;
        ctx.beginPath();ctx.moveTo(cx-1,topY+4);ctx.lineTo(cx-5,botY-2);ctx.stroke();

        function spiralPt(t){var y2=topY+3+t*(totalH-5),angle=t*SPIRALS*Math.PI*2,r=tubeRTop+t*(tubeR-tubeRTop),x2=cx+Math.cos(angle)*r,yOff=Math.sin(angle)*r*0.25;return{x:x2,y:y2+yOff,angle:angle,r:r,t:t};}
        function groupContiguous(filterFn){var groups=[],current=[];for(var i=0;i<=NUM_PTS;i++){var t=i/NUM_PTS,p=spiralPt(t);if(filterFn(p)){current.push(p);}else{if(current.length>1)groups.push(current);current=[];}}if(current.length>1)groups.push(current);return groups;}
        function drawTubeSegments(pts,isBack){if(pts.length<2)return;ctx.strokeStyle=isBack?SS_SL_D:SS_SL;ctx.lineWidth=isBack?3.5:4;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();pts.forEach(function(p,i){if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);});ctx.stroke();ctx.strokeStyle=isBack?SS_SL:SS_SL_L;ctx.lineWidth=isBack?1.5:2;ctx.beginPath();pts.forEach(function(p,i){if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);});ctx.stroke();if(!isBack){ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=0.6;ctx.beginPath();pts.forEach(function(p,i){if(i===0)ctx.moveTo(p.x-0.5,p.y-0.5);else ctx.lineTo(p.x-0.5,p.y-0.5);});ctx.stroke();}}

        var backGroups=groupContiguous(function(p){return Math.sin(p.angle)<0.1;});
        var frontGroups=groupContiguous(function(p){return Math.sin(p.angle)>=-0.1;});
        backGroups.forEach(function(g){drawTubeSegments(g,true);});

        // Platform
        ctx.fillStyle=SS_PLAT;ctx.beginPath();ctx.ellipse(cx,topY+3,7,2.5,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle=SS_PLAT_L;ctx.beginPath();ctx.ellipse(cx,topY+2.5,6,2,0,0,Math.PI);ctx.fill();
        ctx.strokeStyle=SS_STRUC_D;ctx.lineWidth=0.5;ctx.beginPath();ctx.ellipse(cx,topY+3,7,2.5,0,0,Math.PI*2);ctx.stroke();

        // Railing posts
        ctx.fillStyle='#c0b0a0';
        for(var ri=0;ri<6;ri++){var ra=(ri/6)*Math.PI*2,rrx=cx+Math.cos(ra)*6,rry=topY+3+Math.sin(ra)*2;ctx.fillRect(rrx-0.3,rry-2,0.6,2);}
        ctx.strokeStyle='#d0c0b0';ctx.lineWidth=0.4;ctx.beginPath();
        for(var ri2=0;ri2<=12;ri2++){var ra2=(ri2/12)*Math.PI*2,rrx2=cx+Math.cos(ra2)*6,rry2=topY+1.5+Math.sin(ra2)*2;if(ri2===0)ctx.moveTo(rrx2,rry2);else ctx.lineTo(rrx2,rry2);}ctx.stroke();

        // Roof
        ctx.fillStyle=C.red;ctx.beginPath();ctx.moveTo(cx,topY-1);ctx.lineTo(cx+8,topY+2);ctx.lineTo(cx-8,topY+2);ctx.closePath();ctx.fill();
        ctx.fillStyle='#ff9090';ctx.beginPath();ctx.moveTo(cx,topY-1);ctx.lineTo(cx+3,topY+2);ctx.lineTo(cx-1,topY+2);ctx.closePath();ctx.fill();
        ctx.fillStyle='#ff9090';ctx.beginPath();ctx.moveTo(cx,topY-1);ctx.lineTo(cx+8,topY+2);ctx.lineTo(cx+5,topY+2);ctx.closePath();ctx.fill();
        ctx.fillStyle=C.yellow;ctx.beginPath();ctx.ellipse(cx,topY+2,8,1.2,0,0,Math.PI);ctx.fill();

        // Finial & flag
        ctx.fillStyle=SS_STRUC;ctx.fillRect(cx-0.3,topY-3,0.7,3);
        ctx.fillStyle=C.yellow;ctx.beginPath();ctx.arc(cx,topY-3,1,0,Math.PI*2);ctx.fill();
        var wave=Math.sin(f*0.08)*1;
        ctx.fillStyle=C.orange;ctx.beginPath();ctx.moveTo(cx+0.5,topY-4.5);ctx.lineTo(cx+4,topY-3.5+wave);ctx.lineTo(cx+0.5,topY-2.5);ctx.closePath();ctx.fill();

        frontGroups.forEach(function(g){drawTubeSegments(g,false);});

        // Riders
        if(!night){var riderSpeed=0.004;for(var ri3=0;ri3<2;ri3++){var rt=((f*riderSpeed+ri3*0.5)%1);if(rt<0.02||rt>0.95)continue;var rp=spiralPt(rt);if(Math.sin(rp.angle)>=0){ctx.fillStyle=ri3===0?C.blue:C.purple;ctx.beginPath();ctx.roundRect(rp.x-1.5,rp.y-2,3,3,0.8);ctx.fill();ctx.fillStyle='#ffd5b8';ctx.beginPath();ctx.arc(rp.x,rp.y-3.5,1.3,0,Math.PI*2);ctx.fill();ctx.fillStyle=ri3===0?'#6c5043':'#ffe94d';ctx.beginPath();ctx.ellipse(rp.x,rp.y-4.3,1.5,0.7,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ffd5b8';ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(rp.x-1.5,rp.y-2);ctx.lineTo(rp.x-2.5,rp.y-5);ctx.stroke();ctx.beginPath();ctx.moveTo(rp.x+1.5,rp.y-2);ctx.lineTo(rp.x+2.5,rp.y-5);ctx.stroke();}}}

        // Edge lights
        var lc=[C.yellow,C.purple,C.blue,C.green,C.orange,C.pink,C.yellow,C.red];
        for(var li=0;li<8;li++){var lt=li/8,lp=spiralPt(lt);if(Math.sin(lp.angle)>=0){if(night){ctx.globalAlpha=0.6+0.4*Math.abs(Math.sin(f*0.04+li*1.1));ctx.fillStyle=lc[li%lc.length];ctx.fillRect(Math.round(lp.x-0.5),Math.round(lp.y-0.5),1,1);ctx.globalAlpha=0.12;ctx.beginPath();ctx.arc(lp.x,lp.y,2.5,0,Math.PI*2);ctx.fill();}else{ctx.globalAlpha=0.3+0.6*Math.abs(Math.sin(f*0.05+li*1.3));ctx.fillStyle=lc[li%lc.length];ctx.fillRect(Math.round(lp.x-0.5),Math.round(lp.y-0.5),1,1);}}}
        ctx.globalAlpha=1;

        if(night){ctx.fillStyle='rgba(34,193,195,0.07)';ctx.beginPath();ctx.ellipse(cx,16,12,14,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,233,77,0.06)';ctx.beginPath();ctx.ellipse(cx,topY,6,4,0,0,Math.PI*2);ctx.fill();}

        ctx.restore();
    }
    function drawHauntedHouse(x, y) {
        var f = G.paused ? 0 : G.frame;
        var night = getDayPart() === 'night';
        var ctx = parkCtx;
        drawGrass(x, y);
        ctx.save();
        ctx.translate(x * TILE_SIZE, y * TILE_SIZE);

        // Ground shadow
        ctx.fillStyle='rgba(20,10,30,0.3)';ctx.beginPath();ctx.ellipse(16,30,14,3,0,0,Math.PI*2);ctx.fill();

        // Right side wall
        ctx.fillStyle=HH_H2;ctx.beginPath();ctx.moveTo(26,12);ctx.lineTo(30,14);ctx.lineTo(30,29);ctx.lineTo(26,29);ctx.closePath();ctx.fill();
        ctx.fillStyle=HH_H4;for(var rb=0;rb<4;rb++)ctx.fillRect(27,16+rb*3.5,3,0.4);

        // Front wall
        ctx.fillStyle=HH_H1;ctx.beginPath();ctx.roundRect(3,12,23,17,1);ctx.fill();
        ctx.fillStyle=HH_H3;ctx.fillRect(3,12,1.5,17);
        ctx.fillStyle=HH_H4;ctx.fillRect(4,27,21,2);
        // Brick texture
        ctx.fillStyle=HH_H2;
        for(var bk=0;bk<5;bk++){var bkY=14+bk*3.2;ctx.fillRect(4,bkY,21,0.4);for(var bj=0;bj<4;bj++){var bjX=6+bj*5.5+(bk%2)*2.5;if(bjX<25)ctx.fillRect(bjX,bkY,0.4,3.2);}}

        // Roof
        ctx.fillStyle=HH_ROOF;ctx.beginPath();ctx.moveTo(16,2);ctx.lineTo(1,12);ctx.lineTo(26,12);ctx.closePath();ctx.fill();
        ctx.fillStyle='#221828';ctx.beginPath();ctx.moveTo(16,2);ctx.lineTo(26,12);ctx.lineTo(31,14);ctx.lineTo(20,4);ctx.closePath();ctx.fill();
        ctx.strokeStyle=HH_ROOF_L;ctx.lineWidth=0.6;ctx.beginPath();ctx.moveTo(16,2);ctx.lineTo(1,12);ctx.stroke();
        ctx.strokeStyle='rgba(255,255,255,0.05)';ctx.lineWidth=0.3;
        for(var sl=0;sl<4;sl++){var slY=4+sl*2.5;ctx.beginPath();ctx.moveTo(16-sl*3,slY);ctx.lineTo(3+sl*1.5,12);ctx.stroke();}
        ctx.fillStyle='#1a1225';ctx.fillRect(1,11.5,25,1.2);
        ctx.fillStyle=HH_IRON;ctx.fillRect(1,11,25,0.5);

        // Tower
        ctx.fillStyle=HH_H2;ctx.beginPath();ctx.roundRect(22,4,7,25,0.8);ctx.fill();
        ctx.fillStyle=HH_H1;ctx.beginPath();ctx.roundRect(21,4,6,25,0.8);ctx.fill();
        ctx.fillStyle=HH_H3;ctx.fillRect(21,4,1.2,25);
        ctx.fillStyle=HH_H2;for(var tb=0;tb<7;tb++)ctx.fillRect(22,6+tb*3.3,5,0.3);
        // Tower roof
        ctx.fillStyle=HH_ROOF;ctx.beginPath();ctx.moveTo(24,0);ctx.lineTo(20,5);ctx.lineTo(28,5);ctx.closePath();ctx.fill();
        ctx.fillStyle=HH_ROOF_L;ctx.beginPath();ctx.moveTo(24,0);ctx.lineTo(21,5);ctx.lineTo(23,5);ctx.closePath();ctx.fill();
        ctx.fillStyle=HH_IRON;ctx.fillRect(23.5,0,1,1.5);
        ctx.strokeStyle=HH_IRON;ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(22,0.5);ctx.lineTo(26,0.5);ctx.stroke();
        ctx.fillStyle=HH_IRON;ctx.beginPath();ctx.moveTo(26,0.5);ctx.lineTo(25,0);ctx.lineTo(25,1);ctx.closePath();ctx.fill();

        // Tower window
        var twGlow=0.3+0.4*Math.abs(Math.sin(f*0.03));
        ctx.fillStyle='rgba(200,180,50,'+twGlow+')';ctx.fillRect(23,9,2,4);
        ctx.fillStyle=HH_IRON;ctx.fillRect(23.8,9,0.4,4);

        // Front windows
        var w1Glow=0.2+0.5*Math.abs(Math.sin(f*0.04+1));
        ctx.fillStyle='rgba(200,170,40,'+w1Glow+')';ctx.beginPath();ctx.roundRect(6,15,5,4,0.5);ctx.fill();
        ctx.strokeStyle=HH_H4;ctx.lineWidth=0.6;ctx.beginPath();ctx.roundRect(6,15,5,4,0.5);ctx.stroke();
        ctx.fillStyle=HH_H4;ctx.fillRect(8.2,15,0.5,4);ctx.fillRect(6,16.8,5,0.5);
        var w2Glow=0.15+0.6*Math.abs(Math.sin(f*0.035+2.5));
        ctx.fillStyle='rgba(200,170,40,'+w2Glow+')';ctx.beginPath();ctx.roundRect(14,15,5,4,0.5);ctx.fill();
        ctx.strokeStyle=HH_H4;ctx.lineWidth=0.6;ctx.beginPath();ctx.roundRect(14,15,5,4,0.5);ctx.stroke();
        ctx.fillStyle=HH_H4;ctx.fillRect(16.2,15,0.5,4);ctx.fillRect(14,16.8,5,0.5);

        // Silhouette
        var silP=Math.sin(f*0.015);
        if(silP>0.3){ctx.fillStyle='rgba(30,15,40,'+(0.4+silP*0.3)+')';ctx.beginPath();ctx.arc(8.5+silP*0.5,16.5,1.5,0,Math.PI*2);ctx.fill();ctx.fillRect(7.5+silP*0.5,17.5,2,1.5);}

        // Door
        ctx.fillStyle=HH_WOOD;ctx.beginPath();ctx.roundRect(11,22,6,7,1);ctx.fill();
        ctx.fillStyle='#3a2820';ctx.beginPath();ctx.roundRect(12,23,4,5.5,0.8);ctx.fill();
        ctx.fillStyle=HH_WOOD;ctx.beginPath();ctx.arc(14,22,3,Math.PI,0,false);ctx.fill();
        ctx.fillStyle='#3a2820';ctx.beginPath();ctx.arc(14,22,2,Math.PI,0,false);ctx.fill();
        ctx.fillStyle=C.yellow;ctx.beginPath();ctx.arc(15,25.5,0.5,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle=HH_H4;ctx.lineWidth=0.5;ctx.beginPath();ctx.roundRect(11,22,6,7,1);ctx.stroke();
        ctx.fillStyle='#6a6070';ctx.beginPath();ctx.roundRect(10,28.5,8,1.5,0.5);ctx.fill();
        ctx.fillStyle='#7a7080';ctx.fillRect(10.5,28.5,7,0.5);

        // Gable window
        var gwGlow=0.25+0.5*Math.abs(Math.sin(f*0.028+4));
        ctx.fillStyle='rgba(180,50,50,'+gwGlow+')';ctx.beginPath();ctx.arc(13,7,2,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle=HH_H4;ctx.lineWidth=0.5;ctx.beginPath();ctx.arc(13,7,2,0,Math.PI*2);ctx.stroke();
        ctx.fillStyle=HH_H4;ctx.fillRect(12.7,5.2,0.5,3.6);ctx.fillRect(11.2,6.7,3.6,0.5);

        // Ghost
        var ghostY=3+Math.sin(f*0.025)*3,ghostX=5+Math.sin(f*0.018)*2,ghostAlpha=0.15+0.2*Math.abs(Math.sin(f*0.02));
        ctx.globalAlpha=night?ghostAlpha+0.15:ghostAlpha;
        ctx.fillStyle='#e0d8f0';ctx.beginPath();ctx.moveTo(ghostX,ghostY);ctx.quadraticCurveTo(ghostX-2,ghostY+1,ghostX-1.5,ghostY+3);ctx.quadraticCurveTo(ghostX-0.5,ghostY+2.5,ghostX,ghostY+3.5);ctx.quadraticCurveTo(ghostX+0.5,ghostY+2.5,ghostX+1.5,ghostY+3);ctx.quadraticCurveTo(ghostX+2,ghostY+1,ghostX,ghostY);ctx.fill();
        ctx.fillStyle='rgba(40,20,60,'+(ghostAlpha+0.3)+')';ctx.fillRect(ghostX-1,ghostY+1,0.7,0.7);ctx.fillRect(ghostX+0.3,ghostY+1,0.7,0.7);
        ctx.globalAlpha=1;

        // Bats
        for(var bi=0;bi<2;bi++){var batA=f*0.04+bi*3.14,batX=16+Math.cos(batA)*8+Math.sin(batA*0.7)*2,batY=4+Math.sin(batA*1.3)*3+bi*2,wingSpread=1.5+Math.sin(f*0.12+bi*2)*1.5;ctx.fillStyle='#1a1025';ctx.globalAlpha=night?0.8:0.5;ctx.fillRect(batX-0.5,batY-0.3,1,0.8);ctx.beginPath();ctx.moveTo(batX-0.5,batY);ctx.lineTo(batX-wingSpread-1,batY-wingSpread*0.4);ctx.lineTo(batX-0.8,batY+0.3);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(batX+0.5,batY);ctx.lineTo(batX+wingSpread+1,batY-wingSpread*0.4);ctx.lineTo(batX+0.8,batY+0.3);ctx.closePath();ctx.fill();}
        ctx.globalAlpha=1;

        // Fog
        for(var fi=0;fi<3;fi++){var fogX=4+fi*10+Math.sin(f*0.012+fi*2)*3,fogY=27+Math.sin(f*0.015+fi)*1,fogW=6+Math.sin(f*0.01+fi)*2;ctx.fillStyle=HH_FOG+(night?'0.12)':'0.06)');ctx.beginPath();ctx.ellipse(fogX,fogY,fogW,1.5,0,0,Math.PI*2);ctx.fill();}

        // Porch lights
        var porchPulse=0.3+0.5*Math.abs(Math.sin(f*0.05));
        ctx.fillStyle=HH_IRON;ctx.fillRect(9.5,21,1,2);ctx.fillRect(17.5,21,1,2);
        if(night){ctx.globalAlpha=0.7;ctx.fillStyle='rgba(220,180,60,0.8)';ctx.beginPath();ctx.arc(10,21,1,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(18,21,1,0,Math.PI*2);ctx.fill();ctx.globalAlpha=0.15;ctx.fillStyle='rgba(220,180,60,0.5)';ctx.beginPath();ctx.arc(10,21,3,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(18,21,3,0,Math.PI*2);ctx.fill();}else{ctx.globalAlpha=porchPulse;ctx.fillStyle=C.orange;ctx.beginPath();ctx.arc(10,21,0.7,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(18,21,0.7,0,Math.PI*2);ctx.fill();}
        ctx.globalAlpha=1;

        // Cobweb
        ctx.strokeStyle='rgba(200,195,210,0.2)';ctx.lineWidth=0.3;
        ctx.beginPath();ctx.moveTo(3,12);ctx.quadraticCurveTo(5,13,4,15);ctx.stroke();
        ctx.beginPath();ctx.moveTo(3,12);ctx.quadraticCurveTo(6,12.5,7,13);ctx.stroke();
        ctx.beginPath();ctx.moveTo(3,13);ctx.quadraticCurveTo(5,14,6,14);ctx.stroke();

        // Night glow
        if(night){ctx.fillStyle='rgba(90,50,120,0.08)';ctx.beginPath();ctx.ellipse(16,18,16,14,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(200,170,40,0.06)';ctx.beginPath();ctx.ellipse(8.5,20,4,2,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(16.5,20,4,2,0,0,Math.PI*2);ctx.fill();}

        ctx.restore();
    }
    function drawPirateShip(x, y) {
        var night = getDayPart() === 'night';
        var f = (G.paused || night) ? 0 : G.frame;
        var ctx = parkCtx;
        drawGrass(x, y);
        ctx.save();
        ctx.translate(x * TILE_SIZE, y * TILE_SIZE);

        var swingAngle=Math.sin(f*0.028)*0.38;
        var pivotX=16,pivotY=5;
        function rot(rx,ry){var dx=rx-pivotX,dy=ry-pivotY,cos=Math.cos(swingAngle),sin=Math.sin(swingAngle);return{x:pivotX+dx*cos-dy*sin,y:pivotY+dx*sin+dy*cos};}
        var restCY=20;
        function sp(lx,ly){return rot(pivotX+lx,restCY+ly);}

        // Shadow
        var shadowOff=swingAngle*6;
        ctx.fillStyle='rgba(0,30,15,0.25)';ctx.beginPath();ctx.ellipse(16+shadowOff*0.5,29.5,12,2.5,0,0,Math.PI*2);ctx.fill();

        // Water pool
        ctx.fillStyle=PS_WATER_D;ctx.beginPath();ctx.ellipse(16,29,13,3,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle=PS_WATER;ctx.beginPath();ctx.ellipse(16,28.8,12,2.5,0,0,Math.PI*2);ctx.fill();
        var waveOff=f*0.06;
        ctx.fillStyle=PS_WATER_L;for(var wi=0;wi<5;wi++){var wx=7+wi*4.5+Math.sin(waveOff+wi*1.2)*1.2,wy=28.3+Math.sin(waveOff*0.8+wi*0.9)*0.4;ctx.fillRect(wx,wy,2.5,0.5);}
        ctx.fillStyle=PS_FOAM;for(var pfi=0;pfi<4;pfi++){var pfx=8+pfi*5+Math.sin(waveOff*1.1+pfi*1.5)*1,pfy=28.5+Math.cos(waveOff*0.7+pfi)*0.3;ctx.globalAlpha=0.4+0.3*Math.sin(waveOff+pfi*2);ctx.fillRect(pfx,pfy,1.5,0.3);}ctx.globalAlpha=1;
        ctx.strokeStyle='#5a7a5a';ctx.lineWidth=0.6;ctx.beginPath();ctx.ellipse(16,29,13.5,3.2,0,0,Math.PI*2);ctx.stroke();
        ctx.strokeStyle='#8aaa8a';ctx.lineWidth=0.3;ctx.beginPath();ctx.ellipse(16,29,13.5,3.2,0,Math.PI,Math.PI*2);ctx.stroke();

        // A-frame
        ctx.strokeStyle=PS_STRUC_D;ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(pivotX-10,30);ctx.lineTo(pivotX,pivotY);ctx.stroke();
        ctx.beginPath();ctx.moveTo(pivotX+10,30);ctx.lineTo(pivotX,pivotY);ctx.stroke();
        ctx.strokeStyle=PS_STRUC;ctx.lineWidth=1.5;
        ctx.beginPath();ctx.moveTo(pivotX-9.5,30);ctx.lineTo(pivotX,pivotY);ctx.stroke();
        ctx.beginPath();ctx.moveTo(pivotX+9.5,30);ctx.lineTo(pivotX,pivotY);ctx.stroke();
        ctx.strokeStyle=PS_STRUC_L;ctx.lineWidth=0.5;
        ctx.beginPath();ctx.moveTo(pivotX-9,30);ctx.lineTo(pivotX-0.5,pivotY);ctx.stroke();
        ctx.strokeStyle=PS_STRUC;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pivotX-6,20);ctx.lineTo(pivotX+6,20);ctx.stroke();
        ctx.strokeStyle=PS_STRUC_L;ctx.lineWidth=0.3;ctx.beginPath();ctx.moveTo(pivotX-6,19.8);ctx.lineTo(pivotX+6,19.8);ctx.stroke();
        ctx.strokeStyle=PS_STRUC;ctx.lineWidth=0.7;ctx.beginPath();ctx.moveTo(pivotX-8,25);ctx.lineTo(pivotX+8,25);ctx.stroke();

        // Pivot hub
        ctx.fillStyle=PS_IRON;ctx.beginPath();ctx.arc(pivotX,pivotY,1.8,0,Math.PI*2);ctx.fill();
        ctx.fillStyle=PS_IRON_D;ctx.beginPath();ctx.arc(pivotX,pivotY,1,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#7a7a8a';ctx.beginPath();ctx.arc(pivotX-0.3,pivotY-0.3,0.4,0,Math.PI*2);ctx.fill();

        // Pivot arm
        var armBot=rot(pivotX,pivotY+12);
        ctx.strokeStyle=PS_IRON;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(pivotX,pivotY);ctx.lineTo(armBot.x,armBot.y);ctx.stroke();
        ctx.strokeStyle='#7a7a8a';ctx.lineWidth=0.4;ctx.beginPath();ctx.moveTo(pivotX,pivotY);ctx.lineTo(armBot.x,armBot.y);ctx.stroke();

        // Hull bottom
        ctx.fillStyle=PS_HULL_BOT;ctx.beginPath();
        var hbl=sp(-9,3),hbr=sp(9,3),hkl=sp(-7,5),hkr=sp(7,5);
        ctx.moveTo(hbl.x,hbl.y);ctx.lineTo(hbr.x,hbr.y);ctx.quadraticCurveTo(sp(8,4.5).x,sp(8,4.5).y,hkr.x,hkr.y);ctx.lineTo(hkl.x,hkl.y);ctx.quadraticCurveTo(sp(-8,4.5).x,sp(-8,4.5).y,hbl.x,hbl.y);ctx.fill();

        // Hull body
        ctx.fillStyle=PS_HULL;ctx.beginPath();
        var bowTip=sp(-11,0),sternTip=sp(11,-2);
        ctx.moveTo(bowTip.x,bowTip.y);ctx.quadraticCurveTo(sp(-10,-1).x,sp(-10,-1).y,sp(-10,1).x,sp(-10,1).y);ctx.lineTo(sp(-9,3).x,sp(-9,3).y);ctx.lineTo(sp(9,3).x,sp(9,3).y);ctx.lineTo(sp(10,1).x,sp(10,1).y);ctx.quadraticCurveTo(sp(10,-1).x,sp(10,-1).y,sternTip.x,sternTip.y);ctx.lineTo(sp(10,-1).x,sp(10,-1).y);ctx.lineTo(sp(-10,-1).x,sp(-10,-1).y);ctx.closePath();ctx.fill();
        ctx.strokeStyle=PS_HULL_L;ctx.lineWidth=0.7;ctx.beginPath();ctx.moveTo(sp(-10,1).x,sp(-10,1).y);ctx.lineTo(sp(10,1).x,sp(10,1).y);ctx.stroke();
        ctx.strokeStyle=PS_HULL_D;ctx.lineWidth=0.3;for(var pi2=0;pi2<4;pi2++){var py=-0.5+pi2;ctx.beginPath();ctx.moveTo(sp(-9.5,py).x,sp(-9.5,py).y);ctx.lineTo(sp(9.5,py).x,sp(9.5,py).y);ctx.stroke();}
        ctx.strokeStyle=PS_HULL_D;ctx.lineWidth=0.2;for(var pj=0;pj<6;pj++){var px=-7+pj*2.8,prow=(pj%2===0)?0:1;ctx.beginPath();ctx.moveTo(sp(px,-1+prow).x,sp(px,-1+prow).y);ctx.lineTo(sp(px,3).x,sp(px,3).y);ctx.stroke();}

        // Gold trim
        ctx.strokeStyle=PS_GOLD;ctx.lineWidth=0.6;ctx.beginPath();ctx.moveTo(sp(-11,0).x,sp(-11,0).y);ctx.lineTo(sp(-10,-1).x,sp(-10,-1).y);ctx.lineTo(sp(10,-1).x,sp(10,-1).y);ctx.lineTo(sp(11,-2).x,sp(11,-2).y);ctx.stroke();

        // Bowsprit & figurehead
        var bsp1=sp(-11,0),bsp2=sp(-13,-1.5);
        ctx.strokeStyle=PS_MAST;ctx.lineWidth=0.8;ctx.beginPath();ctx.moveTo(bsp1.x,bsp1.y);ctx.lineTo(bsp2.x,bsp2.y);ctx.stroke();
        ctx.fillStyle=PS_GOLD;ctx.beginPath();ctx.arc(bsp2.x,bsp2.y,0.8,0,Math.PI*2);ctx.fill();

        // Stern
        var st1=sp(10,-1),st2=sp(11,-2),st3=sp(11,-4),st4=sp(10,-4);
        ctx.fillStyle=PS_HULL;ctx.beginPath();ctx.moveTo(st1.x,st1.y);ctx.lineTo(st2.x,st2.y);ctx.lineTo(st3.x,st3.y);ctx.lineTo(st4.x,st4.y);ctx.closePath();ctx.fill();
        var sw2=sp(10.5,-3);ctx.fillStyle=PS_GOLD_D;ctx.beginPath();ctx.arc(sw2.x,sw2.y,0.7,0,Math.PI*2);ctx.fill();
        ctx.fillStyle=night?'rgba(255,200,80,0.7)':'rgba(200,180,120,0.4)';ctx.beginPath();ctx.arc(sw2.x,sw2.y,0.5,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle=PS_GOLD;ctx.lineWidth=0.4;ctx.beginPath();ctx.moveTo(st2.x,st2.y);ctx.lineTo(st3.x,st3.y);ctx.stroke();

        // Deck
        ctx.fillStyle=PS_DECK;ctx.beginPath();ctx.moveTo(sp(-10,-1).x,sp(-10,-1).y);ctx.lineTo(sp(10,-1).x,sp(10,-1).y);ctx.lineTo(sp(9,-2).x,sp(9,-2).y);ctx.lineTo(sp(-9,-2).x,sp(-9,-2).y);ctx.closePath();ctx.fill();
        ctx.fillStyle=PS_DECK_L;ctx.beginPath();ctx.moveTo(sp(-9,-2).x,sp(-9,-2).y);ctx.lineTo(sp(8,-2).x,sp(8,-2).y);ctx.lineTo(sp(9,-1.5).x,sp(9,-1.5).y);ctx.lineTo(sp(-9,-1.5).x,sp(-9,-1.5).y);ctx.closePath();ctx.fill();
        ctx.strokeStyle='#7a5a38';ctx.lineWidth=0.2;for(var dp=0;dp<7;dp++){var dpx=-8+dp*2.5;ctx.beginPath();ctx.moveTo(sp(dpx,-2).x,sp(dpx,-2).y);ctx.lineTo(sp(dpx,-1).x,sp(dpx,-1).y);ctx.stroke();}

        // Railings
        ctx.strokeStyle=PS_RAIL;ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(sp(-10,-1).x,sp(-10,-1).y);ctx.lineTo(sp(-10,-3).x,sp(-10,-3).y);ctx.stroke();
        ctx.beginPath();ctx.moveTo(sp(10,-1).x,sp(10,-1).y);ctx.lineTo(sp(10,-4).x,sp(10,-4).y);ctx.stroke();
        ctx.strokeStyle=PS_RAIL_L;ctx.lineWidth=0.4;ctx.beginPath();ctx.moveTo(sp(-10,-3).x,sp(-10,-3).y);ctx.lineTo(sp(10,-3).x,sp(10,-3).y);ctx.stroke();
        ctx.strokeStyle=PS_RAIL;ctx.lineWidth=0.3;for(var rp2=0;rp2<6;rp2++){var rpx2=-8+rp2*3.5;ctx.beginPath();ctx.moveTo(sp(rpx2,-1.5).x,sp(rpx2,-1.5).y);ctx.lineTo(sp(rpx2,-3).x,sp(rpx2,-3).y);ctx.stroke();}

        // Mast
        var mastBot=sp(0,-2),mastTop=sp(0,-13);
        ctx.strokeStyle=PS_MAST;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(mastBot.x,mastBot.y);ctx.lineTo(mastTop.x,mastTop.y);ctx.stroke();
        ctx.strokeStyle=PS_MAST_L;ctx.lineWidth=0.4;ctx.beginPath();ctx.moveTo(mastBot.x-0.3,mastBot.y);ctx.lineTo(mastTop.x-0.3,mastTop.y);ctx.stroke();

        // Crow's nest
        var cnY=-11,cn1=sp(-1.5,cnY),cn2=sp(1.5,cnY),cn3=sp(1.5,cnY-0.8),cn4=sp(-1.5,cnY-0.8);
        ctx.fillStyle=PS_MAST;ctx.beginPath();ctx.moveTo(cn1.x,cn1.y);ctx.lineTo(cn2.x,cn2.y);ctx.lineTo(cn3.x,cn3.y);ctx.lineTo(cn4.x,cn4.y);ctx.closePath();ctx.fill();

        // Yard arm
        var yardL=sp(-7,-10),yardR=sp(7,-10);
        ctx.strokeStyle=PS_MAST;ctx.lineWidth=0.7;ctx.beginPath();ctx.moveTo(yardL.x,yardL.y);ctx.lineTo(yardR.x,yardR.y);ctx.stroke();

        // Sail
        var sailBillow=swingAngle*3;
        ctx.fillStyle=PS_SAIL;ctx.beginPath();
        var sTopL=sp(-6,-10),sTopR=sp(6,-10),sBotL=sp(-5,-3.5),sBotR=sp(5,-3.5);
        ctx.moveTo(sTopL.x,sTopL.y);ctx.lineTo(sTopR.x,sTopR.y);ctx.quadraticCurveTo(sp(5+sailBillow,-6.5).x,sp(5+sailBillow,-6.5).y,sBotR.x,sBotR.y);ctx.lineTo(sBotL.x,sBotL.y);ctx.quadraticCurveTo(sp(-5+sailBillow,-6.5).x,sp(-5+sailBillow,-6.5).y,sTopL.x,sTopL.y);ctx.fill();
        ctx.fillStyle=PS_SAIL_D;ctx.beginPath();
        var sMidL=sp(-5.5+sailBillow*0.5,-6),sMidR=sp(5.5+sailBillow*0.5,-6);
        ctx.moveTo(sMidL.x,sMidL.y);ctx.lineTo(sMidR.x,sMidR.y);ctx.quadraticCurveTo(sp(5+sailBillow*0.8,-4.5).x,sp(5+sailBillow*0.8,-4.5).y,sBotR.x,sBotR.y);ctx.lineTo(sBotL.x,sBotL.y);ctx.quadraticCurveTo(sp(-5+sailBillow*0.8,-4.5).x,sp(-5+sailBillow*0.8,-4.5).y,sMidL.x,sMidL.y);ctx.fill();
        ctx.strokeStyle=PS_SAIL_DK;ctx.lineWidth=0.2;for(var sc=0;sc<3;sc++){var scx=-3+sc*3;ctx.beginPath();ctx.moveTo(sp(scx,-9.5).x,sp(scx,-9.5).y);ctx.quadraticCurveTo(sp(scx+sailBillow*0.5,-6.5).x,sp(scx+sailBillow*0.5,-6.5).y,sp(scx,-3.8).x,sp(scx,-3.8).y);ctx.stroke();}

        // Skull on sail
        var skullP=sp(sailBillow*0.5,-7);ctx.fillStyle='#2a2a2a';ctx.beginPath();ctx.arc(skullP.x,skullP.y,1.3,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#2a2a2a';ctx.lineWidth=0.5;
        var cb1a=sp(-1.5+sailBillow*0.5,-5.5),cb1b=sp(1.5+sailBillow*0.5,-8),cb2a=sp(1.5+sailBillow*0.5,-5.5),cb2b=sp(-1.5+sailBillow*0.5,-8);
        ctx.beginPath();ctx.moveTo(cb1a.x,cb1a.y);ctx.lineTo(cb1b.x,cb1b.y);ctx.stroke();
        ctx.beginPath();ctx.moveTo(cb2a.x,cb2a.y);ctx.lineTo(cb2b.x,cb2b.y);ctx.stroke();
        ctx.fillStyle=PS_SAIL;ctx.fillRect(skullP.x-0.8,skullP.y-0.3,0.5,0.5);ctx.fillRect(skullP.x+0.3,skullP.y-0.3,0.5,0.5);

        // Pirate flag
        var flagBase=sp(0,-13),flagWave=Math.sin(f*0.06)*0.8+swingAngle*2;
        ctx.fillStyle=PS_FLAG_R;ctx.beginPath();
        var pf1=sp(0.5,-13),pf2=sp(5,-13.5+flagWave*0.3),pf3=sp(5,-11.5+flagWave*0.3),pf4=sp(0.5,-11);
        ctx.moveTo(pf1.x,pf1.y);ctx.quadraticCurveTo(sp(2.5,-13.2+flagWave*0.2).x,sp(2.5,-13.2+flagWave*0.2).y,pf2.x,pf2.y);ctx.lineTo(pf3.x,pf3.y);ctx.quadraticCurveTo(sp(2.5,-11.3+flagWave*0.2).x,sp(2.5,-11.3+flagWave*0.2).y,pf4.x,pf4.y);ctx.closePath();ctx.fill();
        var fskull=sp(2.5+flagWave*0.15,-12.2+flagWave*0.15);ctx.fillStyle=PS_SKULL;ctx.beginPath();ctx.arc(fskull.x,fskull.y,0.5,0,Math.PI*2);ctx.fill();

        // Rigging
        ctx.strokeStyle=PS_ROPE;ctx.lineWidth=0.25;
        ctx.beginPath();ctx.moveTo(sp(0,-10).x,sp(0,-10).y);ctx.lineTo(sp(-8,-1.5).x,sp(-8,-1.5).y);ctx.stroke();
        ctx.beginPath();ctx.moveTo(sp(0,-10).x,sp(0,-10).y);ctx.lineTo(sp(8,-1.5).x,sp(8,-1.5).y);ctx.stroke();
        ctx.beginPath();ctx.moveTo(sp(0,-12).x,sp(0,-12).y);ctx.lineTo(sp(-11,0).x,sp(-11,0).y);ctx.stroke();
        ctx.beginPath();ctx.moveTo(sp(0,-12).x,sp(0,-12).y);ctx.lineTo(sp(10,-2).x,sp(10,-2).y);ctx.stroke();

        // Passengers
        var riders=[{lx:-6,color:C.blue,hair:'#6c5043'},{lx:-3,color:C.red,hair:'#ffe94d'},{lx:0,color:C.green,hair:'#4a3020'},{lx:3,color:C.purple,hair:'#ff9c52'},{lx:6,color:C.pink,hair:'#2a2030'}];
        for(var ri=0;ri<riders.length;ri++){var r=riders[ri],rp3=sp(r.lx,-2.5);ctx.fillStyle=r.color;ctx.fillRect(rp3.x-0.7,rp3.y-0.5,1.4,1.5);ctx.fillStyle='#ffd5b8';ctx.beginPath();ctx.arc(rp3.x,rp3.y-1.2,0.7,0,Math.PI*2);ctx.fill();ctx.fillStyle=r.hair;ctx.beginPath();ctx.ellipse(rp3.x,rp3.y-1.7,0.8,0.35,0,0,Math.PI*2);ctx.fill();if(ri%2===0){var armReact=swingAngle*4;ctx.strokeStyle='#ffd5b8';ctx.lineWidth=0.35;ctx.beginPath();ctx.moveTo(rp3.x-0.7,rp3.y-0.3);ctx.lineTo(rp3.x-1.5+armReact,rp3.y-2);ctx.stroke();ctx.beginPath();ctx.moveTo(rp3.x+0.7,rp3.y-0.3);ctx.lineTo(rp3.x+1.5+armReact,rp3.y-2);ctx.stroke();}}

        // Cannons
        ctx.fillStyle=PS_IRON_D;for(var ci=0;ci<3;ci++){var cp=sp(-5+ci*5,1);ctx.fillRect(cp.x-0.3,cp.y-0.3,0.8,0.6);ctx.fillStyle=PS_IRON;ctx.fillRect(cp.x-0.5,cp.y-0.1,0.3,0.3);ctx.fillStyle=PS_IRON_D;}

        // Portholes
        ctx.fillStyle=PS_GOLD_D;for(var ph=0;ph<4;ph++){var pp=sp(-6+ph*4,0.5);ctx.beginPath();ctx.arc(pp.x,pp.y,0.5,0,Math.PI*2);ctx.fill();ctx.fillStyle=night?'rgba(255,200,80,0.5)':'rgba(120,100,60,0.3)';ctx.beginPath();ctx.arc(pp.x,pp.y,0.3,0,Math.PI*2);ctx.fill();ctx.fillStyle=PS_GOLD_D;}

        // Splash
        var splashIntensity=Math.abs(swingAngle);
        if(splashIntensity>0.15){var splashSide=swingAngle>0?1:-1,splashX=16+splashSide*8;ctx.fillStyle=PS_FOAM;ctx.globalAlpha=splashIntensity*1.5;for(var si=0;si<4;si++){var sdx2=splashX+Math.sin(f*0.1+si*1.7)*2*splashSide,sdy=27-si*1.2-splashIntensity*3;ctx.beginPath();ctx.arc(sdx2,sdy,0.4+si*0.1,0,Math.PI*2);ctx.fill();}ctx.strokeStyle=PS_FOAM;ctx.lineWidth=0.4;ctx.beginPath();ctx.moveTo(splashX-2*splashSide,28);ctx.quadraticCurveTo(splashX,26-splashIntensity*4,splashX+2*splashSide,28);ctx.stroke();ctx.globalAlpha=1;}

        // Hull lights
        var lc2=[C.yellow,C.red,C.blue,C.green,C.orange,C.purple,C.pink,C.yellow];
        for(var li=0;li<8;li++){var lx=-8+li*2.2,lp2=sp(lx,-1),pulse=0.3+0.7*Math.abs(Math.sin(f*0.04+li*0.8));if(night){ctx.globalAlpha=0.7*pulse;ctx.fillStyle=lc2[li];ctx.fillRect(Math.round(lp2.x-0.3),Math.round(lp2.y-0.3),0.8,0.8);ctx.globalAlpha=0.12*pulse;ctx.beginPath();ctx.arc(lp2.x,lp2.y,2,0,Math.PI*2);ctx.fill();}else{ctx.globalAlpha=0.3+0.5*pulse;ctx.fillStyle=lc2[li];ctx.fillRect(Math.round(lp2.x-0.3),Math.round(lp2.y-0.3),0.6,0.6);}}
        ctx.globalAlpha=1;

        // Lantern
        var lanternP=sp(0,-13.5),lanternPulse=0.5+0.5*Math.sin(f*0.06);
        if(night){ctx.fillStyle='rgba(255,220,100,0.9)';ctx.beginPath();ctx.arc(lanternP.x,lanternP.y,0.8,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,200,60,0.15)';ctx.beginPath();ctx.arc(lanternP.x,lanternP.y,3,0,Math.PI*2);ctx.fill();}else{ctx.fillStyle=PS_GOLD;ctx.beginPath();ctx.arc(lanternP.x,lanternP.y,0.5,0,Math.PI*2);ctx.fill();}

        // Night glow
        if(night){ctx.fillStyle='rgba(255,180,60,0.05)';ctx.beginPath();ctx.ellipse(16,17,14,12,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,200,80,0.06)';ctx.beginPath();ctx.ellipse(16,28.5,8,2,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(200,210,255,0.08)';ctx.beginPath();ctx.arc(28,2,4,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(230,235,255,0.4)';ctx.beginPath();ctx.arc(28,2,1.2,0,Math.PI*2);ctx.fill();}

        // Seagulls
        if(!night){ctx.strokeStyle='#555';ctx.lineWidth=0.3;for(var gi=0;gi<2;gi++){var gx=5+gi*18+Math.sin(f*0.015+gi*3)*3,gy=1+Math.sin(f*0.02+gi*2)*1.5,wingF=Math.sin(f*0.08+gi*2)*0.8;ctx.beginPath();ctx.moveTo(gx-1.5,gy+wingF);ctx.lineTo(gx,gy);ctx.lineTo(gx+1.5,gy+wingF);ctx.stroke();}}

        ctx.restore();
    }
    function drawObservationTower(x, y) { const night = getDayPart() === 'night'; const f = (G.paused || night) ? 0 : G.frame; drawGrass(x, y); parkCtx.fillStyle = '#666'; parkCtx.fillRect(x * TILE_SIZE + 12, y * TILE_SIZE + 8, 8, 22); parkCtx.fillStyle = '#888'; for (let i = 0; i < 5; i++) parkCtx.fillRect(x * TILE_SIZE + 10, y * TILE_SIZE + 10 + i * 4, 12, 2); const cabY = y * TILE_SIZE + 6 + (night ? 0 : Math.sin(f * 0.02) * 4); parkCtx.fillStyle = '#444'; parkCtx.beginPath(); parkCtx.roundRect(x * TILE_SIZE + 6, cabY, 20, 10, 3); parkCtx.fill(); parkCtx.fillStyle = C.blue; parkCtx.fillRect(x * TILE_SIZE + 8, cabY + 2, 6, 5); parkCtx.fillRect(x * TILE_SIZE + 18, cabY + 2, 6, 5); parkCtx.fillStyle = C.red; parkCtx.fillRect(x * TILE_SIZE + 10, y * TILE_SIZE + 2, 12, 5); }
    
    // Coasters (animations stop at night)
    // Wild Mouse track data and helpers
    var _wmTrackPts = [
        {x:8,y:58,h:0},{x:8,y:54,h:0},{x:8,y:49,h:1.5},{x:8,y:44,h:3},{x:8,y:39,h:4.5},
        {x:8,y:34,h:6},{x:8,y:29,h:7},{x:8,y:24,h:7.5},{x:14,y:22,h:8},{x:24,y:21,h:8},
        {x:34,y:21,h:8},{x:44,y:22,h:8},{x:50,y:25,h:7.5},{x:50,y:29,h:7},{x:44,y:31,h:6.5},
        {x:34,y:31,h:6.5},{x:24,y:32,h:6},{x:16,y:33,h:6},{x:12,y:36,h:5.5},{x:12,y:40,h:5},
        {x:18,y:42,h:4.5},{x:28,y:42,h:4},{x:38,y:42,h:4},{x:48,y:43,h:3.5},{x:54,y:46,h:3},
        {x:54,y:49,h:2},{x:48,y:50,h:1.5},{x:40,y:50,h:1},{x:32,y:52,h:2},{x:26,y:54,h:3.5},
        {x:22,y:56,h:1},{x:30,y:55,h:2.5},{x:38,y:54,h:0.8},{x:44,y:53,h:2},{x:50,y:56,h:0.5},
        {x:54,y:58,h:0.3},{x:46,y:59,h:0.2},{x:36,y:59,h:0.1},{x:26,y:59,h:0},{x:16,y:58,h:0},
        {x:8,y:58,h:0}
    ];
    function _wmCatmull(p0,p1,p2,p3,t){return 0.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t);}
    var _wmPath = (function(){
        var pts=_wmTrackPts, path=[], N=500;
        for(var s=0;s<N;s++){
            var t=s/N, pos=t*(pts.length-1), i=Math.floor(pos), frac=pos-i;
            var p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[Math.min(pts.length-1,i+1)],p3=pts[Math.min(pts.length-1,i+2)];
            path.push({x:_wmCatmull(p0.x,p1.x,p2.x,p3.x,frac),y:_wmCatmull(p0.y,p1.y,p2.y,p3.y,frac),h:_wmCatmull(p0.h,p1.h,p2.h,p3.h,frac)});
        }
        return path;
    })();

    function drawWildMouse(x, y) {
        var night = getDayPart() === 'night';
        var f = (G.paused || night) ? 0 : G.frame;
        var px = x * TILE_SIZE, py = y * TILE_SIZE;
        var ctx = parkCtx;
        var PATH = _wmPath;
        var WM='#f0a030',WM_D='#c07820',WM_L='#ffc060',WM_A='#ffe94d';
        var CAR_C=['#4ecdc4','#ff6b6b','#9b6bff'];
        var STL='#7a7a8a',STL_L='#9a9aaa',STL_D='#5a5a6a';

        // Draw grass 2x2
        drawGrass(x,y); drawGrass(x+1,y); drawGrass(x,y+1); drawGrass(x+1,y+1);

        function proj(p){return{x:px+p.x, y:py+p.y-p.h*1.3};}
        function tang(idx){var ni=(idx+2)%PATH.length;var a=proj(PATH[idx]),b=proj(PATH[ni]);var dx=b.x-a.x,dy=b.y-a.y;var len=Math.sqrt(dx*dx+dy*dy)||1;return{dx:dx/len,dy:dy/len};}

        // Ground shadow
        ctx.fillStyle='rgba(0,40,20,0.18)';
        ctx.beginPath();ctx.ellipse(px+32,py+60,28,4,0,0,Math.PI*2);ctx.fill();

        // Support columns
        var suppIdx=[20,50,80,110,140,175,205,235,260,290,320,355,380,410];
        suppIdx.forEach(function(si){
            var p=PATH[si%PATH.length],pr=proj(p);
            var groundY=py+p.y+2,topY=pr.y+1;
            if(groundY-topY<3)return;
            ctx.fillStyle=STL;ctx.fillRect(pr.x-0.7,topY,1.5,groundY-topY);
            ctx.fillStyle=STL_L;ctx.fillRect(pr.x-0.7,topY,0.5,groundY-topY);
            ctx.strokeStyle=STL_D;ctx.lineWidth=0.3;
            var bC=Math.floor((groundY-topY)/8);
            for(var bi=1;bi<=bC;bi++){var by=topY+bi*8;ctx.beginPath();ctx.moveTo(pr.x-2,by);ctx.lineTo(pr.x+2,by-3);ctx.stroke();ctx.beginPath();ctx.moveTo(pr.x+2,by);ctx.lineTo(pr.x-2,by-3);ctx.stroke();}
            ctx.fillStyle=STL_D;ctx.fillRect(pr.x-2,groundY-0.5,4,1.5);
        });

        // Lift chain
        ctx.strokeStyle='#555';ctx.lineWidth=0.3;
        for(var li=0;li<16;li++){var lIdx=Math.floor((li/16)*70)+10;var lp=proj(PATH[lIdx%PATH.length]);ctx.beginPath();ctx.moveTo(lp.x-1.5,lp.y+0.5);ctx.lineTo(lp.x+1.5,lp.y-0.5);ctx.stroke();}

        // Rail shadow
        ctx.strokeStyle='rgba(0,0,0,0.08)';ctx.lineWidth=2.5;
        ctx.beginPath();PATH.forEach(function(p,i){var pt={x:px+p.x,y:py+p.y+2};if(i===0)ctx.moveTo(pt.x,pt.y);else ctx.lineTo(pt.x,pt.y);});ctx.stroke();

        // Left rail
        ctx.strokeStyle=STL;ctx.lineWidth=1.2;
        ctx.beginPath();PATH.forEach(function(p,i){var pr=proj(p),t=tang(i);var nx=-t.dy*1,ny=t.dx*1;if(i===0)ctx.moveTo(pr.x+nx,pr.y+ny);else ctx.lineTo(pr.x+nx,pr.y+ny);});ctx.stroke();
        // Right rail
        ctx.strokeStyle=STL_L;ctx.lineWidth=1;
        ctx.beginPath();PATH.forEach(function(p,i){var pr=proj(p),t=tang(i);var nx=t.dy*1,ny=-t.dx*1;if(i===0)ctx.moveTo(pr.x+nx,pr.y+ny);else ctx.lineTo(pr.x+nx,pr.y+ny);});ctx.stroke();
        // Center guide rail
        ctx.strokeStyle=WM;ctx.lineWidth=0.6;
        ctx.beginPath();PATH.forEach(function(p,i){var pr=proj(p);if(i===0)ctx.moveTo(pr.x,pr.y);else ctx.lineTo(pr.x,pr.y);});ctx.stroke();

        // Cross-ties
        ctx.strokeStyle=STL_D;ctx.lineWidth=0.5;
        for(var ti=0;ti<PATH.length;ti+=10){var p=PATH[ti],pr=proj(p),t=tang(ti);var nx=-t.dy*2,ny=t.dx*2;ctx.beginPath();ctx.moveTo(pr.x+nx,pr.y+ny);ctx.lineTo(pr.x-nx,pr.y-ny);ctx.stroke();}

        // Hairpin markers
        var turnIdxs=[130,200,260];
        turnIdxs.forEach(function(ti){var pp=proj(PATH[ti%PATH.length]);var pulse=0.4+0.5*Math.abs(Math.sin(f*0.07));ctx.globalAlpha=pulse;ctx.fillStyle=C.yellow;ctx.beginPath();ctx.moveTo(pp.x-2,pp.y-1);ctx.lineTo(pp.x+1,pp.y);ctx.lineTo(pp.x-2,pp.y+1);ctx.closePath();ctx.fill();ctx.globalAlpha=1;});

        // Animated cars
        var numCars=3,loopLen=PATH.length,carSpeed=night?0:1.2;
        for(var ci=0;ci<numCars;ci++){
            var carIdx=Math.floor((f*carSpeed+ci*(loopLen/numCars))%loopLen);
            var p=PATH[carIdx],pr=proj(p),t=tang(carIdx);
            var angle=Math.atan2(t.dy,t.dx);
            var col=CAR_C[ci];
            ctx.save();ctx.translate(pr.x,pr.y);ctx.rotate(angle);
            ctx.fillStyle='rgba(0,0,0,0.2)';ctx.beginPath();ctx.ellipse(0,4,3.5,1.2,0,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#333';ctx.fillRect(-3.5,2.5,2,1.2);ctx.fillRect(1.5,2.5,2,1.2);
            ctx.fillStyle=col;ctx.beginPath();ctx.roundRect(-4,-3,8,6,2);ctx.fill();
            ctx.fillStyle=shadeColor(col,-35);ctx.beginPath();ctx.roundRect(-3.5,-3.5,7,2,1);ctx.fill();
            ctx.fillStyle=shadeColor(col,30);ctx.fillRect(3,-2,1.2,4);
            ctx.fillStyle='rgba(200,240,255,0.5)';ctx.fillRect(2,-1.5,1.5,3);
            ctx.fillStyle=WM_A;ctx.fillRect(-3.5,1,7,0.6);
            ctx.fillStyle=C.yellow;ctx.fillRect(3.5,-1,0.8,0.6);ctx.fillRect(3.5,0.5,0.8,0.6);
            ctx.restore();
            // Upright riders
            ctx.fillStyle='#ffd5b8';
            ctx.beginPath();ctx.arc(pr.x-1.5,pr.y-6,1.5,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.arc(pr.x+1.2,pr.y-6,1.5,0,Math.PI*2);ctx.fill();
            ctx.fillStyle=ci===0?'#6c5043':ci===1?'#ffe94d':'#3c2820';
            ctx.beginPath();ctx.ellipse(pr.x-1.5,pr.y-7.2,1.8,0.8,0,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.ellipse(pr.x+1.2,pr.y-7.2,1.8,0.8,0,0,Math.PI*2);ctx.fill();
        }

        // Track lights
        var lc2=[C.yellow,WM_A,C.blue,C.green,C.orange,WM_A,C.red,C.yellow,C.blue,C.green,WM_A,C.orange,C.yellow,C.green];
        for(var tli=0;tli<14;tli++){var lIdx2=(tli*35)%PATH.length;var lp2=proj(PATH[lIdx2]);
            if(night){ctx.globalAlpha=0.5+0.5*Math.abs(Math.sin(f*0.04+tli*0.8));ctx.fillStyle=lc2[tli%lc2.length];ctx.fillRect(Math.round(lp2.x-0.5),Math.round(lp2.y-2),1,1);ctx.globalAlpha=0.12;ctx.beginPath();ctx.arc(lp2.x,lp2.y-1.5,3,0,Math.PI*2);ctx.fill();}
            else{ctx.globalAlpha=0.3+0.6*Math.abs(Math.sin(f*0.05+tli*1.1));ctx.fillStyle=lc2[tli%lc2.length];ctx.fillRect(Math.round(lp2.x-0.5),Math.round(lp2.y-2),1,1);}
        }
        ctx.globalAlpha=1;

        // Night glow
        if(night){ctx.fillStyle='rgba(240,160,48,0.06)';ctx.beginPath();ctx.ellipse(px+32,py+30,30,25,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,233,77,0.05)';ctx.beginPath();ctx.ellipse(px+10,py+40,10,8,0,0,Math.PI*2);ctx.fill();}

        // Station gate (drawn LAST — always on top)
        ctx.fillStyle='#6a5a4a';ctx.beginPath();ctx.roundRect(px+1,py+52,16,11,2);ctx.fill();
        ctx.fillStyle='#7a6a5a';ctx.fillRect(px+2,py+52,14,1.5);
        ctx.fillStyle='#2a2020';ctx.beginPath();ctx.roundRect(px+4,py+53,10,7,1);ctx.fill();
        ctx.fillStyle='#1a1515';ctx.fillRect(px+5,py+53,8,2);
        ctx.fillStyle='#6a5a4a';ctx.beginPath();ctx.arc(px+9,py+53,5,Math.PI,0,false);ctx.lineTo(px+14,py+53);ctx.lineTo(px+4,py+53);ctx.closePath();ctx.fill();
        ctx.strokeStyle='#8a7a6a';ctx.lineWidth=0.5;ctx.beginPath();ctx.arc(px+9,py+53,5,Math.PI,0,false);ctx.stroke();
        ctx.fillStyle='#8a7a6a';ctx.fillRect(px+2,py+49,3,14);ctx.fillRect(px+13,py+49,3,14);
        ctx.fillStyle='#9a8a7a';ctx.fillRect(px+2,py+49,1,14);ctx.fillRect(px+13,py+49,1,14);
        ctx.fillStyle='#a09080';ctx.beginPath();ctx.roundRect(px+1.5,py+47,4,3,0.8);ctx.fill();ctx.beginPath();ctx.roundRect(px+12.5,py+47,4,3,0.8);ctx.fill();
        ctx.fillStyle=WM;ctx.beginPath();ctx.roundRect(px+0,py+44,18,4.5,1.5);ctx.fill();
        ctx.fillStyle=WM_L;ctx.fillRect(px+1,py+44,16,1.5);
        ctx.fillStyle=WM_D;ctx.fillRect(px+1,py+47.5,16,1);
        for(var ri=0;ri<4;ri++){ctx.fillStyle=ri%2?WM_L:WM_D;ctx.fillRect(px+1+ri*4,py+44.5,3.5,3);}
        ctx.fillStyle=WM_D;ctx.beginPath();ctx.arc(px+5,py+43,2.2,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(px+13,py+43,2.2,0,Math.PI*2);ctx.fill();
        ctx.fillStyle=WM;ctx.beginPath();ctx.arc(px+5,py+43,1.3,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(px+13,py+43,1.3,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#cc3030';ctx.beginPath();ctx.roundRect(px+3,py+48.5,12,2.5,0.6);ctx.fill();
        ctx.fillStyle=C.yellow;ctx.fillRect(px+4.5,py+49,1,0.8);ctx.fillRect(px+6,py+49,1,0.8);ctx.fillRect(px+7.5,py+49,1,0.8);ctx.fillRect(px+9,py+49,1,0.8);ctx.fillRect(px+10.5,py+49,1,0.8);ctx.fillRect(px+12,py+49,1,0.8);
        var gP=0.4+0.5*Math.abs(Math.sin(f*0.06));
        if(night){ctx.globalAlpha=0.7;ctx.fillStyle=C.yellow;ctx.beginPath();ctx.arc(px+3.5,py+47,1,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(px+14.5,py+47,1,0,Math.PI*2);ctx.fill();ctx.globalAlpha=0.15;ctx.beginPath();ctx.arc(px+3.5,py+47,3.5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(px+14.5,py+47,3.5,0,Math.PI*2);ctx.fill();}
        else{ctx.globalAlpha=gP;ctx.fillStyle=C.yellow;ctx.beginPath();ctx.arc(px+3.5,py+47,0.8,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(px+14.5,py+47,0.8,0,Math.PI*2);ctx.fill();}
        ctx.globalAlpha=1;
    }

    // ==================== SHARED COASTER SYSTEM ====================
    
    function _catmull(p0,p1,p2,p3,t){return 0.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t);}
    
    function _buildPath(pts, N) {
        var path = [], n = N || 500;
        for (var s = 0; s < n; s++) {
            var t = s/n, pos = t*(pts.length-1), i = Math.floor(pos), frac = pos - i;
            var p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[Math.min(pts.length-1,i+1)],p3=pts[Math.min(pts.length-1,i+2)];
            path.push({x:_catmull(p0.x,p1.x,p2.x,p3.x,frac),y:_catmull(p0.y,p1.y,p2.y,p3.y,frac),h:_catmull(p0.h,p1.h,p2.h,p3.h,frac)});
        }
        return path;
    }
    
    // --- JUNIOR COASTER: gentle hills, wide turns, kid-friendly ---
    var _jcTrack = [
        {x:8,y:58,h:0},{x:8,y:52,h:0.5},{x:8,y:46,h:1.5},{x:8,y:40,h:3},{x:10,y:34,h:4},
        {x:14,y:28,h:5},{x:20,y:24,h:5.5},{x:28,y:22,h:5},{x:36,y:24,h:4},{x:40,y:28,h:3},
        {x:38,y:32,h:3.5},{x:32,y:34,h:4.5},{x:26,y:32,h:4},{x:22,y:35,h:3},{x:24,y:39,h:2},
        {x:30,y:40,h:2.5},{x:38,y:39,h:3.5},{x:46,y:38,h:4},{x:52,y:40,h:3},{x:54,y:44,h:2},
        {x:50,y:48,h:2.5},{x:44,y:50,h:3},{x:38,y:48,h:2},{x:32,y:50,h:1.5},{x:26,y:52,h:1},
        {x:20,y:54,h:0.5},{x:14,y:56,h:0.3},{x:8,y:58,h:0}
    ];
    var _jcPath = _buildPath(_jcTrack, 400);
    
    function drawJuniorCoaster(x, y) {
        var night = getDayPart() === 'night';
        var f = (G.paused || night) ? 0 : G.frame;
        var px = x * TILE_SIZE, py = y * TILE_SIZE;
        var ctx = parkCtx;
        var PATH = _jcPath;
        var TC='#4ecdc4',TC_D='#3ab0a8',TC_L='#7aded8',TC_A='#a0efe8';
        var STL='#7a8a8a',STL_L='#9aadad',STL_D='#5a6a6a';
        var CAR_C=['#ffe94d','#ff9a52','#7bdb87'];
        
        drawGrass(x,y); drawGrass(x+1,y); drawGrass(x,y+1); drawGrass(x+1,y+1);
        
        function proj(p){return{x:px+p.x, y:py+p.y-p.h*1.3};}
        function tang(idx){var ni=(idx+2)%PATH.length;var a=proj(PATH[idx]),b=proj(PATH[ni]);var dx=b.x-a.x,dy=b.y-a.y;var len=Math.sqrt(dx*dx+dy*dy)||1;return{dx:dx/len,dy:dy/len};}
        
        // Ground shadow
        ctx.fillStyle='rgba(0,40,20,0.15)';
        ctx.beginPath();ctx.ellipse(px+32,py+60,26,4,0,0,Math.PI*2);ctx.fill();
        
        // Supports - colorful tubular steel
        var suppIdx=[15,40,65,90,120,150,180,210,240,270,300,340,370];
        suppIdx.forEach(function(si){
            var p=PATH[si%PATH.length],pr=proj(p);
            var groundY=py+p.y+2,topY=pr.y+1;
            if(groundY-topY<3)return;
            ctx.fillStyle=TC_D;ctx.fillRect(pr.x-0.8,topY,1.6,groundY-topY);
            ctx.fillStyle=TC;ctx.fillRect(pr.x-0.8,topY,0.6,groundY-topY);
            ctx.fillStyle=STL_D;ctx.fillRect(pr.x-2,groundY-0.5,4,1.2);
        });
        
        // Rails
        ctx.strokeStyle=STL;ctx.lineWidth=1.0;
        ctx.beginPath();PATH.forEach(function(p,i){var pr=proj(p),t=tang(i);var nx=-t.dy*1.2,ny=t.dx*1.2;if(i===0)ctx.moveTo(pr.x+nx,pr.y+ny);else ctx.lineTo(pr.x+nx,pr.y+ny);});ctx.stroke();
        ctx.strokeStyle=STL_L;ctx.lineWidth=0.8;
        ctx.beginPath();PATH.forEach(function(p,i){var pr=proj(p),t=tang(i);var nx=t.dy*1.2,ny=-t.dx*1.2;if(i===0)ctx.moveTo(pr.x+nx,pr.y+ny);else ctx.lineTo(pr.x+nx,pr.y+ny);});ctx.stroke();
        // Center guide
        ctx.strokeStyle=TC;ctx.lineWidth=0.5;
        ctx.beginPath();PATH.forEach(function(p,i){var pr=proj(p);if(i===0)ctx.moveTo(pr.x,pr.y);else ctx.lineTo(pr.x,pr.y);});ctx.stroke();
        
        // Cross-ties
        ctx.strokeStyle=STL_D;ctx.lineWidth=0.4;
        for(var ti=0;ti<PATH.length;ti+=12){var p=PATH[ti],pr=proj(p),t=tang(ti);var nx=-t.dy*2,ny=t.dx*2;ctx.beginPath();ctx.moveTo(pr.x+nx,pr.y+ny);ctx.lineTo(pr.x-nx,pr.y-ny);ctx.stroke();}
        
        // Animated cars (3 cars, slower speed)
        var numCars=3,loopLen=PATH.length,carSpeed=night?0:0.8;
        for(var ci=0;ci<numCars;ci++){
            var carIdx=Math.floor((f*carSpeed+ci*(loopLen/numCars))%loopLen);
            var p=PATH[carIdx],pr=proj(p),t=tang(carIdx);
            var angle=Math.atan2(t.dy,t.dx);
            var col=CAR_C[ci];
            ctx.save();ctx.translate(pr.x,pr.y);ctx.rotate(angle);
            ctx.fillStyle='rgba(0,0,0,0.15)';ctx.beginPath();ctx.ellipse(0,3.5,3,1,0,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#444';ctx.fillRect(-3,2,1.5,1);ctx.fillRect(1.5,2,1.5,1);
            ctx.fillStyle=col;ctx.beginPath();ctx.roundRect(-3.5,-2.5,7,5,2);ctx.fill();
            ctx.fillStyle=shadeColor(col,-30);ctx.beginPath();ctx.roundRect(-3,-3,6,1.8,1);ctx.fill();
            ctx.fillStyle=shadeColor(col,35);ctx.fillRect(2.5,-1.5,1,3);
            ctx.fillStyle='rgba(200,240,255,0.4)';ctx.fillRect(2,-1,1.2,2.5);
            ctx.restore();
            ctx.fillStyle='#ffd5b8';
            ctx.beginPath();ctx.arc(pr.x-1,pr.y-5,1.4,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.arc(pr.x+1,pr.y-5,1.4,0,Math.PI*2);ctx.fill();
            ctx.fillStyle=ci===0?'#6c5043':ci===1?'#ffe94d':'#3c2820';
            ctx.beginPath();ctx.ellipse(pr.x-1,pr.y-6,1.6,0.7,0,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.ellipse(pr.x+1,pr.y-6,1.6,0.7,0,0,Math.PI*2);ctx.fill();
        }
        
        // Track lights
        for(var tli=0;tli<10;tli++){var lIdx=(tli*40)%PATH.length;var lp=proj(PATH[lIdx]);
            if(night){ctx.globalAlpha=0.5+0.5*Math.abs(Math.sin(f*0.04+tli*0.9));ctx.fillStyle=[C.yellow,TC_A,C.green,C.blue][tli%4];ctx.fillRect(Math.round(lp.x-0.5),Math.round(lp.y-2),1,1);ctx.globalAlpha=0.1;ctx.beginPath();ctx.arc(lp.x,lp.y-1.5,3,0,Math.PI*2);ctx.fill();}
            else{ctx.globalAlpha=0.3+0.5*Math.abs(Math.sin(f*0.05+tli*1.2));ctx.fillStyle=[C.yellow,TC_A][tli%2];ctx.fillRect(Math.round(lp.x-0.5),Math.round(lp.y-2),1,1);}
        }ctx.globalAlpha=1;
        
        if(night){ctx.fillStyle='rgba(78,205,196,0.06)';ctx.beginPath();ctx.ellipse(px+32,py+30,28,22,0,0,Math.PI*2);ctx.fill();}
        
        // Station - cheerful kid-friendly arch
        ctx.fillStyle='#6a5a4a';ctx.beginPath();ctx.roundRect(px+1,py+52,16,11,2);ctx.fill();
        ctx.fillStyle='#7a6a5a';ctx.fillRect(px+2,py+52,14,1.5);
        ctx.fillStyle='#2a2020';ctx.beginPath();ctx.roundRect(px+4,py+53,10,7,1);ctx.fill();
        ctx.fillStyle='#6a5a4a';ctx.beginPath();ctx.arc(px+9,py+53,5,Math.PI,0,false);ctx.lineTo(px+14,py+53);ctx.lineTo(px+4,py+53);ctx.closePath();ctx.fill();
        ctx.strokeStyle='#8a7a6a';ctx.lineWidth=0.5;ctx.beginPath();ctx.arc(px+9,py+53,5,Math.PI,0,false);ctx.stroke();
        ctx.fillStyle='#8a7a6a';ctx.fillRect(px+2,py+49,3,14);ctx.fillRect(px+13,py+49,3,14);
        ctx.fillStyle='#9a8a7a';ctx.fillRect(px+2,py+49,1,14);ctx.fillRect(px+13,py+49,1,14);
        ctx.fillStyle='#a09080';ctx.beginPath();ctx.roundRect(px+1.5,py+47,4,3,0.8);ctx.fill();ctx.beginPath();ctx.roundRect(px+12.5,py+47,4,3,0.8);ctx.fill();
        ctx.fillStyle=TC;ctx.beginPath();ctx.roundRect(px+0,py+44,18,4.5,1.5);ctx.fill();
        ctx.fillStyle=TC_L;ctx.fillRect(px+1,py+44,16,1.5);
        ctx.fillStyle=TC_D;ctx.fillRect(px+1,py+47.5,16,1);
        for(var ri=0;ri<4;ri++){ctx.fillStyle=ri%2?TC_L:TC_D;ctx.fillRect(px+1+ri*4,py+44.5,3.5,3);}
        // Stars on sign
        ctx.fillStyle=C.yellow;
        ctx.beginPath();ctx.arc(px+5,py+43,1.5,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(px+13,py+43,1.5,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(px+9,py+42,1.8,0,Math.PI*2);ctx.fill();
        // Gate lights
        var gP=0.4+0.5*Math.abs(Math.sin(f*0.06));
        if(night){ctx.globalAlpha=0.7;ctx.fillStyle=C.yellow;ctx.beginPath();ctx.arc(px+3.5,py+47,1,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(px+14.5,py+47,1,0,Math.PI*2);ctx.fill();ctx.globalAlpha=0.15;ctx.beginPath();ctx.arc(px+3.5,py+47,3.5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(px+14.5,py+47,3.5,0,Math.PI*2);ctx.fill();}
        else{ctx.globalAlpha=gP;ctx.fillStyle=C.yellow;ctx.beginPath();ctx.arc(px+3.5,py+47,0.8,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(px+14.5,py+47,0.8,0,Math.PI*2);ctx.fill();}
        ctx.globalAlpha=1;
    }
    
    // --- STEEL COASTER: sleek, loop, inversions ---
    var _scTrack = [
        {x:8,y:58,h:0},{x:8,y:54,h:0},{x:8,y:48,h:2},{x:8,y:42,h:4},{x:8,y:36,h:6},
        {x:8,y:30,h:8},{x:8,y:24,h:10},{x:12,y:20,h:11},{x:18,y:18,h:11.5},{x:26,y:18,h:11},
        {x:34,y:20,h:10},{x:38,y:24,h:8},{x:40,y:28,h:5},{x:42,y:32,h:2},{x:44,y:36,h:0.5},
        {x:46,y:32,h:3},{x:48,y:28,h:6},{x:48,y:24,h:9},{x:46,y:21,h:10.5},{x:42,y:20,h:10},
        {x:40,y:23,h:8},{x:40,y:27,h:5},{x:42,y:30,h:3},{x:46,y:32,h:2},
        {x:52,y:34,h:3},{x:56,y:38,h:4},{x:56,y:44,h:3},{x:52,y:48,h:2},
        {x:46,y:50,h:2.5},{x:40,y:48,h:3},{x:34,y:46,h:2},{x:28,y:48,h:1.5},
        {x:22,y:50,h:1},{x:16,y:54,h:0.5},{x:10,y:57,h:0.2},{x:8,y:58,h:0}
    ];
    var _scPath = _buildPath(_scTrack, 500);
    
    function drawSteelCoaster(x, y) {
        var night = getDayPart() === 'night';
        var f = (G.paused || night) ? 0 : G.frame;
        var px = x * TILE_SIZE, py = y * TILE_SIZE;
        var ctx = parkCtx;
        var PATH = _scPath;
        var TC='#7b68ee',TC_D='#5a48cc',TC_L='#9d8eff',TC_A='#c0b0ff';
        var STL='#888898',STL_L='#a8a8b8',STL_D='#686878';
        var CAR_C=['#ff4444','#3344ff','#ffcc00'];
        
        drawGrass(x,y); drawGrass(x+1,y); drawGrass(x,y+1); drawGrass(x+1,y+1);
        
        function proj(p){return{x:px+p.x, y:py+p.y-p.h*1.3};}
        function tang(idx){var ni=(idx+2)%PATH.length;var a=proj(PATH[idx]),b=proj(PATH[ni]);var dx=b.x-a.x,dy=b.y-a.y;var len=Math.sqrt(dx*dx+dy*dy)||1;return{dx:dx/len,dy:dy/len};}
        
        ctx.fillStyle='rgba(0,20,40,0.18)';
        ctx.beginPath();ctx.ellipse(px+32,py+60,28,4,0,0,Math.PI*2);ctx.fill();
        
        // Sleek steel supports
        var suppIdx=[20,50,80,115,145,175,210,245,275,310,345,380,420,460];
        suppIdx.forEach(function(si){
            var p=PATH[si%PATH.length],pr=proj(p);
            var groundY=py+p.y+2,topY=pr.y+1;
            if(groundY-topY<3)return;
            ctx.fillStyle=STL;ctx.fillRect(pr.x-0.6,topY,1.2,groundY-topY);
            ctx.fillStyle=STL_L;ctx.fillRect(pr.x-0.6,topY,0.4,groundY-topY);
            // X-bracing
            ctx.strokeStyle=STL_D;ctx.lineWidth=0.3;
            var bC=Math.floor((groundY-topY)/7);
            for(var bi=1;bi<=bC;bi++){var by=topY+bi*7;ctx.beginPath();ctx.moveTo(pr.x-2,by);ctx.lineTo(pr.x+2,by-3);ctx.stroke();ctx.beginPath();ctx.moveTo(pr.x+2,by);ctx.lineTo(pr.x-2,by-3);ctx.stroke();}
            ctx.fillStyle=STL_D;ctx.fillRect(pr.x-2,groundY-0.5,4,1.2);
        });
        
        // Lift chain
        ctx.strokeStyle='#555';ctx.lineWidth=0.3;
        for(var li=0;li<18;li++){var lIdx=Math.floor((li/18)*100)+10;var lp=proj(PATH[lIdx%PATH.length]);ctx.beginPath();ctx.moveTo(lp.x-1.5,lp.y+0.5);ctx.lineTo(lp.x+1.5,lp.y-0.5);ctx.stroke();}
        
        // Rail shadow
        ctx.strokeStyle='rgba(0,0,0,0.07)';ctx.lineWidth=2.5;
        ctx.beginPath();PATH.forEach(function(p,i){var pt={x:px+p.x,y:py+p.y+2};if(i===0)ctx.moveTo(pt.x,pt.y);else ctx.lineTo(pt.x,pt.y);});ctx.stroke();
        
        // Rails - twin tubes
        ctx.strokeStyle=STL;ctx.lineWidth=1.1;
        ctx.beginPath();PATH.forEach(function(p,i){var pr=proj(p),t=tang(i);var nx=-t.dy*1.2,ny=t.dx*1.2;if(i===0)ctx.moveTo(pr.x+nx,pr.y+ny);else ctx.lineTo(pr.x+nx,pr.y+ny);});ctx.stroke();
        ctx.strokeStyle=STL_L;ctx.lineWidth=0.9;
        ctx.beginPath();PATH.forEach(function(p,i){var pr=proj(p),t=tang(i);var nx=t.dy*1.2,ny=-t.dx*1.2;if(i===0)ctx.moveTo(pr.x+nx,pr.y+ny);else ctx.lineTo(pr.x+nx,pr.y+ny);});ctx.stroke();
        // Center spine
        ctx.strokeStyle=TC;ctx.lineWidth=0.7;
        ctx.beginPath();PATH.forEach(function(p,i){var pr=proj(p);if(i===0)ctx.moveTo(pr.x,pr.y);else ctx.lineTo(pr.x,pr.y);});ctx.stroke();
        
        // Cross-ties
        ctx.strokeStyle=STL_D;ctx.lineWidth=0.4;
        for(var ti=0;ti<PATH.length;ti+=10){var p=PATH[ti],pr=proj(p),t=tang(ti);var nx=-t.dy*2,ny=t.dx*2;ctx.beginPath();ctx.moveTo(pr.x+nx,pr.y+ny);ctx.lineTo(pr.x-nx,pr.y-ny);ctx.stroke();}
        
        // Animated cars (3 sleek trains)
        var numCars=3,loopLen=PATH.length,carSpeed=night?0:1.3;
        for(var ci=0;ci<numCars;ci++){
            var carIdx=Math.floor((f*carSpeed+ci*(loopLen/numCars))%loopLen);
            var p=PATH[carIdx],pr=proj(p),t=tang(carIdx);
            var angle=Math.atan2(t.dy,t.dx);
            var col=CAR_C[ci];
            ctx.save();ctx.translate(pr.x,pr.y);ctx.rotate(angle);
            ctx.fillStyle='rgba(0,0,0,0.2)';ctx.beginPath();ctx.ellipse(0,4,3.5,1.2,0,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#333';ctx.fillRect(-3.5,2.5,2,1.2);ctx.fillRect(1.5,2.5,2,1.2);
            ctx.fillStyle=col;ctx.beginPath();ctx.roundRect(-4.5,-3,9,6,1.5);ctx.fill();
            ctx.fillStyle=shadeColor(col,-40);ctx.beginPath();ctx.roundRect(-4,-3.5,8,2,1);ctx.fill();
            ctx.fillStyle=shadeColor(col,30);ctx.fillRect(3.5,-2,1.2,4);
            ctx.fillStyle='rgba(200,230,255,0.5)';ctx.fillRect(3,-1.5,1.5,3);
            ctx.fillStyle=TC_A;ctx.fillRect(-4,1.5,8,0.5);
            ctx.restore();
            ctx.fillStyle='#ffd5b8';
            ctx.beginPath();ctx.arc(pr.x-1.5,pr.y-6,1.5,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.arc(pr.x+1.2,pr.y-6,1.5,0,Math.PI*2);ctx.fill();
            ctx.fillStyle=ci===0?'#6c5043':ci===1?'#ffe94d':'#3c2820';
            ctx.beginPath();ctx.ellipse(pr.x-1.5,pr.y-7.2,1.8,0.7,0,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.ellipse(pr.x+1.2,pr.y-7.2,1.8,0.7,0,0,Math.PI*2);ctx.fill();
        }
        
        // Track lights
        var lc=[C.yellow,TC_A,C.blue,TC_L,C.green,TC_A,C.red,C.yellow];
        for(var tli=0;tli<12;tli++){var lIdx=(tli*42)%PATH.length;var lp=proj(PATH[lIdx]);
            if(night){ctx.globalAlpha=0.5+0.5*Math.abs(Math.sin(f*0.04+tli*0.8));ctx.fillStyle=lc[tli%lc.length];ctx.fillRect(Math.round(lp.x-0.5),Math.round(lp.y-2),1,1);ctx.globalAlpha=0.12;ctx.beginPath();ctx.arc(lp.x,lp.y-1.5,3,0,Math.PI*2);ctx.fill();}
            else{ctx.globalAlpha=0.3+0.6*Math.abs(Math.sin(f*0.05+tli*1.1));ctx.fillStyle=lc[tli%lc.length];ctx.fillRect(Math.round(lp.x-0.5),Math.round(lp.y-2),1,1);}
        }ctx.globalAlpha=1;
        
        if(night){ctx.fillStyle='rgba(123,104,238,0.06)';ctx.beginPath();ctx.ellipse(px+32,py+30,30,25,0,0,Math.PI*2);ctx.fill();}
        
        // Station - sleek modern steel design
        ctx.fillStyle='#5a5a6a';ctx.beginPath();ctx.roundRect(px+1,py+52,16,11,2);ctx.fill();
        ctx.fillStyle='#6a6a7a';ctx.fillRect(px+2,py+52,14,1.5);
        ctx.fillStyle='#1a1a25';ctx.beginPath();ctx.roundRect(px+4,py+53,10,7,1);ctx.fill();
        ctx.fillStyle='#5a5a6a';ctx.beginPath();ctx.arc(px+9,py+53,5,Math.PI,0,false);ctx.lineTo(px+14,py+53);ctx.lineTo(px+4,py+53);ctx.closePath();ctx.fill();
        ctx.strokeStyle='#7a7a8a';ctx.lineWidth=0.5;ctx.beginPath();ctx.arc(px+9,py+53,5,Math.PI,0,false);ctx.stroke();
        ctx.fillStyle='#7a7a8a';ctx.fillRect(px+2,py+49,3,14);ctx.fillRect(px+13,py+49,3,14);
        ctx.fillStyle='#8a8a9a';ctx.fillRect(px+2,py+49,1,14);ctx.fillRect(px+13,py+49,1,14);
        ctx.fillStyle='#909090';ctx.beginPath();ctx.roundRect(px+1.5,py+47,4,3,0.8);ctx.fill();ctx.beginPath();ctx.roundRect(px+12.5,py+47,4,3,0.8);ctx.fill();
        ctx.fillStyle=TC;ctx.beginPath();ctx.roundRect(px+0,py+44,18,4.5,1.5);ctx.fill();
        ctx.fillStyle=TC_L;ctx.fillRect(px+1,py+44,16,1.5);
        ctx.fillStyle=TC_D;ctx.fillRect(px+1,py+47.5,16,1);
        for(var ri=0;ri<4;ri++){ctx.fillStyle=ri%2?TC_L:TC_D;ctx.fillRect(px+1+ri*4,py+44.5,3.5,3);}
        ctx.fillStyle=TC_D;ctx.beginPath();ctx.arc(px+5,py+43,2.2,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(px+13,py+43,2.2,0,Math.PI*2);ctx.fill();
        ctx.fillStyle=TC;ctx.beginPath();ctx.arc(px+5,py+43,1.3,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(px+13,py+43,1.3,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#cc3030';ctx.beginPath();ctx.roundRect(px+3,py+48.5,12,2.5,0.6);ctx.fill();
        ctx.fillStyle=C.yellow;for(var si=0;si<6;si++)ctx.fillRect(px+4.5+si*1.5,py+49,1,0.8);
        var gP=0.4+0.5*Math.abs(Math.sin(f*0.06));
        if(night){ctx.globalAlpha=0.7;ctx.fillStyle=TC_A;ctx.beginPath();ctx.arc(px+3.5,py+47,1,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(px+14.5,py+47,1,0,Math.PI*2);ctx.fill();ctx.globalAlpha=0.15;ctx.beginPath();ctx.arc(px+3.5,py+47,3.5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(px+14.5,py+47,3.5,0,Math.PI*2);ctx.fill();}
        else{ctx.globalAlpha=gP;ctx.fillStyle=TC_A;ctx.beginPath();ctx.arc(px+3.5,py+47,0.8,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(px+14.5,py+47,0.8,0,Math.PI*2);ctx.fill();}
        ctx.globalAlpha=1;
    }
    
    // --- WOODEN COASTER: angular lattice, warm tones ---
    var _wcTrack = [
        {x:8,y:58,h:0},{x:8,y:54,h:0},{x:8,y:48,h:2},{x:8,y:42,h:4},{x:8,y:36,h:6},
        {x:8,y:30,h:8},{x:10,y:24,h:9.5},{x:16,y:20,h:10},{x:24,y:19,h:10},{x:32,y:22,h:8},
        {x:36,y:28,h:4},{x:34,y:34,h:1},{x:30,y:36,h:4},{x:26,y:32,h:7},{x:24,y:28,h:8.5},
        {x:26,y:24,h:7},{x:32,y:26,h:4},{x:38,y:30,h:2},{x:44,y:32,h:1},{x:48,y:28,h:4},
        {x:52,y:24,h:6.5},{x:54,y:28,h:4},{x:52,y:34,h:2},{x:48,y:38,h:3},{x:44,y:40,h:5},
        {x:40,y:38,h:3},{x:38,y:42,h:1},{x:42,y:46,h:2.5},{x:48,y:48,h:1.5},{x:54,y:50,h:1},
        {x:52,y:54,h:0.5},{x:44,y:56,h:0.3},{x:36,y:56,h:0.5},{x:28,y:55,h:0.8},{x:20,y:56,h:0.3},
        {x:14,y:57,h:0.1},{x:8,y:58,h:0}
    ];
    var _wcPath = _buildPath(_wcTrack, 500);
    
    function drawWoodenCoaster(x, y) {
        var night = getDayPart() === 'night';
        var f = (G.paused || night) ? 0 : G.frame;
        var px = x * TILE_SIZE, py = y * TILE_SIZE;
        var ctx = parkCtx;
        var PATH = _wcPath;
        var TC='#d9b87c',TC_D='#b89858',TC_L='#f0d8a0',TC_A='#ffe8b8';
        var WD='#8a7050',WD_L='#a08868',WD_D='#6a5038';
        var CAR_C=['#cc3030','#2255aa','#228844'];
        
        drawGrass(x,y); drawGrass(x+1,y); drawGrass(x,y+1); drawGrass(x+1,y+1);
        
        function proj(p){return{x:px+p.x, y:py+p.y-p.h*1.3};}
        function tang(idx){var ni=(idx+2)%PATH.length;var a=proj(PATH[idx]),b=proj(PATH[ni]);var dx=b.x-a.x,dy=b.y-a.y;var len=Math.sqrt(dx*dx+dy*dy)||1;return{dx:dx/len,dy:dy/len};}
        
        ctx.fillStyle='rgba(0,40,20,0.18)';
        ctx.beginPath();ctx.ellipse(px+32,py+60,28,4,0,0,Math.PI*2);ctx.fill();
        
        // Wooden lattice supports - double posts with diagonal bracing
        var suppIdx=[20,50,80,110,140,170,200,230,260,290,320,355,385,420,455,480];
        suppIdx.forEach(function(si){
            var p=PATH[si%PATH.length],pr=proj(p);
            var groundY=py+p.y+2,topY=pr.y+1;
            if(groundY-topY<4)return;
            // Double wooden posts
            ctx.fillStyle=WD;ctx.fillRect(pr.x-1.5,topY,1.2,groundY-topY);ctx.fillRect(pr.x+0.3,topY,1.2,groundY-topY);
            ctx.fillStyle=WD_L;ctx.fillRect(pr.x-1.5,topY,0.4,groundY-topY);ctx.fillRect(pr.x+0.3,topY,0.4,groundY-topY);
            // Diagonal cross braces
            ctx.strokeStyle=WD_D;ctx.lineWidth=0.5;
            var bC=Math.floor((groundY-topY)/6);
            for(var bi=0;bi<bC;bi++){
                var by=topY+bi*6;
                ctx.beginPath();ctx.moveTo(pr.x-1.5,by);ctx.lineTo(pr.x+1.5,by+6);ctx.stroke();
                ctx.beginPath();ctx.moveTo(pr.x+1.5,by);ctx.lineTo(pr.x-1.5,by+6);ctx.stroke();
            }
            // Horizontal bars
            for(var hi=0;hi<bC+1;hi++){var hy=topY+hi*6;ctx.fillStyle=WD_D;ctx.fillRect(pr.x-2,hy,4,0.6);}
            ctx.fillStyle=WD_D;ctx.fillRect(pr.x-2,groundY-0.5,4,1.5);
        });
        
        // Lift chain
        ctx.strokeStyle='#555';ctx.lineWidth=0.3;
        for(var li=0;li<16;li++){var lIdx=Math.floor((li/16)*90)+10;var lp=proj(PATH[lIdx%PATH.length]);ctx.beginPath();ctx.moveTo(lp.x-1.5,lp.y+0.5);ctx.lineTo(lp.x+1.5,lp.y-0.5);ctx.stroke();}
        
        // Rail shadow
        ctx.strokeStyle='rgba(0,0,0,0.08)';ctx.lineWidth=2.5;
        ctx.beginPath();PATH.forEach(function(p,i){var pt={x:px+p.x,y:py+p.y+2};if(i===0)ctx.moveTo(pt.x,pt.y);else ctx.lineTo(pt.x,pt.y);});ctx.stroke();
        
        // Wooden rails - thicker, with ledger board
        ctx.strokeStyle=TC;ctx.lineWidth=1.4;
        ctx.beginPath();PATH.forEach(function(p,i){var pr=proj(p),t=tang(i);var nx=-t.dy*1.3,ny=t.dx*1.3;if(i===0)ctx.moveTo(pr.x+nx,pr.y+ny);else ctx.lineTo(pr.x+nx,pr.y+ny);});ctx.stroke();
        ctx.strokeStyle=TC_L;ctx.lineWidth=1.0;
        ctx.beginPath();PATH.forEach(function(p,i){var pr=proj(p),t=tang(i);var nx=t.dy*1.3,ny=-t.dx*1.3;if(i===0)ctx.moveTo(pr.x+nx,pr.y+ny);else ctx.lineTo(pr.x+nx,pr.y+ny);});ctx.stroke();
        // Ledger boards
        ctx.strokeStyle=TC_D;ctx.lineWidth=0.5;
        ctx.beginPath();PATH.forEach(function(p,i){var pr=proj(p);if(i===0)ctx.moveTo(pr.x,pr.y+1);else ctx.lineTo(pr.x,pr.y+1);});ctx.stroke();
        
        // Wooden cross-ties (more frequent for wood)
        ctx.strokeStyle=WD;ctx.lineWidth=0.6;
        for(var ti=0;ti<PATH.length;ti+=8){var p=PATH[ti],pr=proj(p),t=tang(ti);var nx=-t.dy*2,ny=t.dx*2;ctx.beginPath();ctx.moveTo(pr.x+nx,pr.y+ny);ctx.lineTo(pr.x-nx,pr.y-ny);ctx.stroke();}
        
        // Animated cars (classic wooden coaster trains)
        var numCars=3,loopLen=PATH.length,carSpeed=night?0:1.1;
        for(var ci=0;ci<numCars;ci++){
            var carIdx=Math.floor((f*carSpeed+ci*(loopLen/numCars))%loopLen);
            var p=PATH[carIdx],pr=proj(p),t=tang(carIdx);
            var angle=Math.atan2(t.dy,t.dx);
            var col=CAR_C[ci];
            ctx.save();ctx.translate(pr.x,pr.y);ctx.rotate(angle);
            ctx.fillStyle='rgba(0,0,0,0.2)';ctx.beginPath();ctx.ellipse(0,4,3.5,1.2,0,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#333';ctx.fillRect(-3.5,2.5,2,1.2);ctx.fillRect(1.5,2.5,2,1.2);
            ctx.fillStyle=col;ctx.beginPath();ctx.roundRect(-4,-3,8,6,1);ctx.fill();
            ctx.fillStyle=shadeColor(col,-30);ctx.fillRect(-3.5,-3.5,7,1.5);
            ctx.fillStyle=shadeColor(col,25);ctx.fillRect(3,-2,1,4);
            // Wood trim
            ctx.fillStyle=TC;ctx.fillRect(-3.5,1.5,7,0.6);
            ctx.restore();
            ctx.fillStyle='#ffd5b8';
            ctx.beginPath();ctx.arc(pr.x-1.5,pr.y-6,1.5,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.arc(pr.x+1.2,pr.y-6,1.5,0,Math.PI*2);ctx.fill();
            ctx.fillStyle=ci===0?'#6c5043':ci===1?'#ffe94d':'#3c2820';
            ctx.beginPath();ctx.ellipse(pr.x-1.5,pr.y-7.2,1.8,0.7,0,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.ellipse(pr.x+1.2,pr.y-7.2,1.8,0.7,0,0,Math.PI*2);ctx.fill();
        }
        
        // Warm track lights
        for(var tli=0;tli<12;tli++){var lIdx=(tli*42)%PATH.length;var lp=proj(PATH[lIdx]);
            if(night){ctx.globalAlpha=0.5+0.5*Math.abs(Math.sin(f*0.04+tli*0.8));ctx.fillStyle=[C.yellow,TC_A,'#ff8844',C.yellow][tli%4];ctx.fillRect(Math.round(lp.x-0.5),Math.round(lp.y-2),1,1);ctx.globalAlpha=0.1;ctx.beginPath();ctx.arc(lp.x,lp.y-1.5,3,0,Math.PI*2);ctx.fill();}
            else{ctx.globalAlpha=0.3+0.5*Math.abs(Math.sin(f*0.05+tli*1));ctx.fillStyle=[C.yellow,TC_A][tli%2];ctx.fillRect(Math.round(lp.x-0.5),Math.round(lp.y-2),1,1);}
        }ctx.globalAlpha=1;
        
        if(night){ctx.fillStyle='rgba(217,184,124,0.06)';ctx.beginPath();ctx.ellipse(px+32,py+30,30,25,0,0,Math.PI*2);ctx.fill();}
        
        // Station - rustic wooden lodge
        ctx.fillStyle=WD;ctx.beginPath();ctx.roundRect(px+1,py+52,16,11,2);ctx.fill();
        ctx.fillStyle=WD_L;ctx.fillRect(px+2,py+52,14,1.5);
        ctx.fillStyle='#2a1c10';ctx.beginPath();ctx.roundRect(px+4,py+53,10,7,1);ctx.fill();
        ctx.fillStyle=WD;ctx.beginPath();ctx.arc(px+9,py+53,5,Math.PI,0,false);ctx.lineTo(px+14,py+53);ctx.lineTo(px+4,py+53);ctx.closePath();ctx.fill();
        ctx.strokeStyle=WD_L;ctx.lineWidth=0.5;ctx.beginPath();ctx.arc(px+9,py+53,5,Math.PI,0,false);ctx.stroke();
        ctx.fillStyle=WD_L;ctx.fillRect(px+2,py+49,3,14);ctx.fillRect(px+13,py+49,3,14);
        ctx.fillStyle=TC;ctx.fillRect(px+2,py+49,1,14);ctx.fillRect(px+13,py+49,1,14);
        ctx.fillStyle=TC_L;ctx.beginPath();ctx.roundRect(px+1.5,py+47,4,3,0.8);ctx.fill();ctx.beginPath();ctx.roundRect(px+12.5,py+47,4,3,0.8);ctx.fill();
        ctx.fillStyle=TC;ctx.beginPath();ctx.roundRect(px+0,py+44,18,4.5,1.5);ctx.fill();
        ctx.fillStyle=TC_L;ctx.fillRect(px+1,py+44,16,1.5);
        ctx.fillStyle=TC_D;ctx.fillRect(px+1,py+47.5,16,1);
        for(var ri=0;ri<4;ri++){ctx.fillStyle=ri%2?TC_L:TC_D;ctx.fillRect(px+1+ri*4,py+44.5,3.5,3);}
        // Wooden ornaments
        ctx.fillStyle=WD_D;ctx.beginPath();ctx.moveTo(px+5,py+42);ctx.lineTo(px+9,py+39);ctx.lineTo(px+13,py+42);ctx.closePath();ctx.fill();
        ctx.fillStyle=WD;ctx.beginPath();ctx.moveTo(px+6,py+42);ctx.lineTo(px+9,py+40);ctx.lineTo(px+12,py+42);ctx.closePath();ctx.fill();
        ctx.fillStyle='#cc3030';ctx.beginPath();ctx.roundRect(px+3,py+48.5,12,2.5,0.6);ctx.fill();
        ctx.fillStyle=C.yellow;for(var si=0;si<6;si++)ctx.fillRect(px+4.5+si*1.5,py+49,1,0.8);
        var gP=0.4+0.5*Math.abs(Math.sin(f*0.06));
        if(night){ctx.globalAlpha=0.7;ctx.fillStyle=C.yellow;ctx.beginPath();ctx.arc(px+3.5,py+47,1,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(px+14.5,py+47,1,0,Math.PI*2);ctx.fill();ctx.globalAlpha=0.15;ctx.beginPath();ctx.arc(px+3.5,py+47,3.5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(px+14.5,py+47,3.5,0,Math.PI*2);ctx.fill();}
        else{ctx.globalAlpha=gP;ctx.fillStyle=C.yellow;ctx.beginPath();ctx.arc(px+3.5,py+47,0.8,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(px+14.5,py+47,0.8,0,Math.PI*2);ctx.fill();}
        ctx.globalAlpha=1;
    }
    
    // --- HYPER COASTER: massive first drop, airtime hills ---
    var _hcTrack = [
        {x:8,y:58,h:0},{x:8,y:54,h:0},{x:8,y:48,h:3},{x:8,y:42,h:6},{x:8,y:36,h:9},
        {x:8,y:30,h:12},{x:8,y:24,h:14.5},{x:10,y:20,h:16},{x:16,y:18,h:16.5},{x:24,y:17,h:16},
        {x:32,y:20,h:14},{x:36,y:26,h:10},{x:38,y:32,h:5},{x:38,y:38,h:1},{x:36,y:40,h:4},
        {x:32,y:38,h:8},{x:30,y:34,h:10},{x:32,y:30,h:8},{x:36,y:32,h:5},{x:42,y:36,h:2},
        {x:48,y:34,h:5},{x:52,y:30,h:8},{x:54,y:34,h:4},{x:52,y:38,h:2},{x:48,y:42,h:3.5},
        {x:44,y:44,h:5.5},{x:42,y:40,h:4},{x:44,y:46,h:2},{x:50,y:48,h:1.5},{x:54,y:52,h:0.8},
        {x:48,y:54,h:0.5},{x:40,y:55,h:0.8},{x:32,y:56,h:0.5},{x:24,y:56,h:0.3},{x:16,y:57,h:0.1},
        {x:8,y:58,h:0}
    ];
    var _hcPath = _buildPath(_hcTrack, 500);
    
    function drawHyperCoaster(x, y) {
        var night = getDayPart() === 'night';
        var f = (G.paused || night) ? 0 : G.frame;
        var px = x * TILE_SIZE, py = y * TILE_SIZE;
        var ctx = parkCtx;
        var PATH = _hcPath;
        var TC='#ff8c42',TC_D='#dd6a20',TC_L='#ffaa68',TC_A='#ffcc88';
        var STL='#8a8a9a',STL_L='#aaaaba',STL_D='#6a6a7a';
        var CAR_C=['#ff2222','#ffcc00','#ff6622'];
        
        drawGrass(x,y); drawGrass(x+1,y); drawGrass(x,y+1); drawGrass(x+1,y+1);
        
        function proj(p){return{x:px+p.x, y:py+p.y-p.h*1.3};}
        function tang(idx){var ni=(idx+2)%PATH.length;var a=proj(PATH[idx]),b=proj(PATH[ni]);var dx=b.x-a.x,dy=b.y-a.y;var len=Math.sqrt(dx*dx+dy*dy)||1;return{dx:dx/len,dy:dy/len};}
        
        ctx.fillStyle='rgba(0,30,10,0.18)';
        ctx.beginPath();ctx.ellipse(px+32,py+60,28,4,0,0,Math.PI*2);ctx.fill();
        
        // Tall steel supports with heavy cross-bracing
        var suppIdx=[15,40,60,80,100,120,145,170,200,230,260,290,320,350,380,415,450,475];
        suppIdx.forEach(function(si){
            var p=PATH[si%PATH.length],pr=proj(p);
            var groundY=py+p.y+2,topY=pr.y+1;
            if(groundY-topY<3)return;
            ctx.fillStyle=STL;ctx.fillRect(pr.x-0.8,topY,1.6,groundY-topY);
            ctx.fillStyle=STL_L;ctx.fillRect(pr.x-0.8,topY,0.5,groundY-topY);
            ctx.strokeStyle=STL_D;ctx.lineWidth=0.3;
            var bC=Math.floor((groundY-topY)/6);
            for(var bi=1;bi<=bC;bi++){var by=topY+bi*6;ctx.beginPath();ctx.moveTo(pr.x-2.5,by);ctx.lineTo(pr.x+2.5,by-3);ctx.stroke();ctx.beginPath();ctx.moveTo(pr.x+2.5,by);ctx.lineTo(pr.x-2.5,by-3);ctx.stroke();}
            ctx.fillStyle=STL_D;ctx.fillRect(pr.x-2.5,groundY-0.5,5,1.5);
        });
        
        // Lift chain
        ctx.strokeStyle='#555';ctx.lineWidth=0.3;
        for(var li=0;li<20;li++){var lIdx=Math.floor((li/20)*120)+10;var lp=proj(PATH[lIdx%PATH.length]);ctx.beginPath();ctx.moveTo(lp.x-1.5,lp.y+0.5);ctx.lineTo(lp.x+1.5,lp.y-0.5);ctx.stroke();}
        
        // Rail shadow
        ctx.strokeStyle='rgba(0,0,0,0.08)';ctx.lineWidth=2.8;
        ctx.beginPath();PATH.forEach(function(p,i){var pt={x:px+p.x,y:py+p.y+2};if(i===0)ctx.moveTo(pt.x,pt.y);else ctx.lineTo(pt.x,pt.y);});ctx.stroke();
        
        // Rails
        ctx.strokeStyle=STL;ctx.lineWidth=1.2;
        ctx.beginPath();PATH.forEach(function(p,i){var pr=proj(p),t=tang(i);var nx=-t.dy*1.3,ny=t.dx*1.3;if(i===0)ctx.moveTo(pr.x+nx,pr.y+ny);else ctx.lineTo(pr.x+nx,pr.y+ny);});ctx.stroke();
        ctx.strokeStyle=STL_L;ctx.lineWidth=1.0;
        ctx.beginPath();PATH.forEach(function(p,i){var pr=proj(p),t=tang(i);var nx=t.dy*1.3,ny=-t.dx*1.3;if(i===0)ctx.moveTo(pr.x+nx,pr.y+ny);else ctx.lineTo(pr.x+nx,pr.y+ny);});ctx.stroke();
        ctx.strokeStyle=TC;ctx.lineWidth=0.7;
        ctx.beginPath();PATH.forEach(function(p,i){var pr=proj(p);if(i===0)ctx.moveTo(pr.x,pr.y);else ctx.lineTo(pr.x,pr.y);});ctx.stroke();
        
        ctx.strokeStyle=STL_D;ctx.lineWidth=0.5;
        for(var ti=0;ti<PATH.length;ti+=10){var p=PATH[ti],pr=proj(p),t=tang(ti);var nx=-t.dy*2.2,ny=t.dx*2.2;ctx.beginPath();ctx.moveTo(pr.x+nx,pr.y+ny);ctx.lineTo(pr.x-nx,pr.y-ny);ctx.stroke();}
        
        // Animated cars (fast trains)
        var numCars=3,loopLen=PATH.length,carSpeed=night?0:1.5;
        for(var ci=0;ci<numCars;ci++){
            var carIdx=Math.floor((f*carSpeed+ci*(loopLen/numCars))%loopLen);
            var p=PATH[carIdx],pr=proj(p),t=tang(carIdx);
            var angle=Math.atan2(t.dy,t.dx);
            var col=CAR_C[ci];
            ctx.save();ctx.translate(pr.x,pr.y);ctx.rotate(angle);
            ctx.fillStyle='rgba(0,0,0,0.2)';ctx.beginPath();ctx.ellipse(0,4,4,1.3,0,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#333';ctx.fillRect(-4,2.5,2,1.3);ctx.fillRect(2,2.5,2,1.3);
            ctx.fillStyle=col;ctx.beginPath();ctx.roundRect(-5,-3.5,10,7,2);ctx.fill();
            ctx.fillStyle=shadeColor(col,-35);ctx.beginPath();ctx.roundRect(-4.5,-4,9,2,1);ctx.fill();
            ctx.fillStyle=shadeColor(col,30);ctx.fillRect(4,-2.5,1.3,5);
            ctx.fillStyle='rgba(200,240,255,0.5)';ctx.fillRect(3.5,-2,1.5,3.5);
            ctx.fillStyle=TC_A;ctx.fillRect(-4.5,1.8,9,0.6);
            ctx.restore();
            ctx.fillStyle='#ffd5b8';
            ctx.beginPath();ctx.arc(pr.x-1.5,pr.y-6.5,1.5,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.arc(pr.x+1.2,pr.y-6.5,1.5,0,Math.PI*2);ctx.fill();
            ctx.fillStyle=ci===0?'#6c5043':ci===1?'#ffe94d':'#3c2820';
            ctx.beginPath();ctx.ellipse(pr.x-1.5,pr.y-7.8,1.8,0.8,0,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.ellipse(pr.x+1.2,pr.y-7.8,1.8,0.8,0,0,Math.PI*2);ctx.fill();
        }
        
        // Track lights
        var lc=[C.yellow,TC_A,C.red,TC_L,C.orange,TC_A];
        for(var tli=0;tli<14;tli++){var lIdx=(tli*36)%PATH.length;var lp=proj(PATH[lIdx]);
            if(night){ctx.globalAlpha=0.5+0.5*Math.abs(Math.sin(f*0.04+tli*0.7));ctx.fillStyle=lc[tli%lc.length];ctx.fillRect(Math.round(lp.x-0.5),Math.round(lp.y-2),1,1);ctx.globalAlpha=0.12;ctx.beginPath();ctx.arc(lp.x,lp.y-1.5,3,0,Math.PI*2);ctx.fill();}
            else{ctx.globalAlpha=0.3+0.6*Math.abs(Math.sin(f*0.05+tli*1));ctx.fillStyle=lc[tli%lc.length];ctx.fillRect(Math.round(lp.x-0.5),Math.round(lp.y-2),1,1);}
        }ctx.globalAlpha=1;
        
        if(night){ctx.fillStyle='rgba(255,140,66,0.06)';ctx.beginPath();ctx.ellipse(px+32,py+30,30,25,0,0,Math.PI*2);ctx.fill();}
        
        // Station - bold industrial
        ctx.fillStyle='#5a5a5a';ctx.beginPath();ctx.roundRect(px+1,py+52,16,11,2);ctx.fill();
        ctx.fillStyle='#6a6a6a';ctx.fillRect(px+2,py+52,14,1.5);
        ctx.fillStyle='#1a1515';ctx.beginPath();ctx.roundRect(px+4,py+53,10,7,1);ctx.fill();
        ctx.fillStyle='#5a5a5a';ctx.beginPath();ctx.arc(px+9,py+53,5,Math.PI,0,false);ctx.lineTo(px+14,py+53);ctx.lineTo(px+4,py+53);ctx.closePath();ctx.fill();
        ctx.strokeStyle='#7a7a7a';ctx.lineWidth=0.5;ctx.beginPath();ctx.arc(px+9,py+53,5,Math.PI,0,false);ctx.stroke();
        ctx.fillStyle='#7a7a7a';ctx.fillRect(px+2,py+49,3,14);ctx.fillRect(px+13,py+49,3,14);
        ctx.fillStyle='#8a8a8a';ctx.fillRect(px+2,py+49,1,14);ctx.fillRect(px+13,py+49,1,14);
        ctx.fillStyle='#909090';ctx.beginPath();ctx.roundRect(px+1.5,py+47,4,3,0.8);ctx.fill();ctx.beginPath();ctx.roundRect(px+12.5,py+47,4,3,0.8);ctx.fill();
        ctx.fillStyle=TC;ctx.beginPath();ctx.roundRect(px+0,py+44,18,4.5,1.5);ctx.fill();
        ctx.fillStyle=TC_L;ctx.fillRect(px+1,py+44,16,1.5);
        ctx.fillStyle=TC_D;ctx.fillRect(px+1,py+47.5,16,1);
        for(var ri=0;ri<4;ri++){ctx.fillStyle=ri%2?TC_L:TC_D;ctx.fillRect(px+1+ri*4,py+44.5,3.5,3);}
        // Flame icons
        ctx.fillStyle='#ff4422';ctx.beginPath();ctx.moveTo(px+5,py+43);ctx.quadraticCurveTo(px+4,py+40,px+5,py+39);ctx.quadraticCurveTo(px+6,py+40,px+7,py+43);ctx.closePath();ctx.fill();
        ctx.fillStyle='#ff4422';ctx.beginPath();ctx.moveTo(px+11,py+43);ctx.quadraticCurveTo(px+10,py+40,px+11,py+39);ctx.quadraticCurveTo(px+12,py+40,px+13,py+43);ctx.closePath();ctx.fill();
        ctx.fillStyle=C.yellow;ctx.beginPath();ctx.moveTo(px+5.5,py+43);ctx.quadraticCurveTo(px+5,py+41,px+5.5,py+40.5);ctx.quadraticCurveTo(px+6,py+41,px+6.5,py+43);ctx.closePath();ctx.fill();
        ctx.fillStyle=C.yellow;ctx.beginPath();ctx.moveTo(px+11.5,py+43);ctx.quadraticCurveTo(px+11,py+41,px+11.5,py+40.5);ctx.quadraticCurveTo(px+12,py+41,px+12.5,py+43);ctx.closePath();ctx.fill();
        ctx.fillStyle='#cc3030';ctx.beginPath();ctx.roundRect(px+3,py+48.5,12,2.5,0.6);ctx.fill();
        ctx.fillStyle=C.yellow;for(var si=0;si<6;si++)ctx.fillRect(px+4.5+si*1.5,py+49,1,0.8);
        var gP=0.4+0.5*Math.abs(Math.sin(f*0.06));
        if(night){ctx.globalAlpha=0.7;ctx.fillStyle=TC_A;ctx.beginPath();ctx.arc(px+3.5,py+47,1,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(px+14.5,py+47,1,0,Math.PI*2);ctx.fill();ctx.globalAlpha=0.15;ctx.beginPath();ctx.arc(px+3.5,py+47,3.5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(px+14.5,py+47,3.5,0,Math.PI*2);ctx.fill();}
        else{ctx.globalAlpha=gP;ctx.fillStyle=TC_A;ctx.beginPath();ctx.arc(px+3.5,py+47,0.8,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(px+14.5,py+47,0.8,0,Math.PI*2);ctx.fill();}
        ctx.globalAlpha=1;
    }
    
    // --- GIGA COASTER: extreme height, sweeping turns ---
    var _gcTrack = [
        {x:8,y:58,h:0},{x:8,y:54,h:0},{x:8,y:48,h:4},{x:8,y:42,h:8},{x:8,y:36,h:12},
        {x:8,y:30,h:16},{x:8,y:24,h:19},{x:10,y:20,h:21},{x:16,y:17,h:22},{x:24,y:16,h:22},
        {x:32,y:17,h:21},{x:38,y:22,h:16},{x:40,y:28,h:10},{x:40,y:34,h:4},{x:38,y:38,h:1},
        {x:34,y:40,h:5},{x:30,y:36,h:10},{x:28,y:32,h:13},{x:30,y:28,h:11},{x:34,y:30,h:7},
        {x:38,y:34,h:3},{x:44,y:36,h:1},{x:50,y:34,h:4},{x:54,y:30,h:8},{x:56,y:34,h:5},
        {x:54,y:38,h:2},{x:50,y:42,h:4},{x:46,y:44,h:6.5},{x:44,y:40,h:4},{x:46,y:46,h:2},
        {x:52,y:48,h:3},{x:56,y:52,h:1},{x:50,y:54,h:0.5},{x:42,y:55,h:1},{x:34,y:56,h:0.5},
        {x:26,y:56,h:0.3},{x:18,y:57,h:0.1},{x:8,y:58,h:0}
    ];
    var _gcPath = _buildPath(_gcTrack, 500);
    
    function drawGigaCoaster(x, y) {
        var night = getDayPart() === 'night';
        var f = (G.paused || night) ? 0 : G.frame;
        var px = x * TILE_SIZE, py = y * TILE_SIZE;
        var ctx = parkCtx;
        var PATH = _gcPath;
        var TC='#00ced1',TC_D='#009ea0',TC_L='#40eef0',TC_A='#80ffff';
        var STL='#8a8a9a',STL_L='#aaadba',STL_D='#6a6a7a';
        var CAR_C=['#2244ff','#00cc66','#ff44aa'];
        
        drawGrass(x,y); drawGrass(x+1,y); drawGrass(x,y+1); drawGrass(x+1,y+1);
        
        function proj(p){return{x:px+p.x, y:py+p.y-p.h*1.3};}
        function tang(idx){var ni=(idx+2)%PATH.length;var a=proj(PATH[idx]),b=proj(PATH[ni]);var dx=b.x-a.x,dy=b.y-a.y;var len=Math.sqrt(dx*dx+dy*dy)||1;return{dx:dx/len,dy:dy/len};}
        
        ctx.fillStyle='rgba(0,30,40,0.2)';
        ctx.beginPath();ctx.ellipse(px+32,py+60,28,4,0,0,Math.PI*2);ctx.fill();
        
        // Massive steel supports with heavy structure
        var suppIdx=[12,30,48,66,84,105,130,155,180,210,240,270,300,330,360,390,420,450,475];
        suppIdx.forEach(function(si){
            var p=PATH[si%PATH.length],pr=proj(p);
            var groundY=py+p.y+2,topY=pr.y+1;
            if(groundY-topY<3)return;
            // Main column
            ctx.fillStyle=STL;ctx.fillRect(pr.x-1,topY,2,groundY-topY);
            ctx.fillStyle=STL_L;ctx.fillRect(pr.x-1,topY,0.6,groundY-topY);
            // Heavy X-bracing
            ctx.strokeStyle=STL_D;ctx.lineWidth=0.4;
            var bC=Math.floor((groundY-topY)/5);
            for(var bi=1;bi<=bC;bi++){var by=topY+bi*5;ctx.beginPath();ctx.moveTo(pr.x-3,by);ctx.lineTo(pr.x+3,by-3);ctx.stroke();ctx.beginPath();ctx.moveTo(pr.x+3,by);ctx.lineTo(pr.x-3,by-3);ctx.stroke();}
            ctx.fillStyle=STL_D;ctx.fillRect(pr.x-3,groundY-0.5,6,1.5);
        });
        
        // Lift chain
        ctx.strokeStyle='#555';ctx.lineWidth=0.4;
        for(var li=0;li<22;li++){var lIdx=Math.floor((li/22)*130)+10;var lp=proj(PATH[lIdx%PATH.length]);ctx.beginPath();ctx.moveTo(lp.x-2,lp.y+0.5);ctx.lineTo(lp.x+2,lp.y-0.5);ctx.stroke();}
        
        // Rail shadow
        ctx.strokeStyle='rgba(0,0,0,0.1)';ctx.lineWidth=3;
        ctx.beginPath();PATH.forEach(function(p,i){var pt={x:px+p.x,y:py+p.y+2};if(i===0)ctx.moveTo(pt.x,pt.y);else ctx.lineTo(pt.x,pt.y);});ctx.stroke();
        
        // Rails - heavy gauge
        ctx.strokeStyle=STL;ctx.lineWidth=1.3;
        ctx.beginPath();PATH.forEach(function(p,i){var pr=proj(p),t=tang(i);var nx=-t.dy*1.4,ny=t.dx*1.4;if(i===0)ctx.moveTo(pr.x+nx,pr.y+ny);else ctx.lineTo(pr.x+nx,pr.y+ny);});ctx.stroke();
        ctx.strokeStyle=STL_L;ctx.lineWidth=1.1;
        ctx.beginPath();PATH.forEach(function(p,i){var pr=proj(p),t=tang(i);var nx=t.dy*1.4,ny=-t.dx*1.4;if(i===0)ctx.moveTo(pr.x+nx,pr.y+ny);else ctx.lineTo(pr.x+nx,pr.y+ny);});ctx.stroke();
        ctx.strokeStyle=TC;ctx.lineWidth=0.8;
        ctx.beginPath();PATH.forEach(function(p,i){var pr=proj(p);if(i===0)ctx.moveTo(pr.x,pr.y);else ctx.lineTo(pr.x,pr.y);});ctx.stroke();
        
        ctx.strokeStyle=STL_D;ctx.lineWidth=0.5;
        for(var ti=0;ti<PATH.length;ti+=9){var p=PATH[ti],pr=proj(p),t=tang(ti);var nx=-t.dy*2.3,ny=t.dx*2.3;ctx.beginPath();ctx.moveTo(pr.x+nx,pr.y+ny);ctx.lineTo(pr.x-nx,pr.y-ny);ctx.stroke();}
        
        // Animated cars (fast, large trains)
        var numCars=3,loopLen=PATH.length,carSpeed=night?0:1.6;
        for(var ci=0;ci<numCars;ci++){
            var carIdx=Math.floor((f*carSpeed+ci*(loopLen/numCars))%loopLen);
            var p=PATH[carIdx],pr=proj(p),t=tang(carIdx);
            var angle=Math.atan2(t.dy,t.dx);
            var col=CAR_C[ci];
            ctx.save();ctx.translate(pr.x,pr.y);ctx.rotate(angle);
            ctx.fillStyle='rgba(0,0,0,0.22)';ctx.beginPath();ctx.ellipse(0,4.5,4.5,1.4,0,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#333';ctx.fillRect(-4.5,3,2.2,1.3);ctx.fillRect(2.3,3,2.2,1.3);
            ctx.fillStyle=col;ctx.beginPath();ctx.roundRect(-5.5,-3.5,11,7,2);ctx.fill();
            ctx.fillStyle=shadeColor(col,-40);ctx.beginPath();ctx.roundRect(-5,-4.2,10,2.2,1);ctx.fill();
            ctx.fillStyle=shadeColor(col,30);ctx.fillRect(4.5,-2.5,1.3,5);
            ctx.fillStyle='rgba(200,240,255,0.5)';ctx.fillRect(4,-2,1.5,3.5);
            ctx.fillStyle=TC_A;ctx.fillRect(-5,2,10,0.6);
            // Headlight
            ctx.fillStyle=C.yellow;ctx.fillRect(5,-0.5,0.8,1);
            ctx.restore();
            ctx.fillStyle='#ffd5b8';
            ctx.beginPath();ctx.arc(pr.x-1.5,pr.y-7,1.5,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.arc(pr.x+1.2,pr.y-7,1.5,0,Math.PI*2);ctx.fill();
            ctx.fillStyle=ci===0?'#6c5043':ci===1?'#ffe94d':'#3c2820';
            ctx.beginPath();ctx.ellipse(pr.x-1.5,pr.y-8.2,1.8,0.8,0,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.ellipse(pr.x+1.2,pr.y-8.2,1.8,0.8,0,0,Math.PI*2);ctx.fill();
        }
        
        // Track lights - cool tones
        var lc=[TC_A,C.blue,TC_L,C.green,TC_A,'#ffffff',C.blue,TC_L];
        for(var tli=0;tli<16;tli++){var lIdx=(tli*31)%PATH.length;var lp=proj(PATH[lIdx]);
            if(night){ctx.globalAlpha=0.5+0.5*Math.abs(Math.sin(f*0.04+tli*0.7));ctx.fillStyle=lc[tli%lc.length];ctx.fillRect(Math.round(lp.x-0.5),Math.round(lp.y-2),1,1);ctx.globalAlpha=0.12;ctx.beginPath();ctx.arc(lp.x,lp.y-1.5,3.5,0,Math.PI*2);ctx.fill();}
            else{ctx.globalAlpha=0.3+0.6*Math.abs(Math.sin(f*0.05+tli*1));ctx.fillStyle=lc[tli%lc.length];ctx.fillRect(Math.round(lp.x-0.5),Math.round(lp.y-2),1,1);}
        }ctx.globalAlpha=1;
        
        if(night){ctx.fillStyle='rgba(0,206,209,0.07)';ctx.beginPath();ctx.ellipse(px+32,py+30,30,25,0,0,Math.PI*2);ctx.fill();}
        
        // Station - imposing, futuristic
        ctx.fillStyle='#4a4a5a';ctx.beginPath();ctx.roundRect(px+1,py+52,16,11,2);ctx.fill();
        ctx.fillStyle='#5a5a6a';ctx.fillRect(px+2,py+52,14,1.5);
        ctx.fillStyle='#1a1520';ctx.beginPath();ctx.roundRect(px+4,py+53,10,7,1);ctx.fill();
        ctx.fillStyle='#4a4a5a';ctx.beginPath();ctx.arc(px+9,py+53,5,Math.PI,0,false);ctx.lineTo(px+14,py+53);ctx.lineTo(px+4,py+53);ctx.closePath();ctx.fill();
        ctx.strokeStyle='#6a6a7a';ctx.lineWidth=0.5;ctx.beginPath();ctx.arc(px+9,py+53,5,Math.PI,0,false);ctx.stroke();
        ctx.fillStyle='#6a6a7a';ctx.fillRect(px+2,py+49,3,14);ctx.fillRect(px+13,py+49,3,14);
        ctx.fillStyle='#7a7a8a';ctx.fillRect(px+2,py+49,1,14);ctx.fillRect(px+13,py+49,1,14);
        ctx.fillStyle='#888';ctx.beginPath();ctx.roundRect(px+1.5,py+47,4,3,0.8);ctx.fill();ctx.beginPath();ctx.roundRect(px+12.5,py+47,4,3,0.8);ctx.fill();
        ctx.fillStyle=TC;ctx.beginPath();ctx.roundRect(px+0,py+44,18,4.5,1.5);ctx.fill();
        ctx.fillStyle=TC_L;ctx.fillRect(px+1,py+44,16,1.5);
        ctx.fillStyle=TC_D;ctx.fillRect(px+1,py+47.5,16,1);
        for(var ri=0;ri<4;ri++){ctx.fillStyle=ri%2?TC_L:TC_D;ctx.fillRect(px+1+ri*4,py+44.5,3.5,3);}
        // Lightning bolt icons
        ctx.fillStyle=TC_A;ctx.beginPath();ctx.moveTo(px+6,py+40);ctx.lineTo(px+4,py+43);ctx.lineTo(px+5.5,py+43);ctx.lineTo(px+4,py+44.5);ctx.lineTo(px+7,py+42);ctx.lineTo(px+5.5,py+42);ctx.closePath();ctx.fill();
        ctx.fillStyle=TC_A;ctx.beginPath();ctx.moveTo(px+12,py+40);ctx.lineTo(px+10,py+43);ctx.lineTo(px+11.5,py+43);ctx.lineTo(px+10,py+44.5);ctx.lineTo(px+13,py+42);ctx.lineTo(px+11.5,py+42);ctx.closePath();ctx.fill();
        ctx.fillStyle='#cc3030';ctx.beginPath();ctx.roundRect(px+3,py+48.5,12,2.5,0.6);ctx.fill();
        ctx.fillStyle=C.yellow;for(var si=0;si<6;si++)ctx.fillRect(px+4.5+si*1.5,py+49,1,0.8);
        var gP=0.4+0.5*Math.abs(Math.sin(f*0.06));
        if(night){ctx.globalAlpha=0.7;ctx.fillStyle=TC_A;ctx.beginPath();ctx.arc(px+3.5,py+47,1,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(px+14.5,py+47,1,0,Math.PI*2);ctx.fill();ctx.globalAlpha=0.15;ctx.beginPath();ctx.arc(px+3.5,py+47,3.5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(px+14.5,py+47,3.5,0,Math.PI*2);ctx.fill();}
        else{ctx.globalAlpha=gP;ctx.fillStyle=TC_A;ctx.beginPath();ctx.arc(px+3.5,py+47,0.8,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(px+14.5,py+47,0.8,0,Math.PI*2);ctx.fill();}
        ctx.globalAlpha=1;
    }
    
    // Food stalls — detailed pop-up fair booth style
    function drawFoodStall(x, y, type) {
        var night = getDayPart() === 'night';
        var f = G.paused ? 0 : G.frame;
        var ctx = parkCtx;
        drawGrass(x, y);
        ctx.save();
        ctx.translate(x * TILE_SIZE, y * TILE_SIZE);

        if (type === 'burger-joint') {
            // Ground shadow
            ctx.fillStyle='rgba(0,30,10,0.22)';ctx.beginPath();ctx.ellipse(16,30,14,3,0,0,Math.PI*2);ctx.fill();
            // Back counter (dark wood)
            ctx.fillStyle='#5a3a1e';ctx.beginPath();ctx.roundRect(2,18,28,12,2);ctx.fill();
            // Counter top
            ctx.fillStyle='#7a5030';ctx.beginPath();ctx.roundRect(2,16,28,4,2);ctx.fill();
            ctx.fillStyle='#9a6a42';ctx.fillRect(3,16,26,2);
            // Front panel - red with yellow stripe
            ctx.fillStyle='#cc2222';ctx.beginPath();ctx.roundRect(2,20,28,10,2);ctx.fill();
            ctx.fillStyle='#e8a020';ctx.fillRect(3,24,26,2);
            // Vertical wood slats
            ctx.fillStyle='rgba(0,0,0,0.08)';
            for(var i=0;i<5;i++) ctx.fillRect(5+i*5.5,20,0.5,10);
            // Awning - red & white stripes
            ctx.fillStyle='#dd3030';ctx.beginPath();ctx.moveTo(0,10);ctx.lineTo(16,6);ctx.lineTo(32,10);ctx.lineTo(32,14);ctx.lineTo(0,14);ctx.closePath();ctx.fill();
            for(var si=0;si<8;si++){ctx.fillStyle=si%2===0?'#fff':'#dd3030';ctx.beginPath();ctx.moveTo(si*4,10+(si<4?-si*0.5:-(8-si)*0.5));ctx.lineTo(si*4+4,10+(si<3?-(si+1)*0.5:-(7-si)*0.5));ctx.lineTo(si*4+4,14);ctx.lineTo(si*4,14);ctx.closePath();ctx.fill();}
            // Scalloped awning edge
            ctx.fillStyle='#dd3030';
            for(var sc=0;sc<8;sc++){ctx.beginPath();ctx.arc(2+sc*4,14,2,0,Math.PI);ctx.fill();}
            // Support poles
            ctx.fillStyle='#8B4513';ctx.fillRect(3,10,2,20);ctx.fillRect(27,10,2,20);
            ctx.fillStyle='#a05a2c';ctx.fillRect(3,10,1,20);ctx.fillRect(27,10,1,20);
            // Burger icon on top
            // Bun top
            ctx.fillStyle='#d4a056';ctx.beginPath();ctx.arc(16,5,5,Math.PI,0);ctx.fill();
            // Sesame seeds
            ctx.fillStyle='#f5e6c8';ctx.fillRect(13,3,1.5,1);ctx.fillRect(17,4,1.5,1);ctx.fillRect(15,2,1,1);
            // Lettuce
            ctx.fillStyle='#4caf50';ctx.beginPath();ctx.moveTo(10,7);ctx.quadraticCurveTo(13,5,16,7);ctx.quadraticCurveTo(19,5,22,7);ctx.lineTo(22,8);ctx.lineTo(10,8);ctx.closePath();ctx.fill();
            // Patty
            ctx.fillStyle='#6d3a1a';ctx.beginPath();ctx.roundRect(11,8,10,3,1);ctx.fill();
            ctx.fillStyle='#8B4513';ctx.fillRect(12,8,8,1);
            // Cheese
            ctx.fillStyle='#ffc107';ctx.beginPath();ctx.moveTo(10,9);ctx.lineTo(11,11);ctx.lineTo(22,11);ctx.lineTo(23,9);ctx.closePath();ctx.fill();
            // Bun bottom
            ctx.fillStyle='#c89040';ctx.beginPath();ctx.roundRect(11,11,10,2,1);ctx.fill();
            // Counter items: ketchup & mustard bottles
            ctx.fillStyle='#cc2222';ctx.beginPath();ctx.roundRect(6,14,3,3,0.5);ctx.fill();
            ctx.fillStyle='#cc2222';ctx.fillRect(7,13,1,1.5);
            ctx.fillStyle='#e8a020';ctx.beginPath();ctx.roundRect(22,14,3,3,0.5);ctx.fill();
            ctx.fillStyle='#e8a020';ctx.fillRect(23,13,1,1.5);
            // Menu board
            ctx.fillStyle='#2a1a0a';ctx.beginPath();ctx.roundRect(12,15,8,3,0.5);ctx.fill();
            ctx.fillStyle='#e8a020';ctx.fillRect(13,15.5,2,0.5);ctx.fillRect(13,16.5,3,0.5);
            // Night glow
            if(night){ctx.fillStyle='rgba(255,200,60,0.12)';ctx.beginPath();ctx.ellipse(16,18,12,8,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,220,100,0.7)';ctx.beginPath();ctx.ellipse(16,17,3,2,0,0,Math.PI*2);ctx.fill();}

        } else if (type === 'cotton-candy') {
            // Ground shadow
            ctx.fillStyle='rgba(0,30,10,0.22)';ctx.beginPath();ctx.ellipse(16,30,14,3,0,0,Math.PI*2);ctx.fill();
            // Back counter
            ctx.fillStyle='#c87090';ctx.beginPath();ctx.roundRect(2,18,28,12,2);ctx.fill();
            // Counter top
            ctx.fillStyle='#e8a0b8';ctx.beginPath();ctx.roundRect(2,16,28,4,2);ctx.fill();
            ctx.fillStyle='#f0b8c8';ctx.fillRect(3,16,26,2);
            // Front panel - pink with white dots
            ctx.fillStyle='#e870a0';ctx.beginPath();ctx.roundRect(2,20,28,10,2);ctx.fill();
            ctx.fillStyle='rgba(255,255,255,0.25)';
            for(var di=0;di<4;di++)for(var dj=0;dj<3;dj++){ctx.beginPath();ctx.arc(6+di*7,22+dj*3,0.8,0,Math.PI*2);ctx.fill();}
            // Awning - pink & white stripes
            ctx.fillStyle='#ff80b0';ctx.beginPath();ctx.moveTo(0,10);ctx.lineTo(16,6);ctx.lineTo(32,10);ctx.lineTo(32,14);ctx.lineTo(0,14);ctx.closePath();ctx.fill();
            for(var si=0;si<8;si++){ctx.fillStyle=si%2===0?'#fff':'#ff80b0';ctx.beginPath();ctx.moveTo(si*4,10+(si<4?-si*0.5:-(8-si)*0.5));ctx.lineTo(si*4+4,10+(si<3?-(si+1)*0.5:-(7-si)*0.5));ctx.lineTo(si*4+4,14);ctx.lineTo(si*4,14);ctx.closePath();ctx.fill();}
            // Scalloped edge
            ctx.fillStyle='#ff80b0';
            for(var sc=0;sc<8;sc++){ctx.beginPath();ctx.arc(2+sc*4,14,2,0,Math.PI);ctx.fill();}
            // Support poles
            ctx.fillStyle='#d070a0';ctx.fillRect(3,10,2,20);ctx.fillRect(27,10,2,20);
            ctx.fillStyle='#e088b0';ctx.fillRect(3,10,1,20);ctx.fillRect(27,10,1,20);
            // Cotton candy on sticks display
            // Left cotton candy (pink)
            ctx.fillStyle='#ffb6c1';ctx.beginPath();ctx.arc(10,6,4.5,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#ffc8d6';ctx.beginPath();ctx.arc(9,5,2.5,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#ff9ab5';ctx.beginPath();ctx.arc(11,8,2,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#deb887';ctx.fillRect(9.5,10,1,5);
            // Right cotton candy (blue)
            ctx.fillStyle='#87ceeb';ctx.beginPath();ctx.arc(22,6,4.5,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#a8e0f8';ctx.beginPath();ctx.arc(21,5,2.5,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#6ab8d8';ctx.beginPath();ctx.arc(23,8,2,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#deb887';ctx.fillRect(21.5,10,1,5);
            // Center cotton candy (purple) - slightly bobbing
            var bob = Math.sin(f*0.04)*1;
            ctx.fillStyle='#d8a0f0';ctx.beginPath();ctx.arc(16,4+bob,5,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#e8b8ff';ctx.beginPath();ctx.arc(15,3+bob,3,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#c888e0';ctx.beginPath();ctx.arc(17,6+bob,2.5,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#deb887';ctx.fillRect(15.5,9+bob,1,6-bob);
            // Sparkle
            ctx.fillStyle='rgba(255,255,255,0.5)';
            var spk = Math.sin(f*0.06);
            if(spk>0.3){ctx.fillRect(14,2+bob,1,1);ctx.fillRect(19,5+bob,1,1);}
            // Night glow
            if(night){ctx.fillStyle='rgba(255,150,200,0.1)';ctx.beginPath();ctx.ellipse(16,18,12,8,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,200,230,0.6)';ctx.beginPath();ctx.ellipse(16,17,3,2,0,0,Math.PI*2);ctx.fill();}

        } else if (type === 'coffee-stand') {
            // Ground shadow
            ctx.fillStyle='rgba(0,30,10,0.22)';ctx.beginPath();ctx.ellipse(16,30,14,3,0,0,Math.PI*2);ctx.fill();
            // Back counter (dark wood)
            ctx.fillStyle='#3a2210';ctx.beginPath();ctx.roundRect(2,18,28,12,2);ctx.fill();
            // Counter top
            ctx.fillStyle='#5c3a1e';ctx.beginPath();ctx.roundRect(2,16,28,4,2);ctx.fill();
            ctx.fillStyle='#6d4a2a';ctx.fillRect(3,16,26,2);
            // Front panel - rich brown with wood grain
            ctx.fillStyle='#4a2a12';ctx.beginPath();ctx.roundRect(2,20,28,10,2);ctx.fill();
            ctx.fillStyle='rgba(255,200,120,0.06)';
            for(var gi=0;gi<6;gi++)ctx.fillRect(3,21+gi*1.5,26,0.5);
            // Chalkboard sign
            ctx.fillStyle='#1a2a1a';ctx.beginPath();ctx.roundRect(8,21,16,7,1);ctx.fill();
            ctx.fillStyle='#2a3a2a';ctx.beginPath();ctx.roundRect(9,22,14,5,0.5);ctx.fill();
            ctx.fillStyle='#d4a870';ctx.fillRect(10,23,4,0.5);ctx.fillRect(10,24.5,6,0.5);ctx.fillRect(10,26,3,0.5);
            // Awning - brown & cream stripes
            ctx.fillStyle='#6d3a1a';ctx.beginPath();ctx.moveTo(0,10);ctx.lineTo(16,6);ctx.lineTo(32,10);ctx.lineTo(32,14);ctx.lineTo(0,14);ctx.closePath();ctx.fill();
            for(var si=0;si<8;si++){ctx.fillStyle=si%2===0?'#f5e6c8':'#6d3a1a';ctx.beginPath();ctx.moveTo(si*4,10+(si<4?-si*0.5:-(8-si)*0.5));ctx.lineTo(si*4+4,10+(si<3?-(si+1)*0.5:-(7-si)*0.5));ctx.lineTo(si*4+4,14);ctx.lineTo(si*4,14);ctx.closePath();ctx.fill();}
            // Scalloped edge
            ctx.fillStyle='#6d3a1a';
            for(var sc=0;sc<8;sc++){ctx.beginPath();ctx.arc(2+sc*4,14,2,0,Math.PI);ctx.fill();}
            // Support poles
            ctx.fillStyle='#5a3018';ctx.fillRect(3,10,2,20);ctx.fillRect(27,10,2,20);
            ctx.fillStyle='#6d4020';ctx.fillRect(3,10,1,20);ctx.fillRect(27,10,1,20);
            // Coffee cup icon on top
            ctx.fillStyle='#fff';ctx.beginPath();ctx.roundRect(11,3,10,8,2);ctx.fill();
            ctx.fillStyle='#f0e8e0';ctx.beginPath();ctx.roundRect(12,4,8,6,1.5);ctx.fill();
            // Coffee liquid
            ctx.fillStyle='#5a3018';ctx.beginPath();ctx.roundRect(12.5,5,7,4,1);ctx.fill();
            // Handle
            ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(22,7,2.5,Math.PI*1.5,Math.PI*0.5);ctx.stroke();
            // Steam
            var st1 = Math.sin(f*0.05)*1;
            var st2 = Math.sin(f*0.05+1)*1;
            ctx.strokeStyle='rgba(200,190,180,0.4)';ctx.lineWidth=0.8;
            ctx.beginPath();ctx.moveTo(14,3);ctx.quadraticCurveTo(14+st1,1,14,0);ctx.stroke();
            ctx.beginPath();ctx.moveTo(17,3);ctx.quadraticCurveTo(17+st2,0.5,17,-1);ctx.stroke();
            // Counter items: cups
            ctx.fillStyle='#f5e6c8';ctx.beginPath();ctx.roundRect(5,14,3,3,0.5);ctx.fill();
            ctx.fillStyle='#5a3018';ctx.fillRect(5.5,14.5,2,1);
            ctx.fillStyle='#e0d0c0';ctx.beginPath();ctx.roundRect(24,14,3,3,0.5);ctx.fill();
            ctx.fillStyle='#5a3018';ctx.fillRect(24.5,14.5,2,1);
            // Night glow
            if(night){ctx.fillStyle='rgba(255,200,100,0.12)';ctx.beginPath();ctx.ellipse(16,18,12,8,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,210,130,0.7)';ctx.beginPath();ctx.ellipse(16,17,3,2,0,0,Math.PI*2);ctx.fill();}

        } else if (type === 'ice-cream') {
            // Ground shadow
            ctx.fillStyle='rgba(0,30,10,0.22)';ctx.beginPath();ctx.ellipse(16,30,14,3,0,0,Math.PI*2);ctx.fill();
            // Back counter
            ctx.fillStyle='#2080a0';ctx.beginPath();ctx.roundRect(2,18,28,12,2);ctx.fill();
            // Counter top - white marble look
            ctx.fillStyle='#e8e8f0';ctx.beginPath();ctx.roundRect(2,16,28,4,2);ctx.fill();
            ctx.fillStyle='#f0f0f8';ctx.fillRect(3,16,26,2);
            // Front panel - light blue with wavy pattern
            ctx.fillStyle='#40a8c8';ctx.beginPath();ctx.roundRect(2,20,28,10,2);ctx.fill();
            // Wavy decoration
            ctx.strokeStyle='rgba(255,255,255,0.2)';ctx.lineWidth=1;
            ctx.beginPath();
            for(var wx=2;wx<30;wx+=0.5){ctx.lineTo(wx,24+Math.sin(wx*0.6)*1.5);}
            ctx.stroke();
            // Awning - blue & white stripes
            ctx.fillStyle='#30a0d0';ctx.beginPath();ctx.moveTo(0,10);ctx.lineTo(16,6);ctx.lineTo(32,10);ctx.lineTo(32,14);ctx.lineTo(0,14);ctx.closePath();ctx.fill();
            for(var si=0;si<8;si++){ctx.fillStyle=si%2===0?'#fff':'#30a0d0';ctx.beginPath();ctx.moveTo(si*4,10+(si<4?-si*0.5:-(8-si)*0.5));ctx.lineTo(si*4+4,10+(si<3?-(si+1)*0.5:-(7-si)*0.5));ctx.lineTo(si*4+4,14);ctx.lineTo(si*4,14);ctx.closePath();ctx.fill();}
            // Scalloped edge
            ctx.fillStyle='#30a0d0';
            for(var sc=0;sc<8;sc++){ctx.beginPath();ctx.arc(2+sc*4,14,2,0,Math.PI);ctx.fill();}
            // Support poles
            ctx.fillStyle='#2890b0';ctx.fillRect(3,10,2,20);ctx.fillRect(27,10,2,20);
            ctx.fillStyle='#38a0c0';ctx.fillRect(3,10,1,20);ctx.fillRect(27,10,1,20);
            // Ice cream cone icon on top
            // Cone
            ctx.fillStyle='#d4a056';ctx.beginPath();ctx.moveTo(16,13);ctx.lineTo(12,6);ctx.lineTo(20,6);ctx.closePath();ctx.fill();
            // Waffle pattern on cone
            ctx.strokeStyle='#c49046';ctx.lineWidth=0.4;
            ctx.beginPath();ctx.moveTo(13,7);ctx.lineTo(18,12);ctx.stroke();
            ctx.beginPath();ctx.moveTo(15,7);ctx.lineTo(19,10);ctx.stroke();
            ctx.beginPath();ctx.moveTo(19,7);ctx.lineTo(14,12);ctx.stroke();
            ctx.beginPath();ctx.moveTo(17,7);ctx.lineTo(13,10);ctx.stroke();
            // Scoops
            ctx.fillStyle='#ff90a0';ctx.beginPath();ctx.arc(14,5,3.5,0,Math.PI*2);ctx.fill(); // strawberry
            ctx.fillStyle='#f5e6c8';ctx.beginPath();ctx.arc(18,5,3.5,0,Math.PI*2);ctx.fill(); // vanilla
            ctx.fillStyle='#7a5030';ctx.beginPath();ctx.arc(16,2,3.5,0,Math.PI*2);ctx.fill(); // chocolate
            // Highlights on scoops
            ctx.fillStyle='rgba(255,255,255,0.35)';
            ctx.beginPath();ctx.arc(13,4,1.2,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.arc(17,4,1.2,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.arc(15,1,1.2,0,Math.PI*2);ctx.fill();
            // Cherry on top
            ctx.fillStyle='#e02040';ctx.beginPath();ctx.arc(16,0,1.5,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='rgba(255,255,255,0.4)';ctx.fillRect(15.5,-0.5,0.7,0.7);
            ctx.fillStyle='#4a8030';ctx.fillRect(15.8,-1.5,0.5,1.5);
            // Display tubs on counter
            ctx.fillStyle='#ff90a0';ctx.beginPath();ctx.ellipse(7,17,3,1.5,0,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#7a5030';ctx.beginPath();ctx.ellipse(13,17,3,1.5,0,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#f5e6c8';ctx.beginPath();ctx.ellipse(19,17,3,1.5,0,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#a0d8a0';ctx.beginPath();ctx.ellipse(25,17,3,1.5,0,0,Math.PI*2);ctx.fill();
            // Night glow
            if(night){ctx.fillStyle='rgba(100,200,255,0.1)';ctx.beginPath();ctx.ellipse(16,18,12,8,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(180,230,255,0.6)';ctx.beginPath();ctx.ellipse(16,17,3,2,0,0,Math.PI*2);ctx.fill();}

        } else if (type === 'soft-drinks') {
            // Ground shadow
            ctx.fillStyle='rgba(0,30,10,0.22)';ctx.beginPath();ctx.ellipse(16,30,14,3,0,0,Math.PI*2);ctx.fill();
            // Back counter
            ctx.fillStyle='#a02020';ctx.beginPath();ctx.roundRect(2,18,28,12,2);ctx.fill();
            // Counter top - stainless steel look
            ctx.fillStyle='#c8c8d0';ctx.beginPath();ctx.roundRect(2,16,28,4,2);ctx.fill();
            ctx.fillStyle='#d8d8e0';ctx.fillRect(3,16,26,2);
            // Front panel - red with white wave
            ctx.fillStyle='#cc2020';ctx.beginPath();ctx.roundRect(2,20,28,10,2);ctx.fill();
            ctx.fillStyle='rgba(255,255,255,0.15)';
            ctx.beginPath();ctx.moveTo(2,25);
            for(var wx=2;wx<30;wx+=0.5)ctx.lineTo(wx,25+Math.sin(wx*0.5)*1.5);
            ctx.lineTo(30,30);ctx.lineTo(2,30);ctx.closePath();ctx.fill();
            // Awning - red & yellow stripes
            ctx.fillStyle='#dd2020';ctx.beginPath();ctx.moveTo(0,10);ctx.lineTo(16,6);ctx.lineTo(32,10);ctx.lineTo(32,14);ctx.lineTo(0,14);ctx.closePath();ctx.fill();
            for(var si=0;si<8;si++){ctx.fillStyle=si%2===0?'#ffc020':'#dd2020';ctx.beginPath();ctx.moveTo(si*4,10+(si<4?-si*0.5:-(8-si)*0.5));ctx.lineTo(si*4+4,10+(si<3?-(si+1)*0.5:-(7-si)*0.5));ctx.lineTo(si*4+4,14);ctx.lineTo(si*4,14);ctx.closePath();ctx.fill();}
            // Scalloped edge
            ctx.fillStyle='#dd2020';
            for(var sc=0;sc<8;sc++){ctx.beginPath();ctx.arc(2+sc*4,14,2,0,Math.PI);ctx.fill();}
            // Support poles
            ctx.fillStyle='#b01818';ctx.fillRect(3,10,2,20);ctx.fillRect(27,10,2,20);
            ctx.fillStyle='#c02020';ctx.fillRect(3,10,1,20);ctx.fillRect(27,10,1,20);
            // Giant soda cup icon on top
            // Cup body
            ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(10,13);ctx.lineTo(11,5);ctx.lineTo(21,5);ctx.lineTo(22,13);ctx.closePath();ctx.fill();
            // Cup red stripe
            ctx.fillStyle='#dd2020';ctx.beginPath();ctx.moveTo(10.3,12);ctx.lineTo(10.7,8);ctx.lineTo(21.3,8);ctx.lineTo(20.7,12);ctx.closePath();ctx.fill();
            // Lid
            ctx.fillStyle='#e0e0e0';ctx.beginPath();ctx.roundRect(9.5,4,13,2,1);ctx.fill();
            // Straw
            ctx.fillStyle='#dd2020';ctx.fillRect(17,0,1.5,7);
            ctx.fillStyle='#ffc020';ctx.fillRect(17,0,1.5,1);ctx.fillRect(17,2,1.5,1);ctx.fillRect(17,4,1.5,1);
            // Straw bend
            ctx.strokeStyle='#dd2020';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(17.7,1);ctx.quadraticCurveTo(19,0,20,-1);ctx.stroke();
            // Condensation drops
            ctx.fillStyle='rgba(180,220,255,0.5)';
            ctx.beginPath();ctx.arc(12,9,0.7,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.arc(19,10,0.6,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.arc(14,11,0.5,0,Math.PI*2);ctx.fill();
            // Ice cubes visible through cup
            ctx.fillStyle='rgba(200,230,255,0.3)';ctx.fillRect(12,6,3,2);ctx.fillRect(16,7,2.5,2);
            // Fizz bubbles (animated)
            var bub1=Math.sin(f*0.08)*0.5,bub2=Math.sin(f*0.08+2)*0.5;
            ctx.fillStyle='rgba(255,255,255,0.4)';
            ctx.beginPath();ctx.arc(14,3+bub1,0.6,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.arc(16,2+bub2,0.5,0,Math.PI*2);ctx.fill();
            // Cups on counter
            ctx.fillStyle='#fff';ctx.beginPath();ctx.roundRect(5,14.5,4,3,0.5);ctx.fill();
            ctx.fillStyle='#dd2020';ctx.fillRect(5.5,15.5,3,1);
            ctx.fillStyle='#fff';ctx.beginPath();ctx.roundRect(23,14.5,4,3,0.5);ctx.fill();
            ctx.fillStyle='#2060c0';ctx.fillRect(23.5,15.5,3,1);
            // Night glow
            if(night){ctx.fillStyle='rgba(255,100,100,0.1)';ctx.beginPath();ctx.ellipse(16,18,12,8,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,200,100,0.6)';ctx.beginPath();ctx.ellipse(16,17,3,2,0,0,Math.PI*2);ctx.fill();}

        } else if (type === 'waffles') {
            // Ground shadow
            ctx.fillStyle='rgba(0,30,10,0.22)';ctx.beginPath();ctx.ellipse(16,30,14,3,0,0,Math.PI*2);ctx.fill();
            // Back counter (warm wood)
            ctx.fillStyle='#7a5530';ctx.beginPath();ctx.roundRect(2,18,28,12,2);ctx.fill();
            // Counter top
            ctx.fillStyle='#a07040';ctx.beginPath();ctx.roundRect(2,16,28,4,2);ctx.fill();
            ctx.fillStyle='#b08050';ctx.fillRect(3,16,26,2);
            // Front panel - warm orange/gold
            ctx.fillStyle='#d08020';ctx.beginPath();ctx.roundRect(2,20,28,10,2);ctx.fill();
            // Diamond pattern
            ctx.strokeStyle='rgba(255,255,255,0.12)';ctx.lineWidth=0.5;
            for(var dx=0;dx<7;dx++){ctx.beginPath();ctx.moveTo(4+dx*4,20);ctx.lineTo(6+dx*4,25);ctx.lineTo(4+dx*4,30);ctx.stroke();ctx.beginPath();ctx.moveTo(6+dx*4,20);ctx.lineTo(4+dx*4,25);ctx.lineTo(6+dx*4,30);ctx.stroke();}
            // Awning - orange & cream stripes
            ctx.fillStyle='#e08820';ctx.beginPath();ctx.moveTo(0,10);ctx.lineTo(16,6);ctx.lineTo(32,10);ctx.lineTo(32,14);ctx.lineTo(0,14);ctx.closePath();ctx.fill();
            for(var si=0;si<8;si++){ctx.fillStyle=si%2===0?'#f5e6c8':'#e08820';ctx.beginPath();ctx.moveTo(si*4,10+(si<4?-si*0.5:-(8-si)*0.5));ctx.lineTo(si*4+4,10+(si<3?-(si+1)*0.5:-(7-si)*0.5));ctx.lineTo(si*4+4,14);ctx.lineTo(si*4,14);ctx.closePath();ctx.fill();}
            // Scalloped edge
            ctx.fillStyle='#e08820';
            for(var sc=0;sc<8;sc++){ctx.beginPath();ctx.arc(2+sc*4,14,2,0,Math.PI);ctx.fill();}
            // Support poles
            ctx.fillStyle='#8a5520';ctx.fillRect(3,10,2,20);ctx.fillRect(27,10,2,20);
            ctx.fillStyle='#9a6530';ctx.fillRect(3,10,1,20);ctx.fillRect(27,10,1,20);
            // Waffle icon on top
            // Waffle base
            ctx.fillStyle='#d4a056';ctx.beginPath();ctx.roundRect(8,4,16,10,2);ctx.fill();
            // Grid pattern
            ctx.fillStyle='#c49046';
            for(var gy=0;gy<3;gy++)for(var gxx=0;gxx<4;gxx++){ctx.fillRect(9+gxx*4,5+gy*3.3,3,2.5);}
            // Grid lines
            ctx.strokeStyle='#b08036';ctx.lineWidth=0.5;
            for(var gl=0;gl<5;gl++)ctx.beginPath(),ctx.moveTo(9+gl*3.5,4),ctx.lineTo(9+gl*3.5,14),ctx.stroke();
            for(var gl=0;gl<4;gl++)ctx.beginPath(),ctx.moveTo(8,5+gl*3.3),ctx.lineTo(24,5+gl*3.3),ctx.stroke();
            // Whipped cream
            ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(14,4,3,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.arc(18,4,2.5,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.arc(16,3,2,0,Math.PI*2);ctx.fill();
            // Strawberry on top
            ctx.fillStyle='#e02040';ctx.beginPath();ctx.arc(16,1.5,2,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='rgba(255,255,255,0.3)';ctx.fillRect(15.2,1,0.8,0.8);
            ctx.fillStyle='#4a8030';ctx.fillRect(15.2,0,1.5,1);ctx.fillRect(14.5,0.3,1,0.5);ctx.fillRect(16.3,0.3,1,0.5);
            // Syrup drip
            ctx.fillStyle='#c08030';
            ctx.beginPath();ctx.moveTo(10,8);ctx.quadraticCurveTo(9,10,9,12);ctx.lineTo(10,12);ctx.quadraticCurveTo(10,10,10.5,8);ctx.fill();
            ctx.beginPath();ctx.moveTo(22,7);ctx.quadraticCurveTo(23,9,23.5,11);ctx.lineTo(22.5,11);ctx.quadraticCurveTo(22,9,22,7);ctx.fill();
            // Powdered sugar dusting
            ctx.fillStyle='rgba(255,255,255,0.3)';
            ctx.fillRect(11,6,1,1);ctx.fillRect(15,9,1,1);ctx.fillRect(20,6,1,1);ctx.fillRect(18,11,1,1);
            // Waffle iron on counter
            ctx.fillStyle='#555';ctx.beginPath();ctx.roundRect(11,15,10,3,1);ctx.fill();
            ctx.fillStyle='#666';ctx.fillRect(12,15,8,1.5);
            // Steam from iron
            var ws1 = Math.sin(f*0.06)*0.8;
            ctx.strokeStyle='rgba(220,210,200,0.3)';ctx.lineWidth=0.6;
            ctx.beginPath();ctx.moveTo(14,15);ctx.quadraticCurveTo(14+ws1,14,14,13);ctx.stroke();
            ctx.beginPath();ctx.moveTo(18,15);ctx.quadraticCurveTo(18-ws1,13.5,18,12.5);ctx.stroke();
            // Night glow
            if(night){ctx.fillStyle='rgba(255,180,60,0.12)';ctx.beginPath();ctx.ellipse(16,18,12,8,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,220,130,0.7)';ctx.beginPath();ctx.ellipse(16,17,3,2,0,0,Math.PI*2);ctx.fill();}
        }

        ctx.restore();
    }
    
    // Decor
    function drawBush(x, y) {
        drawGrass(x, y);
        var ctx = parkCtx, px = x * TILE_SIZE, py = y * TILE_SIZE;
        // Ground shadow
        ctx.fillStyle='rgba(0,30,10,0.22)';ctx.beginPath();ctx.ellipse(px+16,py+28,13,3.5,0,0,Math.PI*2);ctx.fill();
        // Back foliage layer (darkest)
        ctx.fillStyle='#3a7a40';
        ctx.beginPath();ctx.arc(px+10,py+22,7,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(px+22,py+22,7,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(px+16,py+23,8,0,Math.PI*2);ctx.fill();
        // Middle foliage layer
        ctx.fillStyle='#4d9e5d';
        ctx.beginPath();ctx.arc(px+9,py+17,6,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(px+16,py+18,7,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(px+23,py+17,6,0,Math.PI*2);ctx.fill();
        // Top foliage layer (brightest)
        ctx.fillStyle='#5aae6a';
        ctx.beginPath();ctx.arc(px+12,py+12,5.5,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(px+20,py+12,5.5,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#6dbe7a';
        ctx.beginPath();ctx.arc(px+16,py+9,5,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(px+11,py+8,3.5,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(px+21,py+8,3.5,0,Math.PI*2);ctx.fill();
        // Leaf highlights
        ctx.fillStyle='#8fd9a8';
        ctx.fillRect(px+10,py+7,2,2);ctx.fillRect(px+18,py+6,2,2);
        ctx.fillRect(px+14,py+11,2,1);ctx.fillRect(px+22,py+10,1,2);
        // Subtle inner shadow
        ctx.fillStyle='rgba(0,40,20,0.1)';
        ctx.beginPath();ctx.ellipse(px+16,py+22,10,4,0,0,Math.PI*2);ctx.fill();
        // Tiny berry accents
        ctx.fillStyle='#e06070';ctx.fillRect(px+8,py+14,2,2);ctx.fillRect(px+21,py+15,2,2);
        ctx.fillStyle='#e88090';ctx.fillRect(px+14,py+9,1,1);
    }
    function drawHedge(x, y) {
        drawGrass(x, y);
        var ctx = parkCtx, px = x * TILE_SIZE, py = y * TILE_SIZE;
        // Ground shadow
        ctx.fillStyle='rgba(0,30,10,0.2)';ctx.beginPath();ctx.ellipse(px+16,py+29,13,3,0,0,Math.PI*2);ctx.fill();
        // Main body — dark base
        ctx.fillStyle='#2d7a37';ctx.beginPath();ctx.roundRect(px+4,py+10,24,19,3);ctx.fill();
        // Middle green layer
        ctx.fillStyle='#3d8a47';ctx.beginPath();ctx.roundRect(px+5,py+8,22,17,3);ctx.fill();
        // Top face (lighter, gives 3D)
        ctx.fillStyle='#4d9a57';ctx.beginPath();ctx.roundRect(px+5,py+7,22,10,3);ctx.fill();
        // Highlight ridge on top
        ctx.fillStyle='#5daa67';ctx.beginPath();ctx.roundRect(px+6,py+7,20,5,2);ctx.fill();
        // Leaf texture — small dots
        ctx.fillStyle='#3a8242';
        ctx.fillRect(px+8,py+12,2,2);ctx.fillRect(px+14,py+14,2,2);ctx.fillRect(px+20,py+12,2,2);
        ctx.fillRect(px+11,py+18,2,2);ctx.fillRect(px+17,py+20,2,2);ctx.fillRect(px+23,py+18,2,1);
        ctx.fillRect(px+7,py+22,2,2);ctx.fillRect(px+13,py+24,2,1);
        // Light leaf spots
        ctx.fillStyle='#6dbe7a';
        ctx.fillRect(px+9,py+9,2,2);ctx.fillRect(px+16,py+8,2,1);ctx.fillRect(px+22,py+9,2,2);
        ctx.fillRect(px+12,py+11,1,1);ctx.fillRect(px+19,py+10,1,1);
        // Subtle trimmed edge lines
        ctx.fillStyle='rgba(0,50,20,0.12)';
        ctx.fillRect(px+5,py+26,22,1);
        ctx.fillRect(px+4,py+10,1,18);ctx.fillRect(px+27,py+10,1,18);
    }
    function drawFlowers(x, y) {
        drawGrass(x, y);
        var ctx = parkCtx, px = x * TILE_SIZE, py = y * TILE_SIZE;
        var flColors = ['#ff6b8a','#ffcc44','#6baeff','#c06bff','#ff5544','#ff9040','#fff','#ff88cc'];
        // Soil/planter bed base
        ctx.fillStyle='rgba(80,50,30,0.12)';ctx.beginPath();ctx.ellipse(px+16,py+28,13,3,0,0,Math.PI*2);ctx.fill();
        // Green leaf bed underneath
        ctx.fillStyle='#5aae6a';
        for(var li=0;li<5;li++){var lx=px+5+li*5.5,ly=py+22+Math.sin(li)*2;ctx.beginPath();ctx.ellipse(lx,ly,4,2.5,li*0.3,0,Math.PI*2);ctx.fill();}
        ctx.fillStyle='#4d9e5d';
        for(var li=0;li<4;li++){var lx=px+8+li*5.5,ly=py+24;ctx.beginPath();ctx.ellipse(lx,ly,3,2,0,0,Math.PI*2);ctx.fill();}
        // 7 flowers at varied positions
        var fpos = [{x:7,y:10},{x:16,y:7},{x:25,y:10},{x:5,y:18},{x:14,y:16},{x:22,y:17},{x:28,y:20}];
        for(var fi=0;fi<fpos.length;fi++){
            var fx=px+fpos[fi].x,fy=py+fpos[fi].y;
            var fc=flColors[fi%flColors.length];
            // Stem
            ctx.strokeStyle='#4a8a50';ctx.lineWidth=1;
            ctx.beginPath();ctx.moveTo(fx,fy+3);ctx.lineTo(fx+(fi%2?1:-1),fy+8);ctx.stroke();
            // Tiny leaf on stem
            ctx.fillStyle='#5aae6a';ctx.beginPath();ctx.ellipse(fx+(fi%2?2:-2),fy+5,2,1,fi%2?0.5:-0.5,0,Math.PI*2);ctx.fill();
            // Petals (5 around center)
            ctx.fillStyle=fc;
            for(var p=0;p<5;p++){var pa=p*Math.PI*2/5-Math.PI/2;ctx.beginPath();ctx.arc(fx+Math.cos(pa)*2.5,fy+Math.sin(pa)*2.5,1.8,0,Math.PI*2);ctx.fill();}
            // Center
            ctx.fillStyle='#ffdd44';ctx.beginPath();ctx.arc(fx,fy,1.3,0,Math.PI*2);ctx.fill();
            // Tiny highlight on one petal
            ctx.fillStyle='rgba(255,255,255,0.4)';ctx.fillRect(fx-1,fy-3,1,1);
        }
    }
    function drawStatue(x, y) {
        drawGrass(x, y);
        var ctx = parkCtx, px = x * TILE_SIZE, py = y * TILE_SIZE;
        // Ground shadow
        ctx.fillStyle='rgba(0,20,10,0.2)';ctx.beginPath();ctx.ellipse(px+16,py+29,10,3,0,0,Math.PI*2);ctx.fill();
        // Stone pedestal — base
        ctx.fillStyle='#707070';ctx.beginPath();ctx.roundRect(px+7,py+25,18,5,1.5);ctx.fill();
        ctx.fillStyle='#808080';ctx.beginPath();ctx.roundRect(px+8,py+24,16,3,1);ctx.fill();
        ctx.fillStyle='#909090';ctx.fillRect(px+9,py+24,14,1);
        // Pedestal middle
        ctx.fillStyle='#858585';ctx.beginPath();ctx.roundRect(px+9,py+21,14,4,1);ctx.fill();
        ctx.fillStyle='#959595';ctx.fillRect(px+10,py+21,12,1.5);
        // Body (torso)
        ctx.fillStyle='#a8a8a8';ctx.beginPath();ctx.roundRect(px+11,py+13,10,9,2);ctx.fill();
        // Lighter front face
        ctx.fillStyle='#b8b8b8';ctx.fillRect(px+12,py+14,8,7);
        // Head
        ctx.fillStyle='#b0b0b0';ctx.beginPath();ctx.arc(px+16,py+10,4.5,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#c0c0c0';ctx.beginPath();ctx.arc(px+15.5,py+9.5,3.5,0,Math.PI*2);ctx.fill();
        // Hair/crown
        ctx.fillStyle='#a0a0a0';ctx.beginPath();ctx.arc(px+16,py+7,3,Math.PI,0);ctx.fill();
        // Left arm outstretched with torch/object
        ctx.fillStyle='#b0b0b0';
        ctx.save();ctx.translate(px+11,py+14);ctx.rotate(-0.6);ctx.fillRect(-1,0,3,8);ctx.restore();
        // Right arm at side
        ctx.fillStyle='#a8a8a8';ctx.fillRect(px+21,py+14,3,6);ctx.fillRect(px+22,py+19,2,3);
        // Torch/star on left hand
        ctx.fillStyle='#d0c070';ctx.beginPath();ctx.arc(px+6,py+9,2,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#e8d888';ctx.beginPath();ctx.arc(px+6,py+8.5,1.2,0,Math.PI*2);ctx.fill();
        // Stone texture highlights
        ctx.fillStyle='rgba(255,255,255,0.08)';
        ctx.fillRect(px+12,py+15,1,5);ctx.fillRect(px+14,py+11,1,2);
        // Stone texture shadows
        ctx.fillStyle='rgba(0,0,0,0.06)';
        ctx.fillRect(px+19,py+15,1,6);ctx.fillRect(px+17,py+11,1,2);
        // Plaque on pedestal
        ctx.fillStyle='#7a6a50';ctx.beginPath();ctx.roundRect(px+11,py+25,10,2,0.5);ctx.fill();
        ctx.fillStyle='#8a7a60';ctx.fillRect(px+12,py+25.5,8,0.5);
    }
    function drawFountain(x, y) {
        var f = G.paused ? 0 : G.frame;
        var night = getDayPart() === 'night';
        var ctx = parkCtx, px = x * TILE_SIZE, py = y * TILE_SIZE;
        drawGrass(x, y);
        // Ground shadow
        ctx.fillStyle='rgba(0,20,30,0.18)';ctx.beginPath();ctx.ellipse(px+16,py+29,14,3.5,0,0,Math.PI*2);ctx.fill();
        // Outer basin — stone base
        ctx.fillStyle='#8878a0';ctx.beginPath();ctx.ellipse(px+16,py+26,14,5,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#9888b0';ctx.beginPath();ctx.ellipse(px+16,py+25,13,4.5,0,0,Math.PI*2);ctx.fill();
        // Basin rim
        ctx.fillStyle='#a898c0';ctx.beginPath();ctx.ellipse(px+16,py+24,12.5,4,0,0,Math.PI*2);ctx.fill();
        // Water surface
        ctx.fillStyle='#6dd5f7';ctx.beginPath();ctx.ellipse(px+16,py+24,11,3.5,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#5dc5e7';ctx.beginPath();ctx.ellipse(px+16,py+24,9,2.8,0,0,Math.PI*2);ctx.fill();
        // Water shimmer
        var shim=Math.sin(f*0.04)*0.3;
        ctx.fillStyle='rgba(180,230,255,'+(0.3+shim)+')';
        ctx.beginPath();ctx.ellipse(px+13,py+23,3,1,0.3,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='rgba(255,255,255,'+(0.2+shim*0.5)+')';
        ctx.beginPath();ctx.ellipse(px+19,py+24.5,2,0.8,-0.2,0,Math.PI*2);ctx.fill();
        // Central pedestal/pillar
        ctx.fillStyle='#9080a8';ctx.fillRect(px+14,py+17,4,8);
        ctx.fillStyle='#a090b8';ctx.fillRect(px+14,py+17,3,7);
        // Upper bowl
        ctx.fillStyle='#a898c0';ctx.beginPath();ctx.ellipse(px+16,py+17,5,2,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#6dd5f7';ctx.beginPath();ctx.ellipse(px+16,py+17,4,1.5,0,0,Math.PI*2);ctx.fill();
        // Spout tip
        ctx.fillStyle='#b0a0c8';ctx.beginPath();ctx.ellipse(px+16,py+14,2,1,0,0,Math.PI*2);ctx.fill();
        // Water jet & cascade
        if(!night&&!G.paused){
            var wh=10+Math.sin(f*0.015)*2;
            // Central jet
            for(var i=0;i<wh;i++){
                var sp=Math.sin((wh-i)*0.3)*1.5,al=0.55-i/wh*0.35;
                ctx.fillStyle='rgba(109,213,247,'+al+')';
                ctx.beginPath();ctx.ellipse(px+16,py+14-i,1.5+sp*0.3,1.5,0,0,Math.PI*2);ctx.fill();
            }
            // Splash crown at top
            ctx.fillStyle='rgba(180,230,255,0.4)';
            ctx.beginPath();ctx.arc(px+16,py+14-wh,2.5,0,Math.PI*2);ctx.fill();
            // Cascade drips from upper bowl
            var drip1=((f*0.06)%6),drip2=((f*0.06+3)%6);
            ctx.fillStyle='rgba(109,213,247,0.5)';
            ctx.fillRect(px+12,py+17+drip1,1,2);
            ctx.fillRect(px+20,py+17+drip2,1,2);
            // Ripple rings in basin
            var rr=2+Math.sin(f*0.03)*1;
            ctx.strokeStyle='rgba(180,230,255,0.25)';ctx.lineWidth=0.5;
            ctx.beginPath();ctx.ellipse(px+16,py+24,rr*2,rr*0.7,0,0,Math.PI*2);ctx.stroke();
            ctx.beginPath();ctx.ellipse(px+16,py+24,rr*3.5,rr*1.2,0,0,Math.PI*2);ctx.stroke();
        }
        // Night glow
        if(night){
            ctx.fillStyle='rgba(100,180,255,0.08)';ctx.beginPath();ctx.ellipse(px+16,py+20,14,10,0,0,Math.PI*2);ctx.fill();
        }
    }
    function drawWater(x, y) {
        var f = G.paused ? 0 : G.frame;
        var hT = isWaterAt(x, y-1), hB = isWaterAt(x, y+1), hL = isWaterAt(x-1, y), hR = isWaterAt(x+1, y);
        var px = x * TILE_SIZE, py = y * TILE_SIZE, S = TILE_SIZE;
        var c = parkCtx;
        
        // Outer water fill
        c.fillStyle = C.water1;
        c.fillRect(px, py, S, S);
        // Cut pixel-stepped corners where no neighbor (fill with grass)
        var steps = [[0,3],[1,2],[2,1],[3,1]];
        var grassCol = '#6cc478';
        function cutCorner(flipX, flipY) {
            c.fillStyle = grassCol;
            for (var i=0;i<steps.length;i++) {
                var cw = steps[i][1];
                var rx = flipX ? px + S - cw : px;
                var ry = flipY ? py + S - 1 - steps[i][0] : py + steps[i][0];
                c.fillRect(rx, ry, cw, 1);
            }
        }
        if (!hT && !hL) cutCorner(false, false);
        if (!hT && !hR) cutCorner(true, false);
        if (!hB && !hL) cutCorner(false, true);
        if (!hB && !hR) cutCorner(true, true);
        
        // Inner lighter water
        var m = 2;
        c.fillStyle = C.water2;
        c.fillRect(px + (hL?0:m), py + (hT?0:m), S - (hL?0:m) - (hR?0:m), S - (hT?0:m) - (hB?0:m));
        // Inner stepped corners
        var steps2 = [[0,2],[1,1]];
        function cutInner(flipX, flipY) {
            c.fillStyle = C.water1;
            for (var i=0;i<steps2.length;i++) {
                var cw = steps2[i][1];
                var rx = flipX ? px + S - m - cw : px + m;
                var ry = flipY ? py + S - m - 1 - steps2[i][0] : py + m + steps2[i][0];
                c.fillRect(rx, ry, cw, 1);
            }
        }
        if (!hT && !hL) cutInner(false, false);
        if (!hT && !hR) cutInner(true, false);
        if (!hB && !hL) cutInner(false, true);
        if (!hB && !hR) cutInner(true, true);
        
        // Animated pixel wave highlights (moving dashes)
        var wPhase = Math.floor(f * 0.04) % 4;
        c.fillStyle = 'rgba(255,255,255,0.25)';
        for (var wi = 0; wi < 3; wi++) {
            var wx = ((wi * 11 + wPhase * 3) % 24) + 4;
            var wy = 8 + wi * 8;
            c.fillRect(px+wx, py+wy, 2, 1);
        }
        c.fillStyle = 'rgba(255,255,255,0.15)';
        for (var si = 0; si < 4; si++) {
            var sx = ((si * 7 + wPhase * 5 + 3) % 26) + 3;
            var sy = ((si * 9 + wPhase * 2 + 5) % 24) + 4;
            c.fillRect(px+sx, py+sy, 1, 1);
        }
    }
    
    // Guests and effects
    function drawConstructionBar(x, y, cell) {
        var d = PPT.currentScenario.buildings[cell.type];
        var sz = d ? (d.size || 1) : 1;
        var total = cell.buildTotal || 1;
        var remaining = cell.buildTicks || 0;
        var progress = Math.max(0, Math.min(1, 1 - remaining / total));
        
        var px = x * TILE_SIZE;
        var py = y * TILE_SIZE;
        var tileW = TILE_SIZE * sz;
        
        // Bar dimensions: centered, pixel-snapped
        var barW = Math.min(tileW - 4, 28 * sz);
        var barH = 6;
        var barX = px + Math.floor((tileW - barW) / 2);
        var barY = py + Math.floor((TILE_SIZE * sz) / 2) + 4;
        
        // Background (dark)
        parkCtx.fillStyle = 'rgba(0,0,0,0.6)';
        parkCtx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
        
        // Empty track
        parkCtx.fillStyle = '#2a1f3d';
        parkCtx.fillRect(barX, barY, barW, barH);
        
        // Filled portion - smooth yellow bar
        var fillW = Math.round(progress * barW);
        if (fillW > 0) {
            // Solid yellow fill
            parkCtx.fillStyle = '#ffd93d';
            parkCtx.fillRect(barX, barY, fillW, barH);
            
            // Lighter highlight on top 2 rows
            parkCtx.fillStyle = 'rgba(255,255,255,0.3)';
            parkCtx.fillRect(barX, barY, fillW, 2);
            
            // Darker shadow on bottom row
            parkCtx.fillStyle = 'rgba(0,0,0,0.15)';
            parkCtx.fillRect(barX, barY + barH - 1, fillW, 1);
        }
        
        // Wrench icon above bar
        var wx = px + Math.floor(tileW / 2) - 3;
        var wy = barY - 9;
        parkCtx.fillStyle = '#888';
        parkCtx.fillRect(wx + 2, wy, 2, 7);
        parkCtx.fillStyle = '#aaa';
        parkCtx.fillRect(wx, wy - 1, 6, 3);
        parkCtx.fillRect(wx, wy + 1, 1, 1);
        parkCtx.fillRect(wx + 5, wy + 1, 1, 1);
    }
    function drawGuest(g) {
        if (G.carriedGuest === g) return;
        var f = G.paused ? 0 : G.frame, wf = Math.floor(f / 12) % 4;
        var sheet = getGuestSheet(g);
        parkCtx.imageSmoothingEnabled = false;
        parkCtx.drawImage(sheet, wf * 16, 0, 16, 16, g.x + SPR_OX, g.y + SPR_OY, 16, 16);
        // Highlight if inspected
        if (G.inspectedGuest === g) {
            parkCtx.strokeStyle = '#ffd93d';
            parkCtx.lineWidth = 1;
            parkCtx.strokeRect(g.x + SPR_OX - 1, g.y + SPR_OY - 1, 18, 18);
        }
    }
    // drawGuestBody replaced by pixel sprite system (see getGuestSheet + drawGuest)
    function drawBird(b) { var wu = Math.sin(G.frame * 0.08 + b.wing) > 0; var px = Math.round(b.x), py = Math.round(b.y); parkCtx.fillStyle = b.color; parkCtx.fillRect(px, py, 3, 2); parkCtx.fillRect(px+1, py+1, 1, 1); if (wu) { parkCtx.fillRect(px-2, py-1, 2, 1); parkCtx.fillRect(px+3, py-1, 2, 1); } else { parkCtx.fillRect(px-2, py+1, 2, 1); parkCtx.fillRect(px+3, py+1, 2, 1); } parkCtx.fillStyle = '#e8a040'; parkCtx.fillRect(px+3, py, 1, 1); }
    function drawLeaf(l) { var px = Math.round(l.x), py = Math.round(l.y); var phase = Math.floor(l.rot / (Math.PI * 0.5)) % 4; parkCtx.fillStyle = l.color; if (phase === 0 || phase === 2) { parkCtx.fillRect(px, py, 2, 1); parkCtx.fillRect(px, py+1, 1, 1); } else { parkCtx.fillRect(px, py, 1, 2); parkCtx.fillRect(px+1, py, 1, 1); } }
    function drawSparkle(s) { const pu = Math.sin(G.frame * 0.04 + s.x) * 0.5 + 0.5, al = s.life * pu * 0.4, sz = s.size * (0.5 + pu * 0.5); parkCtx.fillStyle = 'rgba(255,255,220,' + al + ')'; parkCtx.beginPath(); parkCtx.moveTo(s.x, s.y - sz); parkCtx.lineTo(s.x + sz * 0.3, s.y - sz * 0.3); parkCtx.lineTo(s.x + sz, s.y); parkCtx.lineTo(s.x + sz * 0.3, s.y + sz * 0.3); parkCtx.lineTo(s.x, s.y + sz); parkCtx.lineTo(s.x - sz * 0.3, s.y + sz * 0.3); parkCtx.lineTo(s.x - sz, s.y); parkCtx.lineTo(s.x - sz * 0.3, s.y - sz * 0.3); parkCtx.closePath(); parkCtx.fill(); }
    
    // Outside area contexts and state
    let outsideCtx = null;
    let foregroundCtx = null;
    let outsideDrawn = false;
    let outsideTintEl = null;
    let foregroundTintEl = null;
    let masterTintEl = null;
    let rainCtx = null;
    
    // ===== PERFORMANCE: DOM write caching for tints =====
    var _lastTintColor = '', _lastTintOpacity = '';
    var _outsideTintCleared = false, _fgTintCleared = false;
    var _weatherTintEl = null;
    var _lastWeatherBg = '', _lastWeatherOp = '';
    
    // Initialize outside canvas
    PPT.render.initOutside = function(ctx, fgCtx, tintEl, fgTintEl, masterTint) {
        outsideCtx = ctx;
        foregroundCtx = fgCtx;
        outsideTintEl = tintEl;
        foregroundTintEl = fgTintEl;
        masterTintEl = masterTint;
        outsideDrawn = false;
        _lastTintColor = ''; _lastTintOpacity = '';
        _outsideTintCleared = false; _fgTintCleared = false;
        _weatherTintEl = null; _lastWeatherBg = ''; _lastWeatherOp = '';
        var rc = document.getElementById('rain-canvas');
        rainCtx = rc ? rc.getContext('2d') : null;
    };
    
    // Update outside area day/night tint (DOM writes only when values actually change)
    PPT.render.updateOutsideTint = function() {
        const tn = getDayTint();
        if (tn.a > 0) {
            const color = 'rgba(' + tn.r + ',' + tn.g + ',' + tn.b + ',' + tn.a + ')';
            if (masterTintEl && (_lastTintColor !== color || _lastTintOpacity !== '1')) {
                masterTintEl.style.backgroundColor = color;
                masterTintEl.style.opacity = '1';
                _lastTintColor = color;
                _lastTintOpacity = '1';
            }
        } else {
            if (masterTintEl && _lastTintOpacity !== '0') {
                masterTintEl.style.opacity = '0';
                _lastTintOpacity = '0';
                _lastTintColor = '';
            }
        }
        // Hide individual tints — only write once
        if (outsideTintEl && !_outsideTintCleared) { outsideTintEl.style.opacity = '0'; _outsideTintCleared = true; }
        if (foregroundTintEl && !_fgTintCleared) { foregroundTintEl.style.opacity = '0'; _fgTintCleared = true; }
    };
    
    // Draw grass tile matching the park's checkerboard pattern
    function drawOutsideGrass(ctx, gx, gy) {
        var v = ((gx * 3 + gy * 7) & 3);
        if (!_grassTiles[v]) _grassTiles[v] = buildGrassTile(v);
        ctx.drawImage(_grassTiles[v], gx * TILE_SIZE, gy * TILE_SIZE);
    }
    
    // Draw tree at grid position
    function drawOutsideTree(ctx, gx, gy, type) {
        drawTreeOnCtx(ctx, gx, gy, 'tree-' + type, 0, 0);
    }
    
    // Draw wire fence - horizontal (top/bottom)
    function drawFence(ctx, x1, y1, x2, y2, horizontal) {
        const postColor = '#b0b0b0';
        const wireColor = '#c8c8c8';
        
        if (horizontal) {
            // Posts every 48px extending upward
            for (let x = x1; x <= x2; x += 48) {
                ctx.fillStyle = postColor;
                ctx.fillRect(x - 2, y1 - 12, 4, 14);
                ctx.fillStyle = '#d0d0d0';
                ctx.fillRect(x - 3, y1 - 14, 6, 3);
            }
            // Horizontal wires
            ctx.strokeStyle = wireColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x1, y1 - 5);
            ctx.lineTo(x2, y1 - 5);
            ctx.moveTo(x1, y1 - 9);
            ctx.lineTo(x2, y1 - 9);
            ctx.stroke();
        } else {
            // Vertical fence - same top-down perspective as horizontal
            // Posts every 48px extending upward (toward top of screen)
            for (let y = y1; y <= y2; y += 48) {
                ctx.fillStyle = postColor;
                ctx.fillRect(x1 - 2, y - 12, 4, 14);
                ctx.fillStyle = '#d0d0d0';
                ctx.fillRect(x1 - 3, y - 14, 6, 3);
            }
            // Vertical wire running along the fence line
            ctx.strokeStyle = wireColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x1 - 1, y1);
            ctx.lineTo(x1 - 1, y2);
            ctx.moveTo(x1 + 1, y1);
            ctx.lineTo(x1 + 1, y2);
            ctx.stroke();
        }
    }
    
    // Draw the outside area
    PPT.render.drawOutsideArea = function() {
        if (!outsideCtx || outsideDrawn) return;
        
        // Grid dimensions - park is 20x12 tiles, add 10 tile margin on each side
        const MARGIN = 10;
        const PARK_W = 20, PARK_H = 12;
        const TOTAL_W = PARK_W + MARGIN * 2; // 40
        const TOTAL_H = PARK_H + MARGIN * 2; // 32
        
        // Park boundaries in grid coords
        const parkX1 = MARGIN;         // 10
        const parkY1 = MARGIN;         // 10
        const parkX2 = MARGIN + PARK_W; // 30
        const parkY2 = MARGIN + PARK_H; // 22
        
        // Entrance is at grid row (parkY1 + 5)
        const entranceY = parkY1 + 5;
        
        // Pixel coordinates
        const parkLeft = parkX1 * TILE_SIZE;
        const parkTop = parkY1 * TILE_SIZE;
        const parkRight = parkX2 * TILE_SIZE;
        const parkBottom = parkY2 * TILE_SIZE;
        const entrancePx = entranceY * TILE_SIZE;
        
        // Draw grass everywhere except park area on background canvas
        for (let gy = 0; gy < TOTAL_H; gy++) {
            for (let gx = 0; gx < TOTAL_W; gx++) {
                // Skip inside park
                if (gx >= parkX1 && gx < parkX2 && gy >= parkY1 && gy < parkY2) continue;
                drawOutsideGrass(outsideCtx, gx, gy);
            }
        }
        
        // Draw entrance path (from left edge to park) — proper promenade style
        for (let gx = 0; gx < parkX1; gx++) {
            const px = gx * TILE_SIZE;
            const py = entrancePx;
            const promLv = PATH_CFG.tiles.levels[2];
            const w = promLv.w; // 22
            const hw = w / 2;   // 11
            const ct = 16 - hw; // top margin (5)
            const cb = 16 + hw; // bottom margin (27)
            
            // Draw path surface (full width horizontally, shaped vertically — grass already drawn by main loop)
            outsideCtx.fillStyle = promLv.base;
            outsideCtx.fillRect(px, py + ct, TILE_SIZE, w);
            
            // Paved texture (surfPaved style)
            for (let i = 0; i < 15; i++) {
                outsideCtx.fillStyle = psr(gx, entranceY, i*3+4002) > 0.5 ? promLv.hl : promLv.edge;
                outsideCtx.globalAlpha = 0.3;
                const tx = Math.floor(psr(gx, entranceY, i*3+4000) * 30) + 1;
                const ty = ct + Math.floor(psr(gx, entranceY, i*3+4001) * (w - 2)) + 1;
                outsideCtx.fillRect(px + tx, py + ty, 2, 2);
            }
            outsideCtx.globalAlpha = 1;
            // Horizontal tile lines
            outsideCtx.fillStyle = promLv.sh;
            outsideCtx.globalAlpha = 0.12;
            for (let y2 = ct; y2 < cb; y2 += 8) outsideCtx.fillRect(px, py + y2, TILE_SIZE, 1);
            // Vertical tile lines (brick pattern)
            for (let y2 = ct; y2 < cb; y2 += 8) {
                const o = (Math.floor((y2 - ct) / 8) % 2) * 5;
                for (let x2 = o; x2 < 32; x2 += 10) outsideCtx.fillRect(px + x2, py + y2, 1, Math.min(8, cb - y2));
            }
            outsideCtx.globalAlpha = 1;
            // Top half highlight
            outsideCtx.fillStyle = promLv.hl;
            outsideCtx.globalAlpha = 0.08;
            outsideCtx.fillRect(px, py + ct, TILE_SIZE, Math.floor(w / 2));
            outsideCtx.globalAlpha = 1;
            
            // Curb edges (top and bottom of path)
            outsideCtx.fillStyle = '#d8d0c0';
            outsideCtx.fillRect(px, py + ct - 1, TILE_SIZE, 1);
            outsideCtx.fillStyle = '#a89888';
            outsideCtx.fillRect(px, py + cb, TILE_SIZE, 1);
        }
        
        // Place trees on grid
        const usedCells = new Set();
        const bgTrees = [];
        const fgTrees = [];
        
        function placeTree(gx, gy, type, isFg) {
            const key = gx + ',' + gy;
            if (usedCells.has(key)) return;
            // Check not on path
            if (gy === entranceY && gx < parkX1) return;
            usedCells.add(key);
            if (isFg) fgTrees.push({ gx, gy, type });
            else bgTrees.push({ gx, gy, type });
        }
        
        // Top area - foreground trees (renders over park)
        // Row close to fence (parkY1 - 1 and parkY1 - 2) so canopies overlap fence
        placeTree(parkX1 - 7, parkY1 - 2, 'cherry', true);
        placeTree(parkX1 - 3, parkY1 - 1, 'oak', true);
        placeTree(parkX1 + 1, parkY1 - 2, 'pine', true);
        placeTree(parkX1 + 5, parkY1 - 1, 'cherry', true);
        placeTree(parkX1 + 9, parkY1 - 2, 'oak', true);
        placeTree(parkX1 + 13, parkY1 - 1, 'pine', true);
        placeTree(parkX1 + 17, parkY1 - 2, 'cherry', true);
        placeTree(parkX2 + 1, parkY1 - 1, 'oak', true);
        placeTree(parkX2 + 5, parkY1 - 2, 'pine', true);
        // Deeper top rows for depth
        placeTree(parkX1 - 5, parkY1 - 3, 'pine', true);
        placeTree(parkX1 + 3, parkY1 - 4, 'oak', true);
        placeTree(parkX1 + 11, parkY1 - 3, 'cherry', true);
        placeTree(parkX2 + 3, parkY1 - 4, 'pine', true);
        placeTree(parkX1 - 1, parkY1 - 5, 'cherry', true);
        placeTree(parkX1 + 7, parkY1 - 5, 'oak', true);
        placeTree(parkX1 + 15, parkY1 - 5, 'pine', true);
        placeTree(parkX2 - 1, parkY1 - 5, 'cherry', true);
        placeTree(parkX2 + 5, parkY1 - 3, 'oak', true);
        // Even deeper rows
        placeTree(parkX1 - 3, parkY1 - 7, 'oak', true);
        placeTree(parkX1 + 5, parkY1 - 7, 'pine', true);
        placeTree(parkX1 + 13, parkY1 - 7, 'cherry', true);
        placeTree(parkX2 + 1, parkY1 - 7, 'oak', true);
        placeTree(parkX2 + 7, parkY1 - 6, 'pine', true);
        placeTree(parkX1 - 7, parkY1 - 6, 'cherry', true);
        
        // Left area (background)
        placeTree(parkX1 - 7, parkY1 + 1, 'oak', false);
        placeTree(parkX1 - 6, parkY1 + 3, 'cherry', false);
        placeTree(parkX1 - 8, parkY1 + 5, 'pine', false);
        placeTree(parkX1 - 5, parkY1 + 7, 'oak', false);
        placeTree(parkX1 - 7, parkY1 + 9, 'cherry', false);
        placeTree(parkX1 - 4, parkY1 + 2, 'pine', false);
        placeTree(parkX1 - 3, parkY1 + 6, 'oak', false);
        placeTree(parkX1 - 2, parkY1 + 4, 'cherry', false);
        
        // Right area (background)
        placeTree(parkX2 + 2, parkY1 + 1, 'pine', false);
        placeTree(parkX2 + 4, parkY1 + 4, 'oak', false);
        placeTree(parkX2 + 6, parkY1 + 7, 'cherry', false);
        placeTree(parkX2 + 3, parkY1 + 10, 'pine', false);
        placeTree(parkX2 + 7, parkY1 + 2, 'cherry', false);
        placeTree(parkX2 + 5, parkY1 + 6, 'oak', false);
        placeTree(parkX2 + 8, parkY1 + 9, 'pine', false);
        
        // Bottom area (background)
        placeTree(parkX1 - 5, parkY2 + 1, 'oak', false);
        placeTree(parkX1 - 1, parkY2 + 2, 'cherry', false);
        placeTree(parkX1 + 3, parkY2 + 1, 'pine', false);
        placeTree(parkX1 + 7, parkY2 + 3, 'oak', false);
        placeTree(parkX1 + 11, parkY2 + 1, 'cherry', false);
        placeTree(parkX1 + 15, parkY2 + 2, 'pine', false);
        placeTree(parkX1 + 19, parkY2 + 1, 'oak', false);
        placeTree(parkX2 + 1, parkY2 + 2, 'pine', false);
        placeTree(parkX2 + 5, parkY2 + 1, 'cherry', false);
        placeTree(parkX1 - 3, parkY2 + 3, 'pine', false);
        placeTree(parkX1 + 5, parkY2 + 2, 'cherry', false);
        placeTree(parkX1 + 13, parkY2 + 3, 'oak', false);
        placeTree(parkX2 + 3, parkY2 + 3, 'cherry', false);
        placeTree(parkX2 + 7, parkY2 + 2, 'oak', false);
        // Deeper bottom rows
        placeTree(parkX1 - 7, parkY2 + 4, 'cherry', false);
        placeTree(parkX1 + 1, parkY2 + 5, 'pine', false);
        placeTree(parkX1 + 9, parkY2 + 4, 'oak', false);
        placeTree(parkX1 + 17, parkY2 + 5, 'cherry', false);
        placeTree(parkX2 + 5, parkY2 + 4, 'pine', false);
        placeTree(parkX2 + 8, parkY2 + 5, 'oak', false);
        placeTree(parkX1 - 5, parkY2 + 6, 'oak', false);
        placeTree(parkX1 + 7, parkY2 + 7, 'cherry', false);
        placeTree(parkX2 + 3, parkY2 + 6, 'pine', false);
        
        // Draw background trees
        bgTrees.forEach(t => drawOutsideTree(outsideCtx, t.gx, t.gy, t.type));
        
        // Draw fences on outside canvas (left fence visible, others as backup)
        // Left fence (gap for entrance)
        drawFence(outsideCtx, parkLeft, parkTop, parkLeft, entrancePx, false);
        drawFence(outsideCtx, parkLeft, entrancePx + TILE_SIZE, parkLeft, parkBottom, false);
        
        // Draw foreground layer (transparent - NO grass!)
        // The outside canvas at z-0 already provides grass for the entire surround.
        // By NOT drawing opaque grass on the foreground (z-3), park tree canopies
        // at z-2 remain visible above the fence line instead of being hidden.
        if (foregroundCtx) {
            // 1) Non-playable trees FIRST (so they appear BEHIND the fence)
            fgTrees.forEach(t => drawOutsideTree(foregroundCtx, t.gx, t.gy, t.type));
            
            // 2) ALL fences AFTER trees (fences render in front of non-playable trees)
            // Top fence
            drawFence(foregroundCtx, parkLeft, parkTop, parkRight, parkTop, true);
            // Bottom fence
            drawFence(foregroundCtx, parkLeft, parkBottom, parkRight, parkBottom, true);
            // Left fence (gap for entrance)
            drawFence(foregroundCtx, parkLeft, parkTop, parkLeft, entrancePx, false);
            drawFence(foregroundCtx, parkLeft, entrancePx + TILE_SIZE, parkLeft, parkBottom, false);
            // Right fence
            drawFence(foregroundCtx, parkRight, parkTop, parkRight, parkBottom, false);
        }
        
        outsideDrawn = true;
    };
    
    // Reset outside canvas (called on new game)
    PPT.render.resetOutside = function() {
        outsideDrawn = false;
    };
    
    // ==================== MAIN RENDER ====================
    
    PPT.render.renderPark = function() {
        if (!parkCtx) return;
        if (!G.paused) G.frame++;
        const night = getDayPart() === 'night';
        
        // Compute building openings for path rendering
        computeBuildingOpenings();
        
        // Reset lantern positions for this frame
        lanternPositions = [];
        
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
                
                // Ghost effect for under-construction buildings
                if (c.building) {
                    parkCtx.save();
                    parkCtx.globalAlpha = 0.35;
                }
                
                switch(c.type) {
                    case 'water': cachedTileDraw(x, y, 1, drawWater); break;
                    case 'tree-oak': case 'tree-pine': case 'tree-cherry': drawTree(x, y, c.type); break;
                    case 'entrance': drawEntrance(x, y); break;
                    case 'dirt-trail': case 'gravel-trail': case 'dirt-lane': case 'gravel-walk':
                    case 'stone-paving': case 'tarmac': case 'park-walkway': case 'park-road':
                    case 'promenade': case 'grand-avenue':
                        drawNewPath(x, y); break;
                    case 'merry-go-round': cachedTileDraw(x, y, 1, drawMerryGoRound); break;
                    case 'ferris-wheel': cachedTileDraw(x, y, 1, drawFerrisWheel); break;
                    case 'spiral-slide': cachedTileDraw(x, y, 1, drawSpiralSlide); break;
                    case 'haunted-house': cachedTileDraw(x, y, 1, drawHauntedHouse); break;
                    case 'pirate-ship': cachedTileDraw(x, y, 1, drawPirateShip); break;
                    case 'observation-tower': cachedTileDraw(x, y, 1, drawObservationTower); break;
                    case 'junior-coaster': cachedTileDraw(x, y, 2, drawJuniorCoaster); break;
                    case 'steel-coaster': cachedTileDraw(x, y, 2, drawSteelCoaster); break;
                    case 'wooden-coaster': cachedTileDraw(x, y, 2, drawWoodenCoaster); break;
                    case 'hyper-coaster': cachedTileDraw(x, y, 2, drawHyperCoaster); break;
                    case 'giga-coaster': cachedTileDraw(x, y, 2, drawGigaCoaster); break;
                    case 'wild-mouse': cachedTileDraw(x, y, 2, drawWildMouse); break;
                    case 'ice-cream': case 'soft-drinks': case 'waffles':
                    case 'burger-joint': case 'cotton-candy': case 'coffee-stand':
                        cachedTileDraw(x, y, 1, drawFoodStall, c.type); break;
                    case 'bush': cachedTileDraw(x, y, 1, drawBush); break;
                    case 'hedge': cachedTileDraw(x, y, 1, drawHedge); break;
                    case 'flowers': cachedTileDraw(x, y, 1, drawFlowers); break;
                    case 'statue': cachedTileDraw(x, y, 1, drawStatue); break;
                    case 'fountain': cachedTileDraw(x, y, 1, drawFountain); break;
                }
                
                if (c.building) {
                    parkCtx.restore();
                    drawConstructionBar(x, y, c);
                }
            }
        }
        
        // Effects
        if (!night) G.sparkles.forEach(s => drawSparkle(s));
        G.guestSprites.forEach(g => { if (g.in_attraction) return; if (!g.entering || g.x >= 0) drawGuest(g); });
        
        // Draw carried guest (1.5× with drop shadow, follows cursor)
        if (G.carriedGuest) {
            var cg = G.carriedGuest;
            parkCtx.fillStyle = 'rgba(0,0,0,0.25)';
            parkCtx.beginPath(); parkCtx.ellipse(cg.x + 8, cg.y + 18, 10, 4, 0, 0, Math.PI * 2); parkCtx.fill();
            var sheet = getGuestSheet(cg);
            parkCtx.imageSmoothingEnabled = false;
            parkCtx.drawImage(sheet, 0, 0, 16, 16, cg.x - 4, cg.y - 8, 24, 24);
        }
        
        G.leaves.forEach(l => drawLeaf(l));
        if (!night) G.birds.forEach(b => drawBird(b));
        
        // Staff sprites — pixel sprite system, hidden at night
        if (G.staffSprites && G.staffSprites.length > 0 && !night) {
            var scenario = PPT.currentScenario;
            var f = G.paused ? 0 : G.frame;
            G.staffSprites.forEach(function(s) {
                var sd = scenario.staff ? scenario.staff[s.type] : null;
                if (!sd) return;
                var moving = s.tx && s.wait <= 0;
                var wf = moving ? Math.floor(f / 16) % 4 : 0;
                if (!s._staffSheet) s._staffSheet = createStaffSheet(s.type);
                parkCtx.imageSmoothingEnabled = false;
                parkCtx.drawImage(s._staffSheet, wf * 16, 0, 16, 16, s.x + SPR_OX, s.y + SPR_OY, 16, 16);
            });
        }
        
        // Breakdown warning overlays
        if (G.rideBreakdowns && G.rideBreakdowns.length > 0) {
            G.rideBreakdowns.forEach(function(bd) {
                var bldg = G.buildings.find(function(b) { return b.x === bd.x && b.y === bd.y; });
                if (!bldg) return;
                var d = BUILDINGS[bldg.type];
                var sz = d ? (d.size || 1) : 1;
                var cx = bd.x * TILE_SIZE + (sz * TILE_SIZE) / 2;
                var cy = bd.y * TILE_SIZE;
                // Flashing red tint
                var flash = Math.sin(G.frame * 0.08) > 0 ? 0.15 : 0.08;
                parkCtx.fillStyle = 'rgba(255,60,60,' + flash + ')';
                parkCtx.fillRect(bd.x * TILE_SIZE, bd.y * TILE_SIZE, TILE_SIZE * sz, TILE_SIZE * sz);
                // Warning triangle
                parkCtx.fillStyle = '#ffd93d';
                parkCtx.beginPath();
                parkCtx.moveTo(cx, cy + 2); parkCtx.lineTo(cx - 5, cy + 12); parkCtx.lineTo(cx + 5, cy + 12);
                parkCtx.closePath(); parkCtx.fill();
                parkCtx.fillStyle = '#1a1a2e';
                parkCtx.fillRect(cx - 1, cy + 5, 2, 4);
                parkCtx.fillRect(cx - 1, cy + 10, 2, 1);
            });
        }
        
        // Pixel arrow indicator above inspected guest/staff/building
        (function() {
            var bounce = Math.sin((G.frame || 0) * 0.1) * 3; // bob up and down
            var arrowColor = '#FFD93D';
            var arrowOutline = '#1a1a2e';
            
            function drawPixelArrow(px, py) {
                var ay = py - 14 + bounce;
                // Shadow/outline
                parkCtx.fillStyle = arrowOutline;
                // Arrow body (3px wide, 6px tall)
                parkCtx.fillRect(px - 2, ay - 1, 5, 8);
                // Arrow head wings
                parkCtx.fillRect(px - 5, ay + 4, 11, 3);
                parkCtx.fillRect(px - 3, ay + 6, 7, 2);
                // Arrow fill
                parkCtx.fillStyle = arrowColor;
                // Body
                parkCtx.fillRect(px - 1, ay, 3, 6);
                // Head wings
                parkCtx.fillRect(px - 4, ay + 5, 9, 1);
                parkCtx.fillRect(px - 2, ay + 6, 5, 1);
                // Tip
                parkCtx.fillRect(px, ay + 7, 1, 1);
            }
            
            // Guest arrow
            if (G.inspectedGuest && G.guestSprites.indexOf(G.inspectedGuest) !== -1) {
                var g = G.inspectedGuest;
                drawPixelArrow(Math.round(g.x + 4), Math.round(g.y + SPR_OY - 2));
            }
            // Staff arrow
            if (G._inspectedStaff_sprite && G.staffSprites && G.staffSprites.indexOf(G._inspectedStaff_sprite) !== -1) {
                var s = G._inspectedStaff_sprite;
                drawPixelArrow(Math.round(s.x + SPR_OX + 8), Math.round(s.y + SPR_OY - 2));
            }
            // Building arrow
            if (G._inspectedStall) {
                var b = G._inspectedStall;
                var bd = BUILDINGS[b.type];
                var sz = bd ? (bd.size || 1) : 1;
                drawPixelArrow(Math.round(b.x * TILE_SIZE + sz * TILE_SIZE / 2), Math.round(b.y * TILE_SIZE - 2));
            }
        })();
        
        // Placement preview
        if (G.selected && G.hover) {
            const can = PPT.game.canPlace(G.hover.x, G.hover.y, G.selected);
            const sz = BUILDINGS[G.selected]?.size || 1;
            parkCtx.fillStyle = can ? 'rgba(200,255,210,0.65)' : 'rgba(255,107,157,0.5)';
            parkCtx.beginPath(); parkCtx.roundRect(G.hover.x * TILE_SIZE, G.hover.y * TILE_SIZE, TILE_SIZE * sz, TILE_SIZE * sz, 6); parkCtx.fill();
            parkCtx.strokeStyle = can ? 'rgba(255,255,255,0.7)' : 'rgba(255,60,60,0.6)';
            parkCtx.lineWidth = 2;
            parkCtx.stroke();
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
        
        // Day tint is handled by the master-tint overlay for consistent coloring
        
        // Weather visual overlays
        // PERF: Cache DOM element and last values to avoid per-frame lookups/writes
        if (PPT.events) {
            var visuals = PPT.events.getActiveVisuals();
            if (!_weatherTintEl) _weatherTintEl = document.getElementById('weather-tint');
            
            // Build combined weather tint for full-area overlay
            var weatherBg = '';
            var weatherOpacity = '0';
            
            // Rain drops (drawn on dedicated rain canvas for full coverage)
            if (visuals.indexOf('rain') >= 0) {
                if (rainCtx) {
                    rainCtx.clearRect(0, 0, 1280, 1024);
                    if (G.rain && G.rain.length > 0) {
                        // PERF: Batch all splashes into one path, all drops into one path
                        var hasSplash = false, hasStroke = false;
                        rainCtx.fillStyle = 'rgba(170,210,240,0.4)';
                        rainCtx.beginPath();
                        for (var ri = 0; ri < G.rain.length; ri++) {
                            var d = G.rain[ri];
                            if (d.splash) {
                                rainCtx.moveTo(d.x + 2, d.y);
                                rainCtx.arc(d.x, d.y, 2, 0, Math.PI * 2);
                                hasSplash = true;
                            }
                        }
                        if (hasSplash) rainCtx.fill();
                        
                        rainCtx.strokeStyle = 'rgba(170,210,240,0.6)';
                        rainCtx.lineWidth = 1;
                        rainCtx.beginPath();
                        for (var ri = 0; ri < G.rain.length; ri++) {
                            var d = G.rain[ri];
                            if (!d.splash) {
                                rainCtx.moveTo(d.x, d.y);
                                rainCtx.lineTo(d.x + d.vx, d.y + 3);
                                hasStroke = true;
                            }
                        }
                        if (hasStroke) rainCtx.stroke();
                    }
                }
                // Overcast tint via full-area overlay
                weatherBg = 'rgba(40,50,70,0.12)';
                weatherOpacity = '1';
            } else {
                // No rain — clear rain canvas
                if (rainCtx) rainCtx.clearRect(0, 0, 1280, 1024);
            }
            
            // Fog: full-area tint
            if (visuals.indexOf('fog') >= 0) {
                weatherBg = 'linear-gradient(to bottom, rgba(180,190,200,0) 0%, rgba(180,190,200,0.08) 40%, rgba(180,190,200,0.2) 100%)';
                weatherOpacity = '1';
            }
            
            // Heat wave: warm tint
            if (visuals.indexOf('heat') >= 0) {
                weatherBg = 'rgba(255,180,60,0.04)';
                weatherOpacity = '1';
            }
            
            // Power outage: dark flicker
            if (visuals.indexOf('powerout') >= 0) {
                var flick = Math.sin(G.frame * 0.15) > 0.3 ? 0.06 : 0.03;
                weatherBg = 'rgba(10,10,30,' + flick + ')';
                weatherOpacity = '1';
            }
            
            if (_weatherTintEl) {
                if (weatherBg !== _lastWeatherBg || weatherOpacity !== _lastWeatherOp) {
                    _weatherTintEl.style.background = weatherBg;
                    _weatherTintEl.style.opacity = weatherOpacity;
                    _lastWeatherBg = weatherBg;
                    _lastWeatherOp = weatherOpacity;
                }
            }
        }
        
        // Render overlay canvas (z-4, above fence/foreground)
        // Covers: tree canopies from top rows + entering guests on the outside path
        if (overlayCtx) {
            overlayCtx.clearRect(0, 0, 640 + OVERLAY_LEFT, 384 + OVERLAY_HEADROOM);
            
            // Re-draw trees from top 3 rows (shifted right by OVERLAY_LEFT, down by OVERLAY_HEADROOM)
            for (let oy = 0; oy < 3; oy++) {
                for (let ox = 0; ox < GRID_WIDTH; ox++) {
                    const oc = G.grid[oy][ox];
                    if (!oc || oc.parent) continue;
                    if (oc.type === 'tree-oak' || oc.type === 'tree-pine' || oc.type === 'tree-cherry') {
                        drawTreeOnCtx(overlayCtx, ox, oy, oc.type, OVERLAY_HEADROOM, OVERLAY_LEFT);
                    }
                }
            }
            
            // Draw entering guests on the outside entrance path
            const gf = G.paused ? 0 : G.frame;
            const gwf = Math.floor(gf / 12) % 4;
            const gbob = gwf % 2;
            G.guestSprites.forEach(function(g) {
                if (!g.entering) return;
                if (g.x >= 0) return;
                var gx = g.x + OVERLAY_LEFT;
                var gy = g.y + OVERLAY_HEADROOM;
                var sheet = getGuestSheet(g);
                overlayCtx.imageSmoothingEnabled = false;
                var owf = Math.floor((G.paused ? 0 : G.frame) / 12) % 4;
                overlayCtx.drawImage(sheet, owf * 16, 0, 16, 16, gx + SPR_OX, gy + SPR_OY, 16, 16);
            });
        }
        
        // Lantern glow at night — PERF: uses pre-rendered glow sprite
        if (glowCtx) {
            glowCtx.clearRect(0, 0, 640, 384);
            if (night && lanternPositions.length > 0) {
                var sprite = getGlowSprite();
                var halfGlow = _GLOW_SIZE / 2;
                glowCtx.globalCompositeOperation = 'lighter';
                lanternPositions.forEach(function(lp) {
                    var flicker = 0.85 + Math.sin(G.frame * 0.06 + lp.px * 0.1) * 0.15;
                    glowCtx.globalAlpha = flicker;
                    glowCtx.drawImage(sprite, lp.px - halfGlow, lp.py - halfGlow);
                });
                glowCtx.globalAlpha = 1;
                glowCtx.globalCompositeOperation = 'source-over';
            }
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
    // PERF: Track canvas size to avoid resetting every frame (resets GPU buffer)
    var _confW = 0, _confH = 0;
    PPT.render.updateConfetti = function() {
        if (!confCtx) return;
        var ww = window.innerWidth, wh = window.innerHeight;
        if (_confW !== ww || _confH !== wh) {
            confCtx.canvas.width = ww;
            confCtx.canvas.height = wh;
            _confW = ww; _confH = wh;
        }
        if (G.confetti.length === 0) return;
        confCtx.clearRect(0, 0, _confW, _confH);
        for (let i = G.confetti.length - 1; i >= 0; i--) {
            const c = G.confetti[i];
            c.x += c.vx; c.y += c.vy; c.rot += c.rotSpd; c.life -= 0.005;
            if (c.life <= 0 || c.y > _confH) { G.confetti.splice(i, 1); continue; }
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

