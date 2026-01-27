/**
 * Pixel Park Tycoon - Main Entry Point
 * Initialization, event handlers, and game loop
 */

(function() {
    'use strict';
    
    var parkCanvas, parkCtx, partCanvas, partCtx, confCanvas, confCtx;
    var selectedScenario = 'classic';
    var gameLoopId = null;
    var tickInterval = null;
    var welcomePreviewId = null;
    
    // ==================== GLOBAL FUNCTIONS (for inline onclick) ====================
    
    window.toggleSFX = function() {
        PPT.audio.toggleSFX();
    };
    
    window.toggleMusic = function() {
        PPT.audio.toggleMusic();
    };
    
    window.switchTab = function(t) {
        PPT.ui.switchTab(t);
    };
    
    window.togglePause = function() {
        PPT.ui.togglePause();
    };
    
    window.selectDemolish = function() {
        PPT.ui.selectDemolish();
    };
    
    window.showHelp = function() {
        PPT.ui.showHelp();
    };
    
    window.closeHelp = function() {
        PPT.ui.closeHelp();
    };
    
    window.toggleDebugPanel = function() {
        PPT.debug.togglePanel();
    };
    
    // ==================== SCREEN NAVIGATION ====================
    
    window.showWelcomeScreen = function() {
        document.getElementById('title-intro').style.display = 'none';
        document.getElementById('welcome-screen').style.display = 'flex';
        document.getElementById('scenario-screen').style.display = 'none';
        document.getElementById('game-container').style.display = 'none';
        startWelcomePreview();
    };
    
    window.showScenarioScreen = function() {
        document.getElementById('welcome-screen').style.display = 'none';
        document.getElementById('scenario-screen').style.display = 'flex';
        stopWelcomePreview();
        initScenarioGrid();
    };
    
    window.showCredits = function() {
        document.getElementById('credits-modal').classList.add('active');
    };
    
    window.closeCredits = function() {
        document.getElementById('credits-modal').classList.remove('active');
    };
    
    // ==================== TITLE INTRO ====================
    
    function startTitleIntro() {
        var intro = document.getElementById('title-intro');
        if (!intro) {
            showWelcomeScreen();
            return;
        }
        
        // Fade out after 1.5 seconds
        setTimeout(function() {
            intro.classList.add('fade-out');
            setTimeout(function() {
                showWelcomeScreen();
            }, 800);
        }, 1500);
    }
    
    function drawCoasterDecor(canvas, flipped) {
        if (!canvas) return;
        var ctx = canvas.getContext('2d');
        var C = PPT.config.C;
        
        ctx.clearRect(0, 0, 80, 60);
        
        // Track supports
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(10, 35, 4, 25);
        ctx.fillRect(35, 20, 4, 40);
        ctx.fillRect(60, 30, 4, 30);
        
        // Track
        ctx.strokeStyle = C.purple;
        ctx.lineWidth = 4;
        ctx.beginPath();
        if (flipped) {
            ctx.moveTo(0, 40);
            ctx.quadraticCurveTo(20, 10, 40, 25);
            ctx.quadraticCurveTo(60, 40, 80, 35);
        } else {
            ctx.moveTo(80, 40);
            ctx.quadraticCurveTo(60, 10, 40, 25);
            ctx.quadraticCurveTo(20, 40, 0, 35);
        }
        ctx.stroke();
        
        // Cross beams
        ctx.strokeStyle = C.pink;
        ctx.lineWidth = 2;
        for (var i = 0; i < 3; i++) {
            var x = 15 + i * 25;
            ctx.beginPath();
            ctx.moveTo(x, 35);
            ctx.lineTo(x + 8, 20);
            ctx.stroke();
        }
        
        // Cart
        var cartX = flipped ? 55 : 20;
        ctx.fillStyle = C.red;
        ctx.beginPath();
        ctx.roundRect(cartX, 15, 12, 8, 2);
        ctx.fill();
        
        // Riders
        ctx.fillStyle = '#ffd5b8';
        ctx.beginPath();
        ctx.arc(cartX + 4, 12, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cartX + 10, 12, 3, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // ==================== WELCOME PREVIEW ====================
    
    function startWelcomePreview() {
        var canvas = document.getElementById('welcome-preview');
        if (!canvas) return;
        
        var ctx = canvas.getContext('2d');
        var C = PPT.config.C;
        var frame = 0;
        var w = canvas.width;
        var h = canvas.height;
        
        function draw() {
            frame++;
            
            // Sky gradient
            var skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.5);
            skyGrad.addColorStop(0, '#87CEEB');
            skyGrad.addColorStop(0.5, '#B0E2FF');
            skyGrad.addColorStop(1, '#E0F4FF');
            ctx.fillStyle = skyGrad;
            ctx.fillRect(0, 0, w, h * 0.55);
            
            // Clouds
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            drawCloud(ctx, 80, 30, 1.2);
            drawCloud(ctx, 280, 45, 0.9);
            drawCloud(ctx, 480, 25, 1.1);
            drawCloud(ctx, 180, 60, 0.7);
            drawCloud(ctx, 380, 55, 0.8);
            
            // Background hills
            ctx.fillStyle = '#6bcb77';
            ctx.beginPath();
            ctx.moveTo(0, h * 0.55);
            ctx.quadraticCurveTo(w * 0.15, h * 0.45, w * 0.3, h * 0.52);
            ctx.quadraticCurveTo(w * 0.5, h * 0.4, w * 0.7, h * 0.5);
            ctx.quadraticCurveTo(w * 0.85, h * 0.42, w, h * 0.55);
            ctx.lineTo(w, h);
            ctx.lineTo(0, h);
            ctx.fill();
            
            // Main grass area
            ctx.fillStyle = C.grass1;
            ctx.fillRect(0, h * 0.55, w, h * 0.45);
            
            // Grass texture
            ctx.fillStyle = C.grass2;
            for (var y = h * 0.55; y < h; y += 16) {
                for (var x = ((Math.floor(y / 16) % 2) === 0 ? 0 : 16); x < w; x += 32) {
                    ctx.fillRect(x, y, 16, 16);
                }
            }
            
            // Coaster track (background) - large sweeping track
            ctx.save();
            // Support beams
            ctx.fillStyle = '#654321';
            ctx.fillRect(40, 70, 6, 120);
            ctx.fillRect(120, 40, 6, 150);
            ctx.fillRect(200, 60, 6, 130);
            ctx.fillRect(350, 50, 6, 140);
            ctx.fillRect(450, 65, 6, 125);
            ctx.fillRect(520, 45, 6, 145);
            
            // Cross beams
            ctx.strokeStyle = '#8b4513';
            ctx.lineWidth = 2;
            for (var i = 0; i < 6; i++) {
                var bx = [43, 123, 203, 353, 453, 523][i];
                var by = [90, 60, 80, 70, 85, 65][i];
                ctx.beginPath();
                ctx.moveTo(bx, by);
                ctx.lineTo(bx - 15, by + 40);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(bx, by + 20);
                ctx.lineTo(bx - 10, by + 50);
                ctx.stroke();
            }
            
            // Main track
            ctx.strokeStyle = C.red;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(-10, 100);
            ctx.quadraticCurveTo(40, 70, 120, 40);
            ctx.quadraticCurveTo(160, 80, 200, 60);
            ctx.quadraticCurveTo(280, 100, 350, 50);
            ctx.quadraticCurveTo(400, 90, 450, 65);
            ctx.quadraticCurveTo(490, 45, 520, 45);
            ctx.quadraticCurveTo(560, 70, w + 10, 55);
            ctx.stroke();
            
            // Track rails
            ctx.strokeStyle = '#8B0000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-10, 95);
            ctx.quadraticCurveTo(40, 65, 120, 35);
            ctx.quadraticCurveTo(160, 75, 200, 55);
            ctx.quadraticCurveTo(280, 95, 350, 45);
            ctx.quadraticCurveTo(400, 85, 450, 60);
            ctx.quadraticCurveTo(490, 40, 520, 40);
            ctx.quadraticCurveTo(560, 65, w + 10, 50);
            ctx.stroke();
            ctx.restore();
            
            // Left tree (green)
            drawDetailedTree(ctx, 25, 140, 1.3);
            
            // Ferris wheel
            drawDetailedFerrisWheel(ctx, 320, 120, 55, frame);
            
            // Pink cherry tree (right side)
            drawCherryTree(ctx, w - 60, 130, 1.2);
            
            // Tent/Carousel
            drawCarouselTent(ctx, 140, 155, frame);
            
            // Food stalls
            drawFoodStall(ctx, 420, 165, C.red, '#fff');
            drawFoodStall(ctx, 480, 170, C.yellow, C.orange);
            
            // Building (left)
            drawBuilding(ctx, 55, 155, '#64B5F6', '#1E88E5');
            
            // Path
            ctx.fillStyle = C.path1;
            ctx.fillRect(0, h * 0.8, w, h * 0.12);
            ctx.fillStyle = C.path2;
            ctx.fillRect(0, h * 0.8, w, 3);
            
            // Path tiles
            ctx.strokeStyle = C.path3;
            ctx.lineWidth = 1;
            for (var tx = 0; tx < w; tx += 20) {
                ctx.beginPath();
                ctx.moveTo(tx, h * 0.8);
                ctx.lineTo(tx, h * 0.92);
                ctx.stroke();
            }
            
            // Grass patches on path edge
            ctx.fillStyle = C.grass3;
            for (var gp = 0; gp < w; gp += 35) {
                ctx.beginPath();
                ctx.ellipse(gp + 10, h * 0.8, 8, 3, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Animated guests (many!)
            var guestPositions = [
                { x: 90, y: h * 0.83 },
                { x: 150, y: h * 0.85 },
                { x: 200, y: h * 0.82 },
                { x: 260, y: h * 0.86 },
                { x: 320, y: h * 0.83 },
                { x: 370, y: h * 0.85 },
                { x: 430, y: h * 0.82 },
                { x: 500, y: h * 0.84 },
                { x: 120, y: h * 0.87 },
                { x: 280, y: h * 0.84 },
                { x: 400, y: h * 0.86 },
                { x: 460, y: h * 0.83 }
            ];
            
            for (var g = 0; g < guestPositions.length; g++) {
                var gp = guestPositions[g];
                var bob = Math.floor((frame + g * 7) / 8) % 2;
                var walkOffset = Math.sin((frame + g * 20) * 0.05) * 2;
                drawGuest(ctx, gp.x + walkOffset, gp.y + bob, g);
            }
            
            // Tooltip callouts
            drawTooltip(ctx, 70, 55, 'Build thrilling\nrollercoasters!', frame);
            drawTooltip(ctx, 400, 125, 'Manage happy\nguests!', frame, true);
            drawTooltip(ctx, 510, h * 0.72, 'Grow your\npark!', frame, true);
            
            // Sparkle effects
            drawSparkles(ctx, frame, w, h);
            
            welcomePreviewId = requestAnimationFrame(draw);
        }
        
        draw();
    }
    
    function drawCloud(ctx, x, y, scale) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.arc(25, -5, 25, 0, Math.PI * 2);
        ctx.arc(50, 0, 20, 0, Math.PI * 2);
        ctx.arc(15, 10, 15, 0, Math.PI * 2);
        ctx.arc(35, 10, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    
    function drawDetailedTree(ctx, x, y, scale) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.ellipse(0, 30, 25, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Trunk
        ctx.fillStyle = '#5D4037';
        ctx.fillRect(-6, 0, 12, 35);
        ctx.fillStyle = '#4E342E';
        ctx.fillRect(-3, 5, 3, 25);
        
        // Foliage layers
        ctx.fillStyle = '#2E7D32';
        ctx.beginPath();
        ctx.arc(-15, -20, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(15, -20, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, -10, 25, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#388E3C';
        ctx.beginPath();
        ctx.arc(-10, -30, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(10, -30, 18, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.arc(0, -40, 15, 0, Math.PI * 2);
        ctx.fill();
        
        // Highlights
        ctx.fillStyle = '#81C784';
        ctx.beginPath();
        ctx.arc(-5, -45, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(8, -32, 6, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
    
    function drawCherryTree(ctx, x, y, scale) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.ellipse(0, 30, 25, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Trunk
        ctx.fillStyle = '#5D4037';
        ctx.fillRect(-5, 0, 10, 35);
        
        // Pink foliage
        ctx.fillStyle = '#F8BBD9';
        ctx.beginPath();
        ctx.arc(-12, -15, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(12, -15, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, -5, 22, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#F48FB1';
        ctx.beginPath();
        ctx.arc(-8, -28, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(8, -28, 15, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#EC407A';
        ctx.beginPath();
        ctx.arc(0, -38, 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Light highlights
        ctx.fillStyle = '#FCE4EC';
        ctx.beginPath();
        ctx.arc(-3, -42, 6, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
    
    function drawDetailedFerrisWheel(ctx, x, y, radius, frame) {
        ctx.save();
        ctx.translate(x, y);
        
        // Support structure
        ctx.fillStyle = '#455A64';
        ctx.beginPath();
        ctx.moveTo(-8, radius + 25);
        ctx.lineTo(-25, radius + 60);
        ctx.lineTo(-15, radius + 60);
        ctx.lineTo(0, radius + 30);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(8, radius + 25);
        ctx.lineTo(25, radius + 60);
        ctx.lineTo(15, radius + 60);
        ctx.lineTo(0, radius + 30);
        ctx.fill();
        
        // Center support
        ctx.fillStyle = '#607D8B';
        ctx.fillRect(-4, 0, 8, radius + 30);
        
        // Wheel rim
        ctx.strokeStyle = C.pink;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Inner rim
        ctx.strokeStyle = '#E91E63';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, radius - 8, 0, Math.PI * 2);
        ctx.stroke();
        
        // Spokes
        ctx.strokeStyle = '#F06292';
        ctx.lineWidth = 2;
        for (var s = 0; s < 8; s++) {
            var sa = (s / 8) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(sa) * radius, Math.sin(sa) * radius);
            ctx.stroke();
        }
        
        // Gondolas
        var gondolaColors = [C.red, '#2196F3', C.yellow, '#4CAF50', C.purple, C.orange, '#00BCD4', '#FF5722'];
        for (var g = 0; g < 8; g++) {
            var ga = (frame * 0.01 + g / 8) * Math.PI * 2;
            var gx = Math.cos(ga) * radius;
            var gy = Math.sin(ga) * radius;
            
            // Gondola body
            ctx.fillStyle = gondolaColors[g];
            ctx.beginPath();
            ctx.roundRect(gx - 10, gy - 6, 20, 14, 4);
            ctx.fill();
            
            // Gondola roof
            ctx.fillStyle = '#333';
            ctx.beginPath();
            ctx.roundRect(gx - 8, gy - 10, 16, 5, 2);
            ctx.fill();
            
            // Little window
            ctx.fillStyle = '#B3E5FC';
            ctx.fillRect(gx - 5, gy - 3, 10, 6);
        }
        
        // Center hub
        ctx.fillStyle = C.yellow;
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFA000';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
    
    function drawCarouselTent(ctx, x, y, frame) {
        ctx.save();
        ctx.translate(x, y);
        
        // Base
        ctx.fillStyle = '#8D6E63';
        ctx.fillRect(-35, 20, 70, 12);
        
        // Striped canopy
        var stripeColors = [C.orange, '#fff'];
        for (var s = 0; s < 8; s++) {
            ctx.fillStyle = stripeColors[s % 2];
            ctx.beginPath();
            ctx.moveTo(-35 + s * 9, 20);
            ctx.lineTo(-35 + s * 9 + 9, 20);
            ctx.lineTo(-15 + s * 4, -25);
            ctx.lineTo(-15 + s * 4 - 4, -25);
            ctx.fill();
        }
        
        // Tent top
        ctx.fillStyle = C.red;
        ctx.beginPath();
        ctx.moveTo(-40, 20);
        ctx.lineTo(0, -35);
        ctx.lineTo(40, 20);
        ctx.closePath();
        ctx.fill();
        
        // Decorative trim
        ctx.fillStyle = C.yellow;
        ctx.beginPath();
        ctx.moveTo(-40, 20);
        ctx.lineTo(0, -30);
        ctx.lineTo(40, 20);
        ctx.lineTo(35, 20);
        ctx.lineTo(0, -22);
        ctx.lineTo(-35, 20);
        ctx.closePath();
        ctx.fill();
        
        // Top ornament
        ctx.fillStyle = C.yellow;
        ctx.beginPath();
        ctx.arc(0, -38, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = C.red;
        ctx.beginPath();
        ctx.moveTo(0, -48);
        ctx.lineTo(-4, -38);
        ctx.lineTo(4, -38);
        ctx.fill();
        
        // Carousel horses (simplified)
        var horseAngles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
        for (var h = 0; h < 4; h++) {
            var ha = horseAngles[h] + frame * 0.02;
            var hx = Math.cos(ha) * 20;
            var hy = 25 + Math.sin(frame * 0.1 + h) * 2;
            ctx.fillStyle = ['#fff', '#D7CCC8', '#FFCC80', '#F8BBD9'][h];
            ctx.beginPath();
            ctx.ellipse(hx, hy, 6, 4, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
    
    function drawFoodStall(ctx, x, y, color1, color2) {
        ctx.save();
        ctx.translate(x, y);
        
        // Counter
        ctx.fillStyle = '#5D4037';
        ctx.fillRect(-20, 10, 40, 18);
        
        // Awning stripes
        for (var a = 0; a < 5; a++) {
            ctx.fillStyle = a % 2 ? color1 : color2;
            ctx.fillRect(-20 + a * 8, -5, 8, 18);
        }
        
        // Awning top
        ctx.fillStyle = color1;
        ctx.beginPath();
        ctx.moveTo(-25, -5);
        ctx.lineTo(0, -18);
        ctx.lineTo(25, -5);
        ctx.lineTo(20, -5);
        ctx.lineTo(0, -12);
        ctx.lineTo(-20, -5);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    }
    
    function drawBuilding(ctx, x, y, color1, color2) {
        ctx.save();
        ctx.translate(x, y);
        
        // Main building
        ctx.fillStyle = color1;
        ctx.fillRect(-25, -35, 50, 60);
        
        // Roof
        ctx.fillStyle = color2;
        ctx.beginPath();
        ctx.moveTo(-30, -35);
        ctx.lineTo(0, -55);
        ctx.lineTo(30, -35);
        ctx.fill();
        
        // Windows
        ctx.fillStyle = '#B3E5FC';
        ctx.fillRect(-18, -25, 12, 15);
        ctx.fillRect(6, -25, 12, 15);
        
        // Door
        ctx.fillStyle = '#1565C0';
        ctx.fillRect(-8, 0, 16, 25);
        ctx.fillStyle = C.yellow;
        ctx.beginPath();
        ctx.arc(5, 12, 2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
    
    function drawGuest(ctx, x, y, index) {
        var colors = PPT.config.GUEST_COLORS;
        var hairColors = PPT.config.HAIR_COLORS;
        
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(x, y + 12, 5, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Body
        ctx.fillStyle = colors[index % colors.length];
        ctx.fillRect(x - 4, y, 8, 10);
        
        // Head
        ctx.fillStyle = '#FFCCBC';
        ctx.beginPath();
        ctx.arc(x, y - 4, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Hair
        ctx.fillStyle = hairColors[index % hairColors.length];
        ctx.beginPath();
        ctx.arc(x, y - 6, 4, Math.PI, 0);
        ctx.fill();
        
        // Arms
        ctx.fillStyle = colors[index % colors.length];
        ctx.fillRect(x - 6, y + 2, 3, 5);
        ctx.fillRect(x + 3, y + 2, 3, 5);
    }
    
    function drawTooltip(ctx, x, y, text, frame, pointLeft) {
        var lines = text.split('\n');
        var maxWidth = 0;
        ctx.font = '8px "Press Start 2P"';
        lines.forEach(function(line) {
            maxWidth = Math.max(maxWidth, ctx.measureText(line).width);
        });
        
        var padding = 8;
        var lineHeight = 12;
        var boxWidth = maxWidth + padding * 2;
        var boxHeight = lines.length * lineHeight + padding * 2 - 4;
        
        // Floating animation
        var floatY = Math.sin(frame * 0.05) * 3;
        
        // Box shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.roundRect(x + 3, y + floatY + 3, boxWidth, boxHeight, 6);
        ctx.fill();
        
        // Box
        ctx.fillStyle = '#FFF8E1';
        ctx.strokeStyle = '#FFB300';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y + floatY, boxWidth, boxHeight, 6);
        ctx.fill();
        ctx.stroke();
        
        // Pointer
        var pointerX = pointLeft ? x : x + boxWidth - 15;
        ctx.fillStyle = '#FFF8E1';
        ctx.beginPath();
        ctx.moveTo(pointerX, y + floatY + boxHeight);
        ctx.lineTo(pointerX + 8, y + floatY + boxHeight + 10);
        ctx.lineTo(pointerX + 16, y + floatY + boxHeight);
        ctx.fill();
        ctx.strokeStyle = '#FFB300';
        ctx.beginPath();
        ctx.moveTo(pointerX, y + floatY + boxHeight);
        ctx.lineTo(pointerX + 8, y + floatY + boxHeight + 10);
        ctx.lineTo(pointerX + 16, y + floatY + boxHeight);
        ctx.stroke();
        
        // Text
        ctx.fillStyle = '#5D4037';
        lines.forEach(function(line, i) {
            ctx.fillText(line, x + padding, y + floatY + padding + 8 + i * lineHeight);
        });
    }
    
    function drawSparkles(ctx, frame, w, h) {
        ctx.fillStyle = '#FFD700';
        var sparklePositions = [
            { x: 50, y: 180 }, { x: 150, y: 200 }, { x: 280, y: 190 },
            { x: 400, y: 185 }, { x: 520, y: 195 }, { x: 100, y: 210 },
            { x: 350, y: 205 }, { x: 480, y: 180 }
        ];
        
        sparklePositions.forEach(function(sp, i) {
            var twinkle = Math.sin(frame * 0.1 + i * 2) * 0.5 + 0.5;
            if (twinkle > 0.3) {
                ctx.globalAlpha = twinkle;
                drawStar(ctx, sp.x, sp.y, 4, 2, 4);
            }
        });
        ctx.globalAlpha = 1;
    }
    
    function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
        var rot = Math.PI / 2 * 3;
        var x = cx;
        var y = cy;
        var step = Math.PI / spikes;
        
        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);
        for (var i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;
            
            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        ctx.fill();
    }
    
    function stopWelcomePreview() {
        if (welcomePreviewId) {
            cancelAnimationFrame(welcomePreviewId);
            welcomePreviewId = null;
        }
    }
    
    // ==================== SCENARIO GRID ====================
    
    function initScenarioGrid() {
        var grid = document.getElementById('scenario-grid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        // Draw back arrow for mobile
        drawBackArrow(document.getElementById('back-arrow-icon'));
        
        // Define all 6 scenario slots with nice names
        var scenarios = [
            { id: 'classic', status: 'playable', name: 'Green Valley' },
            { id: null, status: 'locked', name: 'Desert Oasis' },
            { id: null, status: 'locked', name: 'Winter Wonderland' },
            { id: null, status: 'locked', name: 'Tropical Paradise' },
            { id: null, status: 'locked', name: 'Space Station' },
            { id: null, status: 'locked', name: 'Haunted Hills' }
        ];
        
        scenarios.forEach(function(slot, index) {
            var card = document.createElement('div');
            card.className = 'scenario-card-new';
            
            var s = slot.id ? PPT.scenarios[slot.id] : null;
            var isLocked = slot.status === 'locked';
            
            if (isLocked) card.classList.add('locked');
            if (slot.id === selectedScenario) card.classList.add('selected');
            
            // Preview area
            var preview = document.createElement('div');
            preview.className = 'scenario-preview';
            
            var previewCanvas = document.createElement('canvas');
            previewCanvas.width = 250;
            previewCanvas.height = 140;
            drawScenarioPreview(previewCanvas, index);
            preview.appendChild(previewCanvas);
            
            // Overlay for locked scenarios
            if (isLocked) {
                var overlay = document.createElement('div');
                overlay.className = 'scenario-overlay';
                var overlayText = document.createElement('div');
                overlayText.className = 'scenario-overlay-text';
                overlayText.textContent = 'Coming soon';
                overlay.appendChild(overlayText);
                preview.appendChild(overlay);
            }
            
            card.appendChild(preview);
            
            // Info section
            var info = document.createElement('div');
            info.className = 'scenario-info';
            
            var name = document.createElement('div');
            name.className = 'scenario-card-name';
            name.textContent = slot.name;
            info.appendChild(name);
            
            // Start button for playable, locked button for locked - inside info section
            if (!isLocked && s) {
                var startBtn = document.createElement('button');
                startBtn.className = 'scenario-start-btn';
                startBtn.textContent = 'START';
                startBtn.onclick = function(e) {
                    e.stopPropagation();
                    selectedScenario = slot.id;
                    startGame();
                };
                info.appendChild(startBtn);
                
                card.onclick = function() {
                    document.querySelectorAll('.scenario-card-new').forEach(function(c) {
                        c.classList.remove('selected');
                    });
                    card.classList.add('selected');
                    selectedScenario = slot.id;
                };
            } else if (isLocked) {
                var lockedBtn = document.createElement('button');
                lockedBtn.className = 'scenario-start-btn locked-btn';
                lockedBtn.textContent = 'LOCKED';
                lockedBtn.disabled = true;
                info.appendChild(lockedBtn);
            }
            
            card.appendChild(info);
            
            grid.appendChild(card);
        });
    }
    
    function drawBackArrow(canvas) {
        if (!canvas) return;
        var ctx = canvas.getContext('2d');
        var sz = 24;
        ctx.clearRect(0, 0, sz, sz);
        
        // Pixel art chevron pointing left < shape - white for contrast on pink
        ctx.fillStyle = '#ffffff';
        
        // Clean chevron
        ctx.fillRect(14, 4, 3, 3);
        ctx.fillRect(11, 7, 3, 3);
        ctx.fillRect(8, 10, 3, 4);
        ctx.fillRect(11, 14, 3, 3);
        ctx.fillRect(14, 17, 3, 3);
        
        // Shadow for depth
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(8, 14, 3, 2);
        ctx.fillRect(11, 17, 3, 2);
        ctx.fillRect(14, 20, 3, 2);
    }
    
    function drawScenarioPreview(canvas, index) {
        var ctx = canvas.getContext('2d');
        var C = PPT.config.C;
        var w = canvas.width;
        var h = canvas.height;
        
        // First scenario gets special detailed treatment
        if (index === 0) {
            drawDetailedScenarioPreview(ctx, w, h, C);
            return;
        }
        
        // Other scenarios get themed previews
        var themes = [
            { grass: C.grass1, sky: '#87ceeb', name: 'Green Valley' },
            { grass: '#E8C4A0', sky: '#FFE4B5', accent: '#FF6B35' }, // Desert
            { grass: '#E8F0F8', sky: '#B0D4F1', accent: '#87CEEB' }, // Winter
            { grass: '#90EE90', sky: '#87CEEB', accent: '#FF69B4' }, // Tropical
            { grass: '#2C2C54', sky: '#1a1a2e', accent: '#9B59B6' }, // Space
            { grass: '#4A4A4A', sky: '#2d1b4e', accent: '#FF6347' }  // Haunted
        ];
        var theme = themes[index % themes.length];
        
        // Sky
        ctx.fillStyle = theme.sky;
        ctx.fillRect(0, 0, w, h * 0.6);
        
        // Ground
        ctx.fillStyle = theme.grass;
        ctx.fillRect(0, h * 0.6, w, h * 0.4);
        
        // Grayscale/muted overlay for locked scenarios
        ctx.fillStyle = 'rgba(100,80,120,0.4)';
        ctx.fillRect(0, 0, w, h);
        
        // Simple silhouettes
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        
        // Ferris wheel silhouette
        ctx.beginPath();
        ctx.arc(80, 70, 35, 0, Math.PI * 2);
        ctx.fill();
        
        // Coaster silhouette
        ctx.beginPath();
        ctx.moveTo(120, 100);
        ctx.quadraticCurveTo(160, 40, 200, 60);
        ctx.quadraticCurveTo(230, 80, 250, 70);
        ctx.lineTo(250, 100);
        ctx.lineTo(120, 100);
        ctx.fill();
        
        // Tree silhouettes
        ctx.beginPath();
        ctx.arc(30, 85, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(27, 95, 6, 20);
        
        ctx.beginPath();
        ctx.arc(220, 90, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(217, 98, 6, 18);
    }
    
    function drawDetailedScenarioPreview(ctx, w, h, C) {
        // Sky gradient
        var skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.5);
        skyGrad.addColorStop(0, '#87CEEB');
        skyGrad.addColorStop(1, '#E0F4FF');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, h * 0.55);
        
        // Clouds
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        drawSimpleCloud(ctx, 40, 20, 0.8);
        drawSimpleCloud(ctx, 150, 30, 0.6);
        drawSimpleCloud(ctx, 200, 18, 0.7);
        
        // Ground
        ctx.fillStyle = C.grass1;
        ctx.fillRect(0, h * 0.55, w, h * 0.45);
        
        // Grass texture
        ctx.fillStyle = C.grass2;
        for (var y = h * 0.55; y < h; y += 12) {
            for (var x = ((Math.floor(y / 12) % 2) === 0 ? 0 : 12); x < w; x += 24) {
                ctx.fillRect(x, y, 12, 12);
            }
        }
        
        // Tree (left)
        ctx.fillStyle = '#5D4037';
        ctx.fillRect(18, 75, 6, 25);
        ctx.fillStyle = '#2E7D32';
        ctx.beginPath();
        ctx.arc(21, 60, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.arc(21, 52, 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Ferris wheel
        ctx.strokeStyle = C.pink;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(80, 55, 30, 0, Math.PI * 2);
        ctx.stroke();
        
        // Ferris wheel support
        ctx.fillStyle = '#607D8B';
        ctx.fillRect(77, 55, 6, 45);
        
        // Ferris gondolas
        var gondolaCols = [C.red, '#2196F3', C.yellow, '#4CAF50', C.purple, C.orange];
        for (var g = 0; g < 6; g++) {
            var ga = (g / 6) * Math.PI * 2 - Math.PI / 2;
            ctx.fillStyle = gondolaCols[g];
            ctx.beginPath();
            ctx.roundRect(80 + Math.cos(ga) * 30 - 6, 55 + Math.sin(ga) * 30 - 4, 12, 8, 2);
            ctx.fill();
        }
        
        // Center hub
        ctx.fillStyle = C.yellow;
        ctx.beginPath();
        ctx.arc(80, 55, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Tent/Carousel
        ctx.fillStyle = C.red;
        ctx.beginPath();
        ctx.moveTo(130, 80);
        ctx.lineTo(150, 55);
        ctx.lineTo(170, 80);
        ctx.fill();
        ctx.fillStyle = C.yellow;
        ctx.beginPath();
        ctx.moveTo(135, 80);
        ctx.lineTo(150, 60);
        ctx.lineTo(165, 80);
        ctx.fill();
        
        // Striped awning
        for (var s = 0; s < 4; s++) {
            ctx.fillStyle = s % 2 ? C.orange : '#fff';
            ctx.fillRect(132 + s * 9, 80, 9, 15);
        }
        
        // Coaster track
        ctx.strokeStyle = C.red;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(160, 90);
        ctx.quadraticCurveTo(190, 35, 220, 50);
        ctx.quadraticCurveTo(245, 70, 250, 85);
        ctx.stroke();
        
        // Coaster supports
        ctx.fillStyle = '#654321';
        ctx.fillRect(195, 50, 4, 50);
        ctx.fillRect(225, 55, 4, 45);
        
        // Tree (right) - pink cherry
        ctx.fillStyle = '#5D4037';
        ctx.fillRect(225, 78, 5, 22);
        ctx.fillStyle = '#F8BBD9';
        ctx.beginPath();
        ctx.arc(227, 65, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#EC407A';
        ctx.beginPath();
        ctx.arc(227, 58, 10, 0, Math.PI * 2);
        ctx.fill();
        
        // Path
        ctx.fillStyle = C.path1;
        ctx.fillRect(0, h * 0.75, w, h * 0.15);
        
        // Guests
        for (var p = 0; p < 6; p++) {
            var px = 25 + p * 38;
            ctx.fillStyle = PPT.config.GUEST_COLORS[p % 8];
            ctx.fillRect(px - 3, h * 0.78, 6, 8);
            ctx.fillStyle = '#FFCCBC';
            ctx.beginPath();
            ctx.arc(px, h * 0.75, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = PPT.config.HAIR_COLORS[p % 6];
            ctx.beginPath();
            ctx.arc(px, h * 0.73, 3, Math.PI, 0);
            ctx.fill();
        }
    }
    
    function drawSimpleCloud(ctx, x, y, scale) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.arc(18, -3, 18, 0, Math.PI * 2);
        ctx.arc(36, 0, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    
    // ==================== ORIENTATION CHECK ====================
    
    function checkOrientation() {
        var warning = document.getElementById('landscape-warning');
        if (!warning) return;
        
        var isSmallLandscape = window.innerHeight < 500 && window.innerWidth > window.innerHeight;
        var gameActive = document.getElementById('game-container').style.display !== 'none';
        
        warning.classList.toggle('active', isSmallLandscape && gameActive);
    }
    
    // ==================== MOBILE PAN OVERLAY ====================
    
    function setupPanOverlay() {
        var parkContainer = document.getElementById('park-container');
        var panOverlay = document.getElementById('pan-overlay');
        var leftArrow = document.getElementById('pan-arrow-left');
        var rightArrow = document.getElementById('pan-arrow-right');
        var parkCanvas = document.getElementById('park-canvas');
        
        if (!parkContainer || !panOverlay || !leftArrow || !rightArrow) return;
        
        // Draw pixel art arrows (50x50 size)
        drawPanArrow(leftArrow, 'left');
        drawPanArrow(rightArrow, 'right');
        
        var panTimeout;
        var isMobile = window.matchMedia('(max-width: 768px)').matches || 'ontouchstart' in window;
        
        if (isMobile) {
            // Show overlay briefly on game start to hint at scrolling
            setTimeout(function() {
                if (parkContainer.scrollWidth > parkContainer.clientWidth) {
                    panOverlay.classList.add('visible');
                    panTimeout = setTimeout(function() {
                        panOverlay.classList.remove('visible');
                    }, 2000);
                }
            }, 500);
            
            // Show overlay when touching the park area (if nothing selected)
            var showPanHint = function() {
                if (!G.selected && !G.demolishMode && parkContainer.scrollWidth > parkContainer.clientWidth) {
                    panOverlay.classList.add('visible');
                    if (panTimeout) clearTimeout(panTimeout);
                    panTimeout = setTimeout(function() {
                        panOverlay.classList.remove('visible');
                    }, 1500);
                }
            };
            
            parkContainer.addEventListener('touchstart', showPanHint, { passive: true });
            if (parkCanvas) {
                parkCanvas.addEventListener('touchstart', showPanHint, { passive: true });
            }
            
            parkContainer.addEventListener('scroll', function() {
                if (panTimeout) clearTimeout(panTimeout);
                panOverlay.classList.remove('visible');
            }, { passive: true });
        }
    }
    
    function drawPanArrow(canvas, direction) {
        if (!canvas) return;
        var ctx = canvas.getContext('2d');
        var sz = 50;
        ctx.clearRect(0, 0, sz, sz);
        
        // Yellow pixel art arrow - larger for 50x50
        ctx.fillStyle = '#ffd93d';
        
        if (direction === 'left') {
            // Left pointing chevron arrow
            ctx.fillRect(20, 10, 5, 5);
            ctx.fillRect(15, 15, 5, 5);
            ctx.fillRect(10, 20, 5, 10);
            ctx.fillRect(15, 30, 5, 5);
            ctx.fillRect(20, 35, 5, 5);
            // Shaft
            ctx.fillRect(20, 15, 20, 20);
            
            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(10, 30, 5, 3);
            ctx.fillRect(15, 35, 5, 3);
            ctx.fillRect(20, 35, 20, 3);
        } else {
            // Right pointing chevron arrow
            ctx.fillRect(25, 10, 5, 5);
            ctx.fillRect(30, 15, 5, 5);
            ctx.fillRect(35, 20, 5, 10);
            ctx.fillRect(30, 30, 5, 5);
            ctx.fillRect(25, 35, 5, 5);
            // Shaft
            ctx.fillRect(10, 15, 20, 20);
            
            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(35, 30, 5, 3);
            ctx.fillRect(30, 35, 5, 3);
            ctx.fillRect(10, 35, 20, 3);
        }
    }
    
    // ==================== START GAME ====================
    
    window.startGame = function() {
        PPT.currentScenario = PPT.scenarios[selectedScenario];
        G = PPT.state.create(PPT.currentScenario);
        
        PPT.audio.init();
        PPT.game.generateWorld();
        
        // Hide all menu screens
        document.getElementById('title-intro').style.display = 'none';
        document.getElementById('welcome-screen').style.display = 'none';
        document.getElementById('scenario-screen').style.display = 'none';
        document.getElementById('game-container').style.display = 'flex';
        
        stopWelcomePreview();
        
        // Initialize canvases
        parkCanvas = document.getElementById('park-canvas');
        parkCtx = parkCanvas.getContext('2d');
        partCanvas = document.getElementById('particle-canvas');
        partCtx = partCanvas.getContext('2d');
        confCanvas = document.getElementById('confetti-canvas');
        confCtx = confCanvas.getContext('2d');
        
        PPT.render.init(parkCtx, partCtx, confCtx);
        
        // Setup canvas event handlers
        parkCanvas.addEventListener('mousemove', function(e) {
            var r = parkCanvas.getBoundingClientRect();
            G.hover = {
                x: Math.floor((e.clientX - r.left) * (parkCanvas.width / r.width) / PPT.config.TILE_SIZE),
                y: Math.floor((e.clientY - r.top) * (parkCanvas.height / r.height) / PPT.config.TILE_SIZE)
            };
        });
        parkCanvas.addEventListener('mouseleave', function() { G.hover = null; });
        parkCanvas.addEventListener('click', function(e) {
            var r = parkCanvas.getBoundingClientRect();
            var x = Math.floor((e.clientX - r.left) * (parkCanvas.width / r.width) / PPT.config.TILE_SIZE);
            var y = Math.floor((e.clientY - r.top) * (parkCanvas.height / r.height) / PPT.config.TILE_SIZE);
            if (G.demolishMode) {
                PPT.game.demolish(x, y);
            } else if (G.selected) {
                PPT.game.place(x, y, G.selected);
            }
        });
        parkCanvas.addEventListener('touchstart', function(e) {
            // Only prevent default if something is selected (for building/demolishing)
            // Otherwise allow scrolling
            if (G.selected || G.demolishMode) {
                e.preventDefault();
                var t = e.touches[0], r = parkCanvas.getBoundingClientRect();
                G.hover = {
                    x: Math.floor((t.clientX - r.left) * (parkCanvas.width / r.width) / PPT.config.TILE_SIZE),
                    y: Math.floor((t.clientY - r.top) * (parkCanvas.height / r.height) / PPT.config.TILE_SIZE)
                };
            }
        }, { passive: false });
        parkCanvas.addEventListener('touchmove', function(e) {
            // Only prevent default if something is selected
            if (G.selected || G.demolishMode) {
                e.preventDefault();
                var t = e.touches[0], r = parkCanvas.getBoundingClientRect();
                G.hover = {
                    x: Math.floor((t.clientX - r.left) * (parkCanvas.width / r.width) / PPT.config.TILE_SIZE),
                    y: Math.floor((t.clientY - r.top) * (parkCanvas.height / r.height) / PPT.config.TILE_SIZE)
                };
            }
        }, { passive: false });
        parkCanvas.addEventListener('touchend', function(e) {
            if (!G.hover) return;
            if (G.demolishMode) {
                PPT.game.demolish(G.hover.x, G.hover.y);
            } else if (G.selected) {
                PPT.game.place(G.hover.x, G.hover.y, G.selected);
            }
            G.hover = null;
        });
        
        // Setup icon button hover effects
        var sfxBtn = document.getElementById('sfx-btn');
        var musicBtn = document.getElementById('music-btn');
        var pauseBtn = document.getElementById('pause-btn');
        
        if (sfxBtn) {
            sfxBtn.addEventListener('mouseenter', function() {
                PPT.render.drawIcon(document.getElementById('sfx-icon')?.getContext('2d'), 'speaker', 16, true);
            });
            sfxBtn.addEventListener('mouseleave', function() {
                PPT.render.drawIcon(document.getElementById('sfx-icon')?.getContext('2d'), 'speaker', 16, false);
            });
        }
        if (musicBtn) {
            musicBtn.addEventListener('mouseenter', function() {
                PPT.render.drawIcon(document.getElementById('music-icon')?.getContext('2d'), 'music', 16, true);
            });
            musicBtn.addEventListener('mouseleave', function() {
                PPT.render.drawIcon(document.getElementById('music-icon')?.getContext('2d'), 'music', 16, false);
            });
        }
        if (pauseBtn) {
            pauseBtn.addEventListener('mouseenter', function() {
                PPT.render.drawIcon(document.getElementById('pause-icon')?.getContext('2d'), G.paused ? 'play' : 'pause', 16, true);
            });
            pauseBtn.addEventListener('mouseleave', function() {
                PPT.render.drawIcon(document.getElementById('pause-icon')?.getContext('2d'), G.paused ? 'play' : 'pause', 16, false);
            });
        }
        
        // Setup mobile pan overlay
        setupPanOverlay();
        
        // Build UI
        PPT.ui.initIcons();
        PPT.ui.buildBuildItems();
        PPT.ui.updateDisplay();
        
        // Show debug button if enabled
        if (G.debugMode) {
            var btn = document.getElementById('debug-btn');
            if (btn) btn.style.display = 'inline-block';
        }
        
        // Start game loop and tick
        if (gameLoopId) cancelAnimationFrame(gameLoopId);
        if (tickInterval) clearInterval(tickInterval);
        
        function gameLoop() {
            PPT.render.renderPark();
            PPT.render.updateParticles();
            PPT.render.updateConfetti();
            PPT.game.updateGuests();
            PPT.game.updateBirds();
            PPT.game.updateLeaves();
            PPT.game.updateSparkles();
            gameLoopId = requestAnimationFrame(gameLoop);
        }
        gameLoop();
        
        tickInterval = setInterval(PPT.game.tick, 700);
        
        PPT.audio.startMusic();
        checkOrientation();
    };
    
    // ==================== DEBUG MODE ====================
    
    function setupDebugMode() {
        var keys = [];
        var code = 'debug';
        
        document.addEventListener('keydown', function(e) {
            if (!G) return;
            keys.push(e.key.toLowerCase());
            if (keys.length > code.length) keys.shift();
            
            if (keys.join('') === code) {
                G.debugMode = true;
                G.goalsAchieved = [true, true, true, true, true];
                PPT.ui.updateBuildItems();
                var btn = document.getElementById('debug-btn');
                if (btn) btn.style.display = 'inline-block';
                PPT.ui.showNotif('Debug mode: Unlimited money enabled!', 'achievement');
                PPT.ui.updateMoney();
                keys = [];
            }
        });
    }
    
    // ==================== INITIALIZATION ====================
    
    function init() {
        // Setup debug mode
        setupDebugMode();
        
        // Orientation listener
        window.addEventListener('resize', checkOrientation);
        window.addEventListener('orientationchange', checkOrientation);
        
        // Help modal click outside
        document.getElementById('help-modal').addEventListener('click', function(e) {
            if (e.target === this) closeHelp();
        });
        
        // Credits modal click outside
        document.getElementById('credits-modal').addEventListener('click', function(e) {
            if (e.target === this) closeCredits();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            if (!G) return;
            
            if (e.key === 'Escape') {
                G.selected = null;
                G.demolishMode = false;
                document.querySelectorAll('.build-item').forEach(function(b) { b.classList.remove('selected'); });
                var btn = document.getElementById('demolish-btn');
                if (btn) btn.classList.remove('selected');
            }
            if (e.key === ' ') {
                e.preventDefault();
                togglePause();
            }
            if (e.key === 'd' || e.key === 'D') {
                selectDemolish();
            }
        });
        
        // Start the title intro
        startTitleIntro();
    }
    
    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();
