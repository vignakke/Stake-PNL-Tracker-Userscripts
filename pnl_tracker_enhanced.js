// ==UserScript==
// @name         v12 Stake.com - P/L Tracker Enhanced Clean (Multi-Session, Notifications, Mini Mode)
// @namespace    http://tampermonkey.net/
// @version      12.1
// @description  (Enhanced & Cleaned) version with Multi-Session History, Smart Notifications, and Mini Mode
// @author       Keon 
// @match        https://stake.com/*
// @match        https://stake.bet/*
// @match        https://stake.pet/*
// @match        https://stake.games/*
// @match        https://stake.mba/*
// @match        https://stake.jp/*
// @match        https://stake.bz/*
// @match        https://stake.ceo/*
// @match        https://stake.krd/*
// @match        https://*.staketr.com/*
// @match        https://*.stake.games/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @require      https://html2canvas.hertzen.com/dist/html2canvas.min.js
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Performance: Use const for immutable config - enables V8 optimizations
    const CONFIG = {
        STORAGE: {
            SESSION_ACTIVE: 'pnlSessionActive_v5',
            SESSION_PNL_FIAT: 'pnlSessionPnlFiat_v5',
            DISPLAY_FIAT: 'pnlDisplayFiat_v5',
            TRACKED_BALANCES: 'pnlTrackedBalances_v5',
            TRACKED_CRYPTO_CURRENCIES: 'pnlTrackedCryptoCurrencies_v5',
            STARTING_BALANCE_FIAT: 'pnlStartingBalanceFiat_v5',
            GAME_STATS: 'pnlGameStats_v5',
            POPUP_POS: 'pnlPopupPos_v5',
            // Enhanced storage keys
            SESSION_HISTORY: 'pnlSessionHistory_v5',
            CURRENT_SESSION_ID: 'pnlCurrentSessionId_v5',
            NOTIFICATION_SETTINGS: 'pnlNotificationSettings_v5',
            MINI_MODE: 'pnlMiniMode_v5',
            HOURLY_STATS: 'pnlHourlyStats_v5',
            DAILY_STATS: 'pnlDailyStats_v5',
            WEEKLY_STATS: 'pnlWeeklyStats_v5',
            SESSION_HISTORY_POS: 'pnlSessionHistoryPos_v5',
            SESSION_HISTORY_SIZE: 'pnlSessionHistorySize_v5',
        },
        EVENTS: {
            BET_PROCESSED: 'pnl-stake-bet',
            STATS_UPDATED: 'pnl-stats-updated',
            BIG_WIN: 'pnl-big-win',
        },
        IDS: {
            pnlStyles: 'pnl-styles',
            statsPopup: 'pnl-stats-popup',
            popupClose: 'pnl-popup-close',
            statsTableContainer: 'pnl-stats-table-container',
            saveImage: 'pnl-save-image',
            resetStats: 'pnl-reset-stats',
            exportCsv: 'pnl-export-csv',
            confirmModal: 'pnl-confirm-modal',
            confirmReset: 'pnl-confirm-reset',
            cancelReset: 'pnl-cancel-reset',
            cryptoSelectModal: 'pnl-crypto-select-modal',
            cryptoSelectList: 'pnl-crypto-select-list',
            startSessionBtn: 'pnl-start-session-btn',
            cancelSessionBtn: 'pnl-cancel-session-btn',
            sessionHistoryBtn: 'pnl-session-history-btn',
            miniModeToggle: 'pnl-mini-mode-toggle',
            notificationSettings: 'pnl-notification-settings',
            winNotification: 'pnl-win-notification',
        },
        CLASSES: {
            pnlTrackerContainer: 'pnl-tracker-container',
            pnlText: 'pnl-text',
            statsButton: 'stats-button',
            pnlProfit: 'pnl-profit',
            pnlLoss: 'pnl-loss',
            miniMode: 'pnl-mini-mode',
        },
        NOTIFICATIONS: {
            MIN_MULTIPLIER: 100,
            SOUND_ENABLED: true,
            POPUP_DURATION: 5000,
        }
    };

    // Performance: Cache fiat symbols to avoid repeated object lookups
    const FIAT_SYMBOLS = new Map([
        ['usd', '$'],
        ['eur', '€'],
        ['cad', 'C$'],
        ['ars', 'AR$'],
        ['vnd', '₫']
    ]);

    // Sound for big wins - Using Web Audio API for better Chrome compatibility
    let WIN_SOUND = null;
    
    // Create a pleasant chime sound using Web Audio API
    function createWinSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create a simple pleasant chime
            function playChime() {
                const now = audioContext.currentTime;
                
                // Create oscillators for a pleasant chord
                const frequencies = [523.25, 659.25, 783.99]; // C, E, G (C major chord)
                
                frequencies.forEach((freq, index) => {
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    
                    oscillator.frequency.value = freq;
                    oscillator.type = 'sine';
                    
                    // Envelope for smooth sound
                    gainNode.gain.setValueAtTime(0, now);
                    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
                    
                    oscillator.start(now + index * 0.1);
                    oscillator.stop(now + 2);
                });
            }
            
            return playChime;
        } catch (e) {
            console.log('Web Audio API not supported, falling back to data URI');
            // Fallback to data URI audio
            const audio = new Audio('data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV');
            return () => {
                audio.currentTime = 0;
                audio.play().catch(() => {});
            };
        }
    }

    // Performance: Inject WebSocket hook once with optimized parsing
    const script = document.createElement('script');
    script.textContent = `
        (function() {
            if (window.wsHooked) return;
            window.wsHooked = true;
            const OriginalWebSocket = window.WebSocket;
            class InterceptedWebSocket extends OriginalWebSocket {
                constructor(url, protocols) {
                    super(url, protocols);
                    if (url?.includes('/_api/websockets')) {
                        this.addEventListener('message', (e) => {
                            try {
                                const d = JSON.parse(e.data);
                                // Performance: Early return if no houseBets
                                const bets = d?.payload?.data?.houseBets;
                                if (bets) {
                                    window.dispatchEvent(new CustomEvent('${CONFIG.EVENTS.BET_PROCESSED}', {
                                        detail: { houseBets: bets }
                                    }));
                                }
                            } catch {}
                        });
                    }
                }
            }
            window.WebSocket = InterceptedWebSocket;
        })();
    `;
    (document.head || document.documentElement).appendChild(script);
    script.remove();

    // Session History Manager
    class SessionHistoryManager {
        constructor() {
            this.sessions = [];
            this.currentSessionId = null;
        }

        async load() {
            this.sessions = await GM_getValue(CONFIG.STORAGE.SESSION_HISTORY, []);
            this.currentSessionId = await GM_getValue(CONFIG.STORAGE.CURRENT_SESSION_ID, null);
        }

        async save() {
            await GM_setValue(CONFIG.STORAGE.SESSION_HISTORY, this.sessions);
            await GM_setValue(CONFIG.STORAGE.CURRENT_SESSION_ID, this.currentSessionId);
        }

        createSession(trackedCurrencies, startingBalance, displayFiat) {
            const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const session = {
                id: sessionId,
                startTime: new Date().toISOString(),
                endTime: null,
                trackedCurrencies,
                startingBalance,
                displayFiat,
                finalPnl: 0,
                totalBets: 0,
                biggestWin: 0,
                biggestLoss: 0,
                bestMultiplier: 0,
                bestGame: '',
                gameStats: {},
                hourlyStats: {},
                dailyStats: {},
                weeklyStats: {},
                status: 'active'
            };
            
            this.sessions.unshift(session);
            // Keep only last 50 sessions
            if (this.sessions.length > 50) {
                this.sessions = this.sessions.slice(0, 50);
            }
            
            this.currentSessionId = sessionId;
            return sessionId;
        }

        updateCurrentSession(updates) {
            const session = this.sessions.find(s => s.id === this.currentSessionId);
            if (session) {
                Object.assign(session, updates);
            }
        }

        endCurrentSession(finalStats) {
            const session = this.sessions.find(s => s.id === this.currentSessionId);
            if (session) {
                session.endTime = new Date().toISOString();
                session.status = 'completed';
                session.finalPnl = finalStats.pnlFiat;
                session.totalBets = finalStats.totalBets;
                session.bestMultiplier = finalStats.bestMultiplier || 0;
                session.bestGame = finalStats.bestGame || '';
                session.gameStats = finalStats.gameStats;
            }
            this.currentSessionId = null;
        }

        deleteSession(sessionId) {
            this.sessions = this.sessions.filter(s => s.id !== sessionId);
            return this.save();
        }

        getSessionById(id) {
            return this.sessions.find(s => s.id === id);
        }

        getActiveSessions() {
            return this.sessions.filter(s => s.status === 'active');
        }

        async recoverLastSession() {
            const activeSessions = this.getActiveSessions();
            if (activeSessions.length > 0) {
                // Return the most recent active session
                return activeSessions[0];
            }
            return null;
        }
    }

    // Notification Manager
    class NotificationManager {
        constructor() {
            this.settings = {
                enabled: true,
                minMultiplier: 100,
                soundEnabled: true,
                popupDuration: 5000
            };
        }

        async load() {
            const saved = await GM_getValue(CONFIG.STORAGE.NOTIFICATION_SETTINGS, {});
            Object.assign(this.settings, saved);
        }

        async save() {
            await GM_setValue(CONFIG.STORAGE.NOTIFICATION_SETTINGS, this.settings);
        }

        showBigWin(gameName, multiplier, pnl, currency) {
            if (!this.settings.enabled || multiplier < this.settings.minMultiplier) return;

            // Play sound
            if (this.settings.soundEnabled) {
                try {
                    if (!WIN_SOUND) {
                        WIN_SOUND = createWinSound();
                    }
                    if (WIN_SOUND) {
                        WIN_SOUND();
                    }
                } catch (e) {
                    console.log('Could not play win sound:', e);
                }
            }

            // Show browser notification if available
            if (typeof GM_notification !== 'undefined') {
                GM_notification({
                    title: `🎉 BIG WIN! ${multiplier.toFixed(2)}x`,
                    text: `${gameName}\nProfit: ${pnl.toFixed(2)} ${currency}`,
                    timeout: this.settings.popupDuration,
                    onclick: () => {}
                });
            }

            // Show in-page notification
            this.showInPageNotification(gameName, multiplier, pnl, currency);
        }

        showInPageNotification(gameName, multiplier, pnl, currency) {
            // Remove existing notification if any
            const existing = document.getElementById(CONFIG.IDS.winNotification);
            if (existing) existing.remove();

            const notification = document.createElement('div');
            notification.id = CONFIG.IDS.winNotification;
            notification.className = 'pnl-win-notification';
            notification.innerHTML = `
                <div class="pnl-win-content">
                    <div class="pnl-win-header">🎉 BIG WIN!</div>
                    <div class="pnl-win-multiplier">${multiplier.toFixed(2)}x</div>
                    <div class="pnl-win-game">${gameName}</div>
                    <div class="pnl-win-profit">+${pnl.toFixed(2)} ${currency}</div>
                </div>
            `;

            document.body.appendChild(notification);

            // Animate in
            setTimeout(() => notification.classList.add('show'), 10);

            // Remove after duration
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 500);
            }, this.settings.popupDuration);
        }
    }

    // Time-based Statistics Tracker
    class TimeBasedStats {
        constructor() {
            this.hourlyStats = {};
            this.dailyStats = {};
            this.weeklyStats = {};
        }

        async load() {
            this.hourlyStats = await GM_getValue(CONFIG.STORAGE.HOURLY_STATS, {});
            this.dailyStats = await GM_getValue(CONFIG.STORAGE.DAILY_STATS, {});
            this.weeklyStats = await GM_getValue(CONFIG.STORAGE.WEEKLY_STATS, {});
        }

        async save() {
            await Promise.all([
                GM_setValue(CONFIG.STORAGE.HOURLY_STATS, this.hourlyStats),
                GM_setValue(CONFIG.STORAGE.DAILY_STATS, this.dailyStats),
                GM_setValue(CONFIG.STORAGE.WEEKLY_STATS, this.weeklyStats)
            ]);
        }

        recordBet(pnl, betAmount) {
            const now = new Date();
            const hourKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
            const dayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
            const weekKey = `${now.getFullYear()}-W${this.getWeekNumber(now)}`;

            // Update hourly stats
            if (!this.hourlyStats[hourKey]) {
                this.hourlyStats[hourKey] = { pnl: 0, bets: 0, wagered: 0 };
            }
            this.hourlyStats[hourKey].pnl += pnl;
            this.hourlyStats[hourKey].bets++;
            this.hourlyStats[hourKey].wagered += betAmount;

            // Update daily stats
            if (!this.dailyStats[dayKey]) {
                this.dailyStats[dayKey] = { pnl: 0, bets: 0, wagered: 0 };
            }
            this.dailyStats[dayKey].pnl += pnl;
            this.dailyStats[dayKey].bets++;
            this.dailyStats[dayKey].wagered += betAmount;

            // Update weekly stats
            if (!this.weeklyStats[weekKey]) {
                this.weeklyStats[weekKey] = { pnl: 0, bets: 0, wagered: 0 };
            }
            this.weeklyStats[weekKey].pnl += pnl;
            this.weeklyStats[weekKey].bets++;
            this.weeklyStats[weekKey].wagered += betAmount;

            // Clean old data (keep last 30 days)
            this.cleanOldData();
        }

        getWeekNumber(date) {
            const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
            const dayNum = d.getUTCDay() || 7;
            d.setUTCDate(d.getUTCDate() + 4 - dayNum);
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        }

        cleanOldData() {
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            
            // Clean hourly stats
            Object.keys(this.hourlyStats).forEach(key => {
                const parts = key.split('-');
                const date = new Date(parts[0], parts[1], parts[2], parts[3]);
                if (date.getTime() < thirtyDaysAgo) {
                    delete this.hourlyStats[key];
                }
            });
        }

        getRecentStats(type = 'daily', count = 7) {
            const stats = type === 'hourly' ? this.hourlyStats : 
                         type === 'daily' ? this.dailyStats : 
                         this.weeklyStats;
            
            const sorted = Object.entries(stats)
                .sort((a, b) => b[0].localeCompare(a[0]))
                .slice(0, count);
            
            return sorted.map(([key, data]) => ({ key, ...data }));
        }
    }

    async function main() {
        // Initialize managers
        const sessionHistory = new SessionHistoryManager();
        const notificationManager = new NotificationManager();
        const timeStats = new TimeBasedStats();
        
        await Promise.all([
            sessionHistory.load(),
            notificationManager.load(),
            timeStats.load()
        ]);

        // Check for session recovery
        const recoverableSession = await sessionHistory.recoverLastSession();
        let sessionRecovered = false;
        
        // Performance: Batch GM_getValue calls using Promise.all
        let [sessionActive, displayFiat, miniModeEnabled] = await Promise.all([
            GM_getValue(CONFIG.STORAGE.SESSION_ACTIVE, false),
            GM_getValue(CONFIG.STORAGE.DISPLAY_FIAT, 'eur'),
            GM_getValue(CONFIG.STORAGE.MINI_MODE, false)
        ]);

        // If there's a recoverable session and no active session, offer recovery
        if (recoverableSession && !sessionActive) {
            const shouldRecover = confirm(`Found an active session from ${new Date(recoverableSession.startTime).toLocaleString()}. Would you like to recover it?`);
            if (shouldRecover) {
                sessionActive = true;
                sessionRecovered = true;
                sessionHistory.currentSessionId = recoverableSession.id;
                await GM_setValue(CONFIG.STORAGE.SESSION_ACTIVE, true);
            }
        }

        let pnlUI = null;
        let currencyRates = null;
        let isProcessingClick = false;

        // Performance: Initialize with proper structure to avoid hidden class changes
        let sessionState = {
            pnlFiat: 0,
            pnlCrypto: Object.create(null), // Performance: Faster object without prototype
            gameStats: Object.create(null),
            startingBalanceFiat: 0,
            trackedBalances: Object.create(null),
            trackedCryptoCurrencies: [],
            trackedCurrenciesSet: null, // Performance: Add Set for O(1) lookups
            sessionId: null,
            totalBets: 0
        };

        let saveTimeout = null;

        // Performance: Batch storage operations
        async function saveSessionState() {
            if (!sessionActive) return;
            
            // Update session history
            // Calculate best multiplier and game from all games
            let bestMultiplier = 0;
            let bestGame = '';
            for (const game in sessionState.gameStats) {
                if (sessionState.gameStats[game].bestMultiplier > bestMultiplier) {
                    bestMultiplier = sessionState.gameStats[game].bestMultiplier;
                    bestGame = game;
                }
            }
            
            sessionHistory.updateCurrentSession({
                finalPnl: sessionState.pnlFiat,
                totalBets: sessionState.totalBets,
                bestMultiplier: bestMultiplier,
                bestGame: bestGame,
                gameStats: sessionState.gameStats
            });
            
            await Promise.all([
                GM_setValue(CONFIG.STORAGE.SESSION_PNL_FIAT, sessionState.pnlFiat),
                GM_setValue('pnlSessionPnlCrypto_v5', sessionState.pnlCrypto),
                GM_setValue(CONFIG.STORAGE.GAME_STATS, sessionState.gameStats),
                sessionHistory.save(),
                timeStats.save()
            ]);
        }

        function scheduleSave() {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(saveSessionState, 750);
        }

        // Performance: Batch load operations
        async function loadSessionState() {
            if (!sessionActive) return;
            const [pnlFiat, pnlCrypto, gameStats, startingBalanceFiat, trackedBalances, trackedCryptoCurrencies] = 
                await Promise.all([
                    GM_getValue(CONFIG.STORAGE.SESSION_PNL_FIAT, 0),
                    GM_getValue('pnlSessionPnlCrypto_v5', {}),
                    GM_getValue(CONFIG.STORAGE.GAME_STATS, {}),
                    GM_getValue(CONFIG.STORAGE.STARTING_BALANCE_FIAT, 0),
                    GM_getValue(CONFIG.STORAGE.TRACKED_BALANCES, {}),
                    GM_getValue(CONFIG.STORAGE.TRACKED_CRYPTO_CURRENCIES, [])
                ]);
            
            // Count total bets
            let totalBets = 0;
            for (const game in gameStats) {
                totalBets += gameStats[game].totalBets || 0;
            }
            
            Object.assign(sessionState, {
                pnlFiat,
                pnlCrypto,
                gameStats,
                startingBalanceFiat,
                trackedBalances,
                trackedCryptoCurrencies,
                trackedCurrenciesSet: new Set(trackedCryptoCurrencies), // Performance: Create Set for fast lookups
                sessionId: sessionHistory.currentSessionId,
                totalBets
            });
        }

        if (sessionActive) {
            await loadSessionState();
        }

        // Performance: Cache cookie parsing result
        let cachedToken = null;
        let tokenCacheTime = 0;
        const TOKEN_CACHE_DURATION = 60000; // 1 minute cache

        function getAccessToken() {
            const now = Date.now();
            if (cachedToken && (now - tokenCacheTime) < TOKEN_CACHE_DURATION) {
                return cachedToken;
            }
            try {
                const cookies = document.cookie.split('; ');
                const sessionCookie = cookies.find(row => row.startsWith('session='));
                cachedToken = sessionCookie ? sessionCookie.split('=')[1] : null;
                tokenCacheTime = now;
                return cachedToken;
            } catch { 
                return null; 
            }
        }

        async function performQuery(accessToken, query, variables, operationName) {
            const response = await fetch(`https://${window.location.hostname}/_api/graphql`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'x-access-token': accessToken 
                },
                body: JSON.stringify({ query, variables, operationName })
            });
            return response.json();
        }

        async function fetchCurrencyRates() {
            if (currencyRates) return true;
            const accessToken = getAccessToken();
            if (!accessToken) return false;
            
            try {
                const ratesQuery = `query CurrencyConfiguration($isAcp: Boolean!) { currencyConfiguration(isAcp: $isAcp) { currencies { name rates { currency rate } } } }`;
                const ratesData = await performQuery(accessToken, ratesQuery, { isAcp: false }, 'CurrencyConfiguration');
                
                if (ratesData?.data?.currencyConfiguration?.currencies) {
                    // Performance: Use Map for O(1) lookups instead of object
                    currencyRates = new Map();
                    for (const crypto of ratesData.data.currencyConfiguration.currencies) {
                        const ratesMap = new Map();
                        for (const r of crypto.rates) {
                            ratesMap.set(r.currency.toLowerCase(), parseFloat(r.rate));
                        }
                        currencyRates.set(crypto.name.toLowerCase(), ratesMap);
                    }
                    return true;
                }
                return false;
            } catch { 
                return false; 
            }
        }

        async function showCryptoSelectPopup() {
            if (isProcessingClick) return;
            isProcessingClick = true;

            try {
                if (!await fetchCurrencyRates()) {
                    alert('[PNL Tracker] Could not fetch currency rates. Please refresh and try again.');
                    return;
                }

                const accessToken = getAccessToken();
                const balanceQuery = `query UserBalances { user { balances { available { amount currency } } } }`;
                const balanceData = await performQuery(accessToken, balanceQuery, {}, 'UserBalances');
                const balances = balanceData?.data?.user?.balances
                    ?.map(b => b.available)
                    .filter(b => b.amount > 0) || [];

                if (balances.length === 0) {
                    alert('No active balances found to track.');
                    return;
                }

                const lastFiat = await GM_getValue(CONFIG.STORAGE.DISPLAY_FIAT, 'eur');
                
                // Performance: Single pass sort with cached rate lookups
                balances.sort((a, b) => {
                    const ratesA = currencyRates.get(a.currency.toLowerCase());
                    const ratesB = currencyRates.get(b.currency.toLowerCase());
                    const fiatValueA = a.amount * (ratesA?.get(lastFiat) || 0);
                    const fiatValueB = b.amount * (ratesB?.get(lastFiat) || 0);
                    return fiatValueB - fiatValueA;
                });

                // Performance: Remove existing modal if present
                const existingModal = document.getElementById(CONFIG.IDS.cryptoSelectModal);
                if (existingModal) existingModal.remove();

                const modal = document.createElement('div');
                modal.id = CONFIG.IDS.cryptoSelectModal;

                // Function to update balance display
                function updateBalanceDisplay(selectedFiat) {
                    const items = modal.querySelectorAll('.pnl-cs-item');
                    items.forEach(item => {
                        const currency = item.querySelector('input[type="checkbox"]').dataset.currency;
                        const balance = balances.find(b => b.currency.toLowerCase() === currency);
                        if (balance) {
                            const rates = currencyRates.get(currency);
                            const fiatValue = balance.amount * (rates?.get(selectedFiat) || 0);
                            const fiatDisplay = item.querySelector('.pnl-cs-balance-fiat');
                            if (fiatDisplay) {
                                fiatDisplay.textContent = `${fiatValue.toFixed(2)} ${selectedFiat.toUpperCase()}`;
                            }
                        }
                    });
                }

                // Performance: Build HTML in array then join once
                const balanceItems = [];
                for (const balance of balances) {
                    const rates = currencyRates.get(balance.currency.toLowerCase());
                    const fiatValue = balance.amount * (rates?.get(lastFiat) || 0);
                    const isChecked = fiatValue > 0.1 ? 'checked' : '';
                    
                    balanceItems.push(`
                        <div class="pnl-cs-item" data-balance-currency="${balance.currency.toLowerCase()}">
                            <label>
                                <input type="checkbox" data-currency="${balance.currency.toLowerCase()}" data-amount="${balance.amount}" ${isChecked}>
                                <span class="pnl-cs-crypto-name">${balance.currency.toUpperCase()}</span>
                            </label>
                            <div class="pnl-cs-balance">
                                <div class="pnl-cs-balance-fiat">${fiatValue.toFixed(2)} ${lastFiat.toUpperCase()}</div>
                                <div class="pnl-cs-balance-crypto">${balance.amount.toFixed(6)}</div>
                            </div>
                        </div>`);
                }

                modal.innerHTML = `
                    <div class="pnl-cs-modal-content">
                        <div class="pnl-cs-modal-header">
                            <h2>Select Currencies to Track</h2>
                            <div class="pnl-cs-notification-settings">
                                <label>
                                    <input type="checkbox" id="pnl-enable-notifications" checked>
                                    Enable Big Win Notifications (100x+)
                                </label>
                                <button id="pnl-test-notification" style="margin-left: 10px; padding: 4px 10px; background: #00e701; color: #0f212e; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Test 🎉</button>
                            </div>
                        </div>
                        <div class="pnl-cs-modal-body">
                            <div id="${CONFIG.IDS.cryptoSelectList}">${balanceItems.join('')}</div>
                        </div>
                        <div class="pnl-cs-modal-footer">
                            <div class="pnl-cs-fiat-selector">
                                <label for="pnl-fiat-currency-select">Display Currency:</label>
                                <select id="pnl-fiat-currency-select">
                                    <option value="eur">EUR (€)</option>
                                    <option value="usd">USD ($)</option>
                                    <option value="cad">CAD (C$)</option>
                                    <option value="ars">ARS (AR$)</option>
                                    <option value="vnd">VND (₫)</option>
                                </select>
                            </div>
                            <div class="pnl-cs-modal-buttons">
                                <button id="${CONFIG.IDS.cancelSessionBtn}">Cancel</button>
                                <button id="${CONFIG.IDS.startSessionBtn}">Start Session</button>
                            </div>
                        </div>
                    </div>`;

                document.body.appendChild(modal);
                document.getElementById('pnl-fiat-currency-select').value = lastFiat;
                
                // Always enable notifications by default
                notificationManager.settings.enabled = true;
                document.getElementById('pnl-enable-notifications').checked = true;
                
                // Add test notification button
                document.getElementById('pnl-test-notification').addEventListener('click', () => {
                    // Initialize sound if not already done
                    if (!WIN_SOUND) {
                        WIN_SOUND = createWinSound();
                    }
                    
                    const testGames = ['Dice', 'Crash', 'Limbo', 'Plinko', 'Mines'];
                    const testGame = testGames[Math.floor(Math.random() * testGames.length)];
                    const testMultiplier = 100 + Math.random() * 900; // Random between 100x-1000x
                    const testPnl = Math.random() * 1000; // Random profit
                    const currentFiat = document.getElementById('pnl-fiat-currency-select').value;
                    notificationManager.showBigWin(testGame, testMultiplier, testPnl, currentFiat.toUpperCase());
                });
                
                // Add real-time currency conversion update
                document.getElementById('pnl-fiat-currency-select').addEventListener('change', (e) => {
                    const newFiat = e.target.value;
                    updateBalanceDisplay(newFiat);
                });
                
                // Performance: Use event delegation where possible
                document.getElementById(CONFIG.IDS.cancelSessionBtn).addEventListener('click', () => modal.remove());
                document.getElementById(CONFIG.IDS.startSessionBtn).addEventListener('click', () => {
                    const selectedCryptos = Array.from(
                        modal.querySelectorAll(`#${CONFIG.IDS.cryptoSelectList} input:checked`)
                    ).map(input => input.dataset.currency);
                    
                    const selectedFiat = document.getElementById('pnl-fiat-currency-select').value;
                    const notificationsEnabled = document.getElementById('pnl-enable-notifications').checked;
                    
                    notificationManager.settings.enabled = notificationsEnabled;
                    notificationManager.save();
                    
                    if (selectedCryptos.length > 0) {
                        startSession(selectedCryptos, balances, selectedFiat);
                        modal.remove();
                    } else {
                        alert('Please select at least one currency to track.');
                    }
                });
            } catch (error) {
                console.error('[PNL Tracker] Error:', error);
                alert('An unexpected error occurred. Check the console (F12).');
            } finally {
                isProcessingClick = false;
            }
        }

        async function startSession(selectedCryptos, allBalances, selectedFiat) {
            displayFiat = selectedFiat;
            await GM_setValue(CONFIG.STORAGE.DISPLAY_FIAT, displayFiat);

            let totalStartingFiat = 0;
            const trackedBalances = Object.create(null);
            
            // Performance: Single pass with Map lookups
            for (const currency of selectedCryptos) {
                const balance = allBalances.find(b => b.currency.toLowerCase() === currency);
                if (balance) {
                    const rates = currencyRates.get(currency);
                    const rate = rates?.get(displayFiat) || 0;
                    const fiatValue = balance.amount * rate;
                    trackedBalances[currency] = { 
                        amount: balance.amount, 
                        fiatValue 
                    };
                    totalStartingFiat += fiatValue;
                }
            }

            // Create new session in history
            const sessionId = sessionHistory.createSession(selectedCryptos, totalStartingFiat, displayFiat);

            sessionActive = true;
            
            // Performance: Reset state in one assignment
            sessionState = {
                pnlFiat: 0,
                pnlCrypto: Object.create(null),
                gameStats: Object.create(null),
                startingBalanceFiat: totalStartingFiat,
                trackedBalances,
                trackedCryptoCurrencies: selectedCryptos,
                trackedCurrenciesSet: new Set(selectedCryptos), // Performance: Add Set for O(1) lookups
                sessionId,
                totalBets: 0
            };

            // Performance: Batch all storage operations
            await Promise.all([
                GM_setValue(CONFIG.STORAGE.SESSION_ACTIVE, true),
                GM_setValue(CONFIG.STORAGE.STARTING_BALANCE_FIAT, totalStartingFiat),
                GM_setValue(CONFIG.STORAGE.TRACKED_BALANCES, trackedBalances),
                GM_setValue(CONFIG.STORAGE.TRACKED_CRYPTO_CURRENCIES, selectedCryptos),
                saveSessionState(),
                sessionHistory.save()
            ]);

            updatePnlDisplay();
            showStatsPopup();
            
            // Update session history if it's open
            const sessionModal = document.getElementById('pnl-session-history-modal');
            if (sessionModal) {
                window.dispatchEvent(new CustomEvent(CONFIG.EVENTS.STATS_UPDATED));
            }
        }

        async function stopSession() {
            // End session in history
            // Calculate best multiplier and game
            let bestMultiplier = 0;
            let bestGame = '';
            for (const game in sessionState.gameStats) {
                if (sessionState.gameStats[game].bestMultiplier > bestMultiplier) {
                    bestMultiplier = sessionState.gameStats[game].bestMultiplier;
                    bestGame = game;
                }
            }
            
            sessionHistory.endCurrentSession({
                pnlFiat: sessionState.pnlFiat,
                totalBets: sessionState.totalBets,
                bestMultiplier: bestMultiplier,
                bestGame: bestGame,
                gameStats: sessionState.gameStats
            });
            
            sessionActive = false;
            clearTimeout(saveTimeout);

            // Performance: Batch all storage operations
            await Promise.all([
                GM_setValue(CONFIG.STORAGE.SESSION_ACTIVE, false),
                GM_setValue(CONFIG.STORAGE.GAME_STATS, {}),
                GM_setValue('pnlSessionPnlCrypto_v5', {}),
                GM_setValue(CONFIG.STORAGE.SESSION_PNL_FIAT, 0),
                sessionHistory.save()
            ]);

            // Performance: Reset state in one assignment
            sessionState = {
                pnlFiat: 0,
                pnlCrypto: Object.create(null),
                gameStats: Object.create(null),
                startingBalanceFiat: 0,
                trackedBalances: Object.create(null),
                trackedCryptoCurrencies: [],
                trackedCurrenciesSet: null,
                sessionId: null,
                totalBets: 0
            };

            updatePnlDisplay();
            
            // Close stats popup if open
            const existingPopup = document.getElementById(CONFIG.IDS.statsPopup);
            if (existingPopup) {
                const listener = existingPopup.pnlStatsUpdateListener;
                if (listener) {
                    window.removeEventListener(CONFIG.EVENTS.STATS_UPDATED, listener);
                }
                existingPopup.remove();
            }
            
            // Update session history modal if open
            const sessionModal = document.getElementById('pnl-session-history-modal');
            if (sessionModal) {
                // Trigger update to show session as completed
                window.dispatchEvent(new CustomEvent(CONFIG.EVENTS.STATS_UPDATED));
            }
        }

        function updatePnlDisplay() {
            if (!pnlUI) return;
            
            const pnlText = pnlUI.querySelector('.pnl-text');
            
            if (!sessionActive) {
                pnlText.textContent = 'P/L Tracker';
                pnlText.className = 'pnl-text';
                pnlUI.setAttribute('title', 'Click to start P/L session');
                return;
            }

            const { pnlFiat, trackedCryptoCurrencies, startingBalanceFiat } = sessionState;
            const symbol = FIAT_SYMBOLS.get(displayFiat) || displayFiat.toUpperCase();

            pnlUI.setAttribute('title',
                `Starting balance: ${symbol}${startingBalanceFiat.toFixed(2)}\n` +
                `Tracking: ${trackedCryptoCurrencies.join(', ').toUpperCase()}\n` +
                `Total bets: ${sessionState.totalBets}\n` +
                `Click to stop session.`
            );
            
            const pnlDisplay = `${pnlFiat >= 0 ? '+' : ''}${symbol}${pnlFiat.toFixed(2)}`;
            pnlText.textContent = `P/L: ${pnlDisplay}`;
            
            // Performance: Avoid unnecessary class manipulations
            const newClass = `pnl-text${pnlFiat > 0.005 ? ' pnl-profit' : pnlFiat < -0.005 ? ' pnl-loss' : ''}`;
            if (pnlText.className !== newClass) {
                pnlText.className = newClass;
            }
        }

        function createPnlUI() {
            const pnlContainer = document.createElement('div');
            pnlContainer.className = 'pnl-tracker-container';
            pnlContainer.innerHTML = `<div class="pnl-text">P/L Tracker</div>`;
            pnlContainer.addEventListener('click', () => {
                sessionActive ? stopSession() : showCryptoSelectPopup();
            });

            const statsBtn = document.createElement('div');
            statsBtn.className = 'stats-button';
            statsBtn.innerHTML = '📊';
            statsBtn.title = 'Show P/L Stats';
            statsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!isProcessingClick) showStatsPopup();
            });

            const historyBtn = document.createElement('div');
            historyBtn.className = 'history-button';
            historyBtn.innerHTML = '📜';
            historyBtn.title = 'Session History';
            historyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!isProcessingClick) showSessionHistory();
            });

            // Performance: Inject all styles at once
            const styleSheet = document.createElement("style");
            styleSheet.id = CONFIG.IDS.pnlStyles;
            styleSheet.textContent = `
                .pnl-tracker-container, .stats-button, .history-button {
                    display: flex; align-items: center; justify-content: center; cursor: pointer; 
                    padding: 0 12px; border-left: 1px solid #2f4553; background-color: #0f212e; color: #9eafc1; 
                }
                .pnl-tracker-container:hover, .stats-button:hover, .history-button:hover {
                    background-color: #213743; 
                }
                .stats-button, .history-button { font-size: 18px; }
                .pnl-text { font-weight: 700; }
                .pnl-profit { color: #00e701 !important; }
                .pnl-loss { color: #ff4444 !important; }
                
                /* Win Notification Styles */
                .pnl-win-notification {
                    position: fixed;
                    top: 20px;
                    right: -400px;
                    width: 350px;
                    background: linear-gradient(135deg, rgba(0, 231, 1, 0.2), rgba(0, 231, 1, 0.1));
                    border: 2px solid #00e701;
                    border-radius: 12px;
                    padding: 20px;
                    z-index: 100000;
                    transition: right 0.5s ease;
                    box-shadow: 0 10px 30px rgba(0, 231, 1, 0.3);
                }
                .pnl-win-notification.show { right: 20px; }
                .pnl-win-content { text-align: center; color: #fff; }
                .pnl-win-header { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
                .pnl-win-multiplier { font-size: 36px; font-weight: bold; color: #00e701; margin: 10px 0; }
                .pnl-win-game { font-size: 18px; margin: 5px 0; }
                .pnl-win-profit { font-size: 20px; color: #00e701; font-weight: bold; }
                
                /* Session History Modal */
                .pnl-session-history-modal {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 894px;
                    height: 555px;
                    min-width: 400px;
                    min-height: 300px;
                    max-width: 90vw;
                    max-height: 90vh;
                    background: #1a2c38;
                    border-radius: 10px;
                    border: 1px solid #2f4553;
                    z-index: 10000;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 8px 25px rgba(0,0,0,0.5);
                    resize: both;
                }
                .pnl-session-history-header {
                    height: 61px;
                    min-height: 61px;
                    padding: 0 20px;
                    background: #0f212e;
                    border-bottom: 1px solid #2f4553;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: move;
                    flex-shrink: 0;
                }
                .pnl-session-history-header h2 {
                    font-size: 18px;
                    margin: 0;
                    color: #fff;
                }
                .pnl-session-history-body {
                    flex: 1;
                    height: 494px;
                    overflow-y: auto;
                    padding: 15px;
                }
                .pnl-session-card {
                    background: rgba(0,0,0,0.2);
                    border-radius: 6px;
                    padding: 10px;
                    margin-bottom: 10px;
                    cursor: pointer;
                    transition: background 0.2s;
                    font-size: 13px;
                }
                .pnl-session-card:hover { background: rgba(0,0,0,0.4); }
                .pnl-session-card.active { border: 2px solid #00e701; }
                .pnl-session-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }
                .pnl-session-header-left {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .pnl-session-delete {
                    background: #c23b3b;
                    color: #fff;
                    border: none;
                    padding: 2px 6px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 10px;
                    transition: background 0.2s;
                }
                .pnl-session-delete:hover { background: #ff4444; }
                .pnl-session-time { color: #9eafc1; font-size: 12px; }
                .pnl-session-status { 
                    padding: 2px 6px; 
                    border-radius: 4px; 
                    font-size: 11px; 
                    font-weight: bold;
                }
                .pnl-session-status.active { background: #00e701; color: #0f212e; }
                .pnl-session-status.completed { background: #4a6a82; color: #fff; }
                .pnl-session-stats {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 4px;
                }
                .pnl-session-stat {
                    display: flex;
                    flex-direction: column;
                }
                .pnl-session-stat-label {
                    font-size: 11px;
                    color: #9eafc1;
                    text-transform: uppercase;
                }
                .pnl-session-stat-value {
                    font-size: 14px;
                    font-weight: bold;
                    color: #fff;
                }
                
                /* Time-based Stats */
                .pnl-time-stats {
                    margin-top: 15px;
                    padding: 8px;
                    background: rgba(0,0,0,0.2);
                    border-radius: 6px;
                }
                .pnl-time-stats-collapsed {
                    cursor: pointer;
                    padding: 8px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 12px;
                }
                .pnl-time-stats-collapsed:hover { background: rgba(0,0,0,0.3); }
                .pnl-time-stats-header {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 8px;
                }
                .pnl-time-stats-content.collapsed { display: none; }
                .pnl-time-stats-btn {
                    padding: 4px 10px;
                    background: #2f4553;
                    border: none;
                    border-radius: 4px;
                    color: #fff;
                    cursor: pointer;
                    font-size: 11px;
                }
                .pnl-time-stats-btn.active { background: #00e701; color: #0f212e; }
                .pnl-time-stats-data {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
                    gap: 6px;
                    max-height: 100px;
                    overflow-y: auto;
                    font-size: 11px;
                }
                .pnl-time-stat {
                    background: rgba(0,0,0,0.3);
                    padding: 6px;
                    border-radius: 5px;
                    text-align: center;
                }
                
                #${CONFIG.IDS.cryptoSelectModal} { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; align-items: center; justify-content: center; }
                .pnl-cs-modal-content { background: #1a2c38; width: 90vw; max-width: 400px; border-radius: 8px; border: 1px solid #2f4553; }
                .pnl-cs-modal-header { padding: 15px 20px; border-bottom: 1px solid #2f4553; } 
                .pnl-cs-modal-header h2 { margin: 0 0 10px 0; font-size: 16px; color: #fff; }
                .pnl-cs-notification-settings { margin-top: 10px; }
                .pnl-cs-notification-settings label { display: flex; align-items: center; gap: 8px; color: #9eafc1; font-size: 13px; cursor: pointer; }
                .pnl-cs-modal-body { padding: 20px; max-height: 50vh; overflow-y: auto; } 
                #${CONFIG.IDS.cryptoSelectList} { display: flex; flex-direction: column; gap: 15px; }
                .pnl-cs-item { display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px; }
                .pnl-cs-item label { display: flex; align-items: center; gap: 12px; cursor: pointer; flex-grow: 1; color: #fff;}
                .pnl-cs-item input[type='checkbox'] { -webkit-appearance: checkbox !important; appearance: checkbox !important; display: inline-block !important; visibility: visible !important; opacity: 1 !important; width: 18px !important; height: 18px !important; cursor: pointer !important; }
                .pnl-cs-balance { text-align: right; } 
                .pnl-cs-balance-fiat { font-size: 13px; color: #fff; } 
                .pnl-cs-balance-crypto { font-size: 11px; color: #818b99; }
                .pnl-cs-modal-footer { padding: 15px 20px; border-top: 1px solid #2f4553; } 
                .pnl-cs-fiat-selector { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #9eafc1; }
                .pnl-cs-fiat-selector select { background: #0f212e; color: #fff; border: 1px solid #2f4553; border-radius: 6px; padding: 5px 8px; }
                .pnl-cs-modal-buttons { display: flex; justify-content: flex-end; gap: 10px; margin-top: 15px; }
                .pnl-cs-modal-buttons button { padding: 8px 20px; border-radius: 5px; border: none; cursor: pointer; font-weight: 600; }
                #${CONFIG.IDS.startSessionBtn} { background: #00e701; color: #0f212e; } 
                #${CONFIG.IDS.cancelSessionBtn} { background: #2f4553; color: #fff; }
            `;
            document.head.appendChild(styleSheet);
            
            return { pnlContainer, statsBtn, historyBtn };
        }

        async function showSessionHistory() {
            // Check if modal already exists and toggle it
            const existingModal = document.getElementById('pnl-session-history-modal');
            if (existingModal) {
                // Save position and size before closing
                await GM_setValue(CONFIG.STORAGE.SESSION_HISTORY_POS, {
                    top: existingModal.style.top,
                    left: existingModal.style.left
                });
                await GM_setValue(CONFIG.STORAGE.SESSION_HISTORY_SIZE, {
                    width: existingModal.style.width,
                    height: existingModal.style.height
                });
                
                // Clean up event listener before removing
                const listener = existingModal.sessionHistoryUpdateListener;
                if (listener) {
                    window.removeEventListener(CONFIG.EVENTS.STATS_UPDATED, listener);
                }
                existingModal.remove();
                return; // Exit early - this toggles off the modal
            }
            
            // Create new modal if it doesn't exist
            const modal = document.createElement('div');
            modal.className = 'pnl-session-history-modal';
            modal.id = 'pnl-session-history-modal';
            modal.style.resize = 'both';
            modal.style.overflow = 'auto';
            
            // Restore saved position and size
            const savedPos = await GM_getValue(CONFIG.STORAGE.SESSION_HISTORY_POS, null);
            const savedSize = await GM_getValue(CONFIG.STORAGE.SESSION_HISTORY_SIZE, null);
            
            if (savedPos) {
                modal.style.top = savedPos.top;
                modal.style.left = savedPos.left;
                modal.style.transform = ''; // Remove centering transform when using saved position
            }
            
            if (savedSize) {
                modal.style.width = savedSize.width;
                modal.style.height = savedSize.height;
            } else {
                // Set default size if no saved size
                modal.style.width = '894px';
                modal.style.height = '555px';
            }
            
            function renderSessionHistory() {
                const sessions = sessionHistory.sessions.slice(0, 20); // Show last 20 sessions
                const sessionCards = sessions.map(session => {
                const isActive = session.status === 'active';
                const duration = session.endTime ? 
                    new Date(session.endTime) - new Date(session.startTime) : 
                    Date.now() - new Date(session.startTime);
                const hours = Math.floor(duration / 3600000);
                const minutes = Math.floor((duration % 3600000) / 60000);
                
                    return `
                        <div class="pnl-session-card ${isActive ? 'active' : ''}" data-session-id="${session.id}">
                            <div class="pnl-session-card-header">
                                <div class="pnl-session-header-left">
                                    <div class="pnl-session-time">${new Date(session.startTime).toLocaleString()}</div>
                                    ${!isActive ? `<button class="pnl-session-delete" data-session-id="${session.id}">Delete</button>` : ''}
                                </div>
                                <div class="pnl-session-status ${session.status}">${session.status.toUpperCase()}</div>
                            </div>
                        <div class="pnl-session-stats">
                            <div class="pnl-session-stat">
                                <span class="pnl-session-stat-label">P/L</span>
                                <span class="pnl-session-stat-value ${session.finalPnl >= 0 ? 'pnl-profit' : 'pnl-loss'}">
                                    ${session.finalPnl >= 0 ? '+' : ''}${session.finalPnl.toFixed(2)} ${session.displayFiat.toUpperCase()}
                                </span>
                            </div>
                            <div class="pnl-session-stat">
                                <span class="pnl-session-stat-label">Bets</span>
                                <span class="pnl-session-stat-value">${session.totalBets || 0}</span>
                            </div>
                            <div class="pnl-session-stat">
                                <span class="pnl-session-stat-label">Duration</span>
                                <span class="pnl-session-stat-value">${hours}h ${minutes}m</span>
                            </div>
                            <div class="pnl-session-stat">
                                <span class="pnl-session-stat-label">Best Win</span>
                                <span class="pnl-session-stat-value" style="color: #fbbf24;">
                                    ${session.bestMultiplier ?
                                        `${session.bestMultiplier.toFixed(1)}x${session.bestGame ? ' (' + session.bestGame.substring(0, 8) + ')' : ''}`
                                        : 'N/A'}
                                </span>
                            </div>
                        </div>
                    </div>
                    `;
                }).join('');
                
                // Get time-based stats
                const recentDaily = timeStats.getRecentStats('daily', 7);
                const dailyStatsHtml = recentDaily.map(stat => `
                <div class="pnl-time-stat">
                    <div class="pnl-session-stat-label">${stat.key}</div>
                    <div class="pnl-session-stat-value ${stat.pnl >= 0 ? 'pnl-profit' : 'pnl-loss'}">
                        ${stat.pnl >= 0 ? '+' : ''}${stat.pnl.toFixed(2)}
                    </div>
                    <div style="font-size: 10px; color: #818b99;">${stat.bets} bets</div>
                </div>
                `).join('');
                
                return `
                <div class="pnl-session-history-header">
                    <h2>Session History</h2>
                    <button class="pnl-close-btn" style="background: none; border: none; color: #fff; font-size: 24px; cursor: pointer;">&times;</button>
                </div>
                <div class="pnl-session-history-body">
                    ${sessions.length > 0 ? sessionCards : '<p style="text-align: center; color: #9eafc1;">No sessions recorded yet.</p>'}
                    
                    <div class="pnl-time-stats" id="pnl-time-stats-container">
                        <div class="pnl-time-stats-collapsed" id="pnl-time-stats-toggle">
                            <span style="color: #fff; font-weight: 600;">Performance Overview</span>
                            <span id="pnl-time-stats-arrow" style="color: #9eafc1;">▼</span>
                        </div>
                        <div class="pnl-time-stats-content collapsed" id="pnl-time-stats-content">
                            <div class="pnl-time-stats-header">
                                <button class="pnl-time-stats-btn active" data-view="daily">Daily</button>
                                <button class="pnl-time-stats-btn" data-view="hourly">Hourly</button>
                                <button class="pnl-time-stats-btn" data-view="weekly">Weekly</button>
                            </div>
                            <div class="pnl-time-stats-data">
                                ${dailyStatsHtml || '<p style="color: #9eafc1; margin: 5px 0;">No data available</p>'}
                            </div>
                        </div>
                    </div>
                </div>
                `;
            }
            
            modal.innerHTML = renderSessionHistory();
            document.body.appendChild(modal);
            
            // Set up real-time updates for session history
            const sessionHistoryUpdateListener = () => {
                const existingModal = document.getElementById('pnl-session-history-modal');
                if (existingModal) {
                    const scrollPos = existingModal.querySelector('.pnl-session-history-body').scrollTop;
                    existingModal.innerHTML = renderSessionHistory();
                    existingModal.querySelector('.pnl-session-history-body').scrollTop = scrollPos;
                    
                    // Re-attach event listeners after re-render
                    setupModalEventListeners();
                }
            };
            
            // Store the listener on the modal for cleanup
            modal.sessionHistoryUpdateListener = sessionHistoryUpdateListener;
            window.addEventListener(CONFIG.EVENTS.STATS_UPDATED, sessionHistoryUpdateListener);
            
            function setupModalEventListeners() {
                // Make the session history modal draggable
                const header = modal.querySelector('.pnl-session-history-header');
                makeDraggable(modal, header, false);
                
                // Prevent resize handle from interfering with dragging
                modal.addEventListener('mousedown', (e) => {
                    // Check if clicking on resize handle (bottom-right corner)
                    const rect = modal.getBoundingClientRect();
                    const isResizeHandle = (e.clientX > rect.right - 20) && (e.clientY > rect.bottom - 20);
                    if (isResizeHandle) {
                        e.stopPropagation();
                    }
                });
                
                // Save size when resizing
                const resizeObserver = new ResizeObserver(() => {
                    GM_setValue(CONFIG.STORAGE.SESSION_HISTORY_SIZE, {
                        width: modal.style.width || '700px',
                        height: modal.style.height || '500px'
                    });
                });
                resizeObserver.observe(modal);
                
                // Add event listeners
                modal.querySelector('.pnl-close-btn').addEventListener('click', async () => {
                    // Save position and size before closing
                    await GM_setValue(CONFIG.STORAGE.SESSION_HISTORY_POS, {
                        top: modal.style.top,
                        left: modal.style.left
                    });
                    await GM_setValue(CONFIG.STORAGE.SESSION_HISTORY_SIZE, {
                        width: modal.style.width,
                        height: modal.style.height
                    });
                    
                    const listener = modal.sessionHistoryUpdateListener;
                    if (listener) {
                        window.removeEventListener(CONFIG.EVENTS.STATS_UPDATED, listener);
                    }
                    resizeObserver.disconnect();
                    modal.remove();
                });
                
                // Delete session buttons
                modal.querySelectorAll('.pnl-session-delete').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const sessionId = btn.dataset.sessionId;
                        if (confirm('Are you sure you want to delete this session?')) {
                            await sessionHistory.deleteSession(sessionId);
                            // Re-render the modal
                            const scrollPos = modal.querySelector('.pnl-session-history-body').scrollTop;
                            modal.innerHTML = renderSessionHistory();
                            modal.querySelector('.pnl-session-history-body').scrollTop = scrollPos;
                            setupModalEventListeners();
                        }
                    });
                });
                
                // Performance overview toggle
                const toggleBtn = document.getElementById('pnl-time-stats-toggle');
                const content = document.getElementById('pnl-time-stats-content');
                const arrow = document.getElementById('pnl-time-stats-arrow');
                
                if (toggleBtn) {
                    toggleBtn.addEventListener('click', () => {
                        content.classList.toggle('collapsed');
                        arrow.textContent = content.classList.contains('collapsed') ? '▼' : '▲';
                    });
                }
                
                // Time stats view switcher
                modal.querySelectorAll('.pnl-time-stats-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    modal.querySelectorAll('.pnl-time-stats-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                        const view = btn.dataset.view;
                        const stats = timeStats.getRecentStats(view, view === 'hourly' ? 24 : 7);
                        const dataContainer = modal.querySelector('.pnl-time-stats-data');
                        
                        if (stats.length > 0) {
                            dataContainer.innerHTML = stats.map(stat => `
                            <div class="pnl-time-stat">
                                <div class="pnl-session-stat-label">${stat.key}</div>
                                <div class="pnl-session-stat-value ${stat.pnl >= 0 ? 'pnl-profit' : 'pnl-loss'}">
                                    ${stat.pnl >= 0 ? '+' : ''}${stat.pnl.toFixed(2)}
                                </div>
                                <div style="font-size: 10px; color: #818b99;">${stat.bets} bets</div>
                            </div>
                            `).join('');
                        } else {
                            dataContainer.innerHTML = '<p style="color: #9eafc1; margin: 5px 0;">No data available</p>';
                        }
                    });
                });
                
                // Click outside to close
                modal.addEventListener('click', async (e) => {
                    if (e.target === modal) {
                        // Save position and size before closing
                        await GM_setValue(CONFIG.STORAGE.SESSION_HISTORY_POS, {
                            top: modal.style.top,
                            left: modal.style.left
                        });
                        await GM_setValue(CONFIG.STORAGE.SESSION_HISTORY_SIZE, {
                            width: modal.style.width,
                            height: modal.style.height
                        });
                        
                        const listener = modal.sessionHistoryUpdateListener;
                        if (listener) {
                            window.removeEventListener(CONFIG.EVENTS.STATS_UPDATED, listener);
                        }
                        resizeObserver.disconnect();
                        modal.remove();
                    }
                });
            }
            
            setupModalEventListeners();
        }

        // Performance: Optimized bet processing with fewer operations
        window.addEventListener(CONFIG.EVENTS.BET_PROCESSED, async (event) => {
            if (!sessionActive || !event.detail.houseBets) return;
            
            if (!currencyRates) {
                await fetchCurrencyRates();
                if (!currencyRates) return;
            }

            let { houseBets } = event.detail;
            if (!Array.isArray(houseBets)) {
                houseBets = [houseBets];
            }
            if (houseBets.length === 0) return;

            const { gameStats, pnlCrypto, trackedCurrenciesSet } = sessionState;
            let currentPnl = sessionState.pnlFiat;
            let statsChanged = false;
            const currentDisplayFiat = displayFiat;
            const fiatSymbol = FIAT_SYMBOLS.get(currentDisplayFiat) || currentDisplayFiat.toUpperCase();

            // Performance: Process all bets in single pass
            for (const houseBet of houseBets) {
                const { bet, game } = houseBet;
                if (!bet || !game) continue;

                const betCurrency = bet.currency.toLowerCase();
                // Performance: O(1) Set lookup instead of array.includes
                if (!trackedCurrenciesSet.has(betCurrency)) continue;

                const { name: gameName, slug: gameSlug } = game;
                const { amount, payout, updatedAt, iid } = bet;

                const betAmountCrypto = +amount || 0;
                const payoutCrypto = +payout || 0;
                const multiplier = betAmountCrypto > 0 ? (payoutCrypto / betAmountCrypto) : 0;

                const rates = currencyRates.get(betCurrency);
                const rate = rates?.get(currentDisplayFiat);
                if (!rate) continue;

                statsChanged = true;
                const betAmountFiat = betAmountCrypto * rate;
                const pnlFiat = (payoutCrypto * rate) - betAmountFiat;
                const pnlCryptoDiff = payoutCrypto - betAmountCrypto;

                currentPnl += pnlFiat;
                pnlCrypto[betCurrency] = (pnlCrypto[betCurrency] || 0) + pnlCryptoDiff;
                sessionState.totalBets++;

                // Record time-based stats
                timeStats.recordBet(pnlFiat, betAmountFiat);

                // Check for big win notification
                if (multiplier >= notificationManager.settings.minMultiplier) {
                    notificationManager.showBigWin(gameName, multiplier, pnlFiat, fiatSymbol);
                }

                // Performance: Reuse existing gameStats object structure
                let stats = gameStats[gameName];
                if (!stats) {
                    stats = gameStats[gameName] = {
                        totalBets: 0,
                        totalBetAmount: 0,
                        pnl: 0,
                        wins: 0,
                        totalMultiplier: 0,
                        bestMultiplier: 0,
                        bestMultiplierBet: null,
                        biggestWinBet: null,
                        allBets: []
                    };
                }

                const newBet = {
                    pnl: pnlFiat,
                    multiplier,
                    timestamp: updatedAt || new Date().toISOString(),
                    iid,
                    slug: gameSlug
                };

                stats.totalBets++;
                stats.totalBetAmount += betAmountFiat;
                stats.pnl += pnlFiat;
                stats.totalMultiplier += multiplier;
                
                if (multiplier > 1) stats.wins++;
                if (multiplier > stats.bestMultiplier) {
                    stats.bestMultiplier = multiplier;
                    stats.bestMultiplierBet = newBet;
                }
                if (!stats.biggestWinBet || newBet.pnl > stats.biggestWinBet.pnl) {
                    stats.biggestWinBet = newBet;
                }
                
                stats.allBets.push(newBet);
            }

            if (statsChanged) {
                sessionState.pnlFiat = currentPnl;
                scheduleSave();
                updatePnlDisplay();
                window.dispatchEvent(new CustomEvent(CONFIG.EVENTS.STATS_UPDATED));
            }
        });

        // Performance: Optimized dragging with RAF and cached values
        function makeDraggable(popup, header, savePosition = true) {
            let isRequestingFrame = false;
            let startX, startY, startLeft, startTop;
            let lastClientX, lastClientY;

            header.onmousedown = dragMouseDown;

            function dragMouseDown(e) {
                // Don't start drag if clicking on buttons
                if (e.target.tagName === 'BUTTON' || e.target.id === 'pnl-toggle-compact') {
                    return;
                }
                
                e.preventDefault();
                startX = lastClientX = e.clientX;
                startY = lastClientY = e.clientY;
                startLeft = popup.offsetLeft;
                startTop = popup.offsetTop;
                
                // Clear any transform that might interfere
                popup.style.transform = '';

                document.onmouseup = closeDragElement;
                document.onmousemove = elementDrag;
            }

            function elementDrag(e) {
                e.preventDefault();
                lastClientX = e.clientX;
                lastClientY = e.clientY;

                if (!isRequestingFrame) {
                    isRequestingFrame = true;
                    requestAnimationFrame(updatePosition);
                }
            }

            function updatePosition() {
                isRequestingFrame = false;
                const newTop = startTop + lastClientY - startY;
                const newLeft = startLeft + lastClientX - startX;
                popup.style.top = `${newTop}px`;
                popup.style.left = `${newLeft}px`;
            }

            function closeDragElement() {
                document.onmouseup = null;
                document.onmousemove = null;
                updatePosition();
                
                if (savePosition) {
                    GM_setValue(CONFIG.STORAGE.POPUP_POS, {
                        top: popup.style.top,
                        left: popup.style.left
                    });
                } else {
                    // Save session history position
                    if (popup.id === 'pnl-session-history-modal') {
                        GM_setValue(CONFIG.STORAGE.SESSION_HISTORY_POS, {
                            top: popup.style.top,
                            left: popup.style.left
                        });
                    }
                }
            }
        }

        // Performance: Cache HTML escaping
        const escapeCache = new Map();
        function escapeHtml(text) {
            if (!text) return '';
            if (escapeCache.has(text)) return escapeCache.get(text);
            
            const div = document.createElement('div');
            div.textContent = text;
            const escaped = div.innerHTML;
            
            // Limit cache size to prevent memory issues
            if (escapeCache.size > 1000) {
                escapeCache.clear();
            }
            escapeCache.set(text, escaped);
            return escaped;
        }

        async function showStatsPopup() {
            const existingPopup = document.getElementById(CONFIG.IDS.statsPopup);
            if (existingPopup) {
                const listener = existingPopup.pnlStatsUpdateListener;
                if (listener) {
                    window.removeEventListener(CONFIG.EVENTS.STATS_UPDATED, listener);
                }
                existingPopup.remove();
                return;
            }

            const popup = document.createElement('div');
            popup.id = CONFIG.IDS.statsPopup;

            const lastPos = await GM_getValue(CONFIG.STORAGE.POPUP_POS, { top: '50%', left: '50%' });
            const transform = (lastPos.top === '50%') ? 'translate(-50%, -50%)' : '';
            Object.assign(popup.style, {
                top: lastPos.top,
                left: lastPos.left,
                transform
            });

            popup.innerHTML = `
                <div class="popup-header">
                    <div class="header-title-section">
                        <h2>P/L Statistics per Game</h2>
                        <div class="header-stats-placeholder"></div>
                    </div>
                    <div class="popup-header-controls">
                        <button id="pnl-toggle-compact" title="Toggle Compact View">⬇</button>
                        <button id="${CONFIG.IDS.popupClose}">&times;</button>
                    </div>
                </div>
                <div class="popup-body">
                    <div id="${CONFIG.IDS.statsTableContainer}"></div>
                </div>
                <div class="popup-footer">
                    <button id="${CONFIG.IDS.exportCsv}">Export as CSV</button>
                    <button id="${CONFIG.IDS.saveImage}">Save as Image</button>
                    <button id="${CONFIG.IDS.resetStats}">Reset All Stats</button>
                </div>
            `;
            document.body.appendChild(popup);

            // Performance: Inject styles once
            const styleSheet = document.createElement("style");
            styleSheet.id = 'pnl-stats-styles';
            styleSheet.textContent = `
                #${CONFIG.IDS.statsPopup} { position: fixed; width: 80vw; max-width: 800px; background: #1a2c38; border-radius: 12px; border: 1px solid #2f4553; z-index: 9999; box-shadow: 0 10px 30px rgba(0,0,0,0.5); color: #fff; display: flex; flex-direction: column; transition: width 0.3s ease, max-width 0.3s ease; }
                #${CONFIG.IDS.statsPopup}.compact-mode { width: 400px; max-width: 400px; }
                #${CONFIG.IDS.statsPopup}.compact-mode .popup-body { max-height: 60vh; }
                #${CONFIG.IDS.statsPopup}.compact-mode .header-stats-placeholder { flex-direction: column; gap: 10px; }
                #${CONFIG.IDS.statsPopup}.compact-mode .pnl-balance-separator { display: none; }
                #${CONFIG.IDS.statsPopup}.compact-mode .pnl-balance-item { width: 100%; justify-content: space-between; flex-direction: row; padding: 8px 12px; }
                #${CONFIG.IDS.statsPopup}.compact-mode .pnl-balance-label { margin-bottom: 0; margin-right: 10px; }
                #${CONFIG.IDS.statsPopup}.compact-mode table { font-size: 12px; }
                #${CONFIG.IDS.statsPopup}.compact-mode th, #${CONFIG.IDS.statsPopup}.compact-mode td { padding: 8px 10px; }
                .popup-header { padding: 15px 20px; background: #0f212e; border-bottom: 1px solid #2f4553; cursor: move; display: flex; justify-content: space-between; align-items: center; }
                .popup-header-controls { display: flex; gap: 10px; align-items: center; }
                #pnl-toggle-compact { background: #2f4553; border: none; color: #fff; font-size: 18px; cursor: pointer; padding: 5px 10px; border-radius: 5px; transition: background 0.2s; }
                #pnl-toggle-compact:hover { background: #3a5568; }
                .header-title-section { display: flex; flex-direction: column; gap: 12px; flex-grow: 1; align-items: center; }
                .header-stats-placeholder { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 15px; font-size: 12px; }
                .pnl-balance-item { display: flex; flex-direction: column; align-items: center; background: rgba(0,0,0,0.2); padding: 5px 10px; border-radius: 6px;}
                .pnl-balance-values { display: flex; flex-direction: column; align-items: center; }
                .pnl-balance-label { font-size: 10px; color: #9eafc1; text-transform: uppercase; margin-bottom: 4px; }
                .pnl-balance-crypto { font-size: 13px; color: #fff; font-weight: 600; }
                .pnl-balance-fiat { font-size: 11px; color: #818b99; }
                .pnl-balance-separator { font-size: 20px; color: #4a6a82; line-height: 1; }
                .popup-header h2 { font-size: 18px; margin: 0; }
                #${CONFIG.IDS.popupClose} { background: none; border: none; color: #fff; font-size: 24px; cursor: pointer; line-height: 1; }
                .popup-body { max-height: 70vh; overflow-y: auto; padding: 0; }
                .popup-body table { width: 100%; border-collapse: collapse; }
                .popup-body th, .popup-body td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #2f4553; }
                .popup-body tr.game-row { cursor: pointer; transition: background-color 0.2s; }
                .popup-body tr.game-row:hover { background-color: #213743; }
                .popup-body tr.details-row td { padding: 0; background-color: #152632;}
                .pnl-details-container { padding: 15px 20px; }
                .pnl-details-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 15px; margin-bottom: 15px; text-align: center; }
                .pnl-details-grid-item { background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px; }
                .pnl-details-grid-item h5 { margin: 0 0 5px; font-size: 11px; color: #9eafc1; text-transform: uppercase; font-weight: 600; }
                .pnl-details-grid-item p { margin: 0; font-size: 16px; font-weight: 700; }
                .best-bet-card { background: linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(251, 191, 36, 0.05)); border: 1px solid #fbbf24; border-radius: 8px; padding: 15px; text-align: center; margin-bottom: 15px; }
                .best-bet-title { font-weight: 600; color: #fbbf24; font-size: 14px; margin-bottom: 5px; }
                .best-bet-multi { font-size: 24px; font-weight: 700; color: #fff; }
                .best-bet-pnl { font-size: 14px; margin-top: 5px; }
                .best-bet-time { font-size: 11px; color: #818b99; margin-top: 8px; }
                .bet-link { color: #fbbf24; text-decoration: none; font-weight: 600; }
                .bet-link:hover { text-decoration: underline; }
                .recent-bets-section h4 { margin: 15px 0 10px; font-size: 14px; color: #fff; }
                .pnl-details-list { list-style: none; padding: 0; margin: 0; }
                .pnl-details-list li { display: flex; justify-content: space-between; padding: 8px 5px; font-size: 13px; border-bottom: 1px solid #213743; }
                .pnl-details-list li:last-child { border-bottom: none; }
                .pnl-details-list .bet-time { color: #818b99; }
                .popup-body tr:not(.details-row):last-child td { border-bottom: none; }
                .popup-body th { font-weight: bold; color: #9eafc1; cursor: pointer; user-select: none; position: relative; }
                .popup-body th:hover { color: #fff; }
                .popup-body th .sort-arrow { position: absolute; right: 5px; top: 50%; transform: translateY(-50%); }
                .popup-body td.pnl-profit { color: #00e701; }
                .popup-body td.pnl-loss { color: #ff4444; }
                .popup-body td { color: #c1cce0; }
                .popup-footer { padding: 15px 20px; display: flex; justify-content: flex-end; gap: 10px; text-align: right; border-top: 1px solid #2f4553; background: #0f212e; }
                #${CONFIG.IDS.resetStats} { background: #c23b3b; color: #fff; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; transition: background-color 0.2s; }
                #${CONFIG.IDS.resetStats}:hover { background: #ff4444; }
                #${CONFIG.IDS.saveImage} { background: #4f6579; color: #fff; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; transition: background-color 0.2s; }
                #${CONFIG.IDS.saveImage}:hover { background: #5a788f; }
                #${CONFIG.IDS.exportCsv} { background: #3a86c2; color: #fff; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; transition: background-color 0.2s; margin-right: auto; }
                #${CONFIG.IDS.exportCsv}:hover { background: #4a9fdc; }
                #${CONFIG.IDS.confirmModal} { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; align-items: center; justify-content: center; }
                .pnl-modal-content { background: #1a2c38; padding: 25px; border-radius: 8px; text-align: center; border: 1px solid #2f4553; }
                .pnl-modal-content p { margin: 0 0 20px; }
                .pnl-modal-buttons button { margin: 0 10px; padding: 8px 20px; border-radius: 5px; border: none; cursor: pointer; }
                #${CONFIG.IDS.confirmReset} { background: #c23b3b; color: #fff; }
                #${CONFIG.IDS.cancelReset} { background: #2f4553; color: #fff; }
                .pnl-image-card { display: none; position: absolute; top: -9999px; left: -9999px; width: 600px; background: #0f212e; border: 1px solid #2f4553; border-radius: 12px; padding: 25px; font-family: "proxima-nova", "SF Mono", Monaco, Consolas, "Courier New", monospace; color: #fff; }
                .img-header { text-align: center; border-bottom: 1px solid #2f4553; padding-bottom: 15px; margin-bottom: 20px; }
                .img-header h2 { font-size: 24px; margin: 0 0 5px 0; color: #fff; }
                .img-header p { font-size: 14px; margin: 0; color: #9eafc1; }
                .img-main-stats { display: flex; justify-content: space-around; text-align: center; margin-bottom: 25px; }
                .img-stat-item h3 { font-size: 14px; color: #9eafc1; margin: 0 0 8px 0; font-weight: 600; text-transform: uppercase; }
                .img-stat-item p { font-size: 22px; margin: 0; font-weight: 700; }
                .img-stat-item .pnl-profit { color: #00e701; }
                .img-stat-item .pnl-loss { color: #ff4444; }
                .img-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                .img-grid-item { background: #1a2c38; padding: 15px; border-radius: 8px; }
                .img-grid-item h4 { font-size: 14px; margin: 0 0 5px 0; color: #9eafc1; text-transform: uppercase; border-bottom: 1px solid #2f4553; padding-bottom: 8px; }
                .img-grid-item p { margin: 0; font-size: 16px; font-weight: 600; line-height: 1.3; }
                .img-grid-item .game-name { font-size: 14px; color: #fff; line-height: 1.3; word-wrap: break-word; }
                .img-grid-item .multiplier { color: #fbbf24; }
            `;
            popup.appendChild(styleSheet);

            let currentSort = { key: 'pnl', order: 'desc' };
            let stats = {};
            const fiatSymbol = FIAT_SYMBOLS.get(displayFiat) || displayFiat.toUpperCase();
            const domain = window.location.hostname;

            function renderTable() {
                const tableContainer = document.getElementById(CONFIG.IDS.statsTableContainer);
                if (!tableContainer) return;

                const statsArray = Object.entries(stats);
                if (statsArray.length === 0) {
                    tableContainer.innerHTML = '<p style="text-align:center; padding: 20px;">No bets recorded yet.</p>';
                    return;
                }

                // Performance: Optimized sort
                statsArray.sort((a, b) => {
                    const valA = currentSort.key === 'game' ? a[0] : a[1][currentSort.key];
                    const valB = currentSort.key === 'game' ? b[0] : b[1][currentSort.key];
                    
                    if (typeof valA === 'string') {
                        return currentSort.order === 'asc' 
                            ? valA.localeCompare(valB) 
                            : valB.localeCompare(valA);
                    }
                    return currentSort.order === 'asc' ? valA - valB : valB - valA;
                });

                // Performance: Build HTML in array then join
                const rows = [];
                for (const [game, data] of statsArray) {
                    rows.push(`
                        <tr class="game-row" data-game="${escapeHtml(game)}">
                            <td>${escapeHtml(game)}</td>
                            <td class="${data.pnl >= 0 ? 'pnl-profit' : 'pnl-loss'}">${data.pnl.toFixed(2)}</td>
                            <td>${data.bestMultiplier.toFixed(2)}x</td>
                            <td>${data.totalBets}</td>
                            <td>${data.totalBetAmount.toFixed(2)}</td>
                        </tr>`);
                }

                tableContainer.innerHTML = `
                    <table>
                        <thead>
                            <tr>
                                <th data-sort="game">Game</th>
                                <th data-sort="pnl">P/L (${fiatSymbol})</th>
                                <th data-sort="bestMultiplier">Best Multi</th>
                                <th data-sort="totalBets">Bets</th>
                                <th data-sort="totalBetAmount">Wagered (${fiatSymbol})</th>
                            </tr>
                        </thead>
                        <tbody>${rows.join('')}</tbody>
                    </table>`;

                // Performance: Event delegation for headers
                tableContainer.querySelectorAll('th').forEach(th => {
                    const sortKey = th.dataset.sort;
                    if (sortKey === currentSort.key) {
                        th.innerHTML += `<span class="sort-arrow"> ${currentSort.order === 'desc' ? '▼' : '▲'}</span>`;
                    }
                    th.addEventListener('click', () => {
                        if (!sortKey) return;
                        currentSort.order = currentSort.key === sortKey && currentSort.order === 'desc' ? 'asc' : 'desc';
                        currentSort.key = sortKey;
                        renderTable();
                    });
                });

                // Performance: Event delegation for rows
                tableContainer.addEventListener('click', (e) => {
                    const row = e.target.closest('.game-row');
                    if (!row) return;

                    const gameName = row.dataset.game;
                    const gameData = stats[gameName];
                    const existingDetails = row.nextElementSibling;

                    // Close other details
                    document.querySelectorAll('.details-row').forEach(details => {
                        if (details !== existingDetails) details.remove();
                    });

                    if (existingDetails?.classList.contains('details-row')) {
                        existingDetails.remove();
                        return;
                    }

                    const detailsRow = document.createElement('tr');
                    detailsRow.className = 'details-row';

                    const winRate = gameData.totalBets > 0 ? (gameData.wins / gameData.totalBets) * 100 : 0;
                    const avgMultiplier = gameData.totalBets > 0 ? gameData.totalMultiplier / gameData.totalBets : 0;

                    // Performance: Build HTML efficiently
                    const detailsParts = [`
                        <div class="pnl-details-container">
                            <div class="pnl-details-grid">
                                <div class="pnl-details-grid-item">
                                    <h5>Win Rate</h5>
                                    <p>${winRate.toFixed(1)}%</p>
                                </div>
                                <div class="pnl-details-grid-item">
                                    <h5>Avg. Multi</h5>
                                    <p>${avgMultiplier.toFixed(2)}x</p>
                                </div>
                            </div>`];

                    if (gameData.bestMultiplierBet?.iid) {
                        const bestBet = gameData.bestMultiplierBet;
                        const bestBetLink = `https://${domain}/casino/games/${bestBet.slug}?iid=${encodeURIComponent(bestBet.iid)}&modal=bet`;
                        detailsParts.push(`
                            <div class="best-bet-card">
                                <div class="best-bet-title">🏆 Best Multiplier</div>
                                <div class="best-bet-multi"><a href="${bestBetLink}" target="_blank" class="bet-link">${bestBet.multiplier.toFixed(2)}x</a></div>
                                <div class="best-bet-pnl ${bestBet.pnl >= 0 ? 'pnl-profit' : 'pnl-loss'}">${bestBet.pnl >= 0 ? '+' : ''}${bestBet.pnl.toFixed(2)} ${fiatSymbol}</div>
                                <div class="best-bet-time">${new Date(bestBet.timestamp).toLocaleString()}</div>
                            </div>`);
                    }

                    if (gameData.allBets?.length > 0) {
                        const recentBets = gameData.allBets.slice(-5).reverse();
                        const betItems = [];
                        
                        for (const bet of recentBets) {
                            const betLink = bet.iid ? `https://${domain}/casino/games/${bet.slug}?iid=${encodeURIComponent(bet.iid)}&modal=bet` : '#';
                            const linkStart = bet.iid ? `<a href="${betLink}" target="_blank" class="bet-link">` : '';
                            const linkEnd = bet.iid ? `</a>` : '';
                            betItems.push(`
                                <li>
                                    <span>${linkStart}${bet.multiplier.toFixed(2)}x${linkEnd} (<span class="${bet.pnl >= 0 ? 'pnl-profit' : 'pnl-loss'}">${bet.pnl >= 0 ? '+' : ''}${bet.pnl.toFixed(2)} ${fiatSymbol}</span>)</span>
                                    <span class="bet-time">${new Date(bet.timestamp).toLocaleTimeString()}</span>
                                </li>`);
                        }
                        
                        detailsParts.push(`
                            <div class="recent-bets-section">
                                <h4>Recent Bets</h4>
                                <ul class="pnl-details-list">${betItems.join('')}</ul>
                            </div>`);
                    }

                    detailsParts.push('</div>');
                    detailsRow.innerHTML = `<td colspan="5">${detailsParts.join('')}</td>`;
                    row.parentNode.insertBefore(detailsRow, row.nextSibling);
                });
            }

            function updateHeader() {
                const headerPlaceholder = popup.querySelector('.header-stats-placeholder');
                if (!headerPlaceholder) return;

                Object.assign(headerPlaceholder.style, {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                    gap: '15px'
                });

                if (!sessionActive) {
                    headerPlaceholder.innerHTML = '<div><span class="pnl-stat-item">Session not active.</span></div>';
                    return;
                }

                const { trackedBalances, pnlCrypto, pnlFiat: totalPnlFiat, startingBalanceFiat: totalStartingFiat } = sessionState;
                const fiatSymbol = FIAT_SYMBOLS.get(displayFiat) || displayFiat.toUpperCase();

                // Performance: Build HTML in arrays
                const startingParts = [];
                const currentParts = [];

                for (const currency in trackedBalances) {
                    const startAmount = trackedBalances[currency].amount;
                    const pnlAmount = pnlCrypto[currency] || 0;
                    const currentAmount = startAmount + pnlAmount;
                    startingParts.push(`<div>${startAmount.toFixed(6)} ${currency.toUpperCase()}</div>`);
                    currentParts.push(`<div>${currentAmount.toFixed(6)} ${currency.toUpperCase()}</div>`);
                }

                headerPlaceholder.innerHTML = `
                    <div class="pnl-balance-item">
                        <span class="pnl-balance-label">Starting</span>
                        <div class="pnl-balance-values">
                            <div class="pnl-balance-crypto">${startingParts.join('') || 'N/A'}</div>
                            <span class="pnl-balance-fiat">${fiatSymbol}${totalStartingFiat.toFixed(2)}</span>
                        </div>
                    </div>
                    <div class="pnl-balance-separator">➔</div>
                    <div class="pnl-balance-item">
                        <span class="pnl-balance-label">Current</span>
                        <div class="pnl-balance-values">
                            <div class="pnl-balance-crypto">${currentParts.join('') || 'N/A'}</div>
                            <span class="pnl-balance-fiat ${totalPnlFiat >= 0 ? 'pnl-profit' : 'pnl-loss'}">
                                ${totalPnlFiat >= 0 ? '+' : ''}${totalPnlFiat.toFixed(2)} ${fiatSymbol}
                            </span>
                        </div>
                    </div>
                    <div class="pnl-balance-item">
                        <span class="pnl-balance-label">Total Bets</span>
                        <div class="pnl-balance-values">
                            <span class="pnl-balance-crypto">${sessionState.totalBets}</span>
                        </div>
                    </div>`;
            }

            function updateAndRender() {
                stats = sessionState.gameStats;
                updateHeader();
                renderTable();
            }

            const pnlStatsUpdateListener = () => updateAndRender();
            window.addEventListener(CONFIG.EVENTS.STATS_UPDATED, pnlStatsUpdateListener);
            popup.pnlStatsUpdateListener = pnlStatsUpdateListener;

            // Add compact mode toggle
            let isCompact = false;
            document.getElementById('pnl-toggle-compact').addEventListener('click', () => {
                isCompact = !isCompact;
                if (isCompact) {
                    popup.classList.add('compact-mode');
                    document.getElementById('pnl-toggle-compact').innerHTML = '⬆';
                    document.getElementById('pnl-toggle-compact').title = 'Expand View';
                } else {
                    popup.classList.remove('compact-mode');
                    document.getElementById('pnl-toggle-compact').innerHTML = '⬇';
                    document.getElementById('pnl-toggle-compact').title = 'Toggle Compact View';
                }
            });

            document.getElementById(CONFIG.IDS.popupClose).addEventListener('click', () => {
                window.removeEventListener(CONFIG.EVENTS.STATS_UPDATED, pnlStatsUpdateListener);
                popup.remove();
            });

            document.getElementById(CONFIG.IDS.exportCsv).addEventListener('click', () => {
                const allBets = [];
                for (const [gameName, gameData] of Object.entries(sessionState.gameStats)) {
                    if (gameData.allBets) {
                        for (const bet of gameData.allBets) {
                            allBets.push({ gameName, ...bet });
                        }
                    }
                }

                if (allBets.length === 0) {
                    alert("No bets recorded to export.");
                    return;
                }

                // Performance: Build CSV efficiently
                const header = ["Game", "Timestamp", "BetID", "Multiplier", `P&L (${displayFiat})`];
                const csvRows = [header.join(',')];
                
                for (const row of allBets) {
                    const escapedGameName = `"${row.gameName.replace(/"/g, '""')}"`;
                    csvRows.push([
                        escapedGameName,
                        row.timestamp,
                        row.iid,
                        row.multiplier.toFixed(4),
                        row.pnl.toFixed(4)
                    ].join(','));
                }

                const blob = new Blob([csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `stake_stats_${new Date().toISOString().split('T')[0]}.csv`;
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });

            document.getElementById(CONFIG.IDS.saveImage).addEventListener('click', async () => {
                const games = Object.entries(sessionState.gameStats).map(([name, data]) => ({ name, ...data }));
                
                if (games.length === 0) {
                    alert("No stats to save yet!");
                    return;
                }

                const totalBetsCount = games.reduce((sum, game) => sum + game.totalBets, 0);
                if (totalBetsCount === 0) {
                    alert("No bets recorded to generate stats!");
                    return;
                }

                // Performance: Calculate all stats in single pass
                let totalWagered = 0;
                let totalPnl = 0;
                let gameWithBestPnl = { name: 'N/A', pnl: -Infinity };
                let gameWithWorstPnl = { name: 'N/A', pnl: Infinity };
                let bestMultiplierBet = { multiplier: -1, gameName: 'N/A' };
                let biggestWin = { pnl: -Infinity, gameName: 'N/A' };

                for (const game of games) {
                    totalWagered += game.totalBetAmount;
                    totalPnl += game.pnl;

                    if (game.pnl > gameWithBestPnl.pnl) {
                        gameWithBestPnl = { name: game.name, pnl: game.pnl };
                    }
                    if (game.pnl < gameWithWorstPnl.pnl) {
                        gameWithWorstPnl = { name: game.name, pnl: game.pnl };
                    }
                    if (game.bestMultiplierBet && game.bestMultiplierBet.multiplier > bestMultiplierBet.multiplier) {
                        bestMultiplierBet = { ...game.bestMultiplierBet, gameName: game.name };
                    }
                    if (game.biggestWinBet && game.biggestWinBet.pnl > biggestWin.pnl) {
                        biggestWin = { ...game.biggestWinBet, gameName: game.name };
                    }
                }

                const card = document.createElement('div');
                card.className = 'pnl-image-card';
                card.style.display = 'block';

                const pnlClass = totalPnl >= 0 ? 'pnl-profit' : 'pnl-loss';
                const totalPnlString = `${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)} ${fiatSymbol}`;

                card.innerHTML = `
                    <div class="img-header">
                        <h2>Session Statistics</h2>
                        <p>${new Date().toLocaleString()}</p>
                    </div>
                    <div class="img-main-stats">
                        <div class="img-stat-item">
                            <h3>Total P/L</h3>
                            <p class="${pnlClass}">${totalPnlString}</p>
                        </div>
                        <div class="img-stat-item">
                            <h3>Total Wagered</h3>
                            <p>${totalWagered.toFixed(2)} ${fiatSymbol}</p>
                        </div>
                    </div>
                    <div class="img-grid">
                        <div class="img-grid-item">
                            <h4>🏆 Best P/L Game</h4>
                            <p class="game-name">${escapeHtml(gameWithBestPnl.name)}</p>
                            <p class="pnl-profit">+${gameWithBestPnl.pnl.toFixed(2)} ${fiatSymbol}</p>
                        </div>
                        <div class="img-grid-item">
                            <h4>📉 Worst P/L Game</h4>
                            <p class="game-name">${escapeHtml(gameWithWorstPnl.name)}</p>
                            <p class="pnl-loss">${gameWithWorstPnl.pnl.toFixed(2)} ${fiatSymbol}</p>
                        </div>
                        <div class="img-grid-item">
                            <h4>✨ Best Multiplier</h4>
                            <p class="game-name">${escapeHtml(bestMultiplierBet.gameName)}</p>
                            <p class="multiplier">${bestMultiplierBet.multiplier.toFixed(2)}x</p>
                        </div>
                        <div class="img-grid-item">
                            <h4>💰 Biggest Win</h4>
                            <p class="game-name">${escapeHtml(biggestWin.gameName)}</p>
                            <p class="pnl-profit">+${biggestWin.pnl.toFixed(2)} ${fiatSymbol}</p>
                        </div>
                    </div>`;
                
                document.body.appendChild(card);

                try {
                    const canvas = await html2canvas(card, { 
                        backgroundColor: '#0f212e', 
                        useCORS: true 
                    });
                    const link = document.createElement('a');
                    link.download = 'stake-session-stats.png';
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                } catch (err) {
                    alert('Sorry, something went wrong saving the image.');
                    console.error('html2canvas error:', err);
                } finally {
                    card.remove();
                }
            });

            document.getElementById(CONFIG.IDS.resetStats).addEventListener('click', () => {
                const modal = document.createElement('div');
                modal.id = CONFIG.IDS.confirmModal;
                modal.innerHTML = `
                    <div class="pnl-modal-content">
                        <p>Are you sure you want to reset all game statistics?<br>This cannot be undone.</p>
                        <div class="pnl-modal-buttons">
                            <button id="${CONFIG.IDS.cancelReset}">Cancel</button>
                            <button id="${CONFIG.IDS.confirmReset}">Reset</button>
                        </div>
                    </div>`;
                
                document.body.appendChild(modal);
                
                document.getElementById(CONFIG.IDS.confirmReset).addEventListener('click', async () => {
                    // Performance: Reset in one assignment
                    Object.assign(sessionState, {
                        gameStats: Object.create(null),
                        pnlFiat: 0,
                        pnlCrypto: Object.create(null),
                        totalBets: 0
                    });
                    await saveSessionState();
                    modal.remove();
                    updateAndRender();
                });
                
                document.getElementById(CONFIG.IDS.cancelReset).addEventListener('click', () => modal.remove());
            });

            updateAndRender();
            makeDraggable(popup, popup.querySelector('.popup-header'), true);
        }

        // Performance: Optimized observer with early returns
        const uiObserver = new MutationObserver(async () => {
            const targetContainer = document.querySelector('.coin-toggle .dropdown.flex');
            if (!targetContainer || targetContainer.querySelector('.pnl-tracker-container')) return;

            const uiElements = createPnlUI();
            pnlUI = uiElements.pnlContainer;
            targetContainer.append(pnlUI, uiElements.statsBtn, uiElements.historyBtn);
            await updatePnlDisplay();

            // Performance: Cache active crypto element
            const coinToggle = document.querySelector('[data-testid="coin-toggle"]');
            if (coinToggle) {
                let activeCrypto = coinToggle.getAttribute('data-active-currency');
                new MutationObserver(() => {
                    const newCrypto = coinToggle.getAttribute('data-active-currency');
                    if (newCrypto && newCrypto !== activeCrypto) {
                        activeCrypto = newCrypto;
                    }
                }).observe(document.body, { 
                    subtree: true, 
                    characterData: true, 
                    childList: true 
                });
            }
        });

        uiObserver.observe(document.body, { childList: true, subtree: true });
    }

    // Performance: Use appropriate event
    if (document.readyState === 'complete') {
        main();
    } else {
        window.addEventListener('load', main);
    }
})();