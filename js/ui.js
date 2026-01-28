/**
 * Pixel Park Tycoon - UI System
 * User interface, tooltips, notifications, and display updates
 */

(function() {
    'use strict';
    
    var notifTimeout = null;
    
    // ==================== NOTIFICATIONS ====================
    
    PPT.ui.showNotif = function(text, type) {
        var bar = document.getElementById('notification-bar');
        var icon = document.getElementById('notif-icon');
        var textEl = document.getElementById('notif-text');
        if (!bar || !textEl) return;
        
        bar.className = type || 'info';
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
            bar.className = 'idle';
            textEl.textContent = 'No news is good news.';
            if (icon) {
                PPT.render.drawIcon(icon.getContext('2d'), 'lightbulb', 16);
            }
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
    };
    
    PPT.ui.updateGoals = function() {
        var cg = PPT.game.currentGoal();
        var el = document.getElementById('goals-display');
        var st = el ? el.parentElement : null;
        if (!el || !st) return;
        
        st.classList.remove('silver', 'gold', 'platinum', 'diamond', 'complete');
        
        if (cg) {
            el.textContent = cg.goal.name + ' challenge · ' + cg.goal.guests + ' guests';
            var cls = cg.goal.name.toLowerCase();
            if (cls !== 'bronze') st.classList.add(cls);
        } else {
            el.textContent = 'All complete ✓';
            st.classList.add('complete');
        }
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
        PPT.audio.playSound('click');
    };
    
    PPT.ui.selectDemolish = function() {
        document.querySelectorAll('.build-item').forEach(function(e) { e.classList.remove('selected'); });
        var btn = document.getElementById('demolish-btn');
        
        if (G.demolishMode) {
            btn.classList.remove('selected');
            G.demolishMode = false;
            G.selected = null;
        } else {
            btn.classList.add('selected');
            G.demolishMode = true;
            G.selected = null;
        }
        PPT.audio.playSound('click');
    };
    
    PPT.ui.switchTab = function(t) {
        document.querySelectorAll('.tab-btn').forEach(function(b) {
            b.classList.toggle('active', b.dataset.tab === t);
        });
        document.querySelectorAll('.tab-content').forEach(function(c) {
            c.classList.toggle('active', c.id === 'tab-' + t);
        });
        G.selected = null;
        document.querySelectorAll('.build-item').forEach(function(e) { e.classList.remove('selected'); });
        PPT.audio.playSound('click');
    };
    
    // ==================== TOOLTIPS ====================
    
    PPT.ui.getStatTooltip = function(stat) {
        switch(stat) {
            case 'time':
                return { name: '', desc: 'Morning brings more guests.\nNights are quiet.\nWeekends are busier.' };
            case 'money':
                return { name: '', desc: 'Guests spend money on entry, food, and drinks.\nIncome increases with guest numbers.' };
            case 'guests':
                return { name: '', desc: 'Attractions and happiness attract guests.\nCoasters are especially popular.' };
            case 'happy':
                return { name: '', desc: 'Follow guest feedback to improve happiness.\nEnough food, attractions, paths, and decor matter.\nNew attractions excite guests.' };
            case 'goals':
                var cg = PPT.game.currentGoal();
                if (!cg) return { name: 'GOALS', desc: 'All challenges completed!\nYou reached Diamond status!' };
                var g = cg.goal;
                var scenario = PPT.currentScenario;
                var next = cg.idx < scenario.goals.length - 1 ? scenario.goals[cg.idx + 1] : null;
                var desc = 'Reach ' + g.guests + ' guests.\nEarn prize money and a happiness boost.';
                if (next) desc += '\nUnlock the ' + next.name + ' challenge.';
                return { name: '', desc: desc };
            default:
                return { name: '', desc: '' };
        }
    };
    
    PPT.ui.setupTooltips = function() {
        document.querySelectorAll('.build-item').forEach(function(item) {
            item.addEventListener('mouseenter', function() {
                var tt = document.getElementById('tooltip');
                var type = item.dataset.type;
                var scenario = PPT.currentScenario;
                var d = scenario.buildings[type];
                if (!tt || !d) return;
                
                var locked = !PPT.ui.isUnlocked(type);
                var nameEl = tt.querySelector('.tooltip-name');
                var costEl = tt.querySelector('.tooltip-cost');
                var runEl = tt.querySelector('.tooltip-running');
                var descEl = tt.querySelector('.tooltip-desc');
                
                // Show name and cost
                nameEl.textContent = d.name;
                costEl.textContent = locked ? '' : '€' + d.cost;
                
                // Show operating cost if it exists (> 0)
                if (!locked && d.run && d.run > 0) {
                    runEl.textContent = 'Operating: €' + d.run + '/day';
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
        
        // Title icons (both coaster in original)
        drawIcon(document.getElementById('title-icon1')?.getContext('2d'), 'coaster', 32);
        drawIcon(document.getElementById('title-icon2')?.getContext('2d'), 'coaster', 32);
        
        // Logo
        drawIcon(document.getElementById('logo-icon')?.getContext('2d'), 'coaster', 20);
        
        // Control buttons (top bar)
        drawIcon(document.getElementById('pause-icon')?.getContext('2d'), 'pause', 16);
        drawIcon(document.getElementById('settings-icon')?.getContext('2d'), 'gear', 16);
        
        // Settings modal icons
        drawIcon(document.getElementById('music-label-icon')?.getContext('2d'), 'music', 16);
        drawIcon(document.getElementById('sfx-label-icon')?.getContext('2d'), 'speaker', 16);
        drawIcon(document.getElementById('restart-icon')?.getContext('2d'), 'reset', 16);
        drawIcon(document.getElementById('exit-icon')?.getContext('2d'), 'exit', 16);
        
        // Tabs
        drawIcon(document.getElementById('tab-paths')?.getContext('2d'), 'path', 18);
        drawIcon(document.getElementById('tab-rides')?.getContext('2d'), 'ferris-wheel', 18);
        drawIcon(document.getElementById('tab-coasters')?.getContext('2d'), 'coaster', 18);
        drawIcon(document.getElementById('tab-food')?.getContext('2d'), 'ice-cream', 18);
        drawIcon(document.getElementById('tab-decor')?.getContext('2d'), 'flowers', 18);
        
        // Other
        drawIcon(document.getElementById('build-icon')?.getContext('2d'), 'hammer', 12);
        drawIcon(document.getElementById('demolish-tool-icon')?.getContext('2d'), 'sell', 16);
        drawIcon(document.getElementById('coin-icon')?.getContext('2d'), 'coin', 16);
        drawIcon(document.getElementById('guest-icon')?.getContext('2d'), 'guest', 16);
        drawIcon(document.getElementById('goals-icon')?.getContext('2d'), 'target', 16);
        drawIcon(document.getElementById('notif-icon')?.getContext('2d'), 'lightbulb', 16);
        
        PPT.ui.updateTimeIcon();
        PPT.ui.updateHappyIcon();
    };
    
    PPT.ui.updatePauseButton = function() {
        var icon = G.paused ? 'play' : 'pause';
        PPT.render.drawIcon(document.getElementById('pause-icon')?.getContext('2d'), icon, 16);
    };
    
})();
