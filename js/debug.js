/**
 * Pixel Park Paradise - Debug Panel
 * Live stats, formulas, and graphs for development
 */

(function() {
    'use strict';
    
    // Game speed multiplier (1x, 2x, 4x, 8x)
    var speedMultiplier = 1;
    var speedOptions = [1, 2, 4, 8];
    
    PPT.debug.togglePanel = function() {
        var panel = document.getElementById('debug-panel');
        if (!panel) return;
        panel.classList.toggle('active');
        if (panel.classList.contains('active')) {
            PPT.debug.updatePanel();
        }
    };
    
    PPT.debug.cycleSpeed = function() {
        var idx = speedOptions.indexOf(speedMultiplier);
        idx = (idx + 1) % speedOptions.length;
        speedMultiplier = speedOptions[idx];
        
        // Update tick interval
        PPT.debug.applySpeed();
        PPT.debug.updatePanel();
    };
    
    PPT.debug.applySpeed = function() {
        // Base tick rate is 700ms, divide by speed multiplier
        var baseRate = 700;
        var newRate = Math.floor(baseRate / speedMultiplier);
        
        // Clear existing interval and set new one
        if (window._pptTickInterval) {
            clearInterval(window._pptTickInterval);
        }
        window._pptTickInterval = setInterval(PPT.game.tick, newRate);
    };
    
    PPT.debug.getSpeed = function() {
        return speedMultiplier;
    };
    
    PPT.debug.triggerDilemma = function(index) {
        var d = PPT.events.DILEMMAS[index];
        if (!d) return;
        // Close debug panel first so it doesn't overlap
        var panel = document.getElementById('debug-panel');
        if (panel) panel.classList.remove('active');
        PPT.events.showDilemma(d);
    };
    
    PPT.debug.triggerAutoEvent = function(index) {
        var ev = PPT.events.AUTO_EVENTS[index];
        if (!ev) return;
        ev.exec();
        PPT.ui.showNotif('[DEBUG] Triggered: ' + ev.name, 'info');
        PPT.debug.updatePanel();
    };
    
    PPT.debug.updatePanel = function() {
        var panel = document.getElementById('debug-panel');
        if (!panel || !panel.classList.contains('active') || !G) return;
        
        var scenario = PPT.currentScenario;
        var c = PPT.game.countBuildings();
        var eco = scenario.economy;
        var dp = PPT.render.getDayPart();
        var dow = G.day % 7;
        var isWknd = dow === 5 || dow === 6;
        var tm = scenario.timeMultipliers;
        var timeMult = tm[dp] || 0;
        if (isWknd) timeMult *= tm.weekendBonus;
        
        var guestGen = PPT.game.calcGuestGen();
        
        var html = '<button class="debug-close" onclick="PPT.debug.togglePanel()">×</button>';
        
        // Speed control
        html += '<div class="debug-speed-control">';
        html += '<span class="debug-speed-label">Game Speed:</span>';
        html += '<button class="debug-speed-btn" onclick="PPT.debug.cycleSpeed()">' + speedMultiplier + 'x</button>';
        html += '</div>';
        
        // Current State
        html += '<h3>Current State</h3><div class="debug-grid">';
        html += '<div class="debug-stat"><div class="debug-stat-label">Money</div><div class="debug-stat-value">' + PPT.utils.formatMoney(G.money) + '</div></div>';
        html += '<div class="debug-stat"><div class="debug-stat-label">Guests</div><div class="debug-stat-value">' + G.guests + '</div></div>';
        html += '<div class="debug-stat"><div class="debug-stat-label">Happiness</div><div class="debug-stat-value">' + G.happiness + '%</div></div>';
        html += '<div class="debug-stat"><div class="debug-stat-label">Day</div><div class="debug-stat-value">' + G.day + ' (Y' + G.year + ')</div></div>';
        html += '<div class="debug-stat"><div class="debug-stat-label">Time</div><div class="debug-stat-value">' + dp + ' (tick ' + (G.tick % 84) + '/84)</div></div>';
        html += '<div class="debug-stat"><div class="debug-stat-label">Guest Gen/tick</div><div class="debug-stat-value">' + guestGen.toFixed(4) + '</div></div>';
        html += '</div>';
        
        // Buildings
        html += '<h3>Buildings</h3><div class="debug-grid">';
        html += '<div class="debug-stat"><div class="debug-stat-label">Rides</div><div class="debug-stat-value">' + c.rides + '</div></div>';
        html += '<div class="debug-stat"><div class="debug-stat-label">Coasters</div><div class="debug-stat-value">' + c.coasters + '</div></div>';
        html += '<div class="debug-stat"><div class="debug-stat-label">Food</div><div class="debug-stat-value">' + c.food + '</div></div>';
        html += '<div class="debug-stat"><div class="debug-stat-label">Decor</div><div class="debug-stat-value">' + c.decor + '</div></div>';
        html += '<div class="debug-stat"><div class="debug-stat-label">Paths</div><div class="debug-stat-value">' + c.paths + '</div></div>';
        html += '<div class="debug-stat"><div class="debug-stat-label">Running Costs</div><div class="debug-stat-value">€' + c.run + '/day</div></div>';
        html += '<div class="debug-stat"><div class="debug-stat-label">Attraction Value</div><div class="debug-stat-value">€' + c.attrCost + '</div></div>';
        html += '</div>';
        
        // Formulas
        html += '<h3>Guest Generation Formula</h3>';
        html += '<div class="debug-formula">guestGen = log(1 + ' + c.attrCost + ' / ' + eco.guestGenDivisor + ') × (' + G.happiness + ' / 100) × ' + timeMult.toFixed(2) + '\n';
        html += '        = log(' + (1 + c.attrCost / eco.guestGenDivisor).toFixed(4) + ') × ' + (G.happiness / 100).toFixed(2) + ' × ' + timeMult.toFixed(2) + '\n';
        html += '        = ' + guestGen.toFixed(4) + ' guests/tick</div>';
        
        // Happiness breakdown
        html += '<h3>Happiness Breakdown</h3>';
        html += '<table class="debug-table"><tr><th>Factor</th><th>Have</th><th>Need</th><th>Points</th></tr>';
        
        var g = G.guests || 1;
        var foodNeed = Math.ceil(g / eco.foodPerGuests);
        var ridesNeed = Math.ceil(g / eco.ridesPerGuests);
        var pathsNeed = Math.ceil(g / eco.pathsPerGuests);
        var decorNeed = Math.ceil(g / eco.decorPerGuests);
        
        html += '<tr><td>Food</td><td>' + c.food + '</td><td>' + foodNeed + '</td><td>' + (c.food >= foodNeed ? '+20' : '0') + '</td></tr>';
        html += '<tr><td>Rides</td><td>' + (c.rides + c.coasters) + '</td><td>' + ridesNeed + '</td><td>' + ((c.rides + c.coasters) >= ridesNeed ? '+30' : '0') + '</td></tr>';
        html += '<tr><td>Paths</td><td>' + c.paths + '</td><td>' + pathsNeed + '</td><td>' + (c.paths >= pathsNeed ? '+15' : '0') + '</td></tr>';
        html += '<tr><td>Decor</td><td>' + c.decor + '</td><td>' + decorNeed + '</td><td>' + (c.decor >= decorNeed ? '+5' : '0') + '</td></tr>';
        
        var boostTotal = 0;
        G.boosts.forEach(function(b) { boostTotal += b.amt; });
        html += '<tr><td>Boosts</td><td colspan="2">' + G.boosts.length + ' active</td><td>+' + boostTotal + '</td></tr>';
        html += '</table>';
        
        // Time multipliers
        html += '<h3>Time Multipliers</h3>';
        html += '<table class="debug-table"><tr><th>Period</th><th>Base</th><th>Current</th></tr>';
        ['morning', 'afternoon', 'evening', 'night'].forEach(function(p) {
            var base = tm[p];
            var curr = p === dp ? (isWknd ? base * tm.weekendBonus : base) : '-';
            html += '<tr><td>' + p + (p === dp ? ' ★' : '') + '</td><td>' + base + '</td><td>' + (typeof curr === 'number' ? curr.toFixed(2) : curr) + '</td></tr>';
        });
        html += '</table>';
        
        // History graph
        if (G.history.length > 1) {
            html += '<h3>History (Last ' + G.history.length + ' Days)</h3>';
            html += '<div class="debug-graph"><canvas id="debug-graph-canvas"></canvas></div>';
            html += '<div class="debug-legend">';
            html += '<span><span class="debug-legend-color" style="background:#6bcb77"></span> Money (÷100)</span>';
            html += '<span><span class="debug-legend-color" style="background:#5da6ff"></span> Guests</span>';
            html += '<span><span class="debug-legend-color" style="background:#ffd93d"></span> Happiness</span>';
            html += '</div>';
        }
        
        // Goals
        html += '<h3>Goals</h3>';
        html += '<table class="debug-table"><tr><th>Goal</th><th>Guests</th><th>Reward</th><th>Status</th></tr>';
        scenario.goals.forEach(function(goal, i) {
            var status = G.goalsAchieved[i] ? '✓ Complete' : (G.guests + '/' + goal.guests);
            html += '<tr><td>' + goal.name + '</td><td>' + goal.guests + '</td><td>€' + goal.reward + '</td><td>' + status + '</td></tr>';
        });
        html += '</table>';
        
        // Event Triggers
        if (PPT.events) {
            html += '<h3>Trigger Dilemma</h3>';
            html += '<div class="debug-event-grid">';
            PPT.events.DILEMMAS.forEach(function(d, i) {
                html += '<button class="debug-event-btn" onclick="PPT.debug.triggerDilemma(' + i + ')">' + d.name + '</button>';
            });
            html += '</div>';
            
            html += '<h3>Trigger Auto-Event</h3>';
            html += '<div class="debug-event-grid">';
            PPT.events.AUTO_EVENTS.forEach(function(ev, i) {
                html += '<button class="debug-event-btn debug-event-auto" onclick="PPT.debug.triggerAutoEvent(' + i + ')">' + ev.name + '</button>';
            });
            html += '</div>';
        }
        
        // Active Effects
        if (G.activeEffects && G.activeEffects.length > 0) {
            html += '<h3>Active Effects</h3>';
            html += '<table class="debug-table"><tr><th>ID</th><th>Type</th><th>Mod</th><th>Ticks Left</th></tr>';
            G.activeEffects.forEach(function(e) {
                html += '<tr><td>' + e.id + '</td><td>' + e.type + '</td><td>' + e.modifier + '</td><td>' + e.ticks + '</td></tr>';
            });
            html += '</table>';
        }
        
        // Finance tracking
        if (G.todayFinances) {
            html += '<h3>Today\'s Finance Tracking</h3>';
            html += '<table class="debug-table"><tr><th>Category</th><th>Amount</th></tr>';
            var cats = ['entryFees','foodRevenue','runningCosts','staffSalaries','construction','events','rewards'];
            cats.forEach(function(cat) {
                var v = G.todayFinances[cat] || 0;
                if (v !== 0) html += '<tr><td>' + cat + '</td><td>' + (v > 0 ? '+' : '') + '€' + v + '</td></tr>';
            });
            html += '</table>';
        }
        
        panel.innerHTML = html;
        
        // Draw history graph
        if (G.history.length > 1) {
            setTimeout(function() {
                var canvas = document.getElementById('debug-graph-canvas');
                if (!canvas) return;
                
                canvas.width = canvas.parentElement.offsetWidth - 16;
                canvas.height = 120;
                var ctx = canvas.getContext('2d');
                
                // Find max values
                var maxMoney = 0, maxGuests = 0;
                G.history.forEach(function(h) {
                    if (h.money / 100 > maxMoney) maxMoney = h.money / 100;
                    if (h.guests > maxGuests) maxGuests = h.guests;
                });
                maxMoney = Math.max(maxMoney, 100);
                maxGuests = Math.max(maxGuests, 100);
                var maxH = 100;
                
                var w = canvas.width, h = canvas.height;
                var padding = 5;
                var graphW = w - padding * 2;
                var graphH = h - padding * 2;
                
                // Grid
                ctx.strokeStyle = 'rgba(255,255,255,0.1)';
                ctx.lineWidth = 1;
                for (var i = 0; i <= 4; i++) {
                    var y = padding + (graphH / 4) * i;
                    ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(w - padding, y); ctx.stroke();
                }
                
                // Draw lines
                var drawLine = function(data, key, color, max, divisor) {
                    divisor = divisor || 1;
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    data.forEach(function(d, i) {
                        var x = padding + (i / (data.length - 1)) * graphW;
                        var val = (d[key] / divisor) / max;
                        var y = padding + graphH - val * graphH;
                        if (i === 0) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    });
                    ctx.stroke();
                };
                
                drawLine(G.history, 'money', '#6bcb77', maxMoney, 100);
                drawLine(G.history, 'guests', '#5da6ff', maxGuests, 1);
                drawLine(G.history, 'happiness', '#ffd93d', maxH, 1);
            }, 10);
        }
    };
    
})();
