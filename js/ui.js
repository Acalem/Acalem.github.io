/**
 * Pixel Park Paradise - UI System
 * User interface, tooltips, notifications, and display updates
 */

(function() {
    'use strict';
    
    var notifTimeout = null;
    
    // ==================== NOTIFICATIONS ====================
    
    PPT.ui.showNotif = function(text, type) {
        var layer = document.getElementById('toast-layer');
        var bar = document.getElementById('notification-bar');
        var icon = document.getElementById('notif-icon');
        var textEl = document.getElementById('notif-text');
        if (!bar || !textEl || !layer) return;
        
        // Show the toast layer
        layer.style.display = '';
        bar.className = 'toast-bar' + (type ? ' ' + type : '');
        textEl.textContent = text;
        
        if (icon) {
            var iconType = 'lightbulb';
            if (type === 'achievement') iconType = 'trophy';
            else if (type === 'warning') iconType = 'warning';
            else if (type === 'negative') iconType = 'error';
            PPT.render.drawIcon(icon.getContext('2d'), iconType, 16);
        }
        
        if (type !== 'achievement') PPT.audio.playSound('notification');
        
        if (notifTimeout) clearTimeout(notifTimeout);
        notifTimeout = setTimeout(function() {
            layer.style.display = 'none';
        }, 6000);
    };
    
    // ==================== DISPLAY UPDATES ====================
    
    PPT.ui.updateMoney = function() {
        var el = document.getElementById('money-display');
        if (!el || !G) return;
        
        if (G.debugMode) {
            el.textContent = 'UNLIMITED';
            el.classList.remove('negative');
        } else {
            el.textContent = PPT.utils.formatMoney(G.money);
            el.classList.toggle('negative', G.money < 0);
        }
        
        document.querySelectorAll('.build-item').forEach(function(b) {
            // Never disable in debug mode
            b.classList.toggle('disabled', !G.debugMode && G.money < parseInt(b.dataset.cost));
        });
    };
    
    PPT.ui.updateDisplay = function() {
        if (!G) return;
        var gd = document.getElementById('guest-display');
        var td = document.getElementById('time-display');
        var hd = document.getElementById('happy-display');
        
        if (gd) gd.textContent = G.guests;
        if (td) td.textContent = PPT.config.DAYS[(G.day - 1) % 7] + ' (' + PPT.render.getDayPart() + ')';
        if (hd) hd.textContent = PPT.game.getHappyLabel(G.happiness);
        
        PPT.ui.updateTimeIcon();
        PPT.ui.updateHappyIcon();
        PPT.ui.updateGoals();
        PPT.ui.updateMoney();
        PPT.ui.updateArrows();
        PPT.ui.updateEntryFeePopover();
        
        // Live-refresh finance panel if open
        if (G.tick % 5 === 0) {
            var fp = document.getElementById('finance-panel');
            if (fp && fp.style.display !== 'none') PPT.ui.buildFinanceTable();
        }
        
        // Live-refresh guest card if open
        if (G.inspectedGuest && document.getElementById('guest-info-card').style.display !== 'none') {
            // Check guest still exists
            if (G.guestSprites.indexOf(G.inspectedGuest) === -1) {
                PPT.ui.hideGuestCard();
            } else {
                PPT.ui.showGuestCard(G.inspectedGuest);
            }
        }
        
        // Live-refresh stall/attraction card if open
        if (G._inspectedStall && document.getElementById('stall-info-card').style.display !== 'none') {
            var sb = G._inspectedStall;
            var sd = PPT.currentScenario ? PPT.currentScenario.buildings[sb.type] : null;
            if (sd && sd.cat === 'food') PPT.ui.showStallCard(sb);
            else if (sd && (sd.cat === 'ride' || sd.cat === 'coaster')) PPT.ui.showAttractionCard(sb);
        }
    };
    
    PPT.ui.updateGoals = function() {
        var cg = PPT.game.currentGoal();
        var el = document.getElementById('goals-display');
        var ic = document.getElementById('goals-icon');
        var st = el ? el.parentElement : null;
        if (!el || !st) return;
        
        st.classList.remove('complete');
        
        if (cg) {
            // Show current goal icon + name + compact progress
            if (ic) PPT.render.drawIcon(ic.getContext('2d'), cg.goal.icon || 'target', 16);
            var c = PPT.game.countBuildings();
            var progress = PPT.ui.getGoalProgress(cg.goal, c);
            el.textContent = cg.goal.name + (progress ? ' \u00b7 ' + progress : '');
        } else {
            if (ic) PPT.render.drawIcon(ic.getContext('2d'), 'trophy', 16);
            el.textContent = 'All complete!';
            st.classList.add('complete');
        }
    };
    
    // Get compact progress text for a goal
    PPT.ui.getGoalProgress = function(goal, c) {
        if (!goal.conditions || goal.conditions.length === 0) return '';
        var catKey = { ride: 'rides', coaster: 'coasters', food: 'food', decor: 'decor', path: 'paths' };
        var parts = [];
        goal.conditions.forEach(function(cond) {
            switch (cond.type) {
                case 'buildings':
                    var cur = c[catKey[cond.cat]] || 0;
                    if (cur < cond.min) parts.push(cur + '/' + cond.min + ' ' + cond.cat);
                    break;
                case 'guests':
                    if (G.guests < cond.min) parts.push(G.guests + '/' + cond.min + ' guests');
                    break;
                case 'happiness':
                    if (G.happiness < cond.min) parts.push('happy ' + Math.round(G.happiness) + '/' + cond.min);
                    break;
                case 'entryFee':
                    if (G.entryFee < cond.min) parts.push('fee \u20ac' + G.entryFee + '/' + cond.min);
                    break;
            }
        });
        return parts.length > 0 ? parts.join(', ') : '';
    };
    
    PPT.ui.updateArrows = function() {
        if (!G) return;
        var dp = PPT.render.getDayPart();
        var dow = G.day % 7;
        var isWknd = dow === 5 || dow === 6;
        var c = PPT.game.countBuildings();
        
        var guestUp = (dp === 'morning' || (isWknd && dp === 'afternoon')) && (c.rides + c.coasters) > 0;
        var happyUp = G.boosts.length > 0;
        
        var ga = document.getElementById('guest-arrow');
        var ha = document.getElementById('happy-arrow');
        
        if (ga) {
            ga.style.display = guestUp ? 'block' : 'none';
            if (guestUp) PPT.render.drawIcon(ga.getContext('2d'), 'arrow-up', 10);
        }
        if (ha) {
            ha.style.display = happyUp ? 'block' : 'none';
            if (happyUp) PPT.render.drawIcon(ha.getContext('2d'), 'arrow-up', 10);
        }
    };
    
    PPT.ui.updateTimeIcon = function() {
        var c = document.getElementById('time-icon');
        if (!c || !G) return;
        PPT.render.drawIcon(c.getContext('2d'), PPT.render.getDayPart() === 'night' ? 'moon' : 'sun', 16);
    };
    
    PPT.ui.updateHappyIcon = function() {
        var c = document.getElementById('happy-icon');
        if (!c || !G) return;
        var ctx = c.getContext('2d');
        var h = G.happiness;
        var C = PPT.config.C;
        
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = h <= 1 ? '#ccc' : C.yellow;
        ctx.beginPath(); ctx.arc(8, 8, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(5, 5, 2, 2); ctx.fillRect(9, 5, 2, 2);
        
        if (h <= 45) {
            ctx.strokeStyle = C.pink; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(8, 13, 3, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
        } else if (h <= 60) {
            ctx.fillStyle = '#1a1a2e'; ctx.fillRect(5, 10, 6, 2);
        } else {
            ctx.strokeStyle = C.pink; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(8, 9, 3, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
        }
    };
    
    // ==================== BUILD ITEMS ====================
    
    PPT.ui.isUnlocked = function(type) {
        var scenario = PPT.currentScenario;
        var d = scenario.buildings[type];
        if (!d || !d.unlock) return true;
        
        var goals = scenario.goals;
        for (var i = 0; i < goals.length; i++) {
            if (goals[i].name === d.unlock) return G.goalsAchieved[i];
        }
        return true;
    };
    
    PPT.ui.buildBuildItems = function() {
        var scenario = PPT.currentScenario;
        var BUILDINGS = scenario.buildings;
        var cats = { path: 'tab-paths', ride: 'tab-rides', coaster: 'tab-coasters', food: 'tab-food', decor: 'tab-decor' };
        
        // Clear existing items first to prevent duplicates
        Object.keys(cats).forEach(function(cat) {
            var grid = document.querySelector('#' + cats[cat] + ' .build-items-grid');
            if (grid) grid.innerHTML = '';
        });
        
        // Sort by cost like original
        var sorted = Object.keys(BUILDINGS).map(function(type) {
            return { type: type, data: BUILDINGS[type] };
        }).sort(function(a, b) { return a.data.cost - b.data.cost; });
        
        sorted.forEach(function(item) {
            var type = item.type;
            var data = item.data;
            var tab = document.querySelector('#' + cats[data.cat] + ' .build-items-grid');
            if (!tab) return;
            
            var btn = document.createElement('button');
            var locked = !PPT.ui.isUnlocked(type);
            btn.className = 'build-item' + (locked ? ' locked' : '');
            btn.dataset.type = type;
            btn.dataset.cost = data.cost;
            if (data.unlock) btn.dataset.unlock = data.unlock;
            
            btn.onclick = function() {
                if (!btn.classList.contains('locked')) {
                    PPT.ui.selectItem(btn);
                } else {
                    PPT.ui.showNotif('Complete ' + data.unlock + ' challenge to unlock!', 'warning');
                    PPT.audio.playSound('error');
                }
            };
            
            btn.innerHTML = '<canvas class="item-icon" width="24" height="24"></canvas><span class="item-name">' + data.name + '</span><span class="item-cost">' + (locked ? 'Locked' : '€' + data.cost) + '</span>';
            tab.appendChild(btn);
            
            var canvas = btn.querySelector('canvas');
            if (canvas) PPT.render.drawIcon(canvas.getContext('2d'), type, 24);
        });
        
        PPT.ui.setupTooltips();
    };
    
    PPT.ui.updateBuildItems = function() {
        document.querySelectorAll('.build-item').forEach(function(btn) {
            var type = btn.dataset.type;
            var scenario = PPT.currentScenario;
            var d = scenario.buildings[type];
            if (!d) return;
            var locked = !PPT.ui.isUnlocked(type);
            btn.classList.toggle('locked', locked);
            var costEl = btn.querySelector('.item-cost');
            if (costEl) costEl.textContent = locked ? 'Locked' : '€' + d.cost;
        });
    };
    
    PPT.ui.selectItem = function(el) {
        document.querySelectorAll('.build-item').forEach(function(e) { e.classList.remove('selected'); });
        var demBtn = document.getElementById('demolish-btn');
        if (demBtn) demBtn.classList.remove('selected');
        
        var type = el.dataset.type;
        var cost = parseInt(el.dataset.cost);
        
        // Skip money check in debug mode
        if (!G.debugMode && G.money < cost) {
            PPT.ui.showNotif('Not enough money!', 'negative');
            PPT.audio.playSound('error');
            return;
        }
        
        el.classList.add('selected');
        G.selected = type;
        G.demolishMode = false;
        PPT.ui.hideGuestCard();
        if (G.carriedGuest) PPT.game.dropGuest(G.carriedGuest.x + 4, G.carriedGuest.y + 5);
        PPT.audio.playSound('click');
    };
    
    PPT.ui.selectDemolish = function() {
        PPT.ui.hideGuestCard();
        if (G.carriedGuest) PPT.game.dropGuest(G.carriedGuest.x + 4, G.carriedGuest.y + 5);
        
        if (G.demolishMode) {
            // Turn off sell mode - go back to paths
            PPT.ui.switchCat('paths');
        } else {
            PPT.ui.switchCat('sell');
        }
    };
    
    // ==================== CATEGORY SWITCHING (v14 floating panel) ====================
    
    var catMeta = {
        paths: { icon: 'path', label: 'Paths' },
        rides: { icon: 'ferris-wheel', label: 'Rides' },
        coasters: { icon: 'coaster', label: 'Coasters' },
        food: { icon: 'ice-cream', label: 'Food' },
        decor: { icon: 'flowers', label: 'Decor' },
        staff: { icon: 'goal-staff', label: 'Staff' },
        tickets: { icon: 'entry-fee', label: 'Tickets' },
        objectives: { icon: 'trophy', label: 'Goals' },
        sell: { icon: 'sell', label: 'Sell Mode' }
    };
    
    PPT.ui.switchCat = function(cat) {
        var panel = document.getElementById('build-panel');
        if (panel && panel.classList.contains('collapsed')) {
            panel.classList.remove('collapsed');
            var btn = document.getElementById('collapseBtn');
            if (btn) btn.textContent = '▶';
        }
        
        // Update cat buttons
        document.querySelectorAll('.cat-btn').forEach(function(b) {
            b.classList.toggle('active', b.dataset.cat === cat);
        });
        
        // Update panel contents
        document.querySelectorAll('.panel-content').forEach(function(p) {
            p.classList.toggle('active', p.dataset.panel === cat);
        });
        
        // Update panel header title only (icon is already in the active tab)
        var meta = catMeta[cat];
        if (meta) {
            var label = document.getElementById('panelLabel');
            if (label) label.textContent = meta.label;
        }
        
        // Deselect building tool when switching to non-build categories
        var buildCats = ['paths','rides','coasters','food','decor'];
        if (buildCats.indexOf(cat) === -1) {
            G.selected = null;
            document.querySelectorAll('.build-item').forEach(function(e) { e.classList.remove('selected'); });
        }
        
        // Handle sell mode
        if (cat === 'sell') {
            G.demolishMode = true;
            G.selected = null;
            document.querySelectorAll('.build-item').forEach(function(e) { e.classList.remove('selected'); });
        } else {
            G.demolishMode = false;
        }
        
        // Sync pricing display
        if (cat === 'tickets') PPT.ui.syncPricingPanel();
        
        // Build objectives if switching to that
        if (cat === 'objectives') PPT.ui.buildObjectivesPanel();
        
        PPT.audio.playSound('click');
    };
    
    PPT.ui.initCollapseBtn = function() {
        var btn = document.getElementById('collapseBtn');
        var panel = document.getElementById('build-panel');
        if (!btn || !panel) return;
        btn.addEventListener('click', function() {
            panel.classList.toggle('collapsed');
            btn.textContent = panel.classList.contains('collapsed') ? '◀' : '▶';
        });
    };
    
    // Legacy compat
    PPT.ui.switchTab = function(t) { PPT.ui.switchCat(t); };
    PPT.ui.switchPanel = function(p) { PPT.ui.switchCat(p); };
    
    // ==================== OBJECTIVES PANEL ====================
    
    PPT.ui.buildObjectivesPanel = function() {
        var container = document.getElementById('objectives-panel');
        if (!container) return;
        var scenario = PPT.currentScenario;
        if (!scenario || !scenario.goals) { container.innerHTML = ''; return; }
        
        var html = '';
        var currentIdx = -1;
        for (var i = 0; i < scenario.goals.length; i++) {
            if (!G.goalsAchieved[i]) { currentIdx = i; break; }
        }
        
        // Active label
        if (currentIdx >= 0) {
            html += '<div class="obj-section-label">Active</div>';
        }
        
        for (var i = 0; i < scenario.goals.length; i++) {
            var goal = scenario.goals[i];
            var done = G.goalsAchieved[i];
            var isCurrent = (i === currentIdx);
            var isLocked = (!done && i > currentIdx && currentIdx >= 0);
            
            var cls = 'objective-card';
            if (done) cls += ' completed';
            else if (isLocked) cls += ' locked';
            
            var badgeIcon = done ? 'checkmark' : (isLocked ? 'lock' : 'trophy');
            
            // Calculate progress for current goal
            var progressHtml = '';
            if (isCurrent && goal.conditions) {
                var totalProg = 0, totalMax = 0;
                for (var c = 0; c < goal.conditions.length; c++) {
                    var cond = goal.conditions[c];
                    var val = 0, max = cond.min || 1;
                    switch (cond.type) {
                        case 'guests': val = Math.min(G.guests || 0, max); break;
                        case 'buildings': val = Math.min(PPT.game.countBuildings ? PPT.game.countBuildings(cond.category) : 0, max); break;
                        case 'money': val = Math.min(G.money, max); break;
                        case 'happiness': val = Math.min(G.happiness || 0, max); break;
                        case 'entryFee': val = (G.entryFee >= (cond.min || 0)) ? 1 : 0; max = 1; break;
                        case 'staff': val = Math.min(G.staff && G.staff[cond.staffType] ? G.staff[cond.staffType] : 0, max); break;
                    }
                    totalProg += val;
                    totalMax += max;
                }
                var pct = totalMax > 0 ? Math.min(100, Math.round(totalProg / totalMax * 100)) : 0;
                progressHtml = '<div class="obj-progress">' +
                    '<div class="obj-bar"><div class="obj-bar-fill" style="width:' + pct + '%"></div></div>' +
                    '<span class="obj-pct">' + pct + '%</span>' +
                    '</div>';
            } else if (done) {
                progressHtml = '<div class="obj-progress">' +
                    '<div class="obj-bar"><div class="obj-bar-fill" style="width:100%"></div></div>' +
                    '<span class="obj-pct">Done</span>' +
                    '</div>';
            }
            
            // Add "upcoming" label before first locked
            if (isLocked && i > 0 && !G.goalsAchieved[i] && (i === currentIdx + 1)) {
                html += '<div class="obj-section-label" style="margin-top:4px">Upcoming</div>';
            }
            
            html += '<div class="' + cls + '">' +
                '<div class="obj-header">' +
                '<div class="obj-badge"><canvas class="obj-badge-icon" width="16" height="16" data-icon="' + badgeIcon + '"></canvas></div>' +
                '<div class="obj-info">' +
                '<div class="obj-name">' + (goal.name || 'Goal ' + (i+1)) + '</div>' +
                '<div class="obj-desc">' + (goal.desc || '') + '</div>' +
                '</div></div>' +
                progressHtml +
                '</div>';
        }
        
        container.innerHTML = html;
        
        // Draw badge icons
        container.querySelectorAll('.obj-badge-icon').forEach(function(c) {
            var itype = c.dataset.icon;
            if (itype) PPT.render.drawIcon(c.getContext('2d'), itype, 16);
        });
    };
    
    // ==================== PRICING PANEL ====================
    
    PPT.ui.syncPricingPanel = function() {
        var display = document.getElementById('pricing-fee-display');
        var slider = document.getElementById('pricing-fee-slider');
        if (display) display.textContent = '\u20ac' + G.entryFee;
        if (slider) slider.value = G.entryFee;
    };
    
    PPT.ui.adjustEntryFee = function(delta) {
        G.entryFee = Math.max(0, Math.min(99, G.entryFee + delta));
        PPT.ui.syncPricingPanel();
        PPT.ui.syncEntryFeeDisplay();
        PPT.audio.playSound('click');
    };
    
    PPT.ui.setEntryFee = function(val) {
        G.entryFee = Math.max(0, Math.min(99, parseInt(val) || 0));
        PPT.ui.syncPricingPanel();
        PPT.ui.syncEntryFeeDisplay();
    };
    
    PPT.ui.syncEntryFeeDisplay = function() {
        // Entry fee display is now only in the sidebar pricing panel
        PPT.ui.syncPricingPanel();
    };
    
    // ==================== INFO DIALOGS (non-modal) ====================
    
    var dialogIds = ['finance-panel', 'day-info-dialog', 'guests-info-dialog', 'happy-info-dialog'];
    
    // Get bounding rects of all visible non-modal dialogs except the given one
    function getOtherDialogRects(excludeEl) {
        var rects = [];
        dialogIds.forEach(function(id) {
            var el = document.getElementById(id);
            if (el && el !== excludeEl && el.style.display !== 'none') {
                rects.push(el.getBoundingClientRect());
            }
        });
        return rects;
    }
    
    function rectsOverlap(a, b) {
        return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
    }
    
    // Position a dialog centered, then nudge if overlapping existing dialogs
    function positionDialogAvoidOverlap(el) {
        // Start centered
        el.style.left = '50%';
        el.style.top = '50%';
        el.style.transform = 'translate(-50%, -50%)';
        
        // Force layout to get rect
        var myRect = el.getBoundingClientRect();
        var others = getOtherDialogRects(el);
        
        if (others.length === 0) return;
        
        // Check if centered position overlaps
        var hasOverlap = others.some(function(r) { return rectsOverlap(myRect, r); });
        if (!hasOverlap) return;
        
        // Try offsets in a spiral pattern to find non-overlapping position
        var offsets = [
            [180, 0], [-180, 0], [0, 120], [0, -120],
            [180, 120], [-180, 120], [180, -120], [-180, -120],
            [260, 0], [-260, 0], [0, 200], [0, -200]
        ];
        
        var cx = window.innerWidth / 2;
        var cy = window.innerHeight / 2;
        var hw = myRect.width / 2;
        var hh = myRect.height / 2;
        
        for (var i = 0; i < offsets.length; i++) {
            var testLeft = cx + offsets[i][0] - hw;
            var testTop = cy + offsets[i][1] - hh;
            // Keep in viewport
            testLeft = Math.max(8, Math.min(testLeft, window.innerWidth - myRect.width - 8));
            testTop = Math.max(8, Math.min(testTop, window.innerHeight - myRect.height - 8));
            
            var testRect = { left: testLeft, top: testTop, right: testLeft + myRect.width, bottom: testTop + myRect.height };
            var ok = !others.some(function(r) { return rectsOverlap(testRect, r); });
            if (ok) {
                el.style.left = testLeft + 'px';
                el.style.top = testTop + 'px';
                el.style.transform = 'none';
                return;
            }
        }
        
        // Fallback: stack below last dialog
        var lastRect = others[others.length - 1];
        var fallbackTop = Math.min(lastRect.bottom + 8, window.innerHeight - myRect.height - 8);
        var fallbackLeft = Math.max(8, lastRect.left);
        el.style.left = fallbackLeft + 'px';
        el.style.top = fallbackTop + 'px';
        el.style.transform = 'none';
    }
    
    PPT.ui.toggleInfoDialog = function(type) {
        var id = type === 'money' ? 'finance-panel' : type + '-info-dialog';
        var el = document.getElementById(id);
        if (!el) return;
        
        if (type === 'money') {
            if (el.style.display === 'none') {
                PPT.ui.refreshFinancePanel();
                el.style.display = '';
                positionDialogAvoidOverlap(el);
            } else {
                el.style.display = 'none';
            }
            return;
        }
        
        if (el.style.display === 'none') {
            PPT.ui.populateInfoDialog(type);
            el.style.display = '';
            positionDialogAvoidOverlap(el);
        } else {
            el.style.display = 'none';
        }
    };
    
    PPT.ui.closeInfoDialog = function(type) {
        var el = document.getElementById(type + '-info-dialog');
        if (el) el.style.display = 'none';
    };
    
    PPT.ui.populateInfoDialog = function(type) {
        var body = document.getElementById(type + '-info-body');
        if (!body) return;
        
        if (type === 'day') {
            var dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
            var dayIdx = G.dayOfWeek !== undefined ? G.dayOfWeek : ((G.day || 1) - 1) % 7;
            var weekNum = Math.floor(((G.day || 1) - 1) / 7) + 1;
            var season = '';
            var totalDays = G.day || 1;
            if (totalDays <= 28) season = 'Spring';
            else if (totalDays <= 56) season = 'Summer';
            else if (totalDays <= 84) season = 'Autumn';
            else season = 'Winter';
            var dp = PPT.render.getDayPart ? PPT.render.getDayPart() : '';
            body.innerHTML = '<div class="info-row"><span class="info-label">Day</span><span class="info-val">' + (dayNames[dayIdx] || 'Day ' + totalDays) + '</span></div>'
                + '<div class="info-row"><span class="info-label">Time of day</span><span class="info-val">' + (dp.charAt(0).toUpperCase() + dp.slice(1)) + '</span></div>'
                + '<div class="info-row"><span class="info-label">Week</span><span class="info-val">' + weekNum + '</span></div>'
                + '<div class="info-row"><span class="info-label">Season</span><span class="info-val">' + season + '</span></div>'
                + '<div class="info-row"><span class="info-label">Day #</span><span class="info-val">' + totalDays + '</span></div>';
                
        } else if (type === 'guests') {
            var inPark = G.guests || 0;
            var peakToday = inPark; // current is the best we know for today
            var html = '<div class="info-row"><span class="info-label">In park now</span><span class="info-val">' + inPark + '</span></div>';
            
            // Build graph from G.history
            var hist = G.history || [];
            if (hist.length > 0) {
                var peakAll = 0;
                hist.forEach(function(h) { if (h.guests > peakAll) peakAll = h.guests; });
                html += '<div class="info-row"><span class="info-label">Record peak</span><span class="info-val">' + peakAll + '</span></div>';
                
                // Graph: daily guest counts
                html += '<div class="info-graph-wrap">'
                    + '<div class="info-graph-label">Guests per day (last ' + hist.length + ' days)</div>'
                    + '<canvas class="info-graph-canvas" id="guest-graph-canvas" width="260" height="48"></canvas>'
                    + '</div>';
            }
            
            body.innerHTML = html;
            
            // Draw the graph after DOM update
            if (hist.length > 0) {
                setTimeout(function() { PPT.ui.drawGuestGraph(); }, 10);
            }
            
        } else if (type === 'happy') {
            var happyVal = G.happiness || 0;
            var label = 'Okay';
            if (happyVal >= 80) label = 'Ecstatic';
            else if (happyVal >= 60) label = 'Happy';
            else if (happyVal >= 40) label = 'Content';
            else if (happyVal >= 20) label = 'Unhappy';
            else label = 'Miserable';
            
            var html = '<div class="info-row"><span class="info-label">Mood</span><span class="info-val">' + label + '</span></div>'
                + '<div class="info-row"><span class="info-label">Score</span><span class="info-val">' + Math.round(happyVal) + '%</span></div>';
            
            // Show active effects
            var effects = G.activeEffects || [];
            html += '<div class="info-effects-wrap"><div class="info-effects-label">Active effects</div>';
            if (effects.length === 0) {
                html += '<div class="info-no-effects">None at this time</div>';
            } else {
                var shown = {};
                effects.forEach(function(e) {
                    if (shown[e.id]) return;
                    shown[e.id] = true;
                    var TPD = PPT.config.TICKS_PER_DAY || 240;
                    var daysLeft = Math.ceil(e.ticksRemaining / TPD);
                    var timeStr = daysLeft > 1 ? daysLeft + ' days' : 'ending soon';
                    
                    var effectName = e.id.replace(/([A-Z])/g, ' $1').replace(/_.*/, '').trim();
                    effectName = effectName.charAt(0).toUpperCase() + effectName.slice(1);
                    
                    var modStr = '';
                    var modClass = 'neutral';
                    if (e.modifier !== undefined && e.modifier !== 1) {
                        var pct = Math.round((e.modifier - 1) * 100);
                        if (pct > 0) { modStr = '+' + pct + '%'; modClass = 'positive'; }
                        else if (pct < 0) { modStr = pct + '%'; modClass = 'negative'; }
                    }
                    if (e.visual === 'rain') { effectName = 'Rain'; modClass = 'negative'; if (!modStr) modStr = 'weather'; }
                    else if (e.visual === 'heat') { effectName = 'Heat wave'; }
                    else if (e.visual === 'fog') { effectName = 'Fog'; modClass = 'negative'; if (!modStr) modStr = 'weather'; }
                    else if (e.type === 'powerout') { effectName = 'Power outage'; modClass = 'negative'; if (!modStr) modStr = 'active'; }
                    
                    var iconType = 'event-star';
                    if (e.visual === 'rain') iconType = 'event-rain';
                    else if (e.visual === 'heat') iconType = 'event-sun';
                    else if (e.visual === 'fog') iconType = 'event-fog';
                    else if (e.type === 'powerout') iconType = 'event-wrench';
                    else if (e.type === 'guestGen') iconType = 'event-crowd';
                    else if (e.type === 'foodRev') iconType = 'event-food';
                    else if (e.type === 'entryFee') iconType = 'event-money';
                    
                    html += '<div class="info-effect-row">'
                        + '<canvas class="info-effect-icon" width="14" height="14" data-icon="' + iconType + '"></canvas>'
                        + '<span class="info-effect-name">' + effectName + ' (' + timeStr + ')</span>'
                        + (modStr ? '<span class="info-effect-mod ' + modClass + '">' + modStr + '</span>' : '')
                        + '</div>';
                });
            }
            html += '</div>';
            
            body.innerHTML = html;
            
            // Draw effect icons
            body.querySelectorAll('.info-effect-icon').forEach(function(c) {
                var itype = c.dataset.icon;
                if (itype) PPT.render.drawIcon(c.getContext('2d'), itype, 14);
            });
        }
    };
    
    // Draw guest history sparkline graph
    PPT.ui.drawGuestGraph = function() {
        var canvas = document.getElementById('guest-graph-canvas');
        if (!canvas) return;
        var ctx = canvas.getContext('2d');
        var hist = G.history || [];
        if (hist.length === 0) return;
        
        var w = canvas.width;
        var h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        
        var values = hist.map(function(d) { return d.guests || 0; });
        var maxVal = Math.max.apply(null, values);
        if (maxVal === 0) maxVal = 1;
        
        var padding = { top: 4, bottom: 10, left: 4, right: 4 };
        var graphW = w - padding.left - padding.right;
        var graphH = h - padding.top - padding.bottom;
        var barGap = 1;
        var barW = Math.max(2, Math.floor((graphW - (values.length - 1) * barGap) / values.length));
        var totalW = values.length * barW + (values.length - 1) * barGap;
        var startX = padding.left + Math.floor((graphW - totalW) / 2);
        
        // Draw bars
        for (var i = 0; i < values.length; i++) {
            var barH = Math.max(1, Math.round((values[i] / maxVal) * graphH));
            var x = startX + i * (barW + barGap);
            var y = padding.top + graphH - barH;
            
            // Gradient color based on value
            var ratio = values[i] / maxVal;
            var r = Math.round(93 + (107 - 93) * (1 - ratio));
            var g = Math.round(166 + (203 - 166) * ratio);
            var b = Math.round(255 + (119 - 255) * ratio);
            ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
            ctx.fillRect(x, y, barW, barH);
        }
        
        // Draw axis labels
        ctx.fillStyle = '#666';
        ctx.font = '7px "Press Start 2P"';
        ctx.textAlign = 'left';
        ctx.fillText('0', padding.left, h - 1);
        ctx.textAlign = 'right';
        ctx.fillText(maxVal.toString(), w - padding.right, h - 1);
    };
    
    // ==================== STAFF PANEL ====================
    
    PPT.ui.isStaffUnlocked = function(staffType) {
        var scenario = PPT.currentScenario;
        if (!scenario.staff) return false;
        var sd = scenario.staff[staffType];
        if (!sd || !sd.unlock) return true;
        var goals = scenario.goals;
        for (var i = 0; i < goals.length; i++) {
            if (goals[i].name === sd.unlock) return G.goalsAchieved[i];
        }
        return true;
    };
    
    PPT.ui.buildStaffPanel = function() {
        var scenario = PPT.currentScenario;
        var panel = document.getElementById('staff-panel');
        if (!panel) return;
        if (!scenario.staff) { panel.innerHTML = ''; return; }
        panel.innerHTML = '';
        
        var staffTypes = Object.keys(scenario.staff);
        staffTypes.forEach(function(stype) {
            var sd = scenario.staff[stype];
            var locked = !PPT.ui.isStaffUnlocked(stype);
            var count = (G.staff || []).filter(function(s) { return s.type === stype; }).length;
            var atMax = count >= sd.maxCount;
            
            var row = document.createElement('div');
            row.className = 'staff-row' + (locked ? ' locked' : '');
            
            var iconCanvas = document.createElement('canvas');
            iconCanvas.className = 'staff-row-icon';
            iconCanvas.width = 24; iconCanvas.height = 24;
            row.appendChild(iconCanvas);
            
            var info = document.createElement('div');
            info.className = 'staff-row-info';
            info.innerHTML = '<div class="staff-row-name">' + sd.name + '</div>'
                + '<div class="staff-row-detail">'
                + (locked ? 'Complete ' + sd.unlock : '\u20ac' + sd.cost + ' hire \u00b7 \u20ac' + sd.salary + '/day')
                + '</div>';
            row.appendChild(info);
            
            var countEl = document.createElement('div');
            countEl.className = 'staff-row-count';
            countEl.textContent = count;
            row.appendChild(countEl);
            
            var btns = document.createElement('div');
            btns.className = 'staff-row-btns';
            
            if (count > 0) {
                var fireBtn = document.createElement('button');
                fireBtn.className = 'staff-btn staff-btn-fire';
                fireBtn.textContent = '\u2212';
                fireBtn.onclick = function() { PPT.game.fireStaff(stype); };
                btns.appendChild(fireBtn);
            }
            
            var hireBtn = document.createElement('button');
            hireBtn.className = 'staff-btn staff-btn-hire';
            hireBtn.textContent = '+';
            hireBtn.disabled = locked || atMax;
            hireBtn.onclick = function() { PPT.game.hireStaff(stype); };
            btns.appendChild(hireBtn);
            
            row.appendChild(btns);
            panel.appendChild(row);
            
            PPT.render.drawIcon(iconCanvas.getContext('2d'), sd.icon, 24);
        });
    };
    
    // ==================== GUEST CARD ====================
    
    PPT.ui.showGuestCard = function(guest) {
        var card = document.getElementById('guest-info-card');
        if (!card) return;
        G.inspectedGuest = guest;
        PPT.ui.hideStallCard(); // close stall card if open
        
        var TYPES = PPT.config.GUEST_TYPES;
        var td = TYPES[guest.type];
        var scenario = PPT.currentScenario;
        var BLDGS = scenario ? scenario.buildings : {};
        
        // Name
        document.getElementById('gic-name').textContent = guest.name || 'Guest';
        
        // Type & mode
        var isKid = guest.bodyType === 'boy' || guest.bodyType === 'girl';
        document.getElementById('gic-type').textContent = isKid ? 'Kid' : 'Adult';
        document.getElementById('gic-mode').textContent = '';
        
        // Status
        var statusEl = document.getElementById('gic-status');
        var statusText = '';
        if (guest.status === 'walking_to_goal' && guest.current_goal) {
            var gd = BLDGS[guest.current_goal.type];
            statusText = 'Walking to ' + (gd ? gd.name : 'goal');
        } else if (guest.status === 'seeking_food') {
            statusText = 'Looking for food';
        } else if (guest.status === 'in_attraction' || guest.in_attraction) {
            var ad = guest._attr_x != null ? PPT.game.findBuildingAtCoord(guest._attr_x, guest._attr_y) : null;
            var an = ad ? (BLDGS[ad.type] ? BLDGS[ad.type].name : ad.type) : 'attraction';
            statusText = 'In ' + an;
        } else if (guest.status === 'leaving') {
            statusText = 'Leaving the park';
        } else {
            statusText = 'Wandering';
        }
        statusEl.textContent = statusText;
        
        // Draw guest portrait
        var spriteCanvas = document.getElementById('gic-sprite');
        if (spriteCanvas) {
            var ctx = spriteCanvas.getContext('2d');
            ctx.clearRect(0, 0, spriteCanvas.width, spriteCanvas.height);
            PPT.render.drawGuestPortrait(ctx, guest);
        }
        
        // Wishlist
        var wlSection = document.getElementById('gic-wishlist-section');
        var wlEl = document.getElementById('gic-wishlist');
        if (guest.wishlist && guest.wishlist.length > 0) {
            wlSection.style.display = '';
            var wlHtml = '';
            guest.wishlist.forEach(function(w, idx) {
                var wd = BLDGS[w.type];
                var name = wd ? wd.name : w.type;
                var enRoute = guest.current_goal && guest.current_goal.x === w.x && guest.current_goal.y === w.y;
                wlHtml += '<div class="gic-item' + (enRoute ? ' en-route' : '') + '">' + name + (enRoute ? ' \u27A1' : '') + '</div>';
            });
            wlEl.innerHTML = wlHtml;
        } else {
            wlSection.style.display = 'none';
        }
        
        // Visited
        var vSection = document.getElementById('gic-visited-section');
        var vEl = document.getElementById('gic-visited');
        if (guest.visited && guest.visited.length > 0) {
            vSection.style.display = '';
            var vHtml = '';
            guest.visited.forEach(function(v) {
                vHtml += '<div class="gic-item">' + v.name + '</div>';
            });
            vEl.innerHTML = vHtml;
        } else {
            vSection.style.display = 'none';
        }
        
        // Hunger bar
        var hungerPct = Math.round(guest.hunger || 0);
        document.getElementById('gic-hunger').style.width = hungerPct + '%';
        document.getElementById('gic-hunger-pct').textContent = '';
        
        // Thirst bar
        var thirstPct = Math.round(guest.thirst || 0);
        document.getElementById('gic-thirst').style.width = thirstPct + '%';
        document.getElementById('gic-thirst-pct').textContent = '';
        
        // Spent
        document.getElementById('gic-spent').textContent = 'Spent: \u20ac' + (guest.money_spent || guest.spent || 0);
        
        // Position near the guest on-screen
        var parkCanvas = document.getElementById('park-canvas');
        if (parkCanvas) {
            var r = parkCanvas.getBoundingClientRect();
            var scaleX = r.width / parkCanvas.width;
            var scaleY = r.height / parkCanvas.height;
            var screenX = r.left + guest.x * scaleX;
            var screenY = r.top + guest.y * scaleY;
            
            var cardW = 210, cardH = 280;
            var left = Math.min(Math.max(screenX + 14, 4), window.innerWidth - cardW - 4);
            var top = Math.min(Math.max(screenY - cardH / 2, 4), window.innerHeight - cardH - 4);
            card.style.left = left + 'px';
            card.style.top = top + 'px';
        }
        
        card.style.display = 'block';
    };
    
    PPT.ui.hideGuestCard = function() {
        var card = document.getElementById('guest-info-card');
        if (card) card.style.display = 'none';
        if (G) G.inspectedGuest = null;
    };
    
    // ==================== FOOD STALL INFO CARD ====================
    
    PPT.ui.showStallCard = function(building) {
        var card = document.getElementById('stall-info-card');
        if (!card) return;
        PPT.ui.hideGuestCard(); // close guest card if open
        
        var scenario = PPT.currentScenario;
        var d = scenario ? scenario.buildings[building.type] : null;
        var PRODUCTS = PPT.config.FOOD_PRODUCTS;
        var prod = PRODUCTS[building.type];
        if (!d || !prod) return;
        
        G._inspectedStall = building;
        
        document.getElementById('sic-name').textContent = d.name;
        document.getElementById('sic-type').textContent = 'Type: ' + (prod.food_type === 'food' ? 'Food' : 'Drink');
        document.getElementById('sic-price').textContent = 'Price: \u20ac' + prod.product_price;
        document.getElementById('sic-visitors').textContent = 'Guests: ' + (building.current_visitors || 0) + '/' + PPT.game.getCapacity(building);
        document.getElementById('sic-sold').textContent = 'Sold today: ' + (building.sales_today || 0);
        document.getElementById('sic-revenue').textContent = 'Revenue today: \u20ac' + (building.revenue_today || 0);
        
        // Position near the building
        var parkCanvas = document.getElementById('park-canvas');
        if (parkCanvas) {
            var r = parkCanvas.getBoundingClientRect();
            var scaleX = r.width / parkCanvas.width;
            var scaleY = r.height / parkCanvas.height;
            var sz = d.size || 1;
            var screenX = r.left + (building.x * 32 + sz * 16) * scaleX;
            var screenY = r.top + building.y * 32 * scaleY;
            
            var cardW = 200, cardH = 120;
            var left = Math.min(Math.max(screenX + 14, 4), window.innerWidth - cardW - 4);
            var top = Math.min(Math.max(screenY - cardH / 2, 4), window.innerHeight - cardH - 4);
            card.style.left = left + 'px';
            card.style.top = top + 'px';
        }
        
        card.style.display = 'block';
    };
    
    PPT.ui.hideStallCard = function() {
        var card = document.getElementById('stall-info-card');
        if (card) card.style.display = 'none';
        if (G) G._inspectedStall = null;
    };
    
    PPT.ui.showAttractionCard = function(building) {
        var card = document.getElementById('stall-info-card');
        if (!card) return;
        PPT.ui.hideGuestCard();
        
        var scenario = PPT.currentScenario;
        var d = scenario ? scenario.buildings[building.type] : null;
        if (!d) return;
        
        G._inspectedStall = building;
        
        var pop = PPT.game.getPopularity(building);
        var cap = PPT.game.getCapacity(building);
        
        document.getElementById('sic-name').textContent = d.name;
        document.getElementById('sic-type').textContent = 'Type: ' + (d.cat === 'coaster' ? 'Coaster' : 'Ride');
        document.getElementById('sic-price').textContent = 'Popularity: ' + pop.toFixed(1);
        document.getElementById('sic-visitors').textContent = 'Guests: ' + (building.current_visitors || 0) + '/' + cap;
        document.getElementById('sic-sold').textContent = 'Running cost: \u20ac' + (d.run || 0) + '/day';
        document.getElementById('sic-revenue').textContent = '';
        
        var parkCanvas = document.getElementById('park-canvas');
        if (parkCanvas) {
            var r = parkCanvas.getBoundingClientRect();
            var scaleX = r.width / parkCanvas.width;
            var scaleY = r.height / parkCanvas.height;
            var sz = d.size || 1;
            var screenX = r.left + (building.x * 32 + sz * 16) * scaleX;
            var screenY = r.top + building.y * 32 * scaleY;
            var cardW = 200, cardH = 120;
            var left = Math.min(Math.max(screenX + 14, 4), window.innerWidth - cardW - 4);
            var top = Math.min(Math.max(screenY - cardH / 2, 4), window.innerHeight - cardH - 4);
            card.style.left = left + 'px';
            card.style.top = top + 'px';
        }
        
        card.style.display = 'block';
    };
    
    // ==================== TOOLTIPS ====================
    
    PPT.ui.getStatTooltip = function(stat) {
        switch(stat) {
            case 'time':
                return { name: '', desc: 'Morning brings more guests.\nNights are quiet.\nWeekends are busier.' };
            case 'money':
                return { name: '', desc: 'Guests pay an entry fee + spend at food stalls.\nSet your entry fee in the € stat.' };
            case 'entry-fee':
                return { name: '', desc: 'Click to set your park\'s entry fee.\nHigher fees earn more per guest but attract fewer.' };
            case 'guests':
                return { name: '', desc: 'Attractions and happiness attract guests.\nClick a guest to inspect them.\nDifferent types spend differently on food.' };
            case 'happy':
                var cleanInfo = '';
                if (G && G.cleanliness < 50) cleanInfo = '\nCleanliness: ' + Math.round(G.cleanliness) + '% (penalty active!)';
                else if (G) cleanInfo = '\nCleanliness: ' + Math.round(G.cleanliness) + '%';
                return { name: '', desc: 'Follow guest feedback to improve happiness.\nEnough food, attractions, paths, and decor matter.' + cleanInfo };
            case 'goals':
                var cg = PPT.game.currentGoal();
                if (!cg) return { name: 'GOALS', desc: 'All challenges completed!\nClick to view the roadmap.' };
                return { name: '', desc: cg.goal.desc + '\nClick to open the roadmap.' };
            default:
                return { name: '', desc: '' };
        }
    };
    
    PPT.ui.setupTooltips = function() {
        document.querySelectorAll('.build-item').forEach(function(item) {
            item.addEventListener('mouseenter', function() {
                var tt = document.getElementById('tooltip');
                var scenario = PPT.currentScenario;
                if (!tt) return;
                
                var nameEl = tt.querySelector('.tooltip-name');
                var costEl = tt.querySelector('.tooltip-cost');
                var runEl = tt.querySelector('.tooltip-running');
                var descEl = tt.querySelector('.tooltip-desc');
                
                // Building item
                var type = item.dataset.type;
                var d = scenario.buildings[type];
                if (!d) return;
                
                var locked = !PPT.ui.isUnlocked(type);
                
                nameEl.textContent = d.name;
                costEl.textContent = locked ? '' : '\u20ac' + d.cost;
                
                if (!locked && d.run && d.run > 0) {
                    runEl.textContent = 'Operating: \u20ac' + d.run + '/day';
                    runEl.style.display = 'block';
                } else {
                    runEl.textContent = '';
                    runEl.style.display = 'none';
                }
                
                if (locked) {
                    descEl.textContent = 'Unlock by completing the ' + d.unlock + ' challenge.';
                    descEl.style.color = '#ff6b6b';
                } else {
                    descEl.style.color = '#ccc';
                    if (d.cat === 'path') descEl.textContent = 'Build next to existing path.';
                    else if (d.cat === 'ride' || d.cat === 'coaster' || d.cat === 'food') descEl.textContent = 'Build next to a path tile.';
                    else descEl.textContent = 'Build anywhere on the map.';
                }
                tt.classList.add('active');
            });
            
            item.addEventListener('mousemove', function(e) {
                var tt = document.getElementById('tooltip');
                if (tt) {
                    tt.style.left = (e.clientX + 10) + 'px';
                    tt.style.top = (e.clientY + 10) + 'px';
                }
            });
            
            item.addEventListener('mouseleave', function() {
                var tt = document.getElementById('tooltip');
                if (tt) {
                    tt.querySelector('.tooltip-desc').style.color = '#ccc';
                    tt.querySelector('.tooltip-running').style.display = 'none';
                    tt.classList.remove('active');
                }
            });
        });
        
        document.querySelectorAll('.stat').forEach(function(stat) {
            stat.addEventListener('mouseenter', function() {
                var tt = document.getElementById('tooltip');
                var t = stat.dataset.stat;
                var c = PPT.ui.getStatTooltip(t);
                if (!tt) return;
                
                tt.querySelector('.tooltip-name').textContent = c.name;
                tt.querySelector('.tooltip-cost').textContent = '';
                tt.querySelector('.tooltip-running').textContent = '';
                tt.querySelector('.tooltip-running').style.display = 'none';
                tt.querySelector('.tooltip-desc').textContent = c.desc;
                tt.classList.add('active');
            });
            
            stat.addEventListener('mousemove', function(e) {
                var tt = document.getElementById('tooltip');
                if (tt) {
                    tt.style.left = (e.clientX + 10) + 'px';
                    tt.style.top = (e.clientY + 10) + 'px';
                }
            });
            
            stat.addEventListener('mouseleave', function() {
                document.getElementById('tooltip').classList.remove('active');
            });
        });
        
        var demBtn = document.getElementById('demolish-btn');
        if (demBtn) {
            demBtn.addEventListener('mouseenter', function() {
                var tt = document.getElementById('tooltip');
                var scenario = PPT.currentScenario;
                var refundRate = scenario.economy.sellRefundRate || 0.6;
                if (!tt) return;
                tt.querySelector('.tooltip-name').textContent = 'Sell Building';
                tt.querySelector('.tooltip-cost').textContent = '+' + Math.round(refundRate * 100) + '% refund';
                tt.querySelector('.tooltip-cost').style.color = '#4caf50';
                tt.querySelector('.tooltip-running').textContent = '';
                tt.querySelector('.tooltip-running').style.display = 'none';
                tt.querySelector('.tooltip-desc').textContent = 'Click on any building to sell it.';
                tt.classList.add('active');
            });
            
            demBtn.addEventListener('mousemove', function(e) {
                var tt = document.getElementById('tooltip');
                if (tt) {
                    tt.style.left = (e.clientX + 10) + 'px';
                    tt.style.top = (e.clientY + 10) + 'px';
                }
            });
            
            demBtn.addEventListener('mouseleave', function() {
                var tt = document.getElementById('tooltip');
                tt.querySelector('.tooltip-cost').style.color = '#6bcb77';
                document.getElementById('tooltip').classList.remove('active');
            });
        }
    };
    
    // ==================== MODALS ====================
    
    PPT.ui.showHelp = function() {
        document.getElementById('help-modal').classList.add('active');
        var gc = document.getElementById('game-container');
        if (gc && gc.style.display !== 'none' && !G.paused) {
            G.wasPlayingBeforeHelp = true;
            G.paused = true;
            var ic = document.getElementById('pause-icon');
            if (ic) PPT.render.drawIcon(ic.getContext('2d'), 'play', 16);
            document.getElementById('pause-btn').classList.add('paused');
            document.getElementById('pause-overlay').classList.add('active');
        }
    };
    
    PPT.ui.closeHelp = function() {
        document.getElementById('help-modal').classList.remove('active');
        PPT.audio.playSound('click');
        if (G && G.wasPlayingBeforeHelp) {
            G.wasPlayingBeforeHelp = false;
            G.paused = false;
            var ic = document.getElementById('pause-icon');
            if (ic) PPT.render.drawIcon(ic.getContext('2d'), 'pause', 16);
            var pb = document.getElementById('pause-btn');
            if (pb) pb.classList.remove('paused');
            var po = document.getElementById('pause-overlay');
            if (po) po.classList.remove('active');
        }
    };
    
    // ==================== ROADMAP ====================
    
    PPT.ui.showRoadmap = function() {
        var modal = document.getElementById('roadmap-modal');
        if (!modal) return;
        modal.classList.add('active');
        var gc = document.getElementById('game-container');
        if (gc && gc.style.display !== 'none' && !G.paused) {
            G.wasPlayingBeforeRoadmap = true;
            G.paused = true;
            var ic = document.getElementById('pause-icon');
            if (ic) PPT.render.drawIcon(ic.getContext('2d'), 'play', 16);
            document.getElementById('pause-btn').classList.add('paused');
            document.getElementById('pause-overlay').classList.add('active');
        }
        PPT.ui.buildRoadmap();
    };
    
    PPT.ui.closeRoadmap = function() {
        document.getElementById('roadmap-modal').classList.remove('active');
        PPT.audio.playSound('click');
        if (G && G.wasPlayingBeforeRoadmap) {
            G.wasPlayingBeforeRoadmap = false;
            G.paused = false;
            var ic = document.getElementById('pause-icon');
            if (ic) PPT.render.drawIcon(ic.getContext('2d'), 'pause', 16);
            var pb = document.getElementById('pause-btn');
            if (pb) pb.classList.remove('paused');
            var po = document.getElementById('pause-overlay');
            if (po) po.classList.remove('active');
        }
    };
    
    PPT.ui.getConditionText = function(cond) {
        var catNames = { ride: 'rides', coaster: 'coasters', food: 'food stalls', decor: 'decorations', path: 'paths' };
        switch (cond.type) {
            case 'buildings': return cond.min + ' ' + (catNames[cond.cat] || cond.cat);
            case 'guests': return cond.min + ' guests';
            case 'happiness': return 'Happiness ' + cond.min;
            case 'entryFee': return 'Entry fee \u2265 \u20ac' + cond.min;
            case 'staff': return cond.min + ' ' + cond.staffType;
            case 'maxTiles': return '\u2264 ' + cond.max + ' tiles';
            case 'buildingsExact': return 'All ' + cond.types.length + ' types built';
            case 'allTilesFilled': return 'Every tile filled';
            default: return '???';
        }
    };
    
    PPT.ui.buildRoadmap = function() {
        var timeline = document.getElementById('roadmap-timeline');
        if (!timeline) return;
        timeline.innerHTML = '';
        
        var goals = PPT.currentScenario.goals;
        if (!goals || goals.length === 0) {
            timeline.innerHTML = '<div style="text-align:center;color:#c0b8a8;padding:20px;">No challenges in this mode.</div>';
            return;
        }
        
        var cg = PPT.game.currentGoal();
        var currentIdx = cg ? cg.idx : goals.length;
        var c = PPT.game.countBuildings();
        var scrollTarget = null;
        
        for (var i = 0; i < goals.length; i++) {
            var goal = goals[i];
            var done = G.goalsAchieved[i];
            var isCurrent = (i === currentIdx);
            var locked = (i > currentIdx);
            
            // Connector between nodes (except before first)
            if (i > 0) {
                var conn = document.createElement('div');
                conn.className = 'roadmap-connector' + (done ? ' done' : ' pending');
                timeline.appendChild(conn);
            }
            
            // Node
            var node = document.createElement('div');
            node.className = 'roadmap-node' + (done ? ' completed' : (isCurrent ? ' current' : ' locked'));
            
            // Icon
            var iconWrap = document.createElement('div');
            iconWrap.className = 'roadmap-icon-wrap';
            var canvas = document.createElement('canvas');
            canvas.width = 32; canvas.height = 32;
            canvas.style.width = '32px'; canvas.style.height = '32px';
            canvas.style.imageRendering = 'pixelated';
            PPT.render.drawIcon(canvas.getContext('2d'), goal.icon || 'target', 32);
            iconWrap.appendChild(canvas);
            
            // Checkmark overlay for completed
            if (done) {
                var chk = document.createElement('canvas');
                chk.width = 12; chk.height = 12;
                chk.style.width = '12px'; chk.style.height = '12px';
                chk.style.imageRendering = 'pixelated';
                chk.className = 'roadmap-check';
                PPT.render.drawIcon(chk.getContext('2d'), 'check', 12);
                iconWrap.appendChild(chk);
            }
            node.appendChild(iconWrap);
            
            // Info
            var info = document.createElement('div');
            info.className = 'roadmap-info';
            var name = document.createElement('div');
            name.className = 'roadmap-name';
            name.textContent = goal.name;
            info.appendChild(name);
            
            var desc = document.createElement('div');
            desc.className = 'roadmap-desc';
            desc.textContent = goal.desc || '';
            info.appendChild(desc);
            
            // Reward
            if (goal.reward) {
                var rew = document.createElement('div');
                rew.className = 'roadmap-reward';
                rew.textContent = (done ? 'Earned' : 'Reward') + ': \u20ac' + goal.reward;
                info.appendChild(rew);
            }
            
            // Per-condition progress for current goal
            if (isCurrent && goal.conditions) {
                var condsDiv = document.createElement('div');
                condsDiv.className = 'roadmap-conditions';
                goal.conditions.forEach(function(cond) {
                    var met = PPT.game.checkCondition(cond, c);
                    var row = document.createElement('div');
                    row.className = 'roadmap-cond' + (met ? ' met' : '');
                    var icon = document.createElement('canvas');
                    icon.width = 8; icon.height = 8;
                    icon.style.width = '8px'; icon.style.height = '8px';
                    icon.style.imageRendering = 'pixelated';
                    PPT.render.drawIcon(icon.getContext('2d'), met ? 'check' : 'cross', 8);
                    row.appendChild(icon);
                    var txt = document.createElement('span');
                    txt.textContent = PPT.ui.getConditionText(cond);
                    row.appendChild(txt);
                    condsDiv.appendChild(row);
                });
                info.appendChild(condsDiv);
            }
            
            node.appendChild(info);
            timeline.appendChild(node);
            
            if (isCurrent) scrollTarget = node;
        }
        
        // Auto-scroll to current goal
        if (scrollTarget) {
            setTimeout(function() {
                scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 50);
        }
    };
    
    PPT.ui.togglePause = function() {
        G.paused = !G.paused;
        var b = document.getElementById('pause-btn');
        var ic = document.getElementById('pause-icon');
        if (ic) PPT.render.drawIcon(ic.getContext('2d'), G.paused ? 'play' : 'pause', 16);
        b.classList.toggle('paused', G.paused);
        document.getElementById('pause-overlay').classList.toggle('active', G.paused);
        PPT.audio.playSound('click');
    };
    
    // ==================== ICONS INIT ====================
    
    PPT.ui.initIcons = function() {
        var drawIcon = PPT.render.drawIcon;
        
        // Title icons
        drawIcon(document.getElementById('title-icon1')?.getContext('2d'), 'coaster', 32);
        drawIcon(document.getElementById('title-icon2')?.getContext('2d'), 'coaster', 32);
        
        // Logo
        drawIcon(document.getElementById('logo-icon')?.getContext('2d'), 'coaster', 20);
        
        // Control buttons (floating top bar)
        drawIcon(document.getElementById('pause-icon')?.getContext('2d'), 'pause', 16);
        drawIcon(document.getElementById('settings-icon')?.getContext('2d'), 'gear', 16);
        
        // Settings modal icons
        drawIcon(document.getElementById('music-label-icon')?.getContext('2d'), 'music', 16);
        drawIcon(document.getElementById('sfx-label-icon')?.getContext('2d'), 'speaker', 16);
        drawIcon(document.getElementById('restart-icon')?.getContext('2d'), 'reset', 16);
        drawIcon(document.getElementById('exit-icon')?.getContext('2d'), 'exit', 16);
        
        // Top bar stat icons
        drawIcon(document.getElementById('coin-icon')?.getContext('2d'), 'coin', 16);
        drawIcon(document.getElementById('guest-icon')?.getContext('2d'), 'guest', 16);
        drawIcon(document.getElementById('notif-icon')?.getContext('2d'), 'lightbulb', 16);
        drawIcon(document.getElementById('debug-icon')?.getContext('2d'), 'bug', 16);
        
        // Cat-strip icons (sidebar)
        drawIcon(document.getElementById('cat-paths-icon')?.getContext('2d'), 'path', 20);
        drawIcon(document.getElementById('cat-rides-icon')?.getContext('2d'), 'ferris-wheel', 20);
        drawIcon(document.getElementById('cat-coasters-icon')?.getContext('2d'), 'coaster', 20);
        drawIcon(document.getElementById('cat-food-icon')?.getContext('2d'), 'ice-cream', 20);
        drawIcon(document.getElementById('cat-decor-icon')?.getContext('2d'), 'flowers', 20);
        drawIcon(document.getElementById('cat-staff-icon')?.getContext('2d'), 'goal-staff', 20);
        drawIcon(document.getElementById('cat-tickets-icon')?.getContext('2d'), 'entry-fee', 20);
        drawIcon(document.getElementById('cat-goals-icon')?.getContext('2d'), 'trophy', 20);
        drawIcon(document.getElementById('cat-sell-icon')?.getContext('2d'), 'sell', 20);
        
        // Panel content icons
        drawIcon(document.getElementById('pricing-ticket-icon')?.getContext('2d'), 'entry-fee', 20);
        drawIcon(document.getElementById('sell-panel-icon')?.getContext('2d'), 'sell', 32);
        drawIcon(document.getElementById('demolish-tool-icon')?.getContext('2d'), 'sell', 16);
        
        PPT.ui.updateTimeIcon();
        PPT.ui.updateHappyIcon();
        
        // Sync pricing panel
        PPT.ui.syncPricingPanel();
        
        // Finance popover
        PPT.ui.initFinancePopover();
        
        // Draggable dialogs
        PPT.ui.initDraggableDialogs();
        
        // Collapse button
        PPT.ui.initCollapseBtn();
    };
    
    // ==================== ENTRY FEE (legacy stubs) ====================
    
    PPT.ui.initEntryFeePopover = function() {
        // Pricing now lives in sidebar panel — no popover needed
    };
    
    PPT.ui.updateEntryFeePopover = function() {
        // No-op
    };
    
    PPT.ui.updatePauseButton = function() {
        var icon = G.paused ? 'play' : 'pause';
        PPT.render.drawIcon(document.getElementById('pause-icon')?.getContext('2d'), icon, 16);
    };
    
    // ==================== FINANCE PANEL ====================
    
    PPT.ui.initFinancePopover = function() {
        var panel = document.getElementById('finance-panel');
        var closeBtn = document.getElementById('fin-close-btn');
        if (!panel) return;
        
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                panel.style.display = 'none';
            });
        }
    };
    
    PPT.ui.refreshFinancePanel = function() {
        var panel = document.getElementById('finance-panel');
        if (!panel) return;
        PPT.ui.buildFinanceTable();
    };
    
    PPT.ui.buildFinanceTable = function() {
        var wrap = document.getElementById('finance-table-wrap');
        if (!wrap) return;
        
        var hist = (G.financeHistory || []).slice(-2);
        var today = G.todayFinances;
        var hasToday = today && (today.entryFees || today.foodRevenue || today.runningCosts || today.staffSalaries || today.construction || today.events || today.rewards);
        
        if (hist.length === 0 && !hasToday) {
            wrap.innerHTML = '<div class="fin-no-data">No financial data yet.<br>Complete a day to see results.</div>';
            return;
        }
        
        var rows = [
            { key: 'entryFees', label: 'Entry fees' },
            { key: 'foodRevenue', label: 'Food revenue' },
            { key: 'rewards', label: 'Rewards' },
            { key: 'events', label: 'Events' },
            { key: 'staffSalaries', label: 'Staff wages' },
            { key: 'runningCosts', label: 'Running costs' },
            { key: 'construction', label: 'Construction' }
        ];
        
        var html = '<table class="fin-table"><thead><tr><th></th>';
        hist.forEach(function(c) {
            var label = finDayLabel(c.day);
            html += '<th>' + label + '</th>';
        });
        if (hasToday) html += '<th class="fin-today">Today</th>';
        html += '</tr></thead><tbody>';
        
        rows.forEach(function(r) {
            html += '<tr><td class="fin-label">' + r.label + '</td>';
            hist.forEach(function(c) {
                var v = Math.round(c[r.key] || 0);
                html += '<td class="' + (v > 0 ? 'fin-pos' : v < 0 ? 'fin-neg' : 'fin-zero') + '">' + fmtFin(v) + '</td>';
            });
            if (hasToday) {
                var v2 = Math.round(today[r.key] || 0);
                html += '<td class="fin-today ' + (v2 > 0 ? 'fin-pos' : v2 < 0 ? 'fin-neg' : 'fin-zero') + '">' + fmtFin(v2) + '</td>';
            }
            html += '</tr>';
        });
        
        html += '<tr class="fin-total-row"><td class="fin-label">Net total</td>';
        hist.forEach(function(c) {
            var t = Math.round(c.total || 0);
            html += '<td class="' + (t > 0 ? 'fin-pos' : t < 0 ? 'fin-neg' : 'fin-zero') + '">' + fmtFin(t) + '</td>';
        });
        if (hasToday) {
            var tt = 0;
            rows.forEach(function(r) { tt += (today[r.key] || 0); });
            tt = Math.round(tt);
            html += '<td class="fin-today ' + (tt > 0 ? 'fin-pos' : tt < 0 ? 'fin-neg' : 'fin-zero') + '">' + fmtFin(tt) + '</td>';
        }
        html += '</tr></tbody></table>';
        
        wrap.innerHTML = html;
    };
    
    function fmtFin(v) {
        if (v === 0) return '\u2014';
        return (v > 0 ? '+' : '') + '\u20ac' + v;
    }
    
    function finDayLabel(day) {
        if (day === G.day - 1) return 'Yesterday';
        var DAYS = PPT.config.DAYS;
        return DAYS[(day - 1) % 7];
    }
    
    // ==================== DRAGGABLE DIALOGS ====================
    
    function makeDraggable(dialog, handle) {
        var offsetX = 0, offsetY = 0, dragging = false;
        
        function onDown(e) {
            var ev = e.touches ? e.touches[0] : e;
            // Remove centering transform if present
            if (dialog.style.transform) {
                var rect = dialog.getBoundingClientRect();
                dialog.style.transform = 'none';
                dialog.style.left = rect.left + 'px';
                dialog.style.top = rect.top + 'px';
            }
            var rect = dialog.getBoundingClientRect();
            offsetX = ev.clientX - rect.left;
            offsetY = ev.clientY - rect.top;
            dragging = true;
            e.preventDefault();
        }
        
        function onMove(e) {
            if (!dragging) return;
            var ev = e.touches ? e.touches[0] : e;
            var nx = ev.clientX - offsetX;
            var ny = ev.clientY - offsetY;
            // Clamp to viewport
            nx = Math.max(0, Math.min(window.innerWidth - 60, nx));
            ny = Math.max(0, Math.min(window.innerHeight - 40, ny));
            dialog.style.left = nx + 'px';
            dialog.style.top = ny + 'px';
            e.preventDefault();
        }
        
        function onUp() { dragging = false; }
        
        handle.addEventListener('mousedown', onDown);
        handle.addEventListener('touchstart', onDown, { passive: false });
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchend', onUp);
        handle.style.cursor = 'move';
    }
    
    PPT.ui.initDraggableDialogs = function() {
        var finPanel = document.getElementById('finance-panel');
        var finHeader = finPanel ? finPanel.querySelector('.fin-header') : null;
        if (finPanel && finHeader) makeDraggable(finPanel, finHeader);
        
        // Make all info dialogs draggable
        ['day-info-dialog', 'guests-info-dialog', 'happy-info-dialog'].forEach(function(id) {
            var el = document.getElementById(id);
            var handle = el ? el.querySelector('.info-header') : null;
            if (el && handle) makeDraggable(el, handle);
        });
    };
    
    PPT.ui.resetDialogPosition = function(el) {
        if (!el) return;
        el.style.left = '50%';
        el.style.top = '50%';
        el.style.transform = 'translate(-50%, -50%)';
    };
    
})();
