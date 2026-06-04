// ============================================================
// CONTENT.JS - Reliable Scroll-Interrupting Translation Engine v4
// ============================================================
let isTranslating = false;
let translatedNodes = new WeakSet();

// ============================================================
// 1. DOM EXTRACTION
// ============================================================
function extractUsingTreeWalker() {
    const nodes = [];
    const texts = [];
    const stack = [document.body];
    
    while (stack.length > 0) {
        const node = stack.pop();
        if (!node) continue;
        
        if (node.nodeType === Node.TEXT_NODE) {
            const tag = node.parentNode?.nodeName;
            if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') continue;
            
            const val = node.nodeValue;
            if (!val || !val.trim()) continue;
            
            if (/[\u4e00-\u9fa5]/.test(val)) {
                if (translatedNodes.has(node)) {
                    // DOM Recycling: If already translated but now contains Chinese again, clean and translate it.
                    translatedNodes.delete(node);
                    nodes.push(node);
                    texts.push(val.replace(/[\u200B-\u200D\uFEFF]/g, ''));
                } else {
                    nodes.push(node);
                    texts.push(val.replace(/[\u200B-\u200D\uFEFF]/g, ''));
                }
            }
        } else {
            // Traverse inside Shadow DOM of Custom Elements (crucial for modern sites like YouTube)
            if (node.shadowRoot) {
                stack.push(node.shadowRoot);
            }
            
            let child = node.lastChild;
            while (child) {
                stack.push(child);
                child = child.previousSibling;
            }
        }
    }
    return { nodes, texts };
}

// ============================================================
// 2. LAYOUT CSS
// ============================================================
function injectCSS() {
    if (document.getElementById('ocr-layout-fix')) return;
    const s = document.createElement('style');
    s.id = 'ocr-layout-fix';
    s.textContent = `
        .flex,[class*="flex"],[class*="col"]{min-width:0!important;min-height:0!important}
        p,article,section,.chapter-content,.read-content{word-break:break-word!important;overflow-wrap:anywhere!important}
    `;
    document.head.appendChild(s);
}

// ============================================================
// 3. TRANSLATION REQUEST
// ============================================================
async function requestTranslation(texts) {
    return new Promise(resolve => {
        try {
            chrome.storage.local.get(['settings'], (resStorage) => {
                const mode = resStorage?.settings?.mode || 'advanced';
                chrome.runtime.sendMessage({ action: 'FETCH_TRANSLATE', payload: { texts } }, resp => {
                    if (chrome.runtime.lastError || !resp?.success) {
                        fetch('http://localhost:5050/translate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ texts, mode })
                        }).then(r => r.json()).then(d => resolve(d.translations ?? null)).catch(() => resolve(null));
                    } else {
                        resolve(resp.data?.translations ?? null);
                    }
                });
            });
        } catch { 
            fetch('http://localhost:5050/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ texts })
            }).then(r => r.json()).then(d => resolve(d.translations ?? null)).catch(() => resolve(null));
        }
    });
}

// ============================================================
// 4. APPLY TO DOM
// ============================================================
function applyBatch(nodes, indices, translations) {
    if (!translations) return;
    translations.forEach((t, j) => {
        const node = nodes[indices[j]];
        if (!node?.parentNode) return;
        node.nodeValue = t;
        translatedNodes.add(node);
    });
}

// ============================================================
// 5. ENGINE STATE & TRANSLATION ENGINE
// ============================================================
let allNodes  = [];
let allTexts  = [];
let pending   = new Set();

async function translateAllPending() {
    if (isTranslating || pending.size === 0) return;
    isTranslating = true;

    console.log(`[Translator] Bắt đầu dịch liên tục...`);

    while (pending.size > 0) {
        const sorted = Array.from(pending);
        const chunkSize = 200; // Optimal batch size for translation API requests
        const chunk = sorted.slice(0, chunkSize);
        
        const validChunk = chunk.filter(idx => {
            const node = allNodes[idx];
            return node?.parentNode && document.body.contains(node.parentNode);
        });

        if (validChunk.length > 0) {
            const textsToTranslate = validChunk.map(idx => allTexts[idx]);
            const t = await requestTranslation(textsToTranslate);
            if (t) {
                applyBatch(allNodes, validChunk, t);
            }
        }
        
        // Remove processed chunk from pending set to prevent infinite loop
        chunk.forEach(idx => pending.delete(idx));
        
        // Yield execution to the CPU thread slightly before the next batch
        await new Promise(r => setTimeout(r, 40));
    }

    console.log(`[Translator] Dịch hoàn tất toàn bộ hàng đợi!`);
    isTranslating = false;

    // Trigger auto-next check now that translation is complete (for short pages or already at bottom)
    if (typeof checkAndTriggerAutoNext === 'function') {
        checkAndTriggerAutoNext(false);
    }
}

// ============================================================
// 6. SESSION START
// ============================================================
async function startSession(reset = false) {
    if (reset) {
        allNodes = []; 
        allTexts = []; 
        pending.clear();
        isTranslating = false;
        // Re-initialize WeakSet to clear translated cache for full re-translation
        translatedNodes = new WeakSet();
    }

    injectCSS();
    const { nodes, texts } = extractUsingTreeWalker();
    if (nodes.length === 0) {
        console.log('[Session] Không có chữ Hán mới');
        return 0;
    }

    const base = allNodes.length;
    nodes.forEach((n, i) => {
        allNodes.push(n);
        allTexts.push(texts[i]);
        pending.add(base + i);
    });

    console.log(`[Session] Thêm +${nodes.length} nodes. Chờ xử lý: ${pending.size}`);
    
    // Kick off full translation pipeline
    translateAllPending();

    // Auto sync reading history to Flask server
    try {
        syncReadingHistoryToServer();
    } catch (err) {
        console.warn("[Sync History Error in startSession]", err);
    }

    return nodes.length;
}

let historySynced = false;

function syncReadingHistoryToServer() {
    if (historySynced) return;
    historySynced = true;

    // 1. Extract Novel Title
    let title = "";
    const metaTitle = document.querySelector('meta[property="og:novel:book_name"], meta[name="novel:book_name"]');
    if (metaTitle) {
        title = metaTitle.getAttribute('content');
    } else {
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) {
            title = ogTitle.getAttribute('content');
        } else {
            title = document.title;
        }
    }
    // Clean title (remove chapter suffix and separator strings)
    title = title.replace(/第\s*\d+\s*[章页].*$/, '').replace(/_.*$/, '').replace(/-.*$/, '').trim();

    // 2. Extract Author Name
    let author = "";
    const metaAuthor = document.querySelector('meta[property="og:novel:author"], meta[name="novel:author"]');
    if (metaAuthor) {
        author = metaAuthor.getAttribute('content');
    } else {
        const authorEl = Array.from(document.querySelectorAll('*')).find(el => el.textContent.includes('作者：') || el.textContent.includes('作者:'));
        if (authorEl) {
            author = authorEl.textContent.replace(/^.*作者[：:]/, '').trim();
        }
    }
    author = author.substring(0, 50).trim();

    // 3. Extract Current Chapter Title
    let lastChapter = "";
    const metaChap = document.querySelector('meta[property="og:novel:last_chapter_name"], meta[name="novel:last_chapter_name"]');
    if (metaChap) {
        lastChapter = metaChap.getAttribute('content');
    } else {
        const heading = Array.from(document.querySelectorAll('h1, h2, .chapter-title, .title')).find(el => {
            const txt = el.textContent;
            return /第\s*\d+\s*章/.test(txt) || /Chương\s*\d+/.test(txt);
        });
        if (heading) {
            lastChapter = heading.textContent.trim();
        } else {
            const match = document.title.match(/(第\s*\d+\s*章[^\-_|]*)/) || document.title.match(/(Chương\s*\d+[^\-_|]*)/);
            lastChapter = match ? match[1].trim() : "Chương đọc";
        }
    }

    // 4. Extract Cover Image URL
    let cover = "";
    const metaImage = document.querySelector('meta[property="og:image"], meta[name="novel:image"]');
    if (metaImage) {
        cover = metaImage.getAttribute('content');
    }

    // Dispatch message to background worker to perform actual sync
    chrome.runtime.sendMessage({
        action: "SYNC_HISTORY",
        payload: {
            url: location.href,
            title: title || "Truyện ngoài",
            author: author || "Không rõ",
            cover: cover || "",
            last_chapter: lastChapter || "Chương đọc",
            action: "history"
        }
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.warn("[Sync History] Gửi message sync thất bại:", chrome.runtime.lastError);
        } else {
            console.log("[Sync History] Đồng bộ thành công:", response);
        }
    });
}

// ============================================================
// 11. POPUP LISTENER
// ============================================================
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === 'GET_CHAPTER_CONTENT') {
        console.log('[Popup] Bắt đầu dịch thủ công...');
        startSession(true).then(count => {
            sendResponse(count === 0
                ? { error: 'Không tìm thấy chữ Hán!' }
                : { success: true, count }
            );
        });
    } else if (req.action === 'SHOW_LIMIT_ALERT') {
        const alertId = 'ocr-limit-alert-toast';
        if (document.getElementById(alertId)) return;
        
        const toast = document.createElement('div');
        toast.id = alertId;
        toast.style.position = 'fixed';
        toast.style.top = '24px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.background = 'linear-gradient(135deg, #f57c00, #e65100)';
        toast.style.color = '#fff';
        toast.style.padding = '12px 24px';
        toast.style.borderRadius = '12px';
        toast.style.zIndex = '999999';
        toast.style.fontSize = '12px';
        toast.style.fontWeight = 'bold';
        toast.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
        toast.style.border = '1px solid rgba(255,255,255,0.2)';
        toast.style.textAlign = 'center';
        toast.style.maxWidth = '400px';
        toast.style.lineHeight = '1.6';
        
        toast.innerHTML = `
            <div style="font-size:14px; margin-bottom:4px; font-weight:800;">⚠️ Cảnh báo Hạn mức Dịch</div>
            <div>${req.message} Hệ thống tự động chuyển sang chế độ dịch thô (Vietphrase).</div>
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.5s ease';
            setTimeout(() => toast.remove(), 500);
        }, 6500);
    }
    return true;
});

// ============================================================
// 12. AUTO TRANSLATE & DOM OBSERVER
// ============================================================
let autoEnabled = false;
let autoDebounce = null;

chrome.storage.local.get(['autoTranslate'], r => {
    autoEnabled = !!r.autoTranslate;
    if (autoEnabled) {
        document.readyState === 'loading'
            ? document.addEventListener('DOMContentLoaded', autoTranslate)
            : autoTranslate();
    }
});

chrome.storage.onChanged.addListener((changes, ns) => {
    if (ns === 'local' && changes.autoTranslate) {
        autoEnabled = changes.autoTranslate.newValue;
        if (autoEnabled) autoTranslate();
    }
});

function autoTranslate() {
    if (!autoEnabled || !document.body) return;
    startSession(false);
}

const domObs = new MutationObserver(muts => {
    if (!autoEnabled) return;
    let hasChinese = false;
    for (const m of muts) {
        if (m.type === 'childList') {
            for (const n of m.addedNodes) {
                const txt = n.nodeType === 3 ? n.nodeValue : n.textContent;
                if (/[\u4e00-\u9fa5]/.test(txt || '')) { hasChinese = true; break; }
            }
        } else if (m.type === 'characterData') {
            const txt = m.target.nodeValue;
            if (/[\u4e00-\u9fa5]/.test(txt || '')) { hasChinese = true; }
        }
        if (hasChinese) break;
    }
    if (hasChinese) {
        clearTimeout(autoDebounce);
        autoDebounce = setTimeout(autoTranslate, 400); // Faster reaction time for captions/lyrics
    }
});

let lastUrl = location.href;
let autoNextTriggered = false;
window.isTtsPlaying = false; // Flag to let TTS players coordinate with auto-next

function checkAndTriggerAutoNext(force = false) {
    if (typeof chrome === 'undefined' || !chrome.storage) return;

    // If currently translating, postpone checking until translateAllPending completes
    if (isTranslating) {
        console.log("[AutoNext] Trang đang dịch. Trì hoãn chuyển chương tự động.");
        return;
    }

    chrome.storage.local.get(['autoNext', 'nextChapterSelector', 'autoNextDelay'], (res) => {
        const autoNext = res.autoNext !== undefined ? res.autoNext : true;
        if (!autoNext || autoNextTriggered) return;

        // Coordinate with TTS: if TTS is currently reading, do not trigger auto-next yet
        if (window.isTtsPlaying) {
            console.log("[AutoNext] TTS đang phát. Tạm dừng chuyển trang tự động.");
            return;
        }

        // Check if user has scrolled near the bottom (150px threshold), OR if the page is too short to scroll
        const isNearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 150;
        const isTooShort = document.documentElement.scrollHeight <= window.innerHeight + 150;

        if (force || isNearBottom || isTooShort) {
            const selector = res.nextChapterSelector || '.next-btn, #next-chap, a:contains("下一章"), a[rel="next"]';
            
            // Native query selector find
            let nextBtn = null;
            const selectors = selector.split(',').map(s => s.trim());
            for (const sel of selectors) {
                try {
                    if (sel.includes(':contains')) {
                        const matchText = sel.match(/"([^"]+)"/)?.[1] || sel.match(/'([^']+)'/)?.[1];
                        if (matchText) {
                            const anchors = Array.from(document.querySelectorAll('a'));
                            nextBtn = anchors.find(a => a.textContent.includes(matchText));
                        }
                    } else {
                        nextBtn = document.querySelector(sel);
                    }
                } catch (e) {}
                if (nextBtn) break;
            }

            if (nextBtn) {
                autoNextTriggered = true;
                const delaySeconds = res.autoNextDelay !== undefined ? res.autoNextDelay : 3;
                console.log(`[AutoNext] Điều kiện chuyển chương thỏa mãn. Sẽ chuyển chương sau ${delaySeconds}s...`, nextBtn);
                
                // Visual feedback with countdown timer
                const tip = document.createElement('div');
                tip.style.position = 'fixed';
                tip.style.bottom = '24px';
                tip.style.right = '24px';
                tip.style.background = 'linear-gradient(135deg, #3f51b5, #1a237e)';
                tip.style.color = '#fff';
                tip.style.padding = '10px 18px';
                tip.style.borderRadius = '10px';
                tip.style.zIndex = '99999';
                tip.style.fontSize = '12px';
                tip.style.fontWeight = 'bold';
                tip.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)';
                tip.style.border = '1px solid rgba(255,255,255,0.1)';
                tip.style.transition = 'all 0.3s ease';
                
                let remaining = delaySeconds;
                tip.innerText = `Chuyển chương sau trong ${remaining}s...`;
                document.body.appendChild(tip);

                const timer = setInterval(() => {
                    remaining--;
                    if (remaining <= 0) {
                        clearInterval(timer);
                    } else {
                        tip.innerText = `Chuyển chương sau trong ${remaining}s...`;
                    }
                }, 1000);
                
                setTimeout(() => {
                    clearInterval(timer);
                    // Double check TTS status before click
                    if (window.isTtsPlaying) {
                        console.log("[AutoNext] TTS hoạt động trở lại trong lúc chờ. Hủy tự động click.");
                        autoNextTriggered = false;
                        tip.remove();
                        return;
                    }
                    
                    try {
                        nextBtn.click();
                    } catch (err) {
                        console.error(err);
                        autoNextTriggered = false;
                        tip.remove();
                    }
                }, delaySeconds * 1000);
            }
        }
    });
}

function init() {
    domObs.observe(document.body, { 
        childList: true, 
        subtree: true,
        characterData: true 
    });
    
    // Periodically monitor URL changes every 600ms
    setInterval(() => {
        if (location.href !== lastUrl) {
            console.log(`[URL Changed] ${lastUrl} -> ${location.href}. Resetting translation session...`);
            lastUrl = location.href;
            autoNextTriggered = false; // Reset lock on page change
            historySynced = false; // Reset history sync lock on page change
            if (autoEnabled) {
                startSession(true);
            }
        }
    }, 600);

    // Scroll to bottom -> Auto click next chapter button
    window.addEventListener('scroll', () => {
        checkAndTriggerAutoNext(false);
    });

    // Initial check in case page is short or already scrolled
    setTimeout(() => {
        checkAndTriggerAutoNext(false);
    }, 1500);
}
document.body ? init() : window.addEventListener('DOMContentLoaded', init);
