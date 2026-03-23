// ====== ТАЙМЕР (простий секундомір) ======
const display = document.getElementById('timerDisplay');
const btnStartPause = document.getElementById('timerStartPause');
const btnReset = document.getElementById('timerReset');
const chkAutoStart = document.getElementById('autoStart');
const chkAutoStop = document.getElementById('autoStop');
const chkSpeedMode = document.getElementById('speedMode');
const speedPanel = document.getElementById('speedPanel');
const speedMinutesInput = document.getElementById('speedMinutes');
const speedStatus = document.getElementById('speedStatus');
const chkSmartSpeedCalc = document.getElementById('smartSpeedCalc');
const chkLenientAnyCheck = document.getElementById('lenientAnyCheck');
const chkTimeoutLeniency = document.getElementById('timeoutLeniency');
const timeoutLeniencyPercentInput = document.getElementById('timeoutLeniencyPercent');
const chkIgnoreCase = document.getElementById('ignoreCase');
const chkIgnoreMathCase = document.getElementById('ignoreMathCase');
const chkRetryRevealMode = document.getElementById('retryRevealMode');
const retryRevealCountInput = document.getElementById('retryRevealCount');
const chkSpeechMode = document.getElementById('speechMode');
const speechLangSelect = document.getElementById('speechLang');
const speechStatus = document.getElementById('speechStatus');
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition || null;

let tRunning = false;
let tElapsedMs = 0;
let tLast = 0;
let tHandle = null;
const speedState = {
    running: false,
    blanks: [],
    activeIndex: -1,
    perBlankMs: 0,
    slotDurationsMs: [],
    smartMode: false,
    carryMs: 0,
    deadline: 0,
    tickHandle: null
};
const focusState = {
    lastScrolledId: null,
    lastScrollAt: 0,
    lastUserScrollAt: 0
};
const speechState = {
    supported: typeof SpeechRecognitionCtor === 'function',
    recognition: null,
    listening: false,
    shouldListen: false,
    stopRequested: false,
    syncTimer: 0,
    targetInput: null
};

function fmt(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    return `${m}:${s}`;
}
function updateDisplay() { display.textContent = fmt(tElapsedMs); }
function tick() {
    const now = performance.now();
    const dt = now - tLast;
    tLast = now;
    tElapsedMs += dt;
    updateDisplay();
}
function startTimer() {
    if (tRunning) return;
    tRunning = true;
    tLast = performance.now();
    tHandle = setInterval(tick, 100);
    btnStartPause.textContent = 'Пауза';
    btnReset.disabled = false;
}
function pauseTimer() {
    if (!tRunning) return;
    tRunning = false;
    clearInterval(tHandle);
    btnStartPause.textContent = 'Старт';
}
function resetTimer() {
    pauseTimer();
    tElapsedMs = 0;
    updateDisplay();
    btnReset.disabled = true;
}
btnStartPause.addEventListener('click', () => {
    if (tRunning) pauseTimer(); else startTimer();
});
btnReset.addEventListener('click', resetTimer);
updateDisplay();

function fmtSecs(ms) {
    const safeMs = Math.max(0, ms);
    const totalTenths = Math.ceil(safeMs / 100);
    const totalSec = Math.floor(totalTenths / 10);
    const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const ss = String(totalSec % 60).padStart(2, '0');
    const tenths = String(totalTenths % 10);
    return `${mm}:${ss}.${tenths} с`;
}

function setSpeedStatus(text) {
    if (!speedStatus) return;
    speedStatus.textContent = text || '';
}

function refreshSpeedPanel() {
    if (!speedPanel || !chkSpeedMode) return;
    speedPanel.hidden = !chkSpeedMode.checked;
}

function setSpeechStatus(text = '', tone = '') {
    if (!speechStatus) return;
    speechStatus.textContent = text || '';
    speechStatus.className = tone || '';
}

function isSpeechModeEnabled() {
    return !!chkSpeechMode?.checked;
}

function getSpeechRecognitionLang() {
    const selected = String(speechLangSelect?.value || '').trim();
    if (selected && selected !== 'auto') return selected;
    return navigator.language || document.documentElement.lang || 'de-DE';
}

function clearSpeechTargetHighlight() {
    document.querySelectorAll('input.blank.speech-active').forEach((el) => {
        el.classList.remove('speech-active');
    });
}

function setSpeechTargetHighlight(inp) {
    clearSpeechTargetHighlight();
    if (!inp || !inp.isConnected) return;
    inp.classList.add('speech-active');
}

const MATH_SPEECH_ALIAS_PAIRS = [
    ['null', '0'],
    ['zero', '0'],
    ['eins', '1'],
    ['ein', '1'],
    ['one', '1'],
    ['zwei', '2'],
    ['two', '2'],
    ['drei', '3'],
    ['three', '3'],
    ['vier', '4'],
    ['four', '4'],
    ['funf', '5'],
    ['fuenf', '5'],
    ['five', '5'],
    ['sechs', '6'],
    ['six', '6'],
    ['sieben', '7'],
    ['seven', '7'],
    ['acht', '8'],
    ['eight', '8'],
    ['neun', '9'],
    ['nine', '9'],
    ['ah', 'a'],
    ['a', 'a'],
    ['be', 'b'],
    ['bee', 'b'],
    ['b', 'b'],
    ['ce', 'c'],
    ['see', 'c'],
    ['c', 'c'],
    ['de', 'd'],
    ['d', 'd'],
    ['e', 'e'],
    ['ef', 'f'],
    ['f', 'f'],
    ['ge', 'g'],
    ['g', 'g'],
    ['ha', 'h'],
    ['h', 'h'],
    ['i', 'i'],
    ['jot', 'j'],
    ['jay', 'j'],
    ['j', 'j'],
    ['ka', 'k'],
    ['k', 'k'],
    ['el', 'l'],
    ['l', 'l'],
    ['em', 'm'],
    ['m', 'm'],
    ['en', 'n'],
    ['n', 'n'],
    ['o', 'o'],
    ['pe', 'p'],
    ['p', 'p'],
    ['ku', 'q'],
    ['q', 'q'],
    ['er', 'r'],
    ['r', 'r'],
    ['es', 's'],
    ['s', 's'],
    ['te', 't'],
    ['t', 't'],
    ['u', 'u'],
    ['fau', 'v'],
    ['vau', 'v'],
    ['v', 'v'],
    ['we', 'w'],
    ['double u', 'w'],
    ['w', 'w'],
    ['iks', 'x'],
    ['x', 'x'],
    ['ypsilon', 'y'],
    ['why', 'y'],
    ['y', 'y'],
    ['zet', 'z'],
    ['zed', 'z'],
    ['z', 'z'],
    ['alpha', '\\alpha'],
    ['beta', '\\beta'],
    ['gamma', '\\gamma'],
    ['delta', '\\delta'],
    ['epsilon', '\\epsilon'],
    ['theta', '\\theta'],
    ['lambda', '\\lambda'],
    ['mu', '\\mu'],
    ['pi', '\\pi'],
    ['rho', '\\rho'],
    ['sigma', '\\sigma'],
    ['phi', '\\phi'],
    ['psi', '\\psi'],
    ['omega', '\\omega']
];

const MATH_SPEECH_ALIASES = new Map(MATH_SPEECH_ALIAS_PAIRS);

function normalizeSpeechAliasKey(text) {
    return String(text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\\]+/gu, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function extractRecognizedMathToken(transcript) {
    const normalizedTranscript = normalizeSpeechAliasKey(transcript);
    if (!normalizedTranscript) return '';
    if (MATH_SPEECH_ALIASES.has(normalizedTranscript)) {
        return MATH_SPEECH_ALIASES.get(normalizedTranscript) || '';
    }
    const firstWord = normalizedTranscript.split(' ')[0] || '';
    if (MATH_SPEECH_ALIASES.has(firstWord)) {
        return MATH_SPEECH_ALIASES.get(firstWord) || '';
    }
    if (/^\\[a-z]+$/i.test(firstWord)) return firstWord;
    if (/^[a-z0-9]$/i.test(firstWord)) return firstWord.toLowerCase();
    return '';
}

function extractRecognizedWord(transcript, inp = null) {
    if (inp?.classList?.contains('math-blank')) {
        return extractRecognizedMathToken(transcript);
    }
    const raw = String(transcript || '').trim();
    if (!raw) return '';
    const match = raw.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/u);
    return match ? match[0] : '';
}

function clearSpeechSyncTimer() {
    if (!speechState.syncTimer) return;
    clearTimeout(speechState.syncTimer);
    speechState.syncTimer = 0;
}

function scheduleSpeechSync(delayMs = 0) {
    clearSpeechSyncTimer();
    speechState.syncTimer = window.setTimeout(() => {
        speechState.syncTimer = 0;
        syncSpeechRecognition();
    }, Math.max(0, Number(delayMs) || 0));
}

function getActiveBlankInput() {
    const active = document.activeElement;
    if (!active?.matches?.('input.blank') || !active.isConnected) return null;
    return active;
}

function getSpeechCandidateInput() {
    return getActiveBlankInput() || document.querySelector('input.blank');
}

function stopSpeechRecognition(statusText = '', tone = '') {
    clearSpeechSyncTimer();
    speechState.shouldListen = false;
    speechState.targetInput = null;
    clearSpeechTargetHighlight();

    if (speechState.listening && speechState.recognition) {
        speechState.stopRequested = true;
        try {
            speechState.recognition.abort();
        } catch (_) { }
    } else {
        speechState.stopRequested = false;
    }

    setSpeechStatus(statusText, tone);
}

function getSpeechRecognition() {
    if (!speechState.supported) return null;
    if (speechState.recognition) return speechState.recognition;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        speechState.listening = true;
        const target = speechState.targetInput;
        setSpeechTargetHighlight(target);
        const targetId = target?.dataset?.index;
        setSpeechStatus(
            targetId ? `Мікрофон слухає пропуск ${targetId}.` : 'Мікрофон слухає.',
            'listening'
        );
    };

    recognition.onresult = (event) => {
        const target = speechState.targetInput;
        if (!target || !target.isConnected) return;

        const transcript = Array.from(event.results || [])
            .slice(event.resultIndex)
            .map((result) => result?.[0]?.transcript || '')
            .join(' ')
            .trim();
        const word = extractRecognizedWord(transcript, target);

        if (!word) {
            setSpeechStatus('Не вдалося виділити одне слово. Спробуй ще раз.', 'error');
            return;
        }

        target.value = word;
        target.classList.remove('incorrect');
        target.classList.remove('correct');
        setSpeechStatus(`Розпізнано: ${word}`, 'ready');

        checkAnswers({
            onlyInput: target,
            trackEnterChecks: true,
            moveFocusForward: true,
            forceMoveFocusForwardOnFailure: false
        });

        if (speechState.listening) {
            speechState.stopRequested = true;
            try {
                recognition.abort();
            } catch (_) {
                try {
                    recognition.stop();
                } catch (_) { }
            }
        }
    };

    recognition.onerror = (event) => {
        speechState.listening = false;
        clearSpeechTargetHighlight();

        if (speechState.stopRequested && event.error === 'aborted') return;

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            if (chkSpeechMode) chkSpeechMode.checked = false;
            speechState.shouldListen = false;
            setSpeechStatus('Доступ до мікрофона заблоковано браузером.', 'error');
            return;
        }
        if (event.error === 'audio-capture') {
            speechState.shouldListen = false;
            setSpeechStatus('Мікрофон не знайдено або він недоступний.', 'error');
            return;
        }
        if (event.error === 'no-speech') {
            setSpeechStatus('Не почув слово. Спробуй ще раз.', 'error');
            return;
        }

        setSpeechStatus(`Помилка мікрофона: ${event.error}`, 'error');
    };

    recognition.onend = () => {
        speechState.listening = false;
        clearSpeechTargetHighlight();

        if (speechState.stopRequested) {
            speechState.stopRequested = false;
            if (speechState.shouldListen && isSpeechModeEnabled()) {
                scheduleSpeechSync(0);
            }
            return;
        }

        if (speechState.shouldListen && isSpeechModeEnabled()) {
            scheduleSpeechSync(0);
        }
    };

    speechState.recognition = recognition;
    return recognition;
}

function syncSpeechRecognition() {
    if (!speechState.supported) {
        if (chkSpeechMode) chkSpeechMode.disabled = true;
        setSpeechStatus('Цей браузер не підтримує голосове введення.', 'error');
        return;
    }

    if (!isSpeechModeEnabled()) {
        stopSpeechRecognition();
        return;
    }

    if (speedState.running) {
        stopSpeechRecognition('Голосовий режим вимкнений під час speed mode.', 'error');
        return;
    }

    let target = getSpeechCandidateInput();
    if (!target) {
        stopSpeechRecognition(totalBlanks ? 'Усі пропуски вже оброблені.' : 'Спочатку створи пропуски.', 'ready');
        return;
    }

    if (document.activeElement !== target) {
        focusBlankInput(target);
        target = getActiveBlankInput() || target;
    }

    const prevTarget = speechState.targetInput;
    speechState.shouldListen = true;

    if (speechState.listening) {
        if (prevTarget === target) {
            speechState.targetInput = target;
            setSpeechTargetHighlight(target);
            setSpeechStatus(`Мікрофон слухає пропуск ${target.dataset.index}.`, 'listening');
            return;
        }
        speechState.targetInput = target;
        speechState.stopRequested = true;
        try {
            speechState.recognition?.abort();
        } catch (_) { }
        return;
    }

    speechState.targetInput = target;
    setSpeechTargetHighlight(target);
    const recognition = getSpeechRecognition();
    if (!recognition) {
        setSpeechStatus('Не вдалося ініціалізувати мікрофон.', 'error');
        return;
    }

    recognition.lang = getSpeechRecognitionLang();

    try {
        recognition.start();
    } catch (error) {
        const message = String(error?.message || error || '');
        if (!/already started/i.test(message)) {
            speechState.shouldListen = false;
            setSpeechStatus('Не вдалося запустити розпізнавання голосу.', 'error');
        }
    }
}

function countReadableWords(text) {
    if (!text) return 0;
    const words = String(text).match(/[\p{L}\p{N}']+/gu);
    return words ? words.length : 0;
}

function collectReadWordsByBlankId(root) {
    const readWordsById = new Map();
    if (!root) return readWordsById;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let wordsSincePreviousBlank = 0;
    let node = walker.currentNode;
    while (node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const parent = node.parentElement;
            if (
                parent &&
                parent.tagName !== 'SCRIPT' &&
                !parent.closest('.tikz-block') &&
                !parent.closest('.formula-answers') &&
                !parent.closest('.formula')
            ) {
                wordsSincePreviousBlank += countReadableWords(node.nodeValue);
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node;
            if (el.matches('input.blank')) {
                const id = Number(el.dataset.index);
                if (Number.isFinite(id) && !readWordsById.has(id)) {
                    readWordsById.set(id, wordsSincePreviousBlank);
                }
                wordsSincePreviousBlank = 0;
            }
        }
        node = walker.nextNode();
    }

    return readWordsById;
}

function computeAnswerUnits(answer) {
    const raw = String(answer ?? '').trim();
    if (!raw) return 1;
    const compact = raw.replace(/\s+/g, '');
    if (!compact) return 1;
    if (/^\\[A-Za-z]+$/.test(compact)) {
        return Math.max(2, Math.ceil((compact.length - 1) / 2));
    }
    return Math.max(1, Array.from(compact).length);
}

function computeMathReadUnits(id) {
    const slotInfo = mathIdToSlot.get(id);
    const slots = slotInfo?.formula?.slots;
    if (!slots?.length) return 0;

    let idx = -1;
    for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        if (s?.type === 'blank' && s.id === id) {
            idx = i;
            break;
        }
    }
    if (idx <= 0) return 0;

    let units = 0;
    for (let i = idx - 1; i >= 0; i--) {
        const s = slots[i];
        if (s?.type === 'blank') break;
        const lex = String(s?.value ?? '');
        if (!lex.trim()) continue;
        if (/^\\[A-Za-z]+$/.test(lex)) units += 1.3;
        else if (/^[A-Za-z]$/.test(lex)) units += 0.8;
        else if (/^\d+$/.test(lex)) units += 0.6;
        else units += 0.4;
    }
    return Math.min(10, units);
}

function computeSmartSpeedDurations(blanks, totalMs) {
    if (!blanks.length) return [];
    const outputRoot = document.getElementById('output');
    const readWordsById = collectReadWordsByBlankId(outputRoot);
    const weights = blanks.map((inp) => {
        const id = Number(inp.dataset.index);
        const isMathBlank = inp.classList.contains('math-blank');
        const readWords = Math.min(20, readWordsById.get(id) || 0);
        const mathReadUnits = isMathBlank ? computeMathReadUnits(id) : 0;
        const readUnits = Math.min(30, readWords + mathReadUnits);
        const answerUnits = Math.min(18, computeAnswerUnits(hidden[id]));
        const base = isMathBlank ? 2.2 : 1;
        return base + readUnits * 0.7 + answerUnits * 0.45;
    });

    const weightSum = weights.reduce((sum, w) => sum + w, 0);
    if (!Number.isFinite(weightSum) || weightSum <= 0) {
        return Array(blanks.length).fill(totalMs / blanks.length);
    }
    return weights.map((w) => (totalMs * w) / weightSum);
}

function normalizeRetryRevealCount() {
    if (!retryRevealCountInput) return 1;
    const raw = Number(retryRevealCountInput.value);
    const value = Number.isFinite(raw) ? Math.floor(raw) : 1;
    const safe = Math.max(1, value || 1);
    retryRevealCountInput.value = String(safe);
    return safe;
}

function isRetryRevealEnabled() {
    return !!chkRetryRevealMode?.checked;
}

function syncRetryRevealControls() {
    if (!retryRevealCountInput) return;
    const enabled = isRetryRevealEnabled();
    retryRevealCountInput.disabled = !enabled;
    if (!enabled) {
        failedEnterChecks.clear();
        lastFailedValues.clear();
    }
    normalizeRetryRevealCount();
}

function normalizeTimeoutLeniencyPercent() {
    if (!timeoutLeniencyPercentInput) return 100;
    const raw = Number(timeoutLeniencyPercentInput.value);
    const value = Number.isFinite(raw) ? Math.floor(raw) : 70;
    const safe = Math.min(100, Math.max(1, value || 70));
    timeoutLeniencyPercentInput.value = String(safe);
    return safe;
}

function isTimeoutLeniencyEnabled() {
    return !!chkTimeoutLeniency?.checked;
}

function isLenientAnyCheckEnabled() {
    return !!chkLenientAnyCheck?.checked;
}

function syncTimeoutLeniencyControls() {
    if (!timeoutLeniencyPercentInput) return;
    timeoutLeniencyPercentInput.disabled = !isTimeoutLeniencyEnabled() && !isLenientAnyCheckEnabled();
    normalizeTimeoutLeniencyPercent();
}

function levenshteinDistance(a, b) {
    const n = a.length;
    const m = b.length;
    if (!n) return m;
    if (!m) return n;

    const prev = new Array(m + 1);
    const curr = new Array(m + 1);
    for (let j = 0; j <= m; j++) prev[j] = j;

    for (let i = 1; i <= n; i++) {
        curr[0] = i;
        for (let j = 1; j <= m; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(
                prev[j] + 1,
                curr[j - 1] + 1,
                prev[j - 1] + cost
            );
        }
        for (let j = 0; j <= m; j++) prev[j] = curr[j];
    }
    return prev[m];
}

function calcWordSimilarityPercent(typed, expected) {
    const a = Array.from(String(typed || '').trim().toLowerCase());
    const b = Array.from(String(expected || '').trim().toLowerCase());
    if (!a.length || !b.length) return 0;
    const dist = levenshteinDistance(a, b);
    const maxLen = Math.max(a.length, b.length);
    const similarity = 1 - (dist / maxLen);
    return Math.max(0, Math.min(100, similarity * 100));
}

function shouldIgnoreCaseForInput(inp) {
    if (!inp) return false;
    if (inp.classList.contains('math-blank')) return !!chkIgnoreMathCase?.checked;
    return !!chkIgnoreCase?.checked;
}

function normalizeAnswerForCompare(value, inp) {
    const normalized = String(value ?? '').trim();
    return shouldIgnoreCaseForInput(inp) ? normalized.toLowerCase() : normalized;
}

function isBlankAnswerCorrect(inp, typedValue, expectedValue) {
    return normalizeAnswerForCompare(typedValue, inp) === normalizeAnswerForCompare(expectedValue, inp);
}

function isLenientMatch(inp, typedValue, expectedValue) {
    if (!inp || inp.classList.contains('math-blank')) return false;
    const threshold = normalizeTimeoutLeniencyPercent();
    return calcWordSimilarityPercent(typedValue, expectedValue) >= threshold;
}

function shouldAcceptLenientAnswer(inp, typedValue, expectedValue, mode = 'general') {
    if (mode === 'timeout') {
        if (!isTimeoutLeniencyEnabled() && !isLenientAnyCheckEnabled()) return false;
        return isLenientMatch(inp, typedValue, expectedValue);
    }
    if (!isLenientAnyCheckEnabled()) return false;
    return isLenientMatch(inp, typedValue, expectedValue);
}

function clearSpeedTick() {
    if (!speedState.tickHandle) return;
    clearInterval(speedState.tickHandle);
    speedState.tickHandle = null;
}

function clearSpeedHighlight() {
    document.querySelectorAll('input.blank.speed-active').forEach((el) => {
        el.classList.remove('speed-active');
    });
}

function rerenderUpdatedFormulas(updatedFormulas) {
    if (!updatedFormulas || !updatedFormulas.size) return Promise.resolve();
    updatedFormulas.forEach(renderFormula);
    if (window.MathJax && MathJax.typesetPromise) {
        return MathJax.typesetPromise(Array.from(updatedFormulas, (f) => f.span))
            .catch(() => { });
    }
    return Promise.resolve();
}

function maybeScrollBlankIntoView(inp) {
    if (!inp || !inp.isConnected) return;
    const id = Number(inp.dataset.index);
    const target = getBlankContextAnchor(inp);
    const rect = target.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    if (!vh) return;
    const comfortTop = vh * 0.24;
    const comfortBottom = vh * 0.76;
    const outsideComfortZone = rect.top < comfortTop || rect.bottom > comfortBottom;
    if (!outsideComfortZone) return;

    const now = performance.now();
    if (now - focusState.lastUserScrollAt < 450) return;

    if (Number.isFinite(id) && focusState.lastScrolledId === id && (now - focusState.lastScrollAt) < 350) {
        return;
    }

    const targetCenter = rect.top + rect.height / 2;
    const absoluteCenter = window.scrollY + targetCenter;
    const desiredCenter = vh * 0.5;
    const maxScrollY = Math.max(0, document.documentElement.scrollHeight - vh);
    const nextScrollY = Math.min(maxScrollY, Math.max(0, absoluteCenter - desiredCenter));
    window.scrollTo({ top: nextScrollY, behavior: 'auto' });
    if (Number.isFinite(id)) focusState.lastScrolledId = id;
    focusState.lastScrollAt = now;
}

function getBlankContextAnchor(inp) {
    if (!inp || !inp.isConnected) return inp;

    if (inp.classList.contains('math-blank')) {
        const id = Number(inp.dataset.index);
        const slotInfo = mathIdToSlot.get(id);
        const formulaSpan = slotInfo?.formula?.span;
        if (formulaSpan?.isConnected) {
            const formulaRow = formulaSpan.closest('.formula-row');
            return formulaRow || formulaSpan;
        }
        const ownRow = inp.closest('.formula-row');
        if (ownRow) return ownRow;
    }

    const word = inp.closest('.word');
    if (word) return word;
    return inp;
}

function focusBlankInput(inp) {
    if (!inp || !inp.isConnected) return;
    try {
        inp.focus({ preventScroll: true });
    } catch (_) {
        inp.focus();
    }
    maybeScrollBlankIntoView(inp);
    inp.select?.();
    if (isSpeechModeEnabled()) scheduleSpeechSync(0);
}

function findNextBlankInput(currentInp) {
    if (!currentInp) return null;
    const inputs = Array.from(document.querySelectorAll('input.blank'));
    const idx = inputs.indexOf(currentInp);
    if (idx === -1) return null;
    return inputs[idx + 1] || null;
}

function computeScoreTotal(fallbackCount = 0) {
    const ids = Object.keys(hidden)
        .map((k) => Number(k))
        .filter((id) => Number.isFinite(id));
    return Math.max(0, totalBlanks || fallbackCount || ids.length);
}

function formatResultText(ok, total) {
    const safeTotal = Math.max(0, Number(total) || 0);
    const safeOk = Math.min(Math.max(0, Number(ok) || 0), safeTotal);
    const percent = safeTotal ? (safeOk / safeTotal) * 100 : 0;
    const percentText = percent.toLocaleString('de-DE', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1
    });
    return `\u041A\u0456\u043B\u044C\u043A\u0456\u0441\u0442\u044C \u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0438\u0445 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0435\u0439: ${safeOk}/${safeTotal} (${percentText}%) - \u0427\u0430\u0441: ${fmt(tElapsedMs)}`;
}

function updateResultLine(fallbackCount = 0) {
    const ids = Object.keys(hidden)
        .map((k) => Number(k))
        .filter((id) => Number.isFinite(id));
    let ok = 0;
    ids.forEach((id) => {
        if (solved.has(id) && !excludedFromStats.has(id)) ok += 1;
    });
    const total = computeScoreTotal(fallbackCount);
    if (ok > total) ok = total;
    document.getElementById('result').textContent = formatResultText(ok, total);
}

const EMPTY_INPUT_MARK = '[\u043F\u043E\u0440\u043E\u0436\u043D\u044C\u043E]';

function fillBlankWithAnswer(inp, id, updatedFormulas = null) {
    if (!inp || !inp.isConnected) return;
    solved.add(id);
    revealedWrongInFormula.delete(id);
    wrongInputInFormula.delete(id);
    excludedFromStats.delete(id);
    failedEnterChecks.delete(id);
    lastFailedValues.delete(id);
    const isMathBlank = inp.classList.contains('math-blank');
    if (isMathBlank) {
        const mathLabel = inp.closest('label');
        if (mathLabel) mathLabel.remove();
    } else {
        const filled = document.createElement('span');
        filled.className = 'filled';
        filled.textContent = hidden[id];
        inp.replaceWith(filled);
    }
    if (updatedFormulas && isMathBlank) {
        const slotInfo = mathIdToSlot.get(id);
        if (slotInfo) updatedFormulas.add(slotInfo.formula);
    }
}

function fillBlankWithWrongAttempt(inp, id, wrongValue, updatedFormulas = null) {
    if (!inp || !inp.isConnected) return;
    solved.delete(id);
    revealedWrongInFormula.add(id);
    excludedFromStats.add(id);
    failedEnterChecks.delete(id);
    lastFailedValues.delete(id);
    const isMathBlank = inp.classList.contains('math-blank');
    const wrongText = wrongValue || EMPTY_INPUT_MARK;
    wrongInputInFormula.set(id, wrongText);

    if (isMathBlank) {
        const mathLabel = inp.closest('label');
        if (mathLabel) mathLabel.remove();
    } else {
        const filled = document.createElement('span');
        filled.className = 'filled filled-wrong';

        const correct = document.createElement('span');
        correct.className = 'filled-correct-answer';
        correct.textContent = hidden[id];

        const wrong = document.createElement('span');
        wrong.className = 'filled-wrong-answer';
        wrong.textContent = wrongText;

        filled.appendChild(correct);
        filled.appendChild(wrong);
        inp.replaceWith(filled);
    }
    if (updatedFormulas && isMathBlank) {
        const slotInfo = mathIdToSlot.get(id);
        if (slotInfo) updatedFormulas.add(slotInfo.formula);
    }
}

function handleFailedEnterAttempt(inp, id, val, updatedFormulas = null) {
    inp.classList.add('incorrect');
    inp.classList.remove('correct');
    if (!isRetryRevealEnabled()) return false;

    const missCount = (failedEnterChecks.get(id) || 0) + 1;
    failedEnterChecks.set(id, missCount);
    if (val) lastFailedValues.set(id, val);

    const threshold = normalizeRetryRevealCount();
    if (missCount < threshold) return false;

    const wrongValue = val || lastFailedValues.get(id) || '';
    fillBlankWithWrongAttempt(inp, id, wrongValue, updatedFormulas);
    return true;
}

function stopSpeedMode(resetStatus = true) {
    clearSpeedTick();
    clearSpeedHighlight();
    speedState.running = false;
    speedState.blanks = [];
    speedState.activeIndex = -1;
    speedState.perBlankMs = 0;
    speedState.slotDurationsMs = [];
    speedState.smartMode = false;
    speedState.carryMs = 0;
    speedState.deadline = 0;
    if (resetStatus) setSpeedStatus('');
}

function findNextSpeedIndex(startIdx) {
    for (let i = startIdx; i < speedState.blanks.length; i++) {
        const inp = speedState.blanks[i];
        if (inp && inp.isConnected) return i;
    }
    return -1;
}

function focusSpeedInput(inp) {
    focusBlankInput(inp);
}

window.addEventListener('wheel', () => {
    focusState.lastUserScrollAt = performance.now();
}, { passive: true });
window.addEventListener('touchmove', () => {
    focusState.lastUserScrollAt = performance.now();
}, { passive: true });

function finishSpeedMode() {
    clearSpeedTick();
    clearSpeedHighlight();
    speedState.running = false;
    speedState.activeIndex = -1;
    setSpeedStatus('Режим на швидкість завершено.');
    checkAnswers();
}

function beginSpeedStep() {
    if (!speedState.running) return;
    const idx = findNextSpeedIndex(Math.max(0, speedState.activeIndex));
    if (idx === -1) {
        finishSpeedMode();
        return;
    }

    speedState.activeIndex = idx;
    const inp = speedState.blanks[idx];
    const plannedMs = speedState.slotDurationsMs[idx] ?? speedState.perBlankMs;
    const minSlotMs = speedState.smartMode && inp.classList.contains('math-blank') ? 700 : 400;
    const slotMs = Math.max(minSlotMs, plannedMs + speedState.carryMs);
    speedState.carryMs = 0;
    speedState.deadline = performance.now() + slotMs;

    clearSpeedHighlight();
    inp.classList.remove('incorrect');
    inp.classList.add('speed-active');
    focusSpeedInput(inp);

    const tick = () => {
        if (!speedState.running) return;
        const leftMs = speedState.deadline - performance.now();
        if (leftMs <= 0) {
            clearSpeedTick();
            const id = Number(inp.dataset.index);
            const val = (inp.value || '').trim();
            const expected = hidden[id];
            const updatedFormulas = new Set();
            if (isBlankAnswerCorrect(inp, val, expected) || shouldAcceptLenientAnswer(inp, val, expected, 'timeout')) {
                fillBlankWithAnswer(inp, id, updatedFormulas);
            } else {
                fillBlankWithWrongAttempt(inp, id, val, updatedFormulas);
            }
            speedState.carryMs = 0;
            speedState.activeIndex += 1;
            Promise.resolve(rerenderUpdatedFormulas(updatedFormulas)).finally(() => {
                if (!speedState.running) return;
                beginSpeedStep();
            });
            return;
        }
        const totalSlots = String(speedState.blanks.length);
        const currentSlot = String(idx + 1).padStart(totalSlots.length, '0');
        setSpeedStatus(`На швидкість: ${currentSlot}/${totalSlots} • залишилось ${fmtSecs(leftMs)}`);
    };

    tick();
    clearSpeedTick();
    speedState.tickHandle = setInterval(tick, 100);
}

function submitSpeedBlank() {
    if (!speedState.running) return;
    const inp = speedState.blanks[speedState.activeIndex];
    if (!inp || !inp.isConnected) {
        speedState.activeIndex += 1;
        beginSpeedStep();
        return;
    }

    const id = Number(inp.dataset.index);
    const val = (inp.value || '').trim();
    if (!isBlankAnswerCorrect(inp, val, hidden[id]) && !shouldAcceptLenientAnswer(inp, val, hidden[id], 'general')) {
        const updatedFormulas = new Set();
        const revealed = handleFailedEnterAttempt(inp, id, val, updatedFormulas);
        Promise.resolve(rerenderUpdatedFormulas(updatedFormulas)).finally(() => {
            if (!revealed || !speedState.running) return;
            speedState.carryMs = Math.max(0, speedState.deadline - performance.now());
            speedState.activeIndex += 1;
            beginSpeedStep();
        });
        return;
    }

    const carry = Math.max(0, speedState.deadline - performance.now());
    const updatedFormulas = new Set();
    fillBlankWithAnswer(inp, id, updatedFormulas);
    speedState.carryMs = carry;
    speedState.activeIndex += 1;
    Promise.resolve(rerenderUpdatedFormulas(updatedFormulas)).finally(() => {
        if (!speedState.running) return;
        beginSpeedStep();
    });
}

function startSpeedMode() {
    stopSpeedMode(false);
    if (!chkSpeedMode?.checked) return;

    const minutes = Number(speedMinutesInput?.value);
    const blanks = Array.from(document.querySelectorAll('input.blank'));
    if (!Number.isFinite(minutes) || minutes <= 0) {
        setSpeedStatus('Вкажіть коректну кількість хвилин (> 0).');
        return;
    }
    if (!blanks.length) {
        setSpeedStatus('Немає пропусків для режиму на швидкість.');
        return;
    }

    const totalMs = minutes * 60 * 1000;
    const smartMode = !!chkSmartSpeedCalc?.checked;
    const slotDurationsMs = smartMode
        ? computeSmartSpeedDurations(blanks, totalMs)
        : Array(blanks.length).fill(totalMs / blanks.length);

    speedState.running = true;
    speedState.blanks = blanks;
    speedState.activeIndex = 0;
    speedState.perBlankMs = totalMs / blanks.length;
    speedState.slotDurationsMs = slotDurationsMs;
    speedState.smartMode = smartMode;
    speedState.carryMs = 0;
    beginSpeedStep();
}

refreshSpeedPanel();

// ===== СТАН (те, що зберігаємо між натисканнями) ======================
let hidden = {};     // id -> правильне слово/лексема
let counter = 0;     // лічильник пропусків
let solved = new Set();
let totalBlanks = 0;
let mathFormulas = [];
let mathIdToSlot = new Map();
let revealedWrongInFormula = new Set();
let wrongInputInFormula = new Map();
let failedEnterChecks = new Map();
let lastFailedValues = new Map();
let excludedFromStats = new Set();

// ==== ЗОБРАЖЕННЯ: стан та утиліти ====
let figures = [];     // [{id, el, imgBox, regions:[{key,x,y,w,h,el,hidden}]}]
let figCounter = 0;

const toDataURL = f => new Promise(res => {
    const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f);
});
// Прямокутник, обрізаний рамками картинки [0,W]×[0,H]
function clipRectToBox(rect, W, H) {
    const x1 = Math.max(0, rect.x);
    const y1 = Math.max(0, rect.y);
    const x2 = Math.min(W, rect.x + rect.w);
    const y2 = Math.min(H, rect.y + rect.h);
    return { x1, y1, x2, y2, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) };
}

// Площа видимої частини (після обрізання рамками картинки)
function clippedArea(rect, W, H) {
    const c = clipRectToBox(rect, W, H);
    return c.w * c.h;
}

// Перетин перевіряємо на ОБРІЗАНИХ прямокутниках (доторки дозволені)
function rectsOverlapClipped(a, b, W, H) {
    const A = clipRectToBox(a, W, H);
    const B = clipRectToBox(b, W, H);
    if (A.w <= 0 || A.h <= 0 || B.w <= 0 || B.h <= 0) return false; // нічого не видно → нехай
    return (A.x1 < B.x2 && A.x2 > B.x1 && A.y1 < B.y2 && A.y2 > B.y1);
}

// Підбір одного прямокутника з дозволеним "виходом" за межі
function placeRectWithOverspill(fig, desiredVisibleArea, W, H, overspill = 0.35, maxTries = 200) {
    // overspill=0.35 → дозволяємо до 35% ширини/висоти виходити за межі
    let scale = 1.0;
    for (let t = 0; t < maxTries; t++) {
        // Бажана видима площа може втрачатися через обрізання → компенсуємо scale
        const target = desiredVisibleArea * scale;

        // Випадкове співвідношення сторін, з нього w,h ПЕРЕД обрізанням
        const r = 0.6 + Math.random() * 1.1;           // 0.6..1.7
        let w = Math.sqrt(target * r);
        let h = Math.max(1, target / w);

        // Мін/макс габарити до рандомізації позиції
        w = Math.max(12, Math.round(w));
        h = Math.max(12, Math.round(h));

        // Дозволяємо виходити за межі: випадкова позиція в розширеному діапазоні
        const minX = -overspill * w, maxX = W - (1 - overspill) * w;
        const minY = -overspill * h, maxY = H - (1 - overspill) * h;
        const x = Math.floor(minX + Math.random() * (maxX - minX));
        const y = Math.floor(minY + Math.random() * (maxY - minY));
        const cand = { x, y, w, h };

        // Перевірка неперетину (по видимій частині)
        const ok = fig.regions.every(r => !rectsOverlapClipped(cand, r, W, H));
        if (!ok) {
            if (t === Math.floor(maxTries * 0.5) || t === Math.floor(maxTries * 0.75)) scale *= 0.9; // трохи зменшуємо
            continue;
        }

        // Яка фактична видима площа?
        const vis = clippedArea(cand, W, H);
        if (vis < desiredVisibleArea * 0.8) { // замало — збільшуємо спробою
            scale *= 1.15;
            continue;
        }

        return { ...cand, visible: vis };
    }
    return null;
}

// ----------- ТЕКСТ -------------
// ==== МАТЕМАТИКА: допоміжні (додано) ====
function tokenizeLineWithMarkdown(str, formulas) {
    const FORMULA_PLACEHOLDER = '\u0000';
    const PROTECTED_PLACEHOLDER = '\u0001';
    const out = [];
    let bold = false;
    let buffer = '';

    const flushBuffer = () => {
        if (!buffer) return;
        const parts = buffer.split(/(\s+)/);
        for (const part of parts) {
            if (!part) continue;
            if (/^\s+$/.test(part)) out.push({ type: 'ws', value: part, bold });
            else out.push({ type: 'text', value: part, bold });
        }
        buffer = '';
    };

    for (let i = 0; i < str.length;) {
        if (str.startsWith('**', i)) {
            flushBuffer();
            bold = !bold;
            i += 2;
            continue;
        }
        if (str[i] === PROTECTED_PLACEHOLDER) {
            const end = str.indexOf(PROTECTED_PLACEHOLDER, i + 1);
            if (end !== -1) {
                const idxStr = str.slice(i + 1, end);
                if (/^\d+$/.test(idxStr)) {
                    flushBuffer();
                    const idx = Number(idxStr);
                    out.push({ type: 'protected', value: formulas.protected[idx] || '', bold });
                    i = end + 1;
                    continue;
                }
            }
        }
        if (str[i] === FORMULA_PLACEHOLDER) {
            const end = str.indexOf(FORMULA_PLACEHOLDER, i + 1);
            if (end != -1) {
                const idxStr = str.slice(i + 1, end);
                if (/^\d+$/.test(idxStr)) {
                    flushBuffer();
                    const idx = Number(idxStr);
                    out.push({ type: 'formula', value: formulas.math[idx] || '', bold });
                    i = end + 1;
                    continue;
                }
            }
        }
        buffer += str[i];
        i += 1;
    }
    flushBuffer();
    return out;
}

function tokenizeWithMarkdown(raw) {
    const placeholders = {
        math: [],
        protected: []
    };
    const formulaPlaceholder = '\u0000';
    const protectedPlaceholder = '\u0001';
    const protect = (value) => {
        const idx = placeholders.protected.push(value) - 1;
        return `${protectedPlaceholder}${idx}${protectedPlaceholder}`;
    };

    // Ignore fenced TikZ blocks entirely (```tikz ... ```).
    let text = raw.replace(/```[ \t]*tikz[^\r\n]*\r?\n[\s\S]*?\r?\n```/gi, protect);
    // Ignore raw TikZ environments entirely (\begin{tikz...} ... \end{tikz...}).
    text = text.replace(/\\begin\{tikz[^}]*\}[\s\S]*?\\end\{tikz[^}]*\}/g, protect);
    text = text.replace(/(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$)/g, (m) => {
        const idx = placeholders.math.push(m) - 1;
        return `${formulaPlaceholder}${idx}${formulaPlaceholder}`;
    });

    const lines = text.split(/\r?\n/);
    const out = [];
    lines.forEach((line, idx) => {
        const headingMatch = line.match(/^\s*(#{1,6})\s+(.*)$/);
        const level = headingMatch ? headingMatch[1].length : 0;
        const isHeading = level > 0;
        const content = isHeading ? headingMatch[2] : line;
        if (isHeading) out.push({ type: 'headingStart', level });
        out.push(...tokenizeLineWithMarkdown(content, placeholders));
        if (isHeading) out.push({ type: 'headingEnd', level });
        if (idx < lines.length - 1) out.push({ type: 'linebreak', value: '\n' });
    });
    return out;
}

const TIKZ_FENCED_BLOCK_RE = /^```[ \t]*tikz[^\r\n]*\r?\n([\s\S]*?)\r?\n```[ \t]*$/i;
const TIKZ_ENV_BLOCK_RE = /^\\begin\{tikz[^}]*\}[\s\S]*\\end\{tikz[^}]*\}$/;
const TIKZ_ANY_ENV_RE = /\\begin\{(tikzpicture|tikzcd|circuitikz)\}/i;
const TEX_DOCUMENT_RE = /\\begin\{document\}/i;
const TEX_DOCUMENT_BLOCK_RE = /\\begin\{document\}([\s\S]*?)\\end\{document\}/i;
const USE_TIKZ_LIBRARY_RE = /\\usetikzlibrary\{([^}]+)\}/g;
const USE_PACKAGE_RE = /\\usepackage(?:\[(.*?)\])?\{([^}]+)\}/g;
const ROD2IK_TIKZJAX_URL = 'https://cdn.jsdelivr.net/npm/@rod2ik/tikzjax@1.0.0-beta32/dist/tikzjax.js';
const ROD2IK_FONTS_URL = 'https://cdn.jsdelivr.net/npm/@rod2ik/tikzjax@1.0.0-beta32/dist/fonts.css';
const TIKZ_ENGINE_LOAD_TIMEOUT_MS = 12000;
const TIKZ_STUCK_LOADER_TIMEOUT_MS = 10000;
const TIKZ_MAX_TOTAL_WAIT_MS = 30000;
let rod2ikTikzjaxLoadPromise = null;

function normalizeTikzSource(source) {
    let trimmed = String(source || '').trim();
    if (!trimmed) return trimmed;

    // This TikZ engine wraps input into \begin{document}...\end{document} itself.
    // Strip user-provided document wrapper to avoid nested document environments,
    // but keep any preamble lines such as \usepackage or \usetikzlibrary.
    const docMatch = trimmed.match(TEX_DOCUMENT_BLOCK_RE);
    if (docMatch) {
        const preamble = trimmed.slice(0, docMatch.index).trim();
        const body = (docMatch[1] || '').trim();
        trimmed = [preamble, body].filter(Boolean).join('\n\n').trim();
    } else if (TEX_DOCUMENT_RE.test(trimmed)) {
        trimmed = trimmed
            .replace(/\\begin\{document\}/gi, '')
            .replace(/\\end\{document\}/gi, '')
            .trim();
    }

    if (TIKZ_ANY_ENV_RE.test(trimmed)) return trimmed;
    return `\\begin{tikzpicture}\n${trimmed}\n\\end{tikzpicture}`;
}

function extractTikzSource(blockText) {
    if (typeof blockText !== 'string') return null;
    const trimmed = blockText.trim();
    if (!trimmed) return null;

    const fenced = trimmed.match(TIKZ_FENCED_BLOCK_RE);
    if (fenced) return normalizeTikzSource(fenced[1]);
    if (TIKZ_ENV_BLOCK_RE.test(trimmed)) return normalizeTikzSource(trimmed);
    return null;
}

function parseCsv(value) {
    return String(value || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

function getActiveTikzEngine() {
    if (window.TikzJax) return 'rod2ik';
    if (typeof window.TikZJax === 'function') return 'official';
    return 'none';
}

function ensureRod2ikTikzJaxLoaded() {
    if (window.TikzJax) return Promise.resolve(true);
    if (rod2ikTikzjaxLoadPromise) return rod2ikTikzjaxLoadPromise;

    rod2ikTikzjaxLoadPromise = new Promise((resolve, reject) => {
        let settled = false;
        const finish = (fn, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            fn(value);
        };
        const timeoutId = setTimeout(() => {
            finish(reject, new Error('Timed out while loading Rod2ik TikZJax.'));
        }, TIKZ_ENGINE_LOAD_TIMEOUT_MS);

        if (!document.querySelector(`link[href="${ROD2IK_FONTS_URL}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = ROD2IK_FONTS_URL;
            document.head.appendChild(link);
        }

        const existing = document.querySelector(`script[src="${ROD2IK_TIKZJAX_URL}"]`);
        const onReady = () => {
            if (window.TikzJax) finish(resolve, true);
            else finish(reject, new Error('Rod2ik TikZJax failed to initialize.'));
        };
        if (existing) {
            if (window.TikzJax) {
                finish(resolve, true);
                return;
            }
            existing.addEventListener('load', onReady, { once: true });
            existing.addEventListener('error', () => finish(reject, new Error('Failed to load Rod2ik TikZJax.')), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = ROD2IK_TIKZJAX_URL;
        script.async = true;
        script.onload = onReady;
        script.onerror = () => finish(reject, new Error('Failed to load Rod2ik TikZJax.'));
        document.head.appendChild(script);
    }).catch((err) => {
        rod2ikTikzjaxLoadPromise = null;
        throw err;
    });

    return rod2ikTikzjaxLoadPromise;
}

function extractScriptOptions(source) {
    USE_TIKZ_LIBRARY_RE.lastIndex = 0;
    USE_PACKAGE_RE.lastIndex = 0;

    const libs = new Set();
    const packages = {};
    let match;

    while ((match = USE_TIKZ_LIBRARY_RE.exec(source)) !== null) {
        parseCsv(match[1]).forEach((lib) => libs.add(lib));
    }
    USE_TIKZ_LIBRARY_RE.lastIndex = 0;

    while ((match = USE_PACKAGE_RE.exec(source)) !== null) {
        const options = (match[1] || '').trim();
        parseCsv(match[2]).forEach((pkg) => {
            if (!(pkg in packages)) packages[pkg] = options;
        });
    }
    USE_PACKAGE_RE.lastIndex = 0;

    // Auto-enable commonly needed packages/libraries if their environments appear.
    if (/>=\s*stealth\b/i.test(source) && !libs.has('arrows.meta')) libs.add('arrows.meta');
    if (/\\begin\{axis\}|\\addplot/i.test(source) && !('pgfplots' in packages)) packages.pgfplots = '';
    if (/\\begin\{tikzcd\}/i.test(source) && !('tikz-cd' in packages)) packages['tikz-cd'] = '';
    if (/\\begin\{circuitikz\}/i.test(source) && !('circuitikz' in packages)) packages.circuitikz = '';
    if (/\\chemfig|\\schemestart/i.test(source) && !('chemfig' in packages)) packages.chemfig = '';

    return {
        source: source
            .replace(USE_TIKZ_LIBRARY_RE, '')
            .replace(USE_PACKAGE_RE, '')
            .trim(),
        tikzLibraries: Array.from(libs),
        texPackages: packages
    };
}

function sanitizeTikzSourceForRetry(source) {
    return String(source || '')
        .split(/\r?\n/)
        .map((line) => line.replace(/%.*$/, ''))
        .join('\n')
        .replace(/>=\s*stealth\b/gi, '>=Stealth')
        .replace(/[ \t]+\n/g, '\n')
        .trim();
}

function buildTikzRetryVariants(source) {
    const base = String(source || '').trim();
    if (!base) return [];

    const variants = [];
    const pushUnique = (s) => {
        const v = String(s || '').trim();
        if (!v) return;
        if (!variants.includes(v)) variants.push(v);
    };

    const sanitized = sanitizeTikzSourceForRetry(base);
    pushUnique(base);
    pushUnique(sanitized);
    // Drop >=... arrow tip key if engine doesn't support the selected style.
    pushUnique(sanitized.replace(/>=\s*[^,\]\r\n]+,?\s*/gi, ''));
    // Drop tikzpicture options entirely as last visual-degradation fallback.
    pushUnique(sanitized.replace(/(\\begin\{tikzpicture\})\[[^\]]*\]/i, '$1'));

    return variants;
}

function createTikzScriptElement(source) {
    const engine = getActiveTikzEngine();
    const script = document.createElement('script');
    script.type = 'text/tikz';
    script.dataset.showConsole = 'true';
    if (engine === 'rod2ik') {
        const options = extractScriptOptions(source);
        const finalSource = options.source || source;
        script.textContent = finalSource;
        if (options.tikzLibraries.length) {
            script.dataset.tikzLibraries = options.tikzLibraries.join(',');
        }
        if (Object.keys(options.texPackages).length) {
            script.dataset.texPackages = JSON.stringify(options.texPackages);
        }
        return { script, finalSource };
    }
    script.textContent = source;
    return { script, finalSource: source };
}

function isLikelyBrokenTikzImage(img) {
    if (!img) return false;
    const src = String(img.getAttribute('src') || '');
    if (/invalid\.site/i.test(src)) return true;
    return img.complete && img.naturalWidth === 0;
}

function ensureTikzLoadingState(block) {
    if (!block) return;
    const now = Date.now();
    block.classList.add('tikz-pending');
    block.classList.remove('tikz-ready');
    if (!block.dataset.tikzLoadStartedAt) {
        block.dataset.tikzLoadStartedAt = String(now);
    }
    if (!block.dataset.tikzFirstLoadStartedAt) {
        block.dataset.tikzFirstLoadStartedAt = String(now);
    }
    let loader = block.querySelector('.tikz-loading');
    if (!loader) {
        loader = document.createElement('div');
        loader.className = 'tikz-loading';
        loader.textContent = 'TikZ: рендеринг...';
        block.prepend(loader);
    }
}

function setTikzReadyState(block) {
    if (!block) return;
    block.classList.remove('tikz-pending');
    block.classList.add('tikz-ready');
    delete block.dataset.tikzLoadStartedAt;
    delete block.dataset.tikzFirstLoadStartedAt;
    block.querySelectorAll('.tikz-loading').forEach((el) => el.remove());
}

function isLikelyTikzLoaderSvg(svg) {
    if (!svg || svg.tagName?.toLowerCase() !== 'svg') return false;
    if (svg.classList.contains('tikzjax') || svg.classList.contains('tikz')) return false;
    if (svg.querySelector('animate')) return true;
    const width = String(svg.getAttribute('width') || '');
    const height = String(svg.getAttribute('height') || '');
    return /75pt/i.test(width) && /75pt/i.test(height);
}

function decodeDataSvgPayload(src) {
    if (!/^data:image\/svg\+xml/i.test(src)) return '';
    const commaIdx = src.indexOf(',');
    if (commaIdx < 0) return '';
    const meta = src.slice(0, commaIdx);
    const payload = src.slice(commaIdx + 1);
    try {
        if (/;base64/i.test(meta)) return atob(payload);
        return decodeURIComponent(payload);
    } catch {
        return '';
    }
}

function isLikelyTikzLoaderImg(img) {
    if (!img || img.tagName?.toLowerCase() !== 'img') return false;
    const src = String(img.getAttribute('src') || img.src || '');
    if (!src) return false;

    const inlineSvg = decodeDataSvgPayload(src);
    const haystack = `${src}\n${inlineSvg}`;
    if (!/^data:image\/svg\+xml/i.test(src) && !inlineSvg) return false;

    const hasSpinnerMarkers = /animate(?:Transform)?|stroke-dasharray|stroke-dashoffset/i.test(haystack);
    if (!hasSpinnerMarkers) return false;
    if (/viewbox=["']?0 0 75 75|75pt/i.test(haystack)) return true;

    const w = Number(img.naturalWidth || img.width || 0);
    const h = Number(img.naturalHeight || img.height || 0);
    return w > 0 && h > 0 && w <= 90 && h <= 90;
}

function refreshTikzBlockStates(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('.tikz-block').forEach((block) => {
        const hasScript = !!block.querySelector('script[type="text/tikz"]');
        const svg = block.querySelector('svg');
        const img = block.querySelector('img');
        const hasLoaderSvg = isLikelyTikzLoaderSvg(svg);
        const hasLoaderImg = isLikelyTikzLoaderImg(img);
        const hasFinalRender = !!block.querySelector('svg.tikz, svg.tikzjax') || (!!img && !hasLoaderImg);
        if (hasScript || hasLoaderSvg || hasLoaderImg) {
            ensureTikzLoadingState(block);
            return;
        }
        if (!hasScript && hasFinalRender) {
            setTikzReadyState(block);
        }
    });
}

function getTikzRetryVariants(block) {
    let variants = [];
    try {
        variants = JSON.parse(block.dataset.tikzVariants || '[]');
    } catch {
        variants = [];
    }
    if (!variants.length) {
        const original = block.dataset.tikzOriginal || block.dataset.tikzSource || '';
        variants = buildTikzRetryVariants(original);
        block.dataset.tikzVariants = JSON.stringify(variants);
    }
    return variants;
}

function retryTikzBlockWithNextVariant(block, root) {
    const variants = getTikzRetryVariants(block);
    const idx = Number(block.dataset.tikzRetryIndex || '0');
    if (idx + 1 >= variants.length) return false;
    const retrySource = variants[idx + 1];
    if (!retrySource) return false;

    block.dataset.tikzRetryIndex = String(idx + 1);
    const { script, finalSource } = createTikzScriptElement(retrySource);
    block.dataset.tikzSource = finalSource;
    block.replaceChildren(script);
    block.dataset.errorShown = '0';
    block.dataset.tikzLoadStartedAt = String(Date.now());
    ensureTikzLoadingState(block);
    setTimeout(() => renderTikzBlocks(root), 50);
    return true;
}

function showTikzBlockError(block, message) {
    if (!block || block.dataset.errorShown === '1') return;
    block.dataset.errorShown = '1';
    block.classList.remove('tikz-pending', 'tikz-ready');
    delete block.dataset.tikzLoadStartedAt;
    delete block.dataset.tikzFirstLoadStartedAt;

    const msg = document.createElement('div');
    msg.className = 'tikz-error';
    msg.textContent = message || 'TikZ compile failed after all retries. Check syntax in this block.';
    block.replaceChildren(msg);

    const src = block.dataset.tikzOriginal || block.dataset.tikzSource || '';
    if (!src) return;
    const pre = document.createElement('pre');
    pre.className = 'tikz-source';
    pre.textContent = src;
    block.appendChild(pre);
}

function replaceTikzErrorImages(root) {
    if (!root || !root.querySelectorAll) return;

    root.querySelectorAll('.tikz-block img').forEach((img) => {
        if (!isLikelyBrokenTikzImage(img)) return;
        const block = img.closest('.tikz-block');
        if (!block) return;
        if (retryTikzBlockWithNextVariant(block, root)) return;
        showTikzBlockError(block, 'TikZ compile failed after all retries. Check syntax in this block.');
    });
}

function replaceStuckTikzLoaders(root, timeoutMs = 10000) {
    if (!root || !root.querySelectorAll) return;
    const now = Date.now();
    root.querySelectorAll('.tikz-block').forEach((block) => {
        const svg = block.querySelector('svg');
        const img = block.querySelector('img');
        const hasLoader = isLikelyTikzLoaderSvg(svg) || isLikelyTikzLoaderImg(img);
        if (!hasLoader) return;
        const started = Number(block.dataset.tikzLoadStartedAt || '0');
        const firstStarted = Number(block.dataset.tikzFirstLoadStartedAt || started || '0');
        if (!started) {
            block.dataset.tikzLoadStartedAt = String(now);
            if (!block.dataset.tikzFirstLoadStartedAt) block.dataset.tikzFirstLoadStartedAt = String(now);
            return;
        }
        if (firstStarted && now - firstStarted >= TIKZ_MAX_TOTAL_WAIT_MS) {
            showTikzBlockError(block, 'TikZ rendering timed out. Check syntax in this block.');
            return;
        }
        if (now - started < timeoutMs) return;
        if (retryTikzBlockWithNextVariant(block, root)) return;
        showTikzBlockError(block, 'TikZ rendering timed out. Check syntax in this block.');
    });
}

function scheduleTikzErrorChecks(root, checksLeft = 40) {
    if (!root || !root.querySelector) return;
    refreshTikzBlockStates(root);
    replaceTikzErrorImages(root);
    replaceStuckTikzLoaders(root, TIKZ_STUCK_LOADER_TIMEOUT_MS);
    if (checksLeft <= 0) return;
    setTimeout(() => scheduleTikzErrorChecks(root, checksLeft - 1), 500);
}

function replaceUnprocessedTikzScripts(root, message = 'TikZ compile failed after all retries. Check syntax in this block.') {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('script[type="text/tikz"]').forEach((script) => {
        const src = String(script.textContent || '').trim();
        const hostBlock = script.closest('.tikz-block');
        if (hostBlock) {
            hostBlock.dataset.tikzSource = src;
            showTikzBlockError(hostBlock, message);
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'tikz-block';
        wrapper.dataset.tikzSource = src;
        wrapper.dataset.tikzOriginal = src;
        wrapper.dataset.errorShown = '0';
        showTikzBlockError(wrapper, message);
        script.replaceWith(wrapper);
    });
}

function armPendingTikzScriptWatch(root, delayMs = 7000) {
    if (!root || !root.querySelector) return;
    if (root.dataset.tikzPendingWatch === '1') return;
    root.dataset.tikzPendingWatch = '1';
    setTimeout(() => {
        root.dataset.tikzPendingWatch = '0';
        if (!root.isConnected) return;
        if (!root.querySelector('script[type="text/tikz"]')) return;
        if (root.dataset.tikzFallbackTried === '1') {
            replaceUnprocessedTikzScripts(root);
            return;
        }
        root.dataset.tikzFallbackTried = '1';
        ensureRod2ikTikzJaxLoaded()
            .then(() => {
                renderTikzBlocks(root, 4);
            })
            .catch((err) => {
                console.error('TikZ fallback renderer failed to load:', err);
                replaceUnprocessedTikzScripts(root, 'TikZ renderer failed to load.');
            });
    }, delayMs);
}

function appendProtectedToken(target, tokenValue, isBold, appendTextWithBold) {
    const tikzSource = extractTikzSource(tokenValue);
    if (!tikzSource) {
        appendTextWithBold(target, tokenValue, isBold);
        return;
    }
    const { script, finalSource } = createTikzScriptElement(tikzSource);

    const block = document.createElement('div');
    block.className = 'tikz-block';
    block.dataset.tikzOriginal = finalSource;
    block.dataset.tikzSource = finalSource;
    block.dataset.tikzVariants = JSON.stringify(buildTikzRetryVariants(finalSource));
    block.dataset.tikzRetryIndex = '0';
    block.appendChild(script);
    ensureTikzLoadingState(block);
    target.appendChild(block);
}

function renderTikzBlocks(root, attemptsLeft = 10) {
    if (!root || !root.querySelector) return;
    refreshTikzBlockStates(root);
    const hasPendingScripts = !!root.querySelector('script[type="text/tikz"]');
    if (!hasPendingScripts) {
        replaceTikzErrorImages(root);
        refreshTikzBlockStates(root);
        root.dataset.tikzPendingWatch = '0';
        return;
    }

    // @planktimerr/tikzjax auto-processes new <script type="text/tikz"> via MutationObserver.
    if (window.TikzJax) {
        scheduleTikzErrorChecks(root, 120);
        armPendingTikzScriptWatch(root, 9000);
        return;
    }

    // Backward-compat fallback for original TikZJax API.
    if (typeof window.TikZJax !== 'function') {
        if (attemptsLeft > 0) {
            setTimeout(() => renderTikzBlocks(root, attemptsLeft - 1), 250);
        } else {
            console.warn('TikZJax is not loaded; TikZ blocks were not rendered.');
            if (root.dataset.tikzFallbackTried === '1') {
                replaceUnprocessedTikzScripts(root, 'TikZ renderer is unavailable (CDN load failed).');
                return;
            }
            root.dataset.tikzFallbackTried = '1';
            ensureRod2ikTikzJaxLoaded()
                .then(() => {
                    renderTikzBlocks(root, 4);
                })
                .catch((err) => {
                    console.error('TikZ fallback renderer failed to load:', err);
                    replaceUnprocessedTikzScripts(root, 'TikZ renderer is unavailable (CDN load failed).');
                });
        }
        return;
    }

    Promise.resolve(window.TikZJax(root))
        .catch((err) => {
            console.error('TikZ render failed:', err);
        })
        .finally(() => {
            scheduleTikzErrorChecks(root, 80);
            armPendingTikzScriptWatch(root, 7000);
        });
}

document.addEventListener('tikzjax-load-finished', (ev) => {
    const target = ev?.target;
    if (!target || !target.closest) return;
    const block = target.closest('.tikz-block');
    if (!block) return;
    setTikzReadyState(block);
});

function escapeTexText(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\textbackslash{}')
        .replace(/([{}#$%&_])/g, '\\$1')
        .replace(/\^/g, '\\textasciicircum{}')
        .replace(/~/g, '\\textasciitilde{}');
}

const ARGUMENT_COMMANDS = new Set([
    '\\frac', '\\sqrt', '\\overset', '\\underset', '\\textcolor', '\\color', '\\text',
    '\\operatorname', '\\mathbb', '\\mathrm', '\\mathbf', '\\mathit',
    '\\left', '\\right', '\\begin', '\\end', '\\cancel',
    '\\underline', '\\overline', '\\hat', '\\bar', '\\tilde', '\\vec',
    '\\overrightarrow', '\\overleftarrow', '\\widehat', '\\widetilde',
    '\\phantom', '\\hphantom', '\\vphantom'
]);

function formatMathTokenForReveal(value) {
    const token = String(value ?? '');
    if (/^\\[A-Za-z]+$/.test(token) && ARGUMENT_COMMANDS.has(token)) {
        return `\\text{${escapeTexText(token)}}`;
    }
    return token;
}

function makeWrongRevealTex(correctValue, wrongValue) {
    const wrongEscaped = escapeTexText(wrongValue || EMPTY_INPUT_MARK);
    const safeCorrect = formatMathTokenForReveal(correctValue);
    return `\\overset{\\textcolor{red}{\\cancel{\\text{${wrongEscaped}}}}}{\\textcolor{lime}{${safeCorrect}}}`;
}

function renderFormula(formula) {
    const parts = formula.slots.map((slot) => {
        if (slot.type === 'lex') return slot.value;
        const safeValue = formatMathTokenForReveal(slot.value);
        return solved.has(slot.id)
            ? `\\textcolor{lime}{${safeValue}}`
            : revealedWrongInFormula.has(slot.id)
                ? makeWrongRevealTex(safeValue, wrongInputInFormula.get(slot.id))
                : makePlaceholder(slot.id, slot.value, slot.prevLex);
    });
    formula.span.textContent = formula.delim + parts.join('') + formula.delim;
}

/* команди, які не чіпаємо (додано) */
const RESERVED = new Set([
    '\\frac', '\\sqrt', '\\sum', '\\int', '\\log', '\\sin', '\\cos', '\\tan',
    '\\left', '\\right', '\\big', '\\Big', '\\bigl', '\\bigr', '\\Bigl', '\\Bigr',
    '\\begin', '\\end', '\\bmatrix', '\\pmatrix', '\\vmatrix', '\\cases',
    '\\text', '\\mathbb', '\\mathrm', '\\operatorname', '\\vec',
    '&', '\\\\'
]);

// Плейсхолдер для формул (додано)
function makePlaceholder(idx, original, prevLex) {
    const src = String(original || '');
    const isCmd = /^\\[A-Za-z]+$/.test(src);
    let phantomArg = isCmd ? 'MMM' : src;
    if (!/^[A-Za-z0-9]+$/.test(phantomArg)) phantomArg = 'M';

    const ACCENTS = new Set(['\\vec', '\\hat', '\\bar', '\\tilde', '\\overline', '\\overrightarrow', '\\overleftarrow', '\\widehat', '\\widetilde']);
    const isAccent = ACCENTS.has(String(prevLex || ''));

    if (isAccent) {
        const inner = `\\textcolor{red}{(${idx})\\,\\underline{\\hphantom{${phantomArg}}}}\\vphantom{M}`;
        return `{${inner}}`;
    }
    const inner = `\\textcolor{red}{(${idx})\\;\\underline{\\hphantom{${phantomArg}}}}`;
    return `{${inner}}`;
}

// Вирізає обрамлення й пунктуацію з обох боків слова, але повертає їх окремо
function splitWord(token, ignorePunct) {
    const str = String(token ?? "");
    let leadMatch;
    let trailMatch;
    if (ignorePunct) {
        leadMatch = str.match(/^[\p{P}\p{S}]+/u);
        trailMatch = str.match(/[\p{P}\p{S}]+$/u);
    } else {
        leadMatch = str.match(/^(["'`*_«»(){}\[\]<>]+)+/u);
        trailMatch = str.match(/(["'`*_«»(){}\[\]<>]+|[.,!?:%]+)+$/u);
    }
    const lead = leadMatch ? leadMatch[0] : "";
    const trail = trailMatch ? trailMatch[0] : "";
    const core = str.slice(lead.length, str.length - trail.length);
    return { lead, core, trail };
}

// Головне: згенерувати пропуски
function generateCloze() {
    const raw = document.getElementById('text').value;
    const percent = +document.getElementById('percent').value || 0;
    const out = document.getElementById('output');
    const res = document.getElementById('result');
    const mathOn = !!document.getElementById('processMath')?.checked;
    const noHideCmds = !!document.getElementById('noHideMathCommands')?.checked;
    const ignorePunctuation = !!document.getElementById('ignorePunctuation')?.checked;
    stopSpeedMode();
    stopSpeechRecognition();

    // Таймер: авто-старт, скидання часу
    if (chkAutoStart.checked) { resetTimer(); startTimer(); }

    // скидаємо попередній стан/вивід
    out.innerHTML = '';
    delete out.dataset.tikzPendingWatch;
    delete out.dataset.tikzFallbackTried;
    res.textContent = '';
    hidden = {};
    counter = 0;
    solved = new Set();
    totalBlanks = 0;
    mathFormulas = [];
    mathIdToSlot = new Map();
    revealedWrongInFormula = new Set();
    wrongInputInFormula = new Map();
    failedEnterChecks = new Map();
    lastFailedValues = new Map();
    excludedFromStats = new Set();

    if (!raw.trim()) {
        scheduleSpeechSync(0);
        return;
    }

    // НОВЕ: токени з урахуванням $...$/$$...$$ + збереження пробілів/переносів
    const tokens = tokenizeWithMarkdown(raw);

    // Для текстових пропусків — беремо лише текстові токени (не формули і не пробіли)
    const textIdx = [];
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].type === 'text') textIdx.push(i);
    }
    const howManyText = Math.max(0, Math.round(textIdx.length * percent / 100));
    // випадково обираємо абсолютні індекси з textIdx
    const pool = textIdx.slice();
    const chosenAbs = new Set();
    while (chosenAbs.size < howManyText && pool.length) {
        const k = Math.random() * pool.length | 0;
        chosenAbs.add(pool.splice(k, 1)[0]);
    }

    let container = out;
    let headingEl = null;

    const appendWithBold = (target, node, isBold) => {
        if (!isBold) {
            target.appendChild(node);
            return;
        }
        const strong = document.createElement('strong');
        strong.appendChild(node);
        target.appendChild(strong);
    };

    const appendTextWithBold = (target, text, isBold) => {
        if (!isBold) {
            target.appendChild(document.createTextNode(text));
            return;
        }
        const strong = document.createElement('strong');
        strong.textContent = text;
        target.appendChild(strong);
    };

    tokens.forEach((tok, i) => {
        if (tok.type === 'headingStart') {
            const level = Math.max(1, Math.min(6, Number(tok.level) || 3));
            headingEl = document.createElement(`h${level}`);
            container = headingEl;
            return;
        }
        if (tok.type === 'headingEnd') {
            if (headingEl) out.appendChild(headingEl);
            headingEl = null;
            container = out;
            return;
        }
        if (tok.type === 'linebreak') {
            out.appendChild(document.createTextNode(tok.value || '\n'));
            return;
        }
        if (tok.type === 'ws') {
            appendTextWithBold(container, tok.value, !!tok.bold);
            return;
        }
        if (tok.type === 'protected') {
            appendProtectedToken(container, tok.value, !!tok.bold, appendTextWithBold);
            return;
        }

        // === FORMULA ===
        if (tok.type === 'formula') {
            const tStr = tok.value;
            const span = document.createElement('span');
            span.className = 'word formula';

            if (!mathOn) {
                // лишаємо як є
                span.textContent = tStr;
                appendWithBold(container, span, !!tok.bold);
                return;
            }

            const delim = tStr.startsWith('$$') ? '$$' : '$';
            const core = tStr.slice(delim.length, -delim.length);

            // Розбір у лексеми
            // після:
            let lex = core.match(
                /(\\\\|\\[A-Za-z]+|\\\{|\\\}|[A-Za-z]+|\d+|[=+\-*/^_:&|<>]|[{}\[\]()]|\\,|\\;|\\!|,|\.|\\%|!|['\u2032\u2033\u2034\u00B4\u02B9\u02BC\u2019]|\s+|.)/gsu
            ) || [core];

            // ДОДАНО: зібрати \\text{...} у єдиний токен (не ховаємо всередині)
            function mergeTextGroups(tokens) {
                const out = [];
                for (let i = 0; i < tokens.length; i++) {
                    const t = tokens[i];
                    if (t === '\\text' && tokens[i + 1] === '{') {
                        let j = i + 2, depth = 1;
                        let buf = ['\\text', '{'];
                        while (j < tokens.length && depth > 0) {
                            const s = tokens[j++];
                            buf.push(s);
                            if (s === '{') depth++;
                            else if (s === '}') depth--;
                        }
                        out.push(buf.join(''));
                        i = j - 1; // перестрибуємо до закривної дужки
                    } else {
                        out.push(t);
                    }
                }
                return out;
            }
            lex = mergeTextGroups(lex);


            // Що можна ховати
            const hideable = [];
            for (let k = 0; k < lex.length; k++) {
                const lx = lex[k];
                const isCmd = /^\\[a-zA-Z]+$/.test(lx);
                const needsArgument = isCmd && ARGUMENT_COMMANDS.has(lx);
                const isTextGroup = typeof lx === 'string' && lx.startsWith('\\text{');
                const ok = !isTextGroup && (
                    (isCmd && !needsArgument && !RESERVED.has(lx) && lx.length <= 16 && !noHideCmds) ||
                    (!isCmd && /^[a-zA-Z]$/.test(lx)) ||
                    (!isCmd && /^\d+$/.test(lx))
                );
                if (ok) hideable.push(k);
            }

            const maxFormBlanks = Math.round(hideable.length * percent / 100);
            const chosenK = new Set();
            while (chosenK.size < maxFormBlanks && hideable.length) {
                chosenK.add(hideable.splice(Math.random() * hideable.length | 0, 1)[0]);
            }

            // Збирання назад із плейсхолдерами
            const formulaObj = { span, delim, slots: [] };
            const answers = document.createElement('div');
            answers.className = 'formula-answers';
            for (let k = 0; k < lex.length; k++) {
                const lx = lex[k];
                if (chosenK.has(k)) {
                    ++counter; hidden[counter] = lx;
                    const prev = lex[k - 1] || '';
                    const slot = { type: 'blank', id: counter, value: lx, prevLex: prev };
                    formulaObj.slots.push(slot);
                    mathIdToSlot.set(counter, { formula: formulaObj, slot });

                    // додати відповідний інпут поруч з формулою
                    const lab = document.createElement('label');
                    lab.innerHTML = `(${counter}) <input class="blank math-blank" data-index="${counter}">`;
                    answers.appendChild(lab);
                } else {
                    formulaObj.slots.push({ type: 'lex', value: lx });
                }
            }

            renderFormula(formulaObj);
            mathFormulas.push(formulaObj);
            if (answers.children.length) {
                const row = document.createElement('div');
                row.className = 'formula-row';
                if (tok.bold) {
                    const strong = document.createElement('strong');
                    strong.appendChild(span);
                    row.appendChild(strong);
                } else {
                    row.appendChild(span);
                }
                row.appendChild(answers);
                container.appendChild(row);
            } else {
                appendWithBold(container, span, !!tok.bold);
            }
            return;
        }

        // === ЗВИЧАЙНЕ СЛОВО (НЕ формула) ===
        const tStr = tok.value;
        const { lead, core, trail } = splitWord(tStr, ignorePunctuation);
        const span = document.createElement('span');
        span.className = 'word';

        if (chosenAbs.has(i) && core.length > 0) {
            counter++;
            hidden[counter] = core;

            if (lead) span.appendChild(document.createTextNode(lead));
            const inp = document.createElement('input');
            inp.className = 'blank';
            inp.dataset.index = String(counter);
            inp.setAttribute('aria-label', 'Пропуск ' + counter);
            span.appendChild(inp);
            if (trail) span.appendChild(document.createTextNode(trail));
        } else {
            span.textContent = tStr;
        }

        appendWithBold(container, span, !!tok.bold);
    });

    totalBlanks = counter;

    // Рендер формул після модифікації
    if (window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise([out]);
    }
    renderTikzBlocks(out);

    // Після генерації текстових/математичних пропусків — згенерувати "дірки" на зображеннях (якщо ввімкнено)
    autoOccludeAll();
    if (chkSpeedMode?.checked) startSpeedMode();
    if (isSpeechModeEnabled()) scheduleSpeechSync(0);
}

// Перевірка відповідей
function legacyCheckAnswers() {
    if (speedState.running) stopSpeedMode(false);
    const inputs = document.querySelectorAll('input.blank');
    let ok = solved.size;
    const total = totalBlanks || inputs.length;
    const updatedFormulas = new Set();

    inputs.forEach(inp => {
        const id = +inp.dataset.index;
        const val = (inp.value || '').trim();
        if (isBlankAnswerCorrect(inp, val, hidden[id]) || shouldAcceptLenientAnswer(inp, val, hidden[id], 'general')) {
            ok++;
            fillBlankWithAnswer(inp, id, updatedFormulas);
        } else {
            inp.classList.add('incorrect');
            inp.classList.remove('correct');
        }
    });

    rerenderUpdatedFormulas(updatedFormulas);

    if (chkAutoStop.checked) pauseTimer();
    document.getElementById('result').textContent = formatResultText(ok, total);
}

// Завантаження зображень
function checkAnswers(options = {}) {
    const {
        onlyInput = null,
        trackEnterChecks = false,
        moveFocusForward = false,
        forceMoveFocusForwardOnFailure = false
    } = options;

    if (speedState.running) stopSpeedMode(false);

    const allInputs = Array.from(document.querySelectorAll('input.blank'));
    const inputs = onlyInput ? [onlyInput] : allInputs;
    const updatedFormulas = new Set();

    inputs.forEach((inp) => {
        if (!inp || !inp.isConnected) return;
        const id = Number(inp.dataset.index);
        if (!Number.isFinite(id) || excludedFromStats.has(id)) return;

        const val = (inp.value || '').trim();
        if (isBlankAnswerCorrect(inp, val, hidden[id]) || shouldAcceptLenientAnswer(inp, val, hidden[id], 'general')) {
            const nextInp = moveFocusForward ? findNextBlankInput(inp) : null;
            fillBlankWithAnswer(inp, id, updatedFormulas);
            if (nextInp) focusBlankInput(nextInp);
            return;
        }

        const nextInp = moveFocusForward ? findNextBlankInput(inp) : null;
        if (!trackEnterChecks) {
            inp.classList.add('incorrect');
            inp.classList.remove('correct');
            if (forceMoveFocusForwardOnFailure && nextInp) focusBlankInput(nextInp);
            return;
        }

        const revealed = handleFailedEnterAttempt(inp, id, val, updatedFormulas);
        if ((revealed || forceMoveFocusForwardOnFailure) && nextInp) focusBlankInput(nextInp);
    });

    rerenderUpdatedFormulas(updatedFormulas);

    if (chkAutoStop.checked) pauseTimer();
    updateResultLine(allInputs.length);
    if (isSpeechModeEnabled()) scheduleSpeechSync(0);
}

document.getElementById('imgInput').addEventListener('change', (e) => {
    if (!e.target.files?.length) return;
    addImages([...e.target.files]);
    e.target.value = ''; // очистити input
});

// Якщо міняємо "Складність" — і хочемо одразу бачити нову конфігурацію "дір"
document.getElementById('percent').addEventListener('input', () => {
    autoOccludeAll();
});
// ОКРЕМА складність зображень
document.getElementById('imgPercent').addEventListener('input', () => {
    autoOccludeAll();
});
// Вкл/викл авто-оклюзії
document.getElementById('imgAuto').addEventListener('change', () => {
    autoOccludeAll();
});

// Події на кнопках
document.getElementById('btnGen').addEventListener('click', generateCloze);
document.getElementById('btnCheck').addEventListener('click', checkAnswers);
chkSpeedMode?.addEventListener('change', () => {
    refreshSpeedPanel();
    if (!chkSpeedMode.checked) {
        stopSpeedMode();
        if (isSpeechModeEnabled()) scheduleSpeechSync(0);
        return;
    }
    stopSpeechRecognition('Голосовий режим вимкнений під час speed mode.', 'error');
    if (document.querySelector('input.blank')) startSpeedMode();
    else setSpeedStatus('Режим увімкнено. Натисніть "Створити пропуски".');
});
speedMinutesInput?.addEventListener('change', () => {
    if (speedState.running) startSpeedMode();
});
chkSmartSpeedCalc?.addEventListener('change', () => {
    if (speedState.running) startSpeedMode();
});
chkLenientAnyCheck?.addEventListener('change', syncTimeoutLeniencyControls);
chkTimeoutLeniency?.addEventListener('change', syncTimeoutLeniencyControls);
timeoutLeniencyPercentInput?.addEventListener('input', normalizeTimeoutLeniencyPercent);
timeoutLeniencyPercentInput?.addEventListener('change', normalizeTimeoutLeniencyPercent);
chkRetryRevealMode?.addEventListener('change', syncRetryRevealControls);
retryRevealCountInput?.addEventListener('input', normalizeRetryRevealCount);
retryRevealCountInput?.addEventListener('change', normalizeRetryRevealCount);
chkSpeechMode?.addEventListener('change', () => {
    if (!chkSpeechMode.checked) {
        stopSpeechRecognition();
        return;
    }
    if (!speechState.supported) {
        chkSpeechMode.checked = false;
        setSpeechStatus('Цей браузер не підтримує голосове введення.', 'error');
        return;
    }
    scheduleSpeechSync(0);
});
speechLangSelect?.addEventListener('change', () => {
    if (isSpeechModeEnabled()) scheduleSpeechSync(0);
});
syncTimeoutLeniencyControls();
syncRetryRevealControls();
if (!speechState.supported) {
    if (chkSpeechMode) chkSpeechMode.disabled = true;
    setSpeechStatus('Цей браузер не підтримує голосове введення.', 'error');
}

// Клавіатурні скорочення: Enter = перевірити, Ctrl+G = згенерувати
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (speedState.running) {
            submitSpeedBlank();
            return;
        }
        const active = document.activeElement;
        if (active?.matches?.('input.blank')) {
            checkAnswers({
                onlyInput: active,
                trackEnterChecks: true,
                moveFocusForward: true
            });
            return;
        }
        checkAnswers();
    } else if ((e.key === 'g' || e.key === 'G') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        generateCloze();
    }
});
document.addEventListener('focusin', (e) => {
    if (!isSpeechModeEnabled()) return;
    if (e.target?.matches?.('input.blank')) scheduleSpeechSync(0);
});

// Додати завантажені зображення у галерею
async function addImages(files) {
    for (const f of files) {
        const url = await toDataURL(f);
        createFigure(url, f.name.replace(/\.\w+$/, ''));
    }
}

// Створити "Рис. N" з контейнером для масок
function createFigure(url, title = '') {
    figCounter++;
    const id = figCounter;

    const wrap = document.createElement('div');
    wrap.className = 'figure';
    wrap.dataset.id = id;

    const head = document.createElement('div');
    head.className = 'fig-head';
    head.textContent = `Рис. ${id}${title ? `: ${title}` : ''}`;

    const imgBox = document.createElement('div');
    imgBox.className = 'img-box';

    const img = document.createElement('img');
    img.src = url;
    img.alt = title || `Рис. ${id}`;

    imgBox.appendChild(img);
    wrap.appendChild(head);
    wrap.appendChild(imgBox);
    document.getElementById('figures').appendChild(wrap);

    const fig = { id, el: wrap, imgBox, regions: [] };
    figures.push(fig);

    // У тренуванні: клік по масці показує/ховає її
    imgBox.addEventListener('click', (e) => {
        const m = e.target.closest('.mask'); if (!m) return;
        m.classList.toggle('hidden');
    });

    // Після завантаження картинки — якщо авто-оклюзія увімкнена, генеруй "дірки"
    img.addEventListener('load', () => {
        if (document.getElementById('imgAuto')?.checked) {
            autoOccludeAll(); // згенерує маски під поточну "Складність"
        }
    });
}

/* ===================== фаза росту масок + авто-оклюзія ===================== */

function applyRectToEl(region) {
    Object.assign(region.el.style, {
        left: region.x + 'px',
        top: region.y + 'px',
        width: region.w + 'px',
        height: region.h + 'px'
    });
}

function visibleArea(r, W, H) {
    return clippedArea(r, W, H);
}

function tryGrow(fig, idx, dir, step, W, H) {
    const cur = fig.regions[idx];
    const cand = { x: cur.x, y: cur.y, w: cur.w, h: cur.h };

    if (dir === 'right') cand.w = Math.max(1, cur.w + step);
    else if (dir === 'bottom') cand.h = Math.max(1, cur.h + step);
    else return null;

    for (let j = 0; j < fig.regions.length; j++) {
        if (j === idx) continue;
        if (rectsOverlapClipped(cand, fig.regions[j], W, H)) return null;
    }

    const oldVis = visibleArea(cur, W, H);
    const newVis = visibleArea(cand, W, H);
    const delta = newVis - oldVis;
    if (delta <= 0.1) return null;

    return { cand, delta };
}

function growMasksToTarget(fig, target, W, H, maxIters = 1500) {
    let covered = fig.regions.reduce((s, r) => s + visibleArea(r, W, H), 0);
    const stepBase = Math.max(2, Math.round(Math.min(W, H) / 80));

    let it = 0;
    while (covered < target && it++ < maxIters) {
        let best = null;

        for (let i = 0; i < fig.regions.length; i++) {
            const c1 = tryGrow(fig, i, 'right', stepBase, W, H);
            const c2 = tryGrow(fig, i, 'bottom', stepBase, W, H);

            if (c1 && (!best || c1.delta > best.delta)) best = { i, dir: 'right', ...c1 };
            if (c2 && (!best || c2.delta > best.delta)) best = { i, dir: 'bottom', ...c2 };
        }

        if (!best) break;

        const r = fig.regions[best.i];
        r.x = best.cand.x; r.y = best.cand.y; r.w = best.cand.w; r.h = best.cand.h;
        applyRectToEl(r);
        covered += best.delta;

        if (target - covered < Math.max(20, 0.002 * W * H)) break;
    }
}

function autoOccludeAll() {
    const auto = document.getElementById('imgAuto')?.checked;
    if (!auto) return;

    const debug = !!document.getElementById('debugLog')?.checked;

    // НОВЕ: беремо окремий відсоток для зображень, інакше — з текстового контролу.
    let dImg = +document.getElementById('imgPercent')?.value;
    if (Number.isNaN(dImg)) dImg = +document.getElementById('percent').value || 0;
    const d = Math.min(100, Math.max(0, dImg)) / 100; // 0..1

    const targetFrac = 0.8 * d;                    // максимум 80% при 100% складності
    const MAX_MASKS = Math.min(6, Math.max(1, Math.ceil(1 + d * 5))); // 1..6
    const overspill = 0.35;
    const eps = 0.02;

    figures.forEach(fig => {
        fig.regions.forEach(r => r.el.remove());
        fig.regions = [];

        const box = fig.imgBox;
        const W = box.clientWidth, H = box.clientHeight;
        if (W < 20 || H < 20) return;

        const A = W * H;
        const target = A * targetFrac;

        let covered = 0, placed = 0;

        // Фаза 1
        while (covered < target * (1 - eps) && placed < MAX_MASKS) {
            const remain = Math.max(1, target - covered);
            const left = MAX_MASKS - placed;

            const minVis = A * 0.10 * Math.max(0.2, d);
            const maxVis = A * 0.92;
            const desiredVisible = Math.min(
                maxVis,
                Math.max(minVis, remain / left * (0.95 + Math.random() * 0.1))
            );

            const rect = placeRectWithOverspill(fig, desiredVisible, W, H, overspill, 360);
            if (!rect) {
                const fallback = placeRectWithOverspill(fig, Math.max(A * 0.05, desiredVisible * 0.7), W, H, overspill, 260);
                if (!fallback) break;
                addMask(fig, fallback); covered += fallback.visible; placed++; continue;
            }
            addMask(fig, rect); covered += rect.visible; placed++;
        }

        // Фаза 2
        if (covered < target * (1 - eps) && fig.regions.length) {
            growMasksToTarget(fig, target, W, H);
            covered = fig.regions.reduce((s, r) => s + clippedArea(r, W, H), 0);
        }

        const pct = Math.round((covered / A) * 1000) / 10;
        const goal = Math.round(targetFrac * 1000) / 10;
        if (debug) console.log(`Рис.${fig.id}: покрито ${pct}% (ціль ${goal}%), масок ${fig.regions.length}/${MAX_MASKS}`);
    });

    function addMask(fig, { x, y, w, h }) {
        const el = document.createElement('div');
        el.className = 'mask hidden';
        Object.assign(el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
        const key = fig.id + String.fromCharCode(65 + fig.regions.length); // 1A, 1B, ...
        el.innerHTML = `<span class="label">${key}</span>`;
        fig.imgBox.appendChild(el);
        fig.regions.push({ key, x, y, w, h, el, hidden: true });
    }
}
/* =================== КІНЕЦЬ БЛОКУ =================== */
