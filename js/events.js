/**
 * Pixel Park Paradise - Events System
 * Auto-events (14) and Dilemmas (14)
 */

(function() {
    'use strict';

    PPT.events = {};

    var TILE_SIZE = PPT.config.TILE_SIZE;
    var GRID_WIDTH = PPT.config.GRID_WIDTH;
    var GRID_HEIGHT = PPT.config.GRID_HEIGHT;
    var TPD = PPT.config.TICKS_PER_DAY;

    // ==================== AUTO-EVENTS (14) ====================

    PPT.events.AUTO_EVENTS = [
        {
            id: 'heatWave', name: 'Heat Wave',
            exec: function() {
                addEffect('heatWave', 'guestGen', 1.3, TPD, 'heat');
                addEffect('heatWave_food', 'foodRev', 1.2, TPD, '');
                PPT.ui.showNotif('Heat Wave! Guests are flocking to the park.', 'info');
            }
        },
        {
            id: 'rainstorm', name: 'Rainstorm',
            exec: function() {
                addEffect('rainstorm', 'guestGen', 0.5, TPD, 'rain');
                PPT.ui.showNotif('Rainstorm! Fewer visitors expected today.', 'warning');
            }
        },
        {
            id: 'foggyMorning', name: 'Foggy Morning',
            exec: function() {
                addEffect('foggyMorning', 'guestGen', 0.7, 24, 'fog');
                PPT.ui.showNotif('Foggy morning \u2014 visibility is low.', 'info');
            }
        },
        {
            id: 'perfectDay', name: 'Perfect Day',
            exec: function() {
                G.boosts.push({ amt: 5, ticks: TPD });
                addEffect('perfectDay', 'guestGen', 1.15, TPD, 'sparkle');
                PPT.ui.showNotif('What a beautiful day! Everyone is in a good mood.', 'info');
            }
        },
        {
            id: 'schoolTrip', name: 'School Trip',
            exec: function() {
                for (var i = 0; i < 30; i++) {
                    G.guests++;
                    eventMoney(G.entryFee);
                    // Force family type
                    var NAMES = PPT.config.GUEST_NAMES;
                    G.guestSprites.push({
                        x: -140 - Math.random() * 40,
                        y: 5 * TILE_SIZE + 10 + Math.random() * 12,
                        tx: 1 * TILE_SIZE + 8 + Math.random() * 16,
                        ty: 5 * TILE_SIZE + 8 + Math.random() * 16,
                        color: '#7bdb87',
                        bodyType: (Math.random() < 0.5 ? 'boy' : 'girl'),
                        skin: PPT.config.SKIN_COLORS[Math.floor(Math.random() * PPT.config.SKIN_COLORS.length)],
                        hair: PPT.config.HAIR_COLORS[Math.floor(Math.random() * PPT.config.HAIR_COLORS.length)],
                        outfitIdx: Math.floor(Math.random() * PPT.config.OUTFIT_COMBOS.length),
                        wait: 0, entering: true,
                        name: NAMES[Math.floor(Math.random() * NAMES.length)],
                        type: 'family', spent: G.entryFee
                    });
                    G.guestTypeCounts.family = (G.guestTypeCounts.family || 0) + 1;
                }
                G.boosts.push({ amt: 3, ticks: TPD });
                PPT.ui.updateMoney();
                PPT.ui.showNotif('A school bus just arrived! 30 kids pouring in.', 'info');
            }
        },
        {
            id: 'tourBus', name: 'Tour Bus',
            exec: function() {
                for (var i = 0; i < 20; i++) {
                    G.guests++;
                    eventMoney(G.entryFee);
                    PPT.game.spawnGuest();
                }
                eventMoney(200);
                PPT.ui.updateMoney();
                PPT.game.spawnParticle(320, 192, 'coin', '+\u20ac200');
                PPT.ui.showNotif('Tour bus spotted! 20 new visitors arriving.', 'info');
            }
        },
        {
            id: 'thrillConvention', name: 'Thrill Convention',
            exec: function() {
                addEffect('thrillConvention', 'guestGen', 1.1, TPD, '');
                PPT.ui.showNotif('Thrill convention in town! Adrenaline junkies incoming.', 'info');
            }
        },
        {
            id: 'foodFestival', name: 'Food Festival',
            exec: function() {
                addEffect('foodFestival', 'foodRev', 1.3, TPD, '');
                PPT.ui.showNotif('Food festival nearby! Foodies are hungry.', 'info');
            }
        },
        {
            id: 'quietDay', name: 'Quiet Day',
            exec: function() {
                addEffect('quietDay', 'guestGen', 0.4, TPD, '');
                addEffect('quietDay_costs', 'costs', 0.5, TPD, '');
                PPT.ui.showNotif('Quiet day \u2014 not many visitors around.', 'info');
            }
        },
        {
            id: 'powerOutage', name: 'Power Outage',
            exec: function() {
                addEffect('powerOutage', 'powerout', 1, Math.floor(TPD / 2), 'powerout');
                PPT.ui.showNotif('Power outage! All rides temporarily shut down.', 'negative');
            }
        },
        {
            id: 'lostChild', name: 'Lost Child',
            exec: function() {
                var hasEntertainer = G.staff && G.staff.some(function(s) { return s.type === 'entertainer'; });
                if (hasEntertainer) {
                    G.boosts.push({ amt: 5, ticks: TPD });
                    PPT.ui.showNotif('An entertainer found the lost child. Guests are relieved!', 'info');
                } else {
                    G.boosts.push({ amt: -5, ticks: TPD });
                    PPT.ui.showNotif('A child got lost in the park. Guests are worried.', 'negative');
                }
            }
        },
        {
            id: 'celebrity', name: 'Celebrity Sighting',
            exec: function() {
                addEffect('celebrity', 'guestGen', 1.5, Math.floor(TPD / 2), '');
                G.boosts.push({ amt: 10, ticks: Math.floor(TPD / 2) });
                PPT.ui.showNotif('Celebrity spotted in the park! Guests are thrilled.', 'info');
            }
        },
        {
            id: 'litterProblem', name: 'Litter Problem',
            exec: function() {
                if (G.cleanliness !== undefined) {
                    G.cleanliness = Math.max(0, G.cleanliness - 30);
                }
                PPT.ui.showNotif('A wave of litter swept through the park!', 'warning');
            }
        },
        {
            id: 'brokenBench', name: 'Broken Bench',
            exec: function() {
                G.boosts.push({ amt: -2, ticks: TPD });
                PPT.ui.showNotif('A bench broke. Minor annoyance for guests.', 'info');
            }
        }
    ];

    // ==================== DILEMMAS (14) ====================

    PPT.events.DILEMMAS = [
        {
            id: 'influencer', name: 'Influencer Visit',
            desc: 'A popular influencer wants to visit your park. Pay for their VIP experience?',
            icon: 'event-megaphone',
            requires: function() { return G.guests > 0; },
            optA: { label: 'Pay \u20ac500 for VIP', exec: function() {
                eventMoney(-500); PPT.ui.updateMoney();
                addEffect('influencer', 'guestGen', 1.25, TPD * 3, '');
                PPT.ui.showNotif('The influencer loved your park! Expect more visitors.', 'info');
            }},
            optB: { label: 'Decline', exec: function() {
                PPT.ui.showNotif('The influencer moved on. Oh well.', 'info');
            }}
        },
        {
            id: 'rivalPark', name: 'Rival Park',
            desc: 'A rival theme park opened nearby! Launch an ad campaign or let it play out?',
            icon: 'event-warning',
            requires: function() { return G.guests > 0; },
            optA: { label: 'Ad campaign (\u20ac1,000)', exec: function() {
                eventMoney(-1000); PPT.ui.updateMoney();
                addEffect('rivalAd', 'guestGen', 1.2, TPD * 5, '');
                PPT.ui.showNotif('Ad campaign launched! Guests should notice.', 'info');
            }},
            optB: { label: 'Do nothing', exec: function() {
                addEffect('rival', 'guestGen', 0.85, TPD * 3, '');
                PPT.ui.showNotif('The rival park is stealing your crowd...', 'warning');
            }}
        },
        {
            id: 'bulkDiscount', name: 'Bulk Discount',
            desc: 'A tour group wants a discount. Let 60 in at half price, or 20 at full price?',
            icon: 'event-crowd',
            requires: function() { return G.entryFee > 0; },
            optA: { label: '60 guests at half fee', exec: function() {
                var halfFee = Math.floor(G.entryFee / 2);
                for (var i = 0; i < 60; i++) {
                    G.guests++; eventMoney(halfFee); PPT.game.spawnGuest();
                }
                PPT.ui.updateMoney();
                PPT.ui.showNotif('The gates are open \u2014 60 guests flooding in!', 'info');
            }},
            optB: { label: '20 at full price', exec: function() {
                for (var i = 0; i < 20; i++) {
                    G.guests++; eventMoney(G.entryFee); PPT.game.spawnGuest();
                }
                PPT.ui.updateMoney();
                PPT.ui.showNotif('A smaller but full-paying group arrives.', 'info');
            }}
        },
        {
            id: 'sponsorship', name: 'Sponsorship Deal',
            desc: 'A food brand wants to sponsor your park. Extra revenue but they pick the menu.',
            icon: 'event-money',
            requires: function(c) { return c.food > 0; },
            optA: { label: 'Accept sponsorship', exec: function() {
                eventMoney(2000); PPT.ui.updateMoney();
                PPT.game.spawnParticle(320, 192, 'coin', '+\u20ac2,000');
                addEffect('sponsor', 'foodRev', 1.5, TPD * 7, '');
                PPT.ui.showNotif('Sponsorship signed! Food revenue boosted.', 'info');
            }},
            optB: { label: 'Stay independent', exec: function() {
                PPT.ui.showNotif('You kept creative control. No changes.', 'info');
            }}
        },
        {
            id: 'vipParty', name: 'VIP Party Request',
            desc: 'A group of VIPs want to host a party at your park. It\'ll cost, but could pay off.',
            icon: 'event-star',
            requires: function() { return G.guests > 0; },
            optA: { label: 'Host the party (\u20ac800)', exec: function() {
                eventMoney(-800); PPT.ui.updateMoney();
                for (var i = 0; i < 10; i++) {
                    G.guests++; eventMoney(G.entryFee);
                    var NAMES = PPT.config.GUEST_NAMES;
                    var appear = PPT.game.makeGuestAppearance('vip');
                    G.guestSprites.push({
                        x: -140 - Math.random() * 40,
                        y: 5 * TILE_SIZE + 10 + Math.random() * 12,
                        tx: 1 * TILE_SIZE + 8 + Math.random() * 16,
                        ty: 5 * TILE_SIZE + 8 + Math.random() * 16,
                        color: '#ffd93d',
                        bodyType: appear.bodyType, skin: appear.skin,
                        hair: appear.hair, outfitIdx: appear.outfitIdx,
                        wait: 0, entering: true,
                        name: NAMES[Math.floor(Math.random() * NAMES.length)],
                        type: 'vip', spent: G.entryFee
                    });
                    G.guestTypeCounts.vip = (G.guestTypeCounts.vip || 0) + 1;
                }
                G.boosts.push({ amt: 10, ticks: TPD * 2 });
                PPT.ui.updateMoney();
                PPT.ui.showNotif('VIP party is a hit! Happiness soaring.', 'info');
            }},
            optB: { label: 'Decline', exec: function() {
                PPT.ui.showNotif('The VIPs went elsewhere. Maybe next time.', 'info');
            }}
        },
        {
            id: 'discountDay', name: 'Discount Day',
            desc: 'Run a half-price promotion today? More guests, less per head.',
            icon: 'event-crowd',
            requires: function() { return G.entryFee > 0; },
            optA: { label: 'Half-price day!', exec: function() {
                addEffect('discount', 'guestGen', 2.0, TPD, '');
                addEffect('discount_fee', 'entryFee', 0.5, TPD, '');
                PPT.ui.showNotif('Discount Day! The park is buzzing.', 'info');
            }},
            optB: { label: 'Keep normal prices', exec: function() {
                PPT.ui.showNotif('Holding firm on prices. Steady as she goes.', 'info');
            }}
        },
        {
            id: 'expansion', name: 'Land Expansion',
            desc: 'A neighboring plot is for sale. Buy it to clear 3 tiles for building?',
            icon: 'event-wrench',
            requires: function() {
                // Check if there are natural/non-buildable tiles
                for (var y = 0; y < GRID_HEIGHT; y++) {
                    for (var x = 0; x < GRID_WIDTH; x++) {
                        var c = G.grid[y][x];
                        if (c && c.natural) return true;
                    }
                }
                return false;
            },
            optA: { label: 'Buy land (\u20ac1,500)', exec: function() {
                eventMoney(-1500); PPT.ui.updateMoney();
                var cleared = 0;
                for (var y = 0; y < GRID_HEIGHT && cleared < 3; y++) {
                    for (var x = 0; x < GRID_WIDTH && cleared < 3; x++) {
                        var c = G.grid[y][x];
                        if (c && c.natural) {
                            G.grid[y][x] = null;
                            cleared++;
                        }
                    }
                }
                PPT.ui.showNotif('New land acquired! ' + cleared + ' tiles cleared for building.', 'info');
            }},
            optB: { label: 'Pass', exec: function() {
                PPT.ui.showNotif('The land offer expired. Maybe next time.', 'info');
            }}
        },
        {
            id: 'staffStrike', name: 'Staff Strike',
            desc: 'Your staff are threatening to strike! Pay a bonus or risk walkouts?',
            icon: 'event-warning',
            requires: function() { return (G.staff || []).length > 0; },
            optA: { label: 'Pay \u20ac500 bonus', exec: function() {
                eventMoney(-500); PPT.ui.updateMoney();
                PPT.ui.showNotif('Staff accepted the bonus. Crisis averted.', 'info');
            }},
            optB: { label: 'Refuse', exec: function() {
                // 50% of staff quits (at least 1)
                var quitCount = Math.max(1, Math.floor((G.staff || []).length / 2));
                for (var i = 0; i < quitCount; i++) {
                    if (G.staff.length > 0) {
                        G.staff.pop();
                        if (G.staffSprites && G.staffSprites.length > 0) G.staffSprites.pop();
                    }
                }
                PPT.ui.buildStaffPanel();
                PPT.ui.showNotif('Staff members quit in protest!', 'negative');
            }}
        },
        {
            id: 'safetyInspection', name: 'Safety Inspection',
            desc: 'Inspectors are at the gate. Pay for an express pass or roll the dice?',
            icon: 'event-wrench',
            requires: function(c) { return (c.rides + c.coasters) > 0; },
            optA: { label: 'Pay \u20ac800 for express', exec: function() {
                eventMoney(-800); PPT.ui.updateMoney();
                G.boosts.push({ amt: 10, ticks: TPD * 2 });
                // No breakdowns for 5 days
                addEffect('safePass', 'noBreak', 1, TPD * 5, '');
                PPT.ui.showNotif('Safety inspection passed with flying colors!', 'achievement');
                PPT.audio.playSound('achievement');
            }},
            optB: { label: 'Wing it', exec: function() {
                if (Math.random() < 0.6) {
                    PPT.ui.showNotif('Inspection passed \u2014 got lucky!', 'info');
                } else {
                    // Fail: break a random ride
                    var rideBuildings = G.buildings.filter(function(b) {
                        if (b.building) return false;
                        var d = PPT.currentScenario.buildings[b.type];
                        return d && (d.cat === 'ride' || d.cat === 'coaster');
                    });
                    if (rideBuildings.length > 0) {
                        var rb = rideBuildings[Math.floor(Math.random() * rideBuildings.length)];
                        if (!G.rideBreakdowns) G.rideBreakdowns = [];
                        if (!G.rideBreakdowns.some(function(bd) { return bd.x === rb.x && bd.y === rb.y; })) {
                            G.rideBreakdowns.push({ x: rb.x, y: rb.y, repairTicks: 0 });
                        }
                    }
                    PPT.ui.showNotif('Inspection failed. A ride has been shut down.', 'negative');
                }
            }}
        },
        {
            id: 'mysteryInvestor', name: 'Mystery Investor',
            desc: 'An anonymous investor offers \u20ac3,000 to sponsor one of your rides. Accept?',
            icon: 'event-money',
            requires: function(c) { return (c.rides + c.coasters) > 0; },
            optA: { label: 'Accept \u20ac3,000', exec: function() {
                eventMoney(3000); PPT.ui.updateMoney();
                PPT.game.spawnParticle(320, 192, 'coin', '+\u20ac3,000');
                PPT.ui.showNotif('\u20ac3,000 invested! One ride has a new sponsor.', 'info');
            }},
            optB: { label: 'Decline', exec: function() {
                PPT.ui.showNotif('You turned down the investor. Independence has its price.', 'info');
            }}
        },
        {
            id: 'guestPetition', name: 'Guest Petition',
            desc: 'Guests are petitioning for more greenery. Plant trees or ignore them?',
            icon: 'event-crowd',
            requires: function() { return true; },
            optA: { label: 'Plant trees (\u20ac400)', exec: function() {
                eventMoney(-400); PPT.ui.updateMoney();
                // Plant 3 trees on empty grass tiles
                var planted = 0;
                var treeTypes = PPT.config.TREE_TYPES;
                for (var y = 0; y < GRID_HEIGHT && planted < 3; y++) {
                    for (var x = 0; x < GRID_WIDTH && planted < 3; x++) {
                        if (G.grid[y][x] === null) {
                            var tt = treeTypes[Math.floor(Math.random() * treeTypes.length)];
                            G.grid[y][x] = { type: tt, natural: true };
                            planted++;
                        }
                    }
                }
                G.boosts.push({ amt: 8, ticks: TPD * 3 });
                PPT.ui.showNotif('Trees planted! Guests love the greenery.', 'info');
            }},
            optB: { label: 'Ignore petition', exec: function() {
                G.boosts.push({ amt: -5, ticks: TPD * 2 });
                PPT.ui.showNotif('Guests are grumbling about the lack of nature.', 'warning');
            }}
        },
        {
            id: 'birthday', name: 'Birthday Party',
            desc: 'A family wants to host a birthday party in your park. Worth the setup cost?',
            icon: 'event-star',
            requires: function() { return G.guests > 0; },
            optA: { label: 'Host it (\u20ac200)', exec: function() {
                eventMoney(-200); PPT.ui.updateMoney();
                for (var i = 0; i < 15; i++) {
                    G.guests++; eventMoney(G.entryFee);
                    var NAMES = PPT.config.GUEST_NAMES;
                    var appear = PPT.game.makeGuestAppearance('family');
                    G.guestSprites.push({
                        x: -140 - Math.random() * 40,
                        y: 5 * TILE_SIZE + 10 + Math.random() * 12,
                        tx: 1 * TILE_SIZE + 8 + Math.random() * 16,
                        ty: 5 * TILE_SIZE + 8 + Math.random() * 16,
                        color: '#7bdb87',
                        bodyType: appear.bodyType, skin: appear.skin,
                        hair: appear.hair, outfitIdx: appear.outfitIdx,
                        wait: 0, entering: true,
                        name: NAMES[Math.floor(Math.random() * NAMES.length)],
                        type: 'family', spent: G.entryFee
                    });
                    G.guestTypeCounts.family = (G.guestTypeCounts.family || 0) + 1;
                }
                G.boosts.push({ amt: 5, ticks: TPD * 2 });
                PPT.ui.updateMoney();
                PPT.game.spawnConfetti();
                PPT.ui.showNotif('Happy birthday! The kids are having a blast.', 'info');
            }},
            optB: { label: 'Decline', exec: function() {
                PPT.ui.showNotif('The family went elsewhere. No party today.', 'info');
            }}
        },
        {
            id: 'noiseComplaint', name: 'Noise Complaint',
            desc: 'Neighbors are complaining about coaster noise. Install barriers or risk a fine?',
            icon: 'event-warning',
            requires: function(c) { return c.coasters > 0; },
            optA: { label: 'Install barriers (\u20ac600)', exec: function() {
                eventMoney(-600); PPT.ui.updateMoney();
                PPT.ui.showNotif('Sound barriers installed. Neighbors are happy.', 'info');
            }},
            optB: { label: 'Ignore it', exec: function() {
                if (Math.random() < 0.3) {
                    eventMoney(-1000); PPT.ui.updateMoney();
                    G.boosts.push({ amt: -5, ticks: TPD * 3 });
                    PPT.game.spawnParticle(320, 192, 'neg', '-\u20ac1,000');
                    PPT.ui.showNotif('Fined! The neighbors weren\'t bluffing.', 'negative');
                } else {
                    PPT.ui.showNotif('No complaints filed \u2014 you got away with it!', 'info');
                }
            }}
        },
        {
            id: 'foodPoisoning', name: 'Food Poisoning Scare',
            desc: 'Reports of food poisoning! Close stalls for inspection, or just apologize?',
            icon: 'event-food',
            requires: function(c) { return c.food > 0; },
            optA: { label: 'Close for inspection', exec: function() {
                addEffect('foodClose', 'foodRev', 0, TPD, '');
                G.boosts.push({ amt: 5, ticks: TPD });
                PPT.ui.showNotif('Food stalls closed for inspection. Guests feel safer.', 'info');
            }},
            optB: { label: 'Apologize (\u20ac300)', exec: function() {
                eventMoney(-300); PPT.ui.updateMoney();
                G.boosts.push({ amt: -3, ticks: TPD });
                PPT.ui.showNotif('You apologized. Most guests seem satisfied.', 'info');
            }}
        }
    ];

    // ==================== HELPERS ====================

    function addEffect(id, type, modifier, ticks, visual) {
        if (!G.activeEffects) G.activeEffects = [];
        G.activeEffects.push({ id: id, type: type, modifier: modifier, ticksRemaining: ticks, visual: visual || '' });
        PPT.events.updateEffectsBar();
    }

    function eventMoney(amount) {
        G.money += amount;
        PPT.game.trackFinance('events', amount);
    }

    function getModifierProduct(type) {
        if (!G || !G.activeEffects) return 1.0;
        var product = 1.0;
        G.activeEffects.forEach(function(e) {
            if (e.type === type) product *= e.modifier;
        });
        return product;
    }

    PPT.events.getGuestGenModifier = function() { return getModifierProduct('guestGen'); };
    PPT.events.getFoodRevenueModifier = function() { return getModifierProduct('foodRev'); };
    PPT.events.getEntryFeeModifier = function() { return getModifierProduct('entryFee'); };
    PPT.events.getCostsModifier = function() { return getModifierProduct('costs'); };

    PPT.events.isPowerOutage = function() {
        if (!G || !G.activeEffects) return false;
        return G.activeEffects.some(function(e) { return e.type === 'powerout'; });
    };

    PPT.events.isNoBreakdown = function() {
        if (!G || !G.activeEffects) return false;
        return G.activeEffects.some(function(e) { return e.type === 'noBreak'; });
    };

    PPT.events.getActiveVisuals = function() {
        if (!G || !G.activeEffects) return [];
        var visuals = [];
        G.activeEffects.forEach(function(e) {
            if (e.visual && visuals.indexOf(e.visual) < 0) visuals.push(e.visual);
        });
        return visuals;
    };

    // ==================== TICK & CHECK ====================

    // Expiry notification map
    var EXPIRY_NOTIFS = {
        rain: 'The rainstorm has passed.',
        heat: 'The heat wave has broken.',
        fog: 'The fog has lifted.',
        sponsor: 'Sponsorship deal has ended.',
        discount: 'Discount Day is over. Prices back to normal.',
        rival: 'The rival park buzz has died down.',
        influencer: 'The influencer effect is wearing off.'
    };

    PPT.events.tickEffects = function() {
        if (!G || !G.activeEffects) return;
        for (var i = G.activeEffects.length - 1; i >= 0; i--) {
            G.activeEffects[i].ticksRemaining--;
            if (G.activeEffects[i].ticksRemaining <= 0) {
                var expired = G.activeEffects[i];
                G.activeEffects.splice(i, 1);
                // Expiry notification
                var vis = expired.visual || '';
                var eid = expired.id || '';
                var msg = EXPIRY_NOTIFS[vis] || EXPIRY_NOTIFS[eid] || null;
                if (msg) PPT.ui.showNotif(msg, 'info');
            }
        }
        PPT.events.updateEffectsBar();
    };

    PPT.events.check = function() {
        if (!G) return;
        if (!G.lastEvents) G.lastEvents = [];

        // 55% chance per day
        if (Math.random() > 0.55) return;

        var c = PPT.game.countBuildings();

        // 60% auto / 40% dilemma
        if (Math.random() < 0.6 || G.day <= 3) {
            // Auto-event
            var eligible = PPT.events.AUTO_EVENTS.filter(function(e) {
                return !G.lastEvents.some(function(le) { return le.id === e.id && (G.day - le.day) < 7; });
            });
            if (eligible.length === 0) return;
            var evt = eligible[Math.floor(Math.random() * eligible.length)];
            G.lastEvents.push({ id: evt.id, day: G.day });
            if (G.lastEvents.length > 30) G.lastEvents.shift();
            evt.exec();
        } else {
            // Dilemma
            var eligible2 = PPT.events.DILEMMAS.filter(function(d) {
                if (d.requires && !d.requires(c)) return false;
                return !G.lastEvents.some(function(le) { return le.id === d.id && (G.day - le.day) < 7; });
            });
            if (eligible2.length === 0) return;
            var dilemma = eligible2[Math.floor(Math.random() * eligible2.length)];
            G.lastEvents.push({ id: dilemma.id, day: G.day });
            if (G.lastEvents.length > 30) G.lastEvents.shift();
            PPT.events.showDilemma(dilemma);
        }
    };

    // ==================== DILEMMA MODAL ====================

    // Store current dilemma handlers for delegation
    var _dilemmaHandlers = null;

    PPT.events.showDilemma = function(d) {
        var modal = document.getElementById('event-modal');
        if (!modal) return;

        // Pause game, hide guest card
        G.paused = true;
        PPT.ui.hideGuestCard();

        document.getElementById('event-name').textContent = d.name;
        document.getElementById('event-desc').textContent = d.desc;

        // Draw icon
        var iconCanvas = document.getElementById('event-icon');
        if (iconCanvas) {
            var ctx = iconCanvas.getContext('2d');
            ctx.clearRect(0, 0, 32, 32);
            PPT.render.drawIcon(ctx, d.icon || 'event-warning', 32);
        }

        // Set button text on existing buttons
        var btnA = document.getElementById('event-btn-a');
        var btnB = document.getElementById('event-btn-b');
        if (btnA) btnA.textContent = d.optA.label;
        if (btnB) btnB.textContent = d.optB.label;

        // Store handlers for the delegation listener
        _dilemmaHandlers = {
            done: false,
            a: function() {
                try { d.optA.exec(); } catch(err) { console.error('Dilemma optA error:', err); }
            },
            b: function() {
                try { d.optB.exec(); } catch(err) { console.error('Dilemma optB error:', err); }
            }
        };

        modal.classList.add('active');
    };

    // Single delegated click handler on the modal - set up once
    (function() {
        var modal = document.getElementById('event-modal');
        if (!modal) return;

        modal.addEventListener('click', function(e) {
            if (!_dilemmaHandlers || _dilemmaHandlers.done) return;

            // Walk up from click target to find which button (if any) was clicked
            var el = e.target;
            while (el && el !== modal) {
                if (el.id === 'event-btn-a') {
                    _dilemmaHandlers.done = true;
                    modal.classList.remove('active');
                    G.paused = false;
                    _dilemmaHandlers.a();
                    return;
                }
                if (el.id === 'event-btn-b') {
                    _dilemmaHandlers.done = true;
                    modal.classList.remove('active');
                    G.paused = false;
                    _dilemmaHandlers.b();
                    return;
                }
                el = el.parentNode;
            }
        });
    })();

    // ==================== ACTIVE EFFECTS BAR ====================
    // Effects are hidden from the player - no visible indicators
    PPT.events.updateEffectsBar = function() {
        var bar = document.getElementById('active-effects');
        if (bar) bar.style.display = 'none';
    };

    // ==================== RAIN SYSTEM ====================

    PPT.events.updateRain = function() {
        if (!G) return;
        var visuals = PPT.events.getActiveVisuals();
        var hasRain = visuals.indexOf('rain') >= 0;

        // Toggle full-area rain overlay
        var rainOverlay = document.getElementById('rain-overlay');
        if (rainOverlay) {
            if (hasRain) rainOverlay.classList.add('active');
            else rainOverlay.classList.remove('active');
        }

        if (!G.rain) G.rain = [];

        if (hasRain) {
            // Spawn 30-50 new drops per frame across full outside canvas (1280x1024)
            var count = 30 + Math.floor(Math.random() * 20);
            for (var i = 0; i < count; i++) {
                if (G.rain.length >= 800) break;
                G.rain.push({
                    x: Math.random() * 1300 - 10,
                    y: -10 - Math.random() * 40,
                    vx: -0.5 - Math.random() * 0.5,
                    vy: 4 + Math.random() * 3,
                    splash: false,
                    life: 0
                });
            }
        }

        // Update existing drops
        for (var j = G.rain.length - 1; j >= 0; j--) {
            var d = G.rain[j];
            if (d.splash) {
                d.life--;
                if (d.life <= 0) G.rain.splice(j, 1);
            } else {
                d.x += d.vx;
                d.y += d.vy;
                if (d.y >= 1020) {
                    d.splash = true;
                    d.life = 4;
                    d.y = 1020;
                }
            }
        }
    };

})();
