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
const chkRetryRevealMode = document.getElementById('retryRevealMode');
const retryRevealCountInput = document.getElementById('retryRevealCount');

let tRunning = false;
let tElapsedMs = 0;
let tLast = 0;
let tHandle = null;
const speedState = {
    running: false,
    blanks: [],
    activeIndex: -1,
    perBlankMs: 0,
    carryMs: 0,
    deadline: 0,
    tickHandle: null
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
    return `${(Math.max(0, ms) / 1000).toFixed(1)} с`;
}

function setSpeedStatus(text) {
    if (!speedStatus) return;
    speedStatus.textContent = text || '';
}

function refreshSpeedPanel() {
    if (!speedPanel || !chkSpeedMode) return;
    speedPanel.hidden = !chkSpeedMode.checked;
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
    if (!updatedFormulas || !updatedFormulas.size) return;
    updatedFormulas.forEach(renderFormula);
    if (window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise(Array.from(updatedFormulas, (f) => f.span));
    }
}

function focusBlankInput(inp) {
    if (!inp || !inp.isConnected) return;
    inp.focus();
    inp.select?.();
}

function findNextBlankInput(currentInp) {
    if (!currentInp) return null;
    const inputs = Array.from(document.querySelectorAll('input.blank'));
    const idx = inputs.indexOf(currentInp);
    if (idx === -1) return null;
    return inputs[idx + 1] || null;
}

function computeScoreTotal(fallbackCount = 0) {
    const base = totalBlanks || fallbackCount;
    return Math.max(0, base - excludedFromStats.size);
}

function updateResultLine(fallbackCount = 0) {
    const ok = solved.size;
    const total = computeScoreTotal(fallbackCount);
    document.getElementById('result').textContent = `\u041F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u043E: ${ok}/${total} - \u0427\u0430\u0441: ${fmt(tElapsedMs)}`;
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
    if (!inp || !inp.isConnected) return;
    inp.focus();
    inp.select?.();
}

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
    const slotMs = Math.max(400, speedState.perBlankMs + speedState.carryMs);
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
            if (val === hidden[id]) {
                const updatedFormulas = new Set();
                fillBlankWithAnswer(inp, id, updatedFormulas);
                rerenderUpdatedFormulas(updatedFormulas);
            } else {
                const updatedFormulas = new Set();
                fillBlankWithWrongAttempt(inp, id, val, updatedFormulas);
                rerenderUpdatedFormulas(updatedFormulas);
            }
            speedState.carryMs = 0;
            speedState.activeIndex += 1;
            beginSpeedStep();
            return;
        }
        setSpeedStatus(`На швидкість: ${idx + 1}/${speedState.blanks.length} • залишилось ${fmtSecs(leftMs)}`);
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
    if (val !== hidden[id]) {
        const updatedFormulas = new Set();
        const revealed = handleFailedEnterAttempt(inp, id, val, updatedFormulas);
        rerenderUpdatedFormulas(updatedFormulas);
        if (revealed) {
            speedState.carryMs = 0;
            speedState.activeIndex += 1;
            beginSpeedStep();
        }
        return;
    }

    const carry = Math.max(0, speedState.deadline - performance.now());
    const updatedFormulas = new Set();
    fillBlankWithAnswer(inp, id, updatedFormulas);
    rerenderUpdatedFormulas(updatedFormulas);
    speedState.carryMs = carry;
    speedState.activeIndex += 1;
    beginSpeedStep();
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

    speedState.running = true;
    speedState.blanks = blanks;
    speedState.activeIndex = 0;
    speedState.perBlankMs = (minutes * 60 * 1000) / blanks.length;
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
    // Strip user-provided document wrapper to avoid nested document environments.
    const docMatch = trimmed.match(TEX_DOCUMENT_BLOCK_RE);
    if (docMatch) {
        trimmed = (docMatch[1] || '').trim();
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

function makeWrongRevealTex(correctValue, wrongValue) {
    const wrongEscaped = escapeTexText(wrongValue || EMPTY_INPUT_MARK);
    return `\\overset{\\textcolor{red}{\\cancel{\\text{${wrongEscaped}}}}}{\\textcolor{lime}{${correctValue}}}`;
}

function renderFormula(formula) {
    const parts = formula.slots.map((slot) => {
        if (slot.type === 'lex') return slot.value;
        return solved.has(slot.id)
            ? `\\textcolor{lime}{${slot.value}}`
            : revealedWrongInFormula.has(slot.id)
                ? makeWrongRevealTex(slot.value, wrongInputInFormula.get(slot.id))
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

    if (!raw.trim()) return;

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
                const isTextGroup = typeof lx === 'string' && lx.startsWith('\\text{');
                const ok = !isTextGroup && (
                    (isCmd && !RESERVED.has(lx) && lx.length <= 16 && !noHideCmds) ||
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
        if (val === hidden[id]) {
            ok++;
            fillBlankWithAnswer(inp, id, updatedFormulas);
        } else {
            inp.classList.add('incorrect');
            inp.classList.remove('correct');
        }
    });

    rerenderUpdatedFormulas(updatedFormulas);

    if (chkAutoStop.checked) pauseTimer();
    document.getElementById('result').textContent = `Правильно: ${ok}/${total} — Час: ${fmt(tElapsedMs)}`;
}

// Завантаження зображень
function checkAnswers(options = {}) {
    const {
        onlyInput = null,
        trackEnterChecks = false,
        moveFocusForward = false
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
        if (val === hidden[id]) {
            const nextInp = moveFocusForward ? findNextBlankInput(inp) : null;
            fillBlankWithAnswer(inp, id, updatedFormulas);
            if (nextInp) focusBlankInput(nextInp);
            return;
        }

        const nextInp = moveFocusForward ? findNextBlankInput(inp) : null;
        if (!trackEnterChecks) {
            inp.classList.add('incorrect');
            inp.classList.remove('correct');
            return;
        }

        const revealed = handleFailedEnterAttempt(inp, id, val, updatedFormulas);
        if (revealed && nextInp) focusBlankInput(nextInp);
    });

    rerenderUpdatedFormulas(updatedFormulas);

    if (chkAutoStop.checked) pauseTimer();
    updateResultLine(allInputs.length);
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
        return;
    }
    if (document.querySelector('input.blank')) startSpeedMode();
    else setSpeedStatus('Режим увімкнено. Натисніть "Створити пропуски".');
});
speedMinutesInput?.addEventListener('change', () => {
    if (speedState.running) startSpeedMode();
});
chkRetryRevealMode?.addEventListener('change', syncRetryRevealControls);
retryRevealCountInput?.addEventListener('input', normalizeRetryRevealCount);
retryRevealCountInput?.addEventListener('change', normalizeRetryRevealCount);
syncRetryRevealControls();

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
