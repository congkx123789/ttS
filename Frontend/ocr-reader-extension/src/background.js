// --- HYBRID OFFLINE TRANSLATION ENGINE ---
let dictVietphrase = null;
let dictNames = null;
let dictChar = null;
let isLoaded = false;
let isLoading = false;

function decryptXOR(buffer, keyStr) {
    const view = new Uint8Array(buffer);
    const keyBytes = new TextEncoder().encode(keyStr);
    const decrypted = new Uint8Array(view.length);
    for (let i = 0; i < view.length; i++) {
        decrypted[i] = view[i] ^ keyBytes[i % keyBytes.length];
    }
    return new TextDecoder().decode(decrypted);
}

async function loadDictionaries() {
    if (isLoaded || isLoading) return;
    isLoading = true;
    console.log("Loading dictionaries locally in Chrome Extension background...");
    const secretKey = "quick_translator_secret_key_2026";
    
    async function fetchAndLoad(isEncrypted) {
        const ext = isEncrypted ? "bin" : "txt";
        const urls = [
            chrome.runtime.getURL(`dictionaries/Vietphrase.${ext}`),
            chrome.runtime.getURL(`dictionaries/Aligned_HanViet.${ext}`),
            chrome.runtime.getURL(`dictionaries/HanViet_CharDict.${ext}`)
        ];
        
        const responses = await Promise.all(urls.map(url => fetch(url)));
        
        // Ensure all responses are OK
        for (let res of responses) {
            if (!res.ok) throw new Error(`Failed to load ${res.url}`);
        }
        
        if (isEncrypted) {
            const buffers = await Promise.all(responses.map(res => res.arrayBuffer()));
            return buffers.map(buf => decryptXOR(buf, secretKey));
        } else {
            return Promise.all(responses.map(res => res.text()));
        }
    }

    try {
        let texts;
        try {
            // 1. Try loading encrypted .bin files
            texts = await fetchAndLoad(true);
            console.log("Loaded encrypted .bin dictionaries successfully!");
        } catch (binErr) {
            console.warn("Could not load encrypted .bin dictionaries, trying plain .txt files...", binErr);
            // 2. Fallback to .txt files for local development
            texts = await fetchAndLoad(false);
            console.log("Loaded plain .txt dictionaries successfully!");
        }

        dictVietphrase = parseDict(texts[0]);
        dictNames = parseDict(texts[1]);
        dictChar = parseDict(texts[2]);
        isLoaded = true;
        console.log("Dictionaries loaded successfully inside Extension! Total keys: Vietphrase =", dictVietphrase.size, ", Names =", dictNames.size, ", Char =", dictChar.size);
    } catch (e) {
        console.error("Error loading dictionaries locally:", e);
        throw e;
    } finally {
        isLoading = false;
    }
}

function parseDict(text) {
    const map = new Map();
    const lines = text.split("\n");
    for (let line of lines) {
        line = line.trim();
        if (!line || !line.includes("=")) continue;
        const idx = line.indexOf("=");
        const left = line.slice(0, idx).trim();
        const right = line.slice(idx + 1).trim();
        
        if (left.includes(",") && right.includes(",")) {
            const keys = left.split(",").map(k => k.trim()).filter(Boolean);
            const vals = right.split(",").map(v => v.trim()).filter(Boolean);
            if (keys.length === vals.length) {
                for (let k = 0; k < keys.length; k++) {
                    map.set(keys[k], vals[k]);
                }
                continue;
            }
        }
        if (left) {
            map.set(left, right);
        }
    }
    return map;
}

async function ensureDictionariesLoaded() {
    if (isLoaded) return;
    await loadDictionaries();
}

function cleanAnnotation(text) {
    if (!text) return "";
    text = text.replace(/\{([^{}]+)\}/g, (m, content) => {
        if (content.includes(':')) {
            return content.split(':')[0].trim();
        }
        return content.trim();
    });
    text = text.replace(/\s*\(\*[^)]*\)/g, '');
    return text.trim();
}

function formatTranslation(rawValue, word = "") {
    if (!rawValue) return "";
    const options = rawValue.split("/").map(o => cleanAnnotation(o)).filter(o => o.trim());
    if (options.length === 0) return "";
    if (options.length === 1) return options[0];
    
    if (word && word.length >= 2 && dictChar) {
        // Collect Hán Việt readings for each character in word
        const hvSets = [];
        for (let char of word) {
            const readings = new Set();
            if (dictChar.has(char)) {
                const parts = dictChar.get(char).split("/");
                for (let r of parts) {
                    const rClean = r.trim().toLowerCase();
                    if (rClean) readings.add(rClean);
                }
            }
            if (readings.size > 0) {
                hvSets.push(readings);
            }
        }
        
        let bestOption = options[0];
        let bestScore = -1;
        
        for (let opt of options) {
            // Split option into syllables (e.g. "rất mỹ lệ" -> ["rất", "mỹ", "lệ"])
            const optSyllables = opt.split(/\s+/).map(s => s.trim().toLowerCase()).filter(Boolean);
            let score = 0;
            for (let rSet of hvSets) {
                let found = false;
                for (let r of rSet) {
                    if (optSyllables.includes(r)) {
                        found = true;
                        break;
                    }
                }
                if (found) score++;
            }
            if (score > bestScore) {
                bestScore = score;
                bestOption = opt;
            }
        }
        
        if (bestScore > 0) {
            return bestOption;
        }
    }
    
    return options[0];
}

function capitalizePhrase(phrase) {
    const chars = 'a-zA-ZàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ';
    const regex = new RegExp(`[${chars}]+`, 'g');
    return phrase.replace(regex, (match) => match.charAt(0).toUpperCase() + match.slice(1));
}

const PRONOUNS = new Set([
    '我', '你', 'ta', '他', '她', '它', '们', '您', '自己', 
    '我们', '你们', '他们', '她们', '它们', '大家', '谁', '什么'
]);
const NUM_KEYWORDS = new Set(["重", "阶", "品", "级", "层", "剑", "星", "转", "天", "色", "关", "重天"]);
const HANVIET_NUMBERS = {
    '0': 'Không', '1': 'Nhất', '2': 'Nhị', '3': 'Tam', '4': 'Tứ', '5': 'Ngũ', '6': 'Lục', '7': 'Thất', '8': 'Bát', '9': 'Cửu', '10': 'Thập',
    '一': 'Nhất', '二': 'Nhị', '三': 'Tam', '四': 'Tứ', '五': 'Ngũ', '六': 'Lục', '七': 'Thất', '八': 'Bát', '九': 'Cửu', '十': 'Thập',
    '百': 'Bách', '千': 'Thiên', '万': 'Vạn', '萬': 'Vạn', '几': 'Vài', '数': 'Số', '多': 'Đa', '半': 'Bán', '两': 'Lưỡng', '兩': 'Lưỡng'
};
const LOCALIZERS = new Set(['上', '下', '中', 'li', '里', '外', '内', '內', '后', '後', '前', '旁', '侧', '側', '底', '间', '間']);

function isChineseNumber(str) {
    return /^[0-9一二三四五六七八九十百千万几数多半两]+$/.test(str);
}

function translateSentence(sentence, mode = 'advanced') {
    const leading = sentence.match(/^\s*/)[0];
    const trailing = sentence.match(/\s*$/)[0];
    const body = sentence.trim();
    if (!body) return sentence;
    
    let i = 0;
    const len = body.length;
    
    if (mode === 'hanviet') {
        let result = [];
        while (i < len) {
            const char = body[i];
            
            if (!/[\u4e00-\u9fa5]/.test(char)) {
                let nonChineseStr = "";
                while (i < len && !/[\u4e00-\u9fa5]/.test(body[i])) {
                    const c = body[i];
                    const punctMap = {
                        '，': ',', '。': '.', '「': '"', '」': '"', '、': ',', '？': '?', '！': '!',
                        '：': ':', '；': ';', '“': '"', '”': '"', '（': '(', '）': ')'
                    };
                    nonChineseStr += punctMap[c] || c;
                    i++;
                }
                result.push(nonChineseStr);
                continue;
            }
            
            let matched = false;
            const maxSearchLen = Math.min(10, len - i);
            for (let l = maxSearchLen; l >= 1; l--) {
                const sub = body.substring(i, i + l);
                if (dictNames && dictNames.has(sub)) {
                    let trans = formatTranslation(dictNames.get(sub), sub);
                    result.push(trans);
                    i += l;
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                const rawChar = body[i];
                if (dictChar && dictChar.has(rawChar)) {
                    let trans = dictChar.get(rawChar).split("/")[0];
                    result.push(trans);
                } else {
                    result.push(rawChar);
                }
                i++;
            }
        }
        
        let output = "";
        for (let k = 0; k < result.length; k++) {
            const word = result[k];
            if (k > 0) {
                const prevWord = result[k-1];
                const isCurrentPunct = /^[,.!?:\);\]}"]+$/.test(word);
                const isPrevOpeningPunct = /^[\(\[\{"]+$/.test(prevWord);
                if (!isCurrentPunct && !isPrevOpeningPunct && prevWord !== " " && word !== " ") {
                    output += " ";
                }
            }
            output += word;
        }
        return leading + output.replace(/ {2,}/g, ' ').trim() + trailing;
    }
    
    // Standard / Advanced / Fast modes: build tokens first
    let tokens = [];
    while (i < len) {
        const char = body[i];
        
        if (!/[\u4e00-\u9fa5]/.test(char)) {
            let nonChineseStr = "";
            while (i < len && !/[\u4e00-\u9fa5]/.test(body[i])) {
                const c = body[i];
                const punctMap = {
                    '，': ',', '。': '.', '「': '"', '」': '"', '、': ',', '？': '?', '！': '!',
                    '：': ':', '；': ';', '“': '"', '”': '"', '（': '(', '）': ')'
                };
                nonChineseStr += punctMap[c] || c;
                i++;
            }
            tokens.push({ word: nonChineseStr, translated: nonChineseStr, type: 'punctuation' });
            continue;
        }
        
        if (char === '的') {
            tokens.push({ word: '的', translated: 'đích', type: 'de' });
            i++;
            continue;
        }
        
        let matched = false;
        const maxSearchLen = Math.min(10, len - i);
        
        for (let l = maxSearchLen; l >= 1; l--) {
            const sub = body.substring(i, i + l);
            
            // Prevent matching across 'de' (的) particle
            let shouldSkip = false;
            if (l > 1 && sub.includes('的') && sub.indexOf('的') > 0) {
                shouldSkip = true;
            }
            if (shouldSkip) continue;
            
            if (dictVietphrase && dictVietphrase.has(sub)) {
                let trans = formatTranslation(dictVietphrase.get(sub), sub);
                if (sub.endsWith('的') && sub.length > 1) {
                    if (trans.toLowerCase().endsWith(' đích')) {
                        trans = trans.slice(0, -5);
                    } else if (trans.toLowerCase().endsWith('đích')) {
                        trans = trans.slice(0, -4);
                    }
                }
                tokens.push({ word: sub, translated: trans, type: 'phrase' });
                i += l;
                matched = true;
                break;
            }

            if (dictNames && dictNames.has(sub)) {
                let trans = formatTranslation(dictNames.get(sub), sub);
                trans = capitalizePhrase(trans);
                if (sub.endsWith('的') && sub.length > 1) {
                    if (trans.toLowerCase().endsWith(' đích')) {
                        trans = trans.slice(0, -5);
                    } else if (trans.toLowerCase().endsWith('đích')) {
                        trans = trans.slice(0, -4);
                    }
                }
                tokens.push({ word: sub, translated: trans, type: 'name' });
                i += l;
                matched = true;
                break;
            }
        }
        
        if (!matched) {
            const rawChar = body[i];
            if (dictChar && dictChar.has(rawChar)) {
                let trans = dictChar.get(rawChar).split("/")[0];
                tokens.push({ word: rawChar, translated: trans, type: 'char' });
            } else {
                tokens.push({ word: rawChar, translated: rawChar, type: 'other' });
            }
            i++;
        }
    }
    
    // Group cultivation realms if in advanced or fast mode
    let groupedTokens = [];
    let j = 0;
    while (j < tokens.length) {
        let tok = tokens[j];
        if (isChineseNumber(tok.word) && j + 1 < tokens.length && NUM_KEYWORDS.has(tokens[j+1].word)) {
            let numTok = tok;
            let keyTok = tokens[j+1];
            let combinedWord = numTok.word + keyTok.word;
            let nextIdx = j + 2;
            if (nextIdx < tokens.length && (tokens[nextIdx].type === 'name' || tokens[nextIdx].type === 'phrase')) {
                combinedWord += tokens[nextIdx].word;
                nextIdx++;
            }
            
            let translatedParts = [];
            for (let char of combinedWord) {
                if (HANVIET_NUMBERS[char]) {
                    translatedParts.push(HANVIET_NUMBERS[char]);
                } else if (dictChar && dictChar.has(char)) {
                    let firstVal = dictChar.get(char).split("/")[0];
                    translatedParts.push(capitalizePhrase(firstVal));
                } else {
                    translatedParts.push(char);
                }
            }
            groupedTokens.push({
                word: combinedWord,
                translated: translatedParts.join(" "),
                type: 'cultivation'
            });
            j = nextIdx;
        } else {
            groupedTokens.push(tok);
            j++;
        }
    }
    
    // "的" reordering for advanced mode
    let finalTokens = [];
    if (mode === 'advanced') {
        let k = 0;
        const STOP_WORDS = new Set(['嗎', '吗', '呢', '吧', '呀', '啊', '了', '过', '過', '着', '著']);
        const VERB_INDICATORS = new Set([
            'nói', 'làm', 'đi', 'chạy', 'nghe', 'thấy', 'nhìn', 'đã', 'đang', 'sẽ', 'được', 'bị', 
            'muốn', 'phải', 'rời', 'gặp', 'biết', 'nghĩ', 'cho', 'khiến', 'yêu', 'thích', 'ghét', 
            'sợ', 'cười', 'khóc', 'mang', 'đưa', 'cầm', 'lấy', 'đứng', 'ngồi', 'nằm', 'ngủ', 
            'chết', 'sống', 'hát', 'viết', 'đọc', 'học', 'dạy', 'mua', 'bán', 'trả', 'nhận', 
            'gửi', 'nhớ', 'quên', 'hiểu', 'tin', 'ở', 'đến'
        ]);

        while (k < groupedTokens.length) {
            let tok = groupedTokens[k];
            if (tok.word === '的' && k > 0 && k < groupedTokens.length - 1) {
                let t_x = groupedTokens[k-1];
                
                // Verb check
                let isVerb = false;
                if (/[过過了着著]/.test(t_x.word)) {
                    isVerb = true;
                } else {
                    const words = t_x.translated.toLowerCase().split(/\s+/);
                    for (const w of words) {
                        if (VERB_INDICATORS.has(w)) {
                            isVerb = true;
                            break;
                        }
                    }
                }
                
                let nextPos = k + 1;
                let y_tokens = [];
                while (nextPos < groupedTokens.length) {
                    let tok_next = groupedTokens[nextPos];
                    if (tok_next.type === 'punctuation' || tok_next.word === '的' || 
                        LOCALIZERS.has(tok_next.word) || STOP_WORDS.has(tok_next.word)) {
                        break;
                    }
                    if (y_tokens.length >= 3) {
                        break;
                    }
                    y_tokens.push(tok_next);
                    nextPos++;
                }
                
                if (y_tokens.length > 0 && !isVerb) {
                    let y_translated = y_tokens.map(t => t.translated).join(" ");
                    let y_word = y_tokens.map(t => t.word).join("");
                    
                    let isProperOrPronoun = PRONOUNS.has(t_x.word) || t_x.type === 'name';
                    let combined = "";
                    if (isProperOrPronoun) {
                        combined = y_translated + " của " + t_x.translated;
                    } else {
                        combined = y_translated + " " + t_x.translated;
                    }
                    
                    if (finalTokens.length > 0) {
                        finalTokens.pop();
                    }
                    
                    finalTokens.push({
                        word: t_x.word + '的' + y_word,
                        translated: combined,
                        type: 'phrase'
                    });
                    
                    k = nextPos;
                    continue;
                } else {
                    tok.translated = "";
                }
            }
            finalTokens.push(tok);
            k++;
        }
    } else {
        finalTokens = groupedTokens;
    }
    
    // Format output spacing
    let result = finalTokens.map(t => t.translated);
    let output = "";
    for (let k = 0; k < result.length; k++) {
        const word = result[k];
        if (!word) continue;
        if (output.length > 0) {
            const prevWord = finalTokens[k-1] ? finalTokens[k-1].translated : "";
            const isCurrentPunct = /^[,.!?:\);\]}"]+$/.test(word);
            const isPrevOpeningPunct = /^[\(\[\{"]+$/.test(prevWord);
            if (!isCurrentPunct && !isPrevOpeningPunct && prevWord !== " " && word !== " ") {
                output += " ";
            }
        }
        output += word;
    }
    
    return leading + output.replace(/ {2,}/g, ' ').trim() + trailing;
}

function translateParagraph(paragraph, mode = 'advanced') {
    if (!paragraph) return "";
    const lines = paragraph.split('\n');
    const translatedLines = lines.map(line => translateSentence(line, mode));
    return translatedLines.join('\n');
}

// --- MESSAGES ROUTER ---
let cachedHost = null;

async function getBackendHost(settings) {
    if (cachedHost) return cachedHost;
    
    // List of candidate hosts to probe in order of preference
    const hosts = [];
    if (settings.apiHost) {
        hosts.push(settings.apiHost.replace(/\/$/, ''));
    }
    hosts.push("https://tienhiep.lyvuha.com");
    hosts.push("");
    
    for (const host of hosts) {
        try {
            const res = await fetch(`${host}/api/stats`);
            if (res.ok) {
                cachedHost = host;
                console.log(`[Extension Background] Connected to translation server: ${host}`);
                return host;
            }
        } catch (e) {}
    }
    
    return null;
}

function fallbackToOffline(texts, mode, sendResponse) {
    console.log(`[Extension Background] Translating via offline browser engine (Mode: ${mode})...`);
    ensureDictionariesLoaded()
        .then(() => {
            const translations = texts.map(t => translateParagraph(t, mode));
            sendResponse({ success: true, data: { translations } });
        })
        .catch(localErr => {
            console.error("[Extension Background] Local JS Translation failed:", localErr);
            sendResponse({ success: false, error: localErr.message });
        });
}

chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "translate_stream") {
        port.onMessage.addListener((msg) => {
            if (msg.action === "START") {
                chrome.storage.local.get(['settings', 'serverAuthToken'], (result) => {
                    const settings = result.settings || {};
                    const token = result.serverAuthToken;
                    const engineType = settings.engineType || 'browser';
                    const mode = settings.mode || 'advanced';
                    
                    if (engineType === 'browser') {
                        ensureDictionariesLoaded().then(async () => {
                            for (let i = 0; i < msg.payload.texts.length; i++) {
                                port.postMessage({ type: "CHUNK", index: i, text: translateParagraph(msg.payload.texts[i], mode) });
                                // Add 2ms delay to yield thread and mimic Kafka asynchronous message broker streaming
                                await new Promise(r => setTimeout(r, 2));
                            }
                            port.postMessage({ type: "DONE" });
                        }).catch(e => port.postMessage({ type: "ERROR", error: e.message }));
                    } else {
                        getBackendHost(settings).then((host) => {
                            if (!host) {
                                ensureDictionariesLoaded().then(async () => {
                                    for (let i = 0; i < msg.payload.texts.length; i++) {
                                        port.postMessage({ type: "CHUNK", index: i, text: translateParagraph(msg.payload.texts[i], mode) });
                                        await new Promise(r => setTimeout(r, 2));
                                    }
                                    port.postMessage({ type: "DONE" });
                                });
                                return;
                            }
                            
                            const headers = {
                                "Content-Type": "application/json",
                                "X-VIP-Key": settings.vipKey || ""
                            };
                            if (token) headers['Authorization'] = `Bearer ${token}`;

                            const controller = new AbortController();
                            port.onDisconnect.addListener(() => {
                                console.log("[Background] Port disconnected. Aborting translation stream.");
                                try {
                                    controller.abort();
                                } catch(e) {}
                            });

                            fetch(`${host}/translate_stream`, {
                                method: "POST",
                                headers: headers,
                                body: JSON.stringify({ texts: msg.payload.texts, mode, vip_key: settings.vipKey || "" }),
                                signal: controller.signal
                            }).then(async (res) => {
                                if (res.status === 403) {
                                    const data = await res.json();
                                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                                        if (tabs && tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: "SHOW_LIMIT_ALERT", message: data.error });
                                    });
                                    throw new Error(data.error);
                                }
                                
                                const reader = res.body.getReader();
                                const decoder = new TextDecoder();
                                let buffer = '';
                                
                                while (true) {
                                    const { done, value } = await reader.read();
                                    if (done) break;
                                    buffer += decoder.decode(value, { stream: true });
                                    
                                    const lines = buffer.split('\n\n');
                                    buffer = lines.pop(); // Keep incomplete part
                                    
                                    for (const line of lines) {
                                        if (line.startsWith('data: ')) {
                                            try {
                                                const data = JSON.parse(line.substring(6));
                                                port.postMessage({ type: "CHUNK", index: data.index, text: data.text });
                                            } catch(e) {}
                                        }
                                    }
                                }
                                port.postMessage({ type: "DONE" });
                            }).catch(err => {
                                console.warn(`[Extension Background] Streaming failed. Falling back...`, err);
                                ensureDictionariesLoaded().then(async () => {
                                    for (let i = 0; i < msg.payload.texts.length; i++) {
                                        port.postMessage({ type: "CHUNK", index: i, text: translateParagraph(msg.payload.texts[i], mode) });
                                        await new Promise(r => setTimeout(r, 2));
                                    }
                                    port.postMessage({ type: "DONE" });
                                });
                            });
                        });
                    }
                });
            }
        });
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "FETCH_TRANSLATE") {
        chrome.storage.local.get(['settings', 'serverAuthToken'], (result) => {
            const settings = result.settings || {};
            const token = result.serverAuthToken;
            const engineType = settings.engineType || 'browser';
            const mode = settings.mode || 'advanced';
            
            if (engineType === 'browser') {
                fallbackToOffline(request.payload.texts, mode, sendResponse);
            } else {
                getBackendHost(settings).then((host) => {
                    if (host) {
                        const headers = {
                            "Content-Type": "application/json",
                            "X-VIP-Key": settings.vipKey || ""
                        };
                        if (token) {
                            headers['Authorization'] = `Bearer ${token}`;
                        }

                        fetch(`${host}/translate`, {
                            method: "POST",
                            headers: headers,
                            body: JSON.stringify({ 
                                texts: request.payload.texts,
                                mode: mode,
                                vip_key: settings.vipKey || ""
                            })
                        })
                        .then(res => {
                            if (res.status === 403) {
                                return res.json().then(data => {
                                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                                        if (tabs && tabs[0]) {
                                            chrome.tabs.sendMessage(tabs[0].id, {
                                                action: "SHOW_LIMIT_ALERT",
                                                message: data.error
                                            }).catch(() => {});
                                        }
                                    });
                                    throw new Error(data.error);
                                });
                            }
                            return res.json();
                        })
                        .then(data => {
                            if (data.translations) {
                                sendResponse({ success: true, data: data });
                            } else {
                                throw new Error("Empty translation returned from Python Server.");
                            }
                        })
                        .catch(err => {
                            console.warn(`[Extension Background] Failed to connect or rate limited on host ${host}. Falling back to offline...`);
                            cachedHost = null; // Clear cache on failure
                            fallbackToOffline(request.payload.texts, mode, sendResponse);
                        });
                    } else {
                        fallbackToOffline(request.payload.texts, mode, sendResponse);
                    }
                });
            }
        });
        return true; // Keep asynchronous channel open
    } else if (request.action === "SYNC_HISTORY") {
        // Read user session from storage to determine if online or offline
        chrome.storage.local.get(['serverUser', 'serverUrl', 'serverAuthToken', 'offlineTranslationHistory'], (storageRes) => {
            const user = storageRes.serverUser;
            const token = storageRes.serverAuthToken;
            const serverUrl = storageRes.serverUrl || "https://tienhiep.lyvuha.com";

            // Always save locally first as a reliable backup
            let history = storageRes.offlineTranslationHistory || [];
            history = history.filter(item => item.url !== request.payload.url);
            history.unshift({
                title: request.payload.title,
                url: request.payload.url,
                author: request.payload.author || "Không rõ",
                cover: request.payload.cover || "",
                last_chapter: request.payload.last_chapter || "Chương đọc",
                timestamp: Date.now()
            });
            if (history.length > 20) history = history.slice(0, 20);
            chrome.storage.local.set({ offlineTranslationHistory: history });

            if (user && token) {
                // User is logged in -> Sync online (SQLite database)
                const headers = { "Content-Type": "application/json" };
                headers['Authorization'] = `Bearer ${token}`;

                fetch(`${serverUrl}/api/extension/sync`, {
                    method: "POST",
                    headers: headers,
                    body: JSON.stringify(request.payload),
                    credentials: "include"
                })
                .then(res => res.json())
                .then(data => {
                    console.log("[Sync History Success]", data);
                    sendResponse({ success: true, data });
                })
                .catch(err => {
                    console.warn("[Sync History Error]", err);
                    sendResponse({ success: false, error: err.message });
                });
            } else {
                console.log("[Sync History Offline Success] Saved locally.");
                sendResponse({ success: true, local: true });
            }
        });
        return true; // Keep async channel open for SYNC_HISTORY
    } else if (request.action === "SYNC_WEB_AUTH") {
        const { token, user } = request.payload;
        if (token && user) {
            chrome.storage.local.get(['serverUrl', 'settings'], (res) => {
                const sUrl = res.serverUrl || "";
                chrome.storage.local.set({
                    serverAuthToken: token,
                    serverUser: user,
                    serverUrl: sUrl
                });
                
                // Update VIP settings if necessary
                const settings = res.settings || {};
                let changed = false;
                if (user.vip_status === 1) {
                    if (settings.membershipType !== 'vip') {
                        settings.membershipType = 'vip';
                        settings.vipKey = settings.vipKey || 'VIP_SERVER';
                        changed = true;
                    }
                }
                if (changed) {
                    chrome.storage.local.set({ settings });
                }
            });
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false });
        }
        return true;
    }
});

