// ==UserScript==
// @name         v11 Stake.com - P/L Tracker & Stats (Optimized)
// @namespace    http://tampermonkey.net/
// @version      11.1
// @description  (Optimized) version - Tracks session P/L across multiple cryptos with improved performance
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
// @require      https://html2canvas.hertzen.com/dist/html2canvas.min.js
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Performance: Use const for immutable config - enables V8 optimizations
    const CONFIG = {
        STORAGE: {
            SESSION_ACTIVE: 'pnlSessionActive_v4',
            SESSION_PNL_FIAT: 'pnlSessionPnlFiat_v4',
            DISPLAY_FIAT: 'pnlDisplayFiat_v4',
            TRACKED_BALANCES: 'pnlTrackedBalances_v4',
            TRACKED_CRYPTO_CURRENCIES: 'pnlTrackedCryptoCurrencies_v4',
            STARTING_BALANCE_FIAT: 'pnlStartingBalanceFiat_v4',
            GAME_STATS: 'pnlGameStats_v4',
            POPUP_POS: 'pnlPopupPos_v4',
        },
        EVENTS: {
            BET_PROCESSED: 'pnl-stake-bet',
            STATS_UPDATED: 'pnl-stats-updated',
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
        },
        CLASSES: {
            pnlTrackerContainer: 'pnl-tracker-container',
            pnlText: 'pnl-text',
            statsButton: 'stats-button',
            pnlProfit: 'pnl-profit',
            pnlLoss: 'pnl-loss',
        }
    };

    // Performance: Cache fiat symbols to avoid repeated object lookups
    const FIAT_SYMBOLS = new Map([
        ['usd', '$'],
        ['eur', '€'],
        ['cad', 'C$']
    ]);

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

    async function main() {
        // Performance: Batch GM_getValue calls using Promise.all
        let [sessionActive, displayFiat] = await Promise.all([
            GM_getValue(CONFIG.STORAGE.SESSION_ACTIVE, false),
            GM_getValue(CONFIG.STORAGE.DISPLAY_FIAT, 'eur')
        ]);

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
            trackedCurrenciesSet: null // Performance: Add Set for O(1) lookups
        };

        let saveTimeout = null;

        // Performance: Batch storage operations
        async function saveSessionState() {
            if (!sessionActive) return;
            await Promise.all([
                GM_setValue(CONFIG.STORAGE.SESSION_PNL_FIAT, sessionState.pnlFiat),
                GM_setValue('pnlSessionPnlCrypto_v4', sessionState.pnlCrypto),
                GM_setValue(CONFIG.STORAGE.GAME_STATS, sessionState.gameStats)
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
                    GM_getValue('pnlSessionPnlCrypto_v4', {}),
                    GM_getValue(CONFIG.STORAGE.GAME_STATS, {}),
                    GM_getValue(CONFIG.STORAGE.STARTING_BALANCE_FIAT, 0),
                    GM_getValue(CONFIG.STORAGE.TRACKED_BALANCES, {}),
                    GM_getValue(CONFIG.STORAGE.TRACKED_CRYPTO_CURRENCIES, [])
                ]);
            
            Object.assign(sessionState, {
                pnlFiat,
                pnlCrypto,
                gameStats,
                startingBalanceFiat,
                trackedBalances,
                trackedCryptoCurrencies,
                trackedCurrenciesSet: new Set(trackedCryptoCurrencies) // Performance: Create Set for fast lookups
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

                // Performance: Build HTML in array then join once
                const balanceItems = [];
                for (const balance of balances) {
                    const rates = currencyRates.get(balance.currency.toLowerCase());
                    const fiatValue = balance.amount * (rates?.get(lastFiat) || 0);
                    const isChecked = fiatValue > 0.1 ? 'checked' : '';
                    
                    balanceItems.push(`
                        <div class="pnl-cs-item">
                            <label>
                                <input type="checkbox" data-currency="${balance.currency.toLowerCase()}" ${isChecked}>
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
                        <div class="pnl-cs-modal-header"><h2>Select Currencies to Track</h2></div>
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
                
                // Performance: Use event delegation where possible
                document.getElementById(CONFIG.IDS.cancelSessionBtn).addEventListener('click', () => modal.remove());
                document.getElementById(CONFIG.IDS.startSessionBtn).addEventListener('click', () => {
                    const selectedCryptos = Array.from(
                        modal.querySelectorAll(`#${CONFIG.IDS.cryptoSelectList} input:checked`)
                    ).map(input => input.dataset.currency);
                    
                    const selectedFiat = document.getElementById('pnl-fiat-currency-select').value;
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

            sessionActive = true;
            
            // Performance: Reset state in one assignment
            sessionState = {
                pnlFiat: 0,
                pnlCrypto: Object.create(null),
                gameStats: Object.create(null),
                startingBalanceFiat: totalStartingFiat,
                trackedBalances,
                trackedCryptoCurrencies: selectedCryptos,
                trackedCurrenciesSet: new Set(selectedCryptos) // Performance: Add Set for O(1) lookups
            };

            // Performance: Batch all storage operations
            await Promise.all([
                GM_setValue(CONFIG.STORAGE.SESSION_ACTIVE, true),
                GM_setValue(CONFIG.STORAGE.STARTING_BALANCE_FIAT, totalStartingFiat),
                GM_setValue(CONFIG.STORAGE.TRACKED_BALANCES, trackedBalances),
                GM_setValue(CONFIG.STORAGE.TRACKED_CRYPTO_CURRENCIES, selectedCryptos),
                saveSessionState()
            ]);

            updatePnlDisplay();
            showStatsPopup();
        }

        async function stopSession() {
            sessionActive = false;
            clearTimeout(saveTimeout);

            // Performance: Batch all storage operations
            await Promise.all([
                GM_setValue(CONFIG.STORAGE.SESSION_ACTIVE, false),
                GM_setValue(CONFIG.STORAGE.GAME_STATS, {}),
                GM_setValue('pnlSessionPnlCrypto_v4', {}),
                GM_setValue(CONFIG.STORAGE.SESSION_PNL_FIAT, 0)
            ]);

            // Performance: Reset state in one assignment
            sessionState = {
                pnlFiat: 0,
                pnlCrypto: Object.create(null),
                gameStats: Object.create(null),
                startingBalanceFiat: 0,
                trackedBalances: Object.create(null),
                trackedCryptoCurrencies: [],
                trackedCurrenciesSet: null
            };

            updatePnlDisplay();
            
            const existingPopup = document.getElementById(CONFIG.IDS.statsPopup);
            if (existingPopup) {
                const listener = existingPopup.pnlStatsUpdateListener;
                if (listener) {
                    window.removeEventListener(CONFIG.EVENTS.STATS_UPDATED, listener);
                }
                existingPopup.remove();
            }
        }

        function updatePnlDisplay() {
            if (!pnlUI) return;
            
            const pnlText = pnlUI.querySelector('.pnl-text');
            if (!sessionActive) {
                pnlText.textContent = 'P/L';
                pnlText.className = 'pnl-text';
                pnlUI.setAttribute('title', 'Click to start P/L session');
                return;
            }

            const { pnlFiat, trackedCryptoCurrencies, startingBalanceFiat } = sessionState;
            const symbol = FIAT_SYMBOLS.get(displayFiat) || displayFiat.toUpperCase();

            pnlUI.setAttribute('title', 
                `Starting balance: ${symbol}${startingBalanceFiat.toFixed(2)}\n` +
                `Tracking: ${trackedCryptoCurrencies.join(', ').toUpperCase()}\n` +
                `Click to stop session.`
            );
            
            pnlText.textContent = `${pnlFiat >= 0 ? '+' : ''}${symbol}${pnlFiat.toFixed(2)}`;
            // Performance: Avoid unnecessary class manipulations
            const newClass = `pnl-text${pnlFiat > 0.005 ? ' pnl-profit' : pnlFiat < -0.005 ? ' pnl-loss' : ''}`;
            if (pnlText.className !== newClass) {
                pnlText.className = newClass;
            }
        }

        function createPnlUI() {
            const pnlContainer = document.createElement('div');
            pnlContainer.className = 'pnl-tracker-container';
            pnlContainer.innerHTML = `<div class="pnl-text">P/L</div>`;
            pnlContainer.addEventListener('click', () => {
                sessionActive ? stopSession() : showCryptoSelectPopup();
            });

            const statsBtn = document.createElement('div');
            statsBtn.className = 'stats-button';
            statsBtn.innerHTML = '📊';
            statsBtn.title = 'Show P/L Stats';
            statsBtn.addEventListener('click', () => {
                if (!isProcessingClick) showStatsPopup();
            });

            // Performance: Inject all styles at once
            const styleSheet = document.createElement("style");
            styleSheet.id = CONFIG.IDS.pnlStyles;
            styleSheet.textContent = `
                .pnl-tracker-container, .stats-button { display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0 12px; border-left: 1px solid #2f4553; background-color: #0f212e; color: #9eafc1; }
                .pnl-tracker-container:hover, .stats-button:hover { background-color: #213743; }
                .stats-button { font-size: 18px; }
                .pnl-text { font-weight: 700; }
                .pnl-profit { color: #00e701 !important; }
                .pnl-loss { color: #ff4444 !important; }
                #${CONFIG.IDS.cryptoSelectModal} { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; align-items: center; justify-content: center; }
                .pnl-cs-modal-content { background: #1a2c38; width: 90vw; max-width: 400px; border-radius: 8px; border: 1px solid #2f4553; }
                .pnl-cs-modal-header { padding: 15px 20px; border-bottom: 1px solid #2f4553; } .pnl-cs-modal-header h2 { margin: 0; font-size: 16px; color: #fff; }
                .pnl-cs-modal-body { padding: 20px; max-height: 50vh; overflow-y: auto; } #${CONFIG.IDS.cryptoSelectList} { display: flex; flex-direction: column; gap: 15px; }
                .pnl-cs-item { display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px; }
                .pnl-cs-item label { display: flex; align-items: center; gap: 12px; cursor: pointer; flex-grow: 1; color: #fff;}
                .pnl-cs-item input[type='checkbox'] { -webkit-appearance: checkbox !important; appearance: checkbox !important; display: inline-block !important; visibility: visible !important; opacity: 1 !important; width: 18px !important; height: 18px !important; cursor: pointer !important; }
                .pnl-cs-balance { text-align: right; } .pnl-cs-balance-fiat { font-size: 13px; color: #fff; } .pnl-cs-balance-crypto { font-size: 11px; color: #818b99; }
                .pnl-cs-modal-footer { padding: 15px 20px; border-top: 1px solid #2f4553; } .pnl-cs-fiat-selector { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #9eafc1; }
                .pnl-cs-fiat-selector select { background: #0f212e; color: #fff; border: 1px solid #2f4553; border-radius: 6px; padding: 5px 8px; }
                .pnl-cs-modal-buttons { display: flex; justify-content: flex-end; gap: 10px; margin-top: 15px; }
                .pnl-cs-modal-buttons button { padding: 8px 20px; border-radius: 5px; border: none; cursor: pointer; font-weight: 600; }
                #${CONFIG.IDS.startSessionBtn} { background: #00e701; color: #0f212e; } #${CONFIG.IDS.cancelSessionBtn} { background: #2f4553; color: #fff; }
            `;
            document.head.appendChild(styleSheet);
            
            return { pnlContainer, statsBtn };
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
        function makeDraggable(popup, header) {
            let isRequestingFrame = false;
            let startX, startY, startLeft, startTop;
            let lastClientX, lastClientY;

            header.onmousedown = dragMouseDown;

            function dragMouseDown(e) {
                e.preventDefault();
                startX = lastClientX = e.clientX;
                startY = lastClientY = e.clientY;
                startLeft = popup.offsetLeft;
                startTop = popup.offsetTop;

                document.onmouseup = closeDragElement;
                document.onmousemove = elementDrag;
            }

            function elementDrag(e) {
                lastClientX = e.clientX;
                lastClientY = e.clientY;

                if (!isRequestingFrame) {
                    isRequestingFrame = true;
                    requestAnimationFrame(updatePosition);
                }
            }

            function updatePosition() {
                isRequestingFrame = false;
                popup.style.top = `${startTop + lastClientY - startY}px`;
                popup.style.left = `${startLeft + lastClientX - startX}px`;
            }

            function closeDragElement() {
                document.onmouseup = null;
                document.onmousemove = null;
                updatePosition();
                GM_setValue(CONFIG.STORAGE.POPUP_POS, { 
                    top: popup.style.top, 
                    left: popup.style.left 
                });
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
                    <button id="${CONFIG.IDS.popupClose}">&times;</button>
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
                #${CONFIG.IDS.statsPopup} { position: fixed; width: 80vw; max-width: 800px; background: #1a2c38; border-radius: 12px; border: 1px solid #2f4553; z-index: 9999; box-shadow: 0 10px 30px rgba(0,0,0,0.5); color: #fff; display: flex; flex-direction: column; }
                .popup-header { padding: 15px 20px; background: #0f212e; border-bottom: 1px solid #2f4553; cursor: move; display: flex; justify-content: space-between; align-items: center; }
                .header-title-section { display: flex; flex-direction: column; gap: 12px; flex-grow: 1; align-items: center; }
                .header-stats-placeholder { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 15px; font-size: 12px; }
                .pnl-balance-item { display: flex; flex-direction: column; align-items: center; background: rgba(0,0,0,0.2); padding: 5px 10px; border-radius: 6px;}
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
                        <div class="pnl-balance-crypto">${startingParts.join('') || 'N/A'}</div>
                        <span class="pnl-balance-fiat">${fiatSymbol}${totalStartingFiat.toFixed(2)}</span>
                    </div>
                    <div class="pnl-balance-separator">➔</div>
                    <div class="pnl-balance-item">
                        <span class="pnl-balance-label">Current</span>
                        <div class="pnl-balance-crypto">${currentParts.join('') || 'N/A'}</div>
                        <span class="pnl-balance-fiat ${totalPnlFiat >= 0 ? 'pnl-profit' : 'pnl-loss'}">
                            ${totalPnlFiat >= 0 ? '+' : ''}${totalPnlFiat.toFixed(2)} ${fiatSymbol}
                        </span>
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
                        pnlCrypto: Object.create(null)
                    });
                    await saveSessionState();
                    modal.remove();
                    updateAndRender();
                });
                
                document.getElementById(CONFIG.IDS.cancelReset).addEventListener('click', () => modal.remove());
            });

            updateAndRender();
            makeDraggable(popup, popup.querySelector('.popup-header'));
        }

        // Performance: Optimized observer with early returns
        const uiObserver = new MutationObserver(async () => {
            const targetContainer = document.querySelector('.coin-toggle .dropdown.flex');
            if (!targetContainer || targetContainer.querySelector('.pnl-tracker-container')) return;

            const uiElements = createPnlUI();
            pnlUI = uiElements.pnlContainer;
            targetContainer.append(pnlUI, uiElements.statsBtn);
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