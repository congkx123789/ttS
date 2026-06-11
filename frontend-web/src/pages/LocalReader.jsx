import React, { useState, useEffect } from 'react';
import MainLayout from '../layouts/MainLayout';
import { useReaderSettings } from '../contexts/ReaderSettingsContext';
import { useLang } from '../contexts/LangContext';
import JSZip from 'jszip';
import { 
  BookOpen, Plus, Trash2, ArrowLeft, ChevronLeft, ChevronRight, 
  Settings, Upload, FileText, Check, AlertCircle, FileCode, Play,
  Search, X, Volume2
} from 'lucide-react';
import AudioPlayer from '../components/AudioPlayer';
import { useUsageTracker } from '../hooks/useUsageTracker';

// IndexedDB Database helper for storing offline books (unlimited storage)
const DB_NAME = 'LocalNovelsDB';
const STORE_NAME = 'novels_shelf';
const DB_VERSION = 1;

function getIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function getLocalBooksFromDB() {
  try {
    const db = await getIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('IndexedDB getLocalBooks error:', err);
    return [];
  }
}

async function saveLocalBookToDB(book) {
  try {
    const db = await getIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(book);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('IndexedDB saveLocalBook error:', err);
    return false;
  }
}

async function deleteLocalBookFromDB(bookId) {
  try {
    const db = await getIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(bookId);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('IndexedDB deleteLocalBook error:', err);
    return false;
  }
}

export default function LocalReader() {
  const { theme, fontSize, fontFamily, lineHeight, setTheme, decreaseFontSize, increaseFontSize } = useReaderSettings();
  const { t, lang } = useLang();
  
  // Track active reading time for offline/local novels on the web platform
  useUsageTracker('web', 'read');

  // Local book list stored in IndexedDB
  const [localBooks, setLocalBooks] = useState([]);

  // UI state
  const [activeBook, setActiveBook] = useState(null); // The currently reading book object
  const [activeChapterIdx, setActiveChapterIdx] = useState(0); // Index in book.chapters
  const [showImportForm, setShowImportForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Bulk Edit / Select to delete states for offline books
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState(new Set());
  
  // Table of Contents & TTS States
  const [showToc, setShowToc] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupIdx, setSelectedGroupIdx] = useState(0);
  const [activeAudioObj, setActiveAudioObj] = useState(null);

  // Form states
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [rawText, setRawText] = useState('');
  const [importMode, setImportMode] = useState('auto'); // 'auto' or 'json'
  const [parseLogs, setParseLogs] = useState('');
  const [fileError, setFileError] = useState('');

  const [storageInfo, setStorageInfo] = useState(null);

  // Function to calculate IndexedDB storage space usage
  const updateStorageEstimate = async () => {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const usageInMB = (estimate.usage / (1024 * 1024)).toFixed(2);
        const quotaInMB = (estimate.quota / (1024 * 1024)).toLocaleString(undefined, { maximumFractionDigits: 0 });
        setStorageInfo({ usage: usageInMB, quota: quotaInMB });
      } catch (e) {
        console.error('Failed to get storage estimate:', e);
      }
    }
  };

  // Load books from IndexedDB on component mount
  useEffect(() => {
    async function loadBooks() {
      const books = await getLocalBooksFromDB();
      setLocalBooks(books);
      updateStorageEstimate();
    }
    loadBooks();
  }, []);

  // Update storage usage estimate whenever books list changes
  useEffect(() => {
    updateStorageEstimate();
  }, [localBooks]);

  // Handle deletion of all local novels from IndexedDB
  const handleClearAllData = async () => {
    const confirmMsg = lang === 'zh' 
      ? "⚠️ 警告：此操作将删除设备上保存的所有离线小说，且无法恢复。您确定要删除吗？" 
      : lang === 'en' 
      ? "⚠️ WARNING: This will DELETE ALL offline novels saved on this device and CANNOT be recovered. Are you sure you want to delete?" 
      : "⚠️ CẢNH BÁO: Hành động này sẽ XÓA TOÀN BỘ truyện offline lưu trong thiết bị và không thể khôi phục. Bạn có chắc chắn muốn xóa không?";
    
    const successMsg = lang === 'zh'
      ? "成功清空离线存储空间。"
      : lang === 'en'
      ? "Successfully cleared offline storage memory."
      : "Đã xóa sạch bộ nhớ lưu trữ offline thành công.";

    const errorMsg = lang === 'zh'
      ? "清空存储出错: "
      : lang === 'en'
      ? "Error clearing storage: "
      : "Lỗi khi dọn dẹp bộ nhớ: ";

    if (confirm(confirmMsg)) {
      try {
        const db = await getIndexedDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        await new Promise((resolve, reject) => {
          const request = store.clear();
          request.onsuccess = () => resolve(true);
          request.onerror = (e) => reject(e.target.error);
        });
        
        // Clear all progress keys
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('local_progress_')) {
            localStorage.removeItem(key);
          }
        }
        
        setLocalBooks([]);
        updateStorageEstimate();
        alert(successMsg);
      } catch (err) {
        alert(errorMsg + err.message);
      }
    }
  };

  // Load reading progress when activeBook changes
  useEffect(() => {
    if (activeBook) {
      const progressKey = `local_progress_${activeBook.id}`;
      const savedIdx = localStorage.getItem(progressKey);
      if (savedIdx !== null) {
        const idx = parseInt(savedIdx);
        if (idx >= 0 && idx < activeBook.chapters.length) {
          setActiveChapterIdx(idx);
        } else {
          setActiveChapterIdx(0);
        }
      } else {
        setActiveChapterIdx(0);
      }
    }
  }, [activeBook]);

  // Save progress when activeChapterIdx changes
  useEffect(() => {
    if (activeBook) {
      const progressKey = `local_progress_${activeBook.id}`;
      localStorage.setItem(progressKey, activeChapterIdx.toString());
      
      // Auto scroll to top of window for seamless chapter transition
      window.scrollTo(0, 0);

      // Auto align the active TOC group selection (e.g. index 105 goes to group 1)
      setSelectedGroupIdx(Math.floor(activeChapterIdx / 100));

      // Auto update audio object content if TTS is currently active/playing
      if (activeAudioObj) {
        setActiveAudioObj({
          title_vietphrase: activeBook.chapters[activeChapterIdx]?.title || '',
          title: activeBook.chapters[activeChapterIdx]?.title || '',
          description: activeBook.chapters[activeChapterIdx]?.content || '',
          isChapter: true
        });
      }

      // Update in-memory shelf list state immediately for fast, lag-free UI reactivity
      const updatedReadChapter = activeBook.chapters[activeChapterIdx]?.title || 'Chương 1';
      setLocalBooks(prev => prev.map(b => b.id === activeBook.id ? {
        ...b,
        lastReadChapter: updatedReadChapter,
        updatedAt: Date.now()
      } : b));
    }
  }, [activeChapterIdx]);

  // EPUB parser using JSZip
  const parseEpubFile = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      // Read OPF (content.opf or package.opf) to find chapter order
      let opfContent = null;
      let opfPath = '';

      // First find the container.xml to locate OPF
      const containerFile = zip.file('META-INF/container.xml');
      if (containerFile) {
        const containerXml = await containerFile.async('text');
        const rootfileMatch = containerXml.match(/full-path="([^"]+\.opf)"/i);
        if (rootfileMatch) {
          opfPath = rootfileMatch[1];
          const opfFile = zip.file(opfPath);
          if (opfFile) opfContent = await opfFile.async('text');
        }
      }

      // Fallback: find any .opf file
      if (!opfContent) {
        for (const fname of Object.keys(zip.files)) {
          if (fname.endsWith('.opf')) {
            opfPath = fname;
            opfContent = await zip.files[fname].async('text');
            break;
          }
        }
      }

      const opfBase = opfPath ? opfPath.split('/').slice(0, -1).join('/') : '';

      // ── Extract metadata: title, author, cover ──────────────────
      let epubTitle = '';
      let epubAuthor = '';
      let coverBase64 = null;

      if (opfContent) {
        // dc:title or title
        const titleMatch = opfContent.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i)
          || opfContent.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        if (titleMatch) epubTitle = titleMatch[1].replace(/<[^>]+>/g, '').trim();

        // dc:creator or creator or publisher
        const creatorMatch = opfContent.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i)
          || opfContent.match(/<creator[^>]*>([\s\S]*?)<\/creator>/i)
          || opfContent.match(/<dc:publisher[^>]*>([\s\S]*?)<\/dc:publisher>/i);
        if (creatorMatch) epubAuthor = creatorMatch[1].replace(/<[^>]+>/g, '').trim();

        // Find cover image via manifest
        const manifestItems = {};
        const itemMatches = opfContent.matchAll(/<item\s+([^>]+)>/gi);
        for (const m of itemMatches) {
          const attr = m[1];
          const idMatch = attr.match(/id=["']([^"']+)["']/i);
          const hrefMatch = attr.match(/href=["']([^"']+)["']/i);
          const mediaTypeMatch = attr.match(/media-type=["']([^"']+)["']/i);
          const propertiesMatch = attr.match(/properties=["']([^"']+)["']/i);
          if (idMatch && hrefMatch) {
            manifestItems[idMatch[1]] = {
              href: hrefMatch[1],
              mediaType: mediaTypeMatch ? mediaTypeMatch[1] : '',
              properties: propertiesMatch ? propertiesMatch[1] : ''
            };
          }
        }

        // Find cover item
        let coverHref = null;
        for (const [id, item] of Object.entries(manifestItems)) {
          if (
            id.toLowerCase().includes('cover') ||
            (item.properties && item.properties.toLowerCase().includes('cover-image')) ||
            (item.mediaType.startsWith('image/') && id.toLowerCase() === 'cover')
          ) {
            coverHref = item.href;
            break;
          }
        }
        // Fallback: look for meta name="cover" with single/double quotes
        if (!coverHref) {
          const metaCoverMatch = opfContent.match(/<meta[^>]+name=["']cover["'][^>]+content=["']([^"']+)["']/i)
            || opfContent.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']cover["']/i);
          if (metaCoverMatch && manifestItems[metaCoverMatch[1]]) {
            coverHref = manifestItems[metaCoverMatch[1]].href;
          }
        }
        // Fallback: first image in manifest that looks like cover
        if (!coverHref) {
          for (const [id, item] of Object.entries(manifestItems)) {
            if (item.mediaType.startsWith('image/') && /cover|thumb|front/i.test(id + item.href)) {
              coverHref = item.href;
              break;
            }
          }
        }
        // Fallback: just first image
        if (!coverHref) {
          for (const [, item] of Object.entries(manifestItems)) {
            if (item.mediaType.startsWith('image/')) {
              coverHref = item.href;
              break;
            }
          }
        }

        if (coverHref) {
          const decodedCoverHref = decodeURIComponent(coverHref);
          const fullCoverPath = opfBase ? `${opfBase}/${decodedCoverHref}` : decodedCoverHref;
          const coverZipFile = zip.file(fullCoverPath) || zip.file(decodedCoverHref) || zip.file(coverHref);
          if (coverZipFile) {
            try {
              const coverBytes = await coverZipFile.async('base64');
              const ext = coverHref.split('.').pop().toLowerCase();
              const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
              coverBase64 = `data:${mime};base64,${coverBytes}`;
            } catch (e) {
              console.warn('Cover extraction failed:', e);
            }
          }
        }
      }

      // Parse spine + manifest to get chapter file order
      let spineItems = [];
      if (opfContent) {
        const manifestItems2 = {};
        const itemMatches2 = opfContent.matchAll(/<item\s+([^>]+)>/gi);
        for (const m of itemMatches2) {
          const attributesStr = m[1];
          const idMatch = attributesStr.match(/id="([^"]+)"/i);
          const hrefMatch = attributesStr.match(/href="([^"]+)"/i);
          if (idMatch && hrefMatch) {
            manifestItems2[idMatch[1]] = hrefMatch[1];
          }
        }
        const itemrefMatches = opfContent.matchAll(/<itemref\s+([^>]+)>/gi);
        for (const m of itemrefMatches) {
          const attributesStr = m[1];
          const idrefMatch = attributesStr.match(/idref="([^"]+)"/i);
          if (idrefMatch && manifestItems2[idrefMatch[1]]) {
            spineItems.push(manifestItems2[idrefMatch[1]]);
          }
        }
      }

      // If no spine found, fall back to all HTML files
      if (spineItems.length === 0) {
        spineItems = Object.keys(zip.files).filter(f => f.endsWith('.html') || f.endsWith('.xhtml') || f.endsWith('.htm'));
      }

      // Parse each spine HTML file to extract chapter title and content
      const chapters = [];
      for (const itemHref of spineItems) {
        const decodedHref = decodeURIComponent(itemHref);
        const fullPath = opfBase ? `${opfBase}/${decodedHref}` : decodedHref;
        
        // Find zip file using multiple safety matchers
        let zipEntry = zip.file(fullPath) || zip.file(decodedHref) || zip.file(itemHref);
        if (!zipEntry) {
          const targetFilename = decodedHref.split('/').pop();
          for (const fname of Object.keys(zip.files)) {
            if (fname.endsWith(targetFilename)) {
              zipEntry = zip.file(fname);
              break;
            }
          }
        }
        
        if (!zipEntry) continue;

        const html = await zipEntry.async('text');
        
        // Extract title from <h1>, <h2>, <h3> or <title>
        let chapTitle = '';
        const h1Match = html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
        if (h1Match) {
          chapTitle = h1Match[1].replace(/<[^>]+>/g, '').trim();
        }
        if (!chapTitle) {
          const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          if (titleMatch) chapTitle = titleMatch[1].replace(/<[^>]+>/g, '').trim();
        }
        if (!chapTitle) chapTitle = decodedHref.split('/').pop().replace(/\.xhtml$/i, '').replace(/\.html$/i, '');

        // Extract body text content, stripping HTML tags
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        let bodyText = bodyMatch ? bodyMatch[1] : html;
        bodyText = bodyText
          .replace(/<\/p>/gi, '\n')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/div>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        if (bodyText.length > 5) {
          chapters.push({ title: chapTitle, content: bodyText });
        }
      }

      return { chapters, title: epubTitle, author: epubAuthor, coverBase64 };
    } catch (err) {
      console.error('EPUB parse error:', err);
      return null;
    }
  };

  // File upload handler
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileError('');
    setParseLogs('');

    if (file.name.endsWith('.epub')) {
      const startLog = lang === 'zh' ? '正在解析 EPUB 文件...' : lang === 'en' ? 'Parsing EPUB file...' : 'Đang phân tích tệp EPUB...';
      setParseLogs(startLog);
      
      const result = await parseEpubFile(file);
      if (!result || !result.chapters || result.chapters.length === 0) {
        const parseErr = lang === 'zh' ? '无法读取 EPUB 内容。文件可能已被加密或无效。' : lang === 'en' ? 'Cannot read EPUB content. File may be encrypted or invalid.' : 'Không thể đọc nội dung EPUB. Tệp có thể bị mã hóa hoặc không hợp lệ.';
        setFileError(parseErr);
        setParseLogs('');
        return;
      }

      const { chapters, title: epubTitle, author: epubAuthor, coverBase64 } = result;

      // Use metadata from EPUB, fallback to filename / form fields
      const guessedTitle = epubTitle || file.name.replace(/\.epub$/i, '').replace(/_/g, ' ');
      const guessedAuthor = epubAuthor || (lang === 'zh' ? '未知' : lang === 'en' ? 'Unknown' : 'Chưa rõ');

      if (!title) setTitle(guessedTitle);
      if (!author) setAuthor(guessedAuthor);

      // Set chapters directly, bypass rawText form by immediately creating a book
      const newBook = {
        id: 'local_' + Date.now(),
        title: guessedTitle,
        author: guessedAuthor,
        cover: coverBase64 || null,
        chapters,
        updatedAt: Date.now(),
        lastReadChapter: chapters[0].title
      };
      saveLocalBookToDB(newBook).then(() => {
        setLocalBooks(prev => [newBook, ...prev]);
        setShowImportForm(false);
        const parseOk = lang === 'zh' ? `✓ 成功导入 EPUB：共 ${chapters.length} 章。` : lang === 'en' ? `✓ Successfully imported EPUB: ${chapters.length} chapters.` : `✓ Đã nhúng EPUB thành công: ${chapters.length} chương${epubAuthor ? ` — Tác giả: ${epubAuthor}` : ''}.`;
        setParseLogs(parseOk);
        setTimeout(() => setParseLogs(''), 4000);
      });
      return;
    }

    const reader = new FileReader();

    if (file.name.endsWith('.json')) {
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (Array.isArray(parsed)) {
            if (parsed.length > 0 && parsed[0].title && parsed[0].content) {
              setRawText(JSON.stringify(parsed, null, 2));
              setImportMode('json');
              const jsonOk = lang === 'zh' ? `成功加载 JSON 文件：检测到 ${parsed.length} 个章节。` : lang === 'en' ? `Successfully loaded JSON file: ${parsed.length} chapters detected.` : `Đã tải tệp JSON thành công: ${parsed.length} chương phát hiện.`;
              setParseLogs(jsonOk);
            } else {
              const formatErr = lang === 'zh' ? "JSON 格式不正确。格式应为 [{ title: '...', content: '...' }]" : lang === 'en' ? "Invalid JSON format. Expected [{ title: '...', content: '...' }]" : "Tệp JSON không đúng định dạng. Cần dạng mảng [{ title: '...', content: '...' }]";
              setFileError(formatErr);
            }
          } else {
            const listErr = lang === 'zh' ? "JSON 文件必须是章节列表。" : lang === 'en' ? "JSON file must be a list of chapters." : "Tệp JSON phải là một danh sách các chương.";
            setFileError(listErr);
          }
        } catch (err) {
          const syntaxErr = lang === 'zh' ? "JSON 语法错误。请检查文件。" : lang === 'en' ? "JSON syntax error. Please check your file." : "Lỗi cú pháp JSON. Vui lòng kiểm tra lại tệp.";
          setFileError(syntaxErr);
        }
      };
      reader.readAsText(file);
    } else {
      reader.onload = (event) => {
        setRawText(event.target.result);
        setImportMode('auto');
        const txtOk = lang === 'zh' ? `成功加载文本文件：${(event.target.result.length / 1024).toFixed(1)} KB。` : lang === 'en' ? `Successfully loaded text file: ${(event.target.result.length / 1024).toFixed(1)} KB.` : `Đã tải tệp văn bản thành công: ${(event.target.result.length / 1024).toFixed(1)} KB.`;
        setParseLogs(txtOk);
      };
      reader.readAsText(file);
    }
  };

  // Process smart parsing
  const handleImportSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !author.trim() || !rawText.trim()) {
      const fillErr = lang === 'zh' ? "请填写书名、作者和小说内容。" : lang === 'en' ? "Please fill in Book Title, Author and Novel Content." : "Vui lòng điền đầy đủ Tên truyện, Tác giả và Nội dung truyện.";
      alert(fillErr);
      return;
    }

    let parsedChapters = [];

    if (importMode === 'json') {
      try {
        const jsonList = JSON.parse(rawText);
        if (Array.isArray(jsonList)) {
          parsedChapters = jsonList.map((ch, idx) => ({
            title: ch.title || (lang === 'zh' ? `第 ${idx + 1} 章` : lang === 'en' ? `Chapter ${idx + 1}` : `Chương ${idx + 1}`),
            content: ch.content || ''
          }));
        }
      } catch (err) {
        const jsonErr = lang === 'zh' ? "JSON 内容无效。" : lang === 'en' ? "Invalid JSON content." : "Nội dung JSON không hợp lệ.";
        alert(jsonErr);
        return;
      }
    } else {
      // Auto-parse plain text by matching chapter patterns
      const lines = rawText.split('\n');
      let currentTitle = '';
      let currentContent = [];

      // Regex matching chapter prefixes: "Chương 1:", "Chương I -", "Quyển 2 Chương 4:", "Chapter 5"
      const chapterRegex = /^([Cc]hương|[Cc]hapter|[Qq]uyển\s+\d+\s+[Cc]hương)\s+(\d+|[IVXLCDM]+|[一二三四五六七八九十百千]+)([:\s.-]|$)/i;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (chapterRegex.test(trimmed) && trimmed.length < 100) {
          // If we already have a chapter being collected, save it
          if (currentTitle || currentContent.length > 0) {
            parsedChapters.push({
              title: currentTitle || (lang === 'zh' ? '前言 / 简介' : lang === 'en' ? 'Introduction / Prologue' : 'Giới thiệu / Mở đầu'),
              content: currentContent.join('\n').trim()
            });
          }
          currentTitle = trimmed;
          currentContent = [];
        } else {
          if (trimmed || currentContent.length > 0) {
            currentContent.push(line);
          }
        }
      }

      // Add the final chapter
      if (currentTitle || currentContent.length > 0) {
        parsedChapters.push({
          title: currentTitle || (lang === 'zh' ? '第 1 章' : lang === 'en' ? 'Chapter 1' : 'Chương 1'),
          content: currentContent.join('\n').trim()
        });
      }
    }

    if (parsedChapters.length === 0) {
      const emptyErr = lang === 'zh' ? "在输入文本中未找到任何章节。请尝试手动解析。" : lang === 'en' ? "No chapters found in the input text. Try to parse manually." : "Không tìm thấy chương nào trong văn bản đã nhập. Hãy thử phân tích thủ công.";
      alert(emptyErr);
      return;
    }

    const newBook = {
      id: 'local_' + Date.now(),
      title: title.trim(),
      author: author.trim(),
      cover: coverUrl.trim() || null,
      chapters: parsedChapters,
      updatedAt: Date.now(),
      lastReadChapter: parsedChapters[0].title
    };

    saveLocalBookToDB(newBook).then(() => {
      setLocalBooks(prev => [newBook, ...prev]);
      
      // Reset form states
      setTitle('');
      setAuthor('');
      setCoverUrl('');
      setRawText('');
      setParseLogs('');
      setShowImportForm(false);
    });
  };

  // Delete book from local shelf
  const handleDeleteBook = async (bookId, e) => {
    e.stopPropagation();
    const deleteConfirm = lang === 'zh' ? "您确定要从设备中删除这部小说吗？此操作无法撤销。" : lang === 'en' ? "Are you sure you want to delete this novel from your device? This action cannot be undone." : "Bạn có chắc chắn muốn xoá truyện này khỏi thiết bị không? Hành động này không thể hoàn tác.";
    if (confirm(deleteConfirm)) {
      await deleteLocalBookFromDB(bookId);
      setLocalBooks(prev => prev.filter(b => b.id !== bookId));
      localStorage.removeItem(`local_progress_${bookId}`);
      setSelectedBookIds(prev => {
        const next = new Set(prev);
        next.delete(bookId);
        return next;
      });
    }
  };

  const handleSelectBook = (bookId, e) => {
    if (e) e.stopPropagation();
    setSelectedBookIds(prev => {
      const next = new Set(prev);
      if (next.has(bookId)) {
        next.delete(bookId);
      } else {
        next.add(bookId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedBookIds.size === localBooks.length) {
      setSelectedBookIds(new Set());
    } else {
      setSelectedBookIds(new Set(localBooks.map(b => b.id).filter(Boolean)));
    }
  };

  const handleBulkDelete = async () => {
    const confirmMsg = lang === 'zh'
      ? `您确定要删除选中的 ${selectedBookIds.size} 部小说吗？此操作无法撤销。`
      : lang === 'en'
      ? `Are you sure you want to delete the ${selectedBookIds.size} selected novels? This action cannot be undone.`
      : `Bạn có chắc chắn muốn xóa ${selectedBookIds.size} truyện đã chọn khỏi thiết bị không? Hành động này không thể hoàn tác.`;
    
    if (confirm(confirmMsg)) {
      for (const bookId of selectedBookIds) {
        await deleteLocalBookFromDB(bookId);
        localStorage.removeItem(`local_progress_${bookId}`);
      }
      setLocalBooks(prev => prev.filter(b => !selectedBookIds.has(b.id)));
      setSelectedBookIds(new Set());
      setIsEditMode(false);
    }
  };

  // Detect clean/embed mode (inside iframe or with clean=true query parameter)
  const query = new URLSearchParams(window.location.search);
  const isCleanMode = query.get('clean') === 'true' || query.get('embed') === 'true' || window.self !== window.top;

  // Reader Width state
  const [readerWidth, setReaderWidth] = useState(() => {
    return localStorage.getItem('local_reader_width') || 'medium';
  });

  const saveReaderWidth = (width) => {
    setReaderWidth(width);
    localStorage.setItem('local_reader_width', width);
  };

  const getReaderWidthClass = () => {
    switch (readerWidth) {
      case 'narrow': return 'max-w-2xl'; // ~672px
      case 'wide': return 'max-w-5xl'; // ~1024px
      case 'full': return 'max-w-none px-6 md:px-12 lg:px-24'; // 100% full screen width
      default: return 'max-w-3xl'; // ~768px (medium)
    }
  };

  const handleTTSPlay = () => {
    if (activeAudioObj) {
      setActiveAudioObj(null);
    } else {
      setActiveAudioObj({
        title_vietphrase: activeBook.chapters[activeChapterIdx]?.title || '',
        title: activeBook.chapters[activeChapterIdx]?.title || '',
        description: activeBook.chapters[activeChapterIdx]?.content || '',
        isChapter: true
      });
    }
  };

  const handleBackToShelf = () => {
    if (activeBook) {
      const updatedBook = {
        ...activeBook,
        lastReadChapter: activeBook.chapters[activeChapterIdx]?.title || 'Chương 1',
        updatedAt: Date.now()
      };
      saveLocalBookToDB(updatedBook).then(() => {
        setActiveBook(null);
      });
    } else {
      setActiveBook(null);
    }
  };

  // Get active theme colors matching reader themes
  const getThemeClass = () => {
    switch (theme) {
      case 'light': return 'bg-amber-50/90 text-slate-900 border-amber-200/40';
      case 'sepia': return 'bg-[#f4ebd0] text-[#5c4033] border-[#e4d5b0]';
      case 'gray': return 'bg-[#1e293b] text-slate-200 border-slate-700/40';
      default: return 'bg-[#0f0f26]/85 text-slate-200 border-indigo-950/40';
    }
  };

  const getReaderBg = () => {
    switch (theme) {
      case 'light': return 'bg-amber-50 text-slate-900';
      case 'sepia': return 'bg-[#f5eccb] text-[#422e24]';
      case 'gray': return 'bg-[#181d2a] text-slate-200';
      default: return 'bg-[#0b0c16] text-slate-300';
    }
  };

  const localT = {
    vi: {
      offlineFeature: "Tính năng Offline / Client-Side",
      embedTitle: "Nhúng & Đọc Truyện Của Bạn",
      embedDesc: "Tải lên hoặc dán nội dung văn bản truyện bất kỳ từ thiết bị của bạn. Công cụ sẽ tự động phân tách chương và lưu trữ an toàn trong bộ nhớ trình duyệt để bạn thưởng thức với giao diện đọc cao cấp.",
      embedNewBtn: "Nhúng truyện mới",
      importTitle: "Nhập thông tin truyện nhúng",
      closeBtn: "Đóng lại",
      bookTitleLabel: "Tiêu đề truyện *",
      bookTitlePlaceholder: "Ví dụ: Đại Quản Gia Là Ma Hoàng",
      authorLabel: "Tác giả *",
      authorPlaceholder: "Ví dụ: Dạ Kiêu",
      coverUrlLabel: "Ảnh bìa URL (Không bắt buộc)",
      selectFileLabel: "Chọn hoặc Tải lên tập tin dữ liệu",
      autoSplitTxt: "Tự động phân chương (TXT)",
      jsonFormat: "JSON Format",
      dragDropFile: "Kéo thả hoặc Chọn tập tin",
      supportedFormats: "Hỗ trợ .epub • .txt • .json",
      epubHelp: "📘 EPUB: Tải trực tiếp file .epub — tự động trích xuất tất cả chương và thêm ngay vào tủ sách.",
      txtHelp: "📄 TXT: Dán văn bản thô. Hệ thống tự phân chương qua từ khóa 'Chương 1...', 'Chapter 2...'.",
      jsonHelp: "⚙️ JSON: Định dạng mảng [{\"title\": \"...\", \"content\": \"...\"}]",
      rawContentLabel: "Nội dung truyện (Dán văn bản thô hoặc văn bản JSON)",
      rawContentPlaceholderTxt: "Nhập hoặc dán toàn bộ nội dung của cuốn truyện ở đây...",
      rawContentPlaceholderJson: '[\n  {\n    "title": "Chương 1: Khởi đầu",\n    "content": "Nội dung chương 1 ở đây..."\n  }\n]',
      cancelBtn: "Hủy bỏ",
      parseAddBtn: "Phân tích & Thêm truyện",
      myShelfTitle: "📚 Tủ Sách Nhúng Của Bạn",
      offlineStorage: "💾 Bộ nhớ offline",
      clearBtn: "Dọn sạch",
      emptyShelf: "Không có truyện nhúng nào trong bộ nhớ cục bộ.",
      embedFirstBtn: "Nhúng tác phẩm đầu tiên",
      authorPrefix: "Tác giả: ",
      chaptersCount: "chương offline",
      readingProgress: "📖 Đang đọc: ",
      clearBtnTitle: "Xóa toàn bộ truyện đã lưu ngoại tuyến",
      deleteBtnTitle: "Xóa truyện khỏi thiết bị",
      backToShelf: "Tủ sách",
      prevChapter: "Chương trước",
      nextChapter: "Chương sau",
      toc: "Mục lục",
      audioAiTitle: "Đọc Audio AI",
      settingsTitle: "Cài đặt giao diện",
      readerThemeTitle: "Giao diện đọc",
      fontSizeTitle: "Kích thước chữ",
      bgThemeTitle: "Màu nền trang",
      themeDark: "Tối",
      themeGray: "Xám đêm",
      themeSepia: "Hoài cổ",
      themeLight: "Sáng",
      pageWidthTitle: "Độ rộng trang đọc",
      widthNarrow: "Hẹp",
      widthMedium: "Vừa",
      widthWide: "Rộng",
      widthFull: "100%",
      emptyChapterContent: "Nội dung chương trống.",
      bottomPrevChapter: "Chương trước",
      bottomNextChapter: "Chương sau",
      tocModalTitle: "Mục lục tác phẩm",
      chaptersCountSuffix: "chương",
      searchChaptersPlaceholder: "Tìm kiếm chương theo tên hoặc số...",
      paginationChaptersGroup: "Chương",
      noMatchedChapters: "Không tìm thấy chương nào trùng khớp.",
      readingBadge: "Đang đọc"
    },
    en: {
      offlineFeature: "Offline / Client-Side Mode",
      embedTitle: "Embed & Read Your Own Novels",
      embedDesc: "Upload or paste any novel text content from your device. The tool will automatically split chapters and store them securely in the browser memory for you to enjoy in our premium reading interface.",
      embedNewBtn: "Embed New Novel",
      importTitle: "Import Embedded Novel Info",
      closeBtn: "Close",
      bookTitleLabel: "Book Title *",
      bookTitlePlaceholder: "e.g. The Grandmaster of Demonic Cultivation",
      authorLabel: "Author *",
      authorPlaceholder: "e.g. MXTX",
      coverUrlLabel: "Cover Image URL (Optional)",
      selectFileLabel: "Choose or Upload Data File",
      autoSplitTxt: "Auto Split Chapters (TXT)",
      jsonFormat: "JSON Format",
      dragDropFile: "Drag & drop or Click to choose",
      supportedFormats: "Supports .epub • .txt • .json",
      epubHelp: "📘 EPUB: Upload .epub file directly — auto extracts all chapters and adds them to shelf.",
      txtHelp: "📄 TXT: Paste raw text. Auto detects chapters via keywords like 'Chapter 1...', 'Chapter 2...'.",
      jsonHelp: "⚙️ JSON: Array format [{\"title\": \"...\", \"content\": \"...\"}]",
      rawContentLabel: "Novel Content (Paste raw text or JSON array)",
      rawContentPlaceholderTxt: "Enter or paste the complete content of the novel here...",
      rawContentPlaceholderJson: '[\n  {\n    "title": "Chapter 1: The Beginning",\n    "content": "Chapter 1 content here..."\n  }\n]',
      cancelBtn: "Cancel",
      parseAddBtn: "Parse & Add Novel",
      myShelfTitle: "📚 Your Embedded Bookshelf",
      offlineStorage: "💾 Offline Storage",
      clearBtn: "Clear All",
      emptyShelf: "No embedded novels in local memory.",
      embedFirstBtn: "Embed your first book",
      authorPrefix: "Author: ",
      chaptersCount: "offline chapters",
      readingProgress: "📖 Reading: ",
      clearBtnTitle: "Delete all offline stored books",
      deleteBtnTitle: "Delete book from device",
      backToShelf: "Bookshelf",
      prevChapter: "Prev Chapter",
      nextChapter: "Next Chapter",
      toc: "TOC",
      audioAiTitle: "Read Audio AI",
      settingsTitle: "Reader Settings",
      readerThemeTitle: "Reading Interface",
      fontSizeTitle: "Font Size",
      bgThemeTitle: "Background Theme",
      themeDark: "Dark",
      themeGray: "Gray",
      themeSepia: "Sepia",
      themeLight: "Light",
      pageWidthTitle: "Page Width",
      widthNarrow: "Narrow",
      widthMedium: "Medium",
      widthWide: "Wide",
      widthFull: "100%",
      emptyChapterContent: "Chapter content is empty.",
      bottomPrevChapter: "Prev",
      bottomNextChapter: "Next",
      tocModalTitle: "Table of Contents",
      chaptersCountSuffix: "chapters",
      searchChaptersPlaceholder: "Search chapters by title or index...",
      paginationChaptersGroup: "Chapters",
      noMatchedChapters: "No matching chapters found.",
      readingBadge: "Reading"
    },
    zh: {
      offlineFeature: "离线 / 客户端模式",
      embedTitle: "嵌入并阅读您的小说",
      embedDesc: "上传或粘贴设备上的任何小说文本内容。系统将自动拆分章节并安全地保存在浏览器内存中，让您在高级阅读界面中尽情享受阅读乐趣。",
      embedNewBtn: "导入新小说",
      importTitle: "输入导入小说信息",
      closeBtn: "关闭",
      bookTitleLabel: "书名 *",
      bookTitlePlaceholder: "例如：魔道祖师",
      authorLabel: "作者 *",
      authorPlaceholder: "例如：墨香铜臭",
      coverUrlLabel: "封面图片链接 (选填)",
      selectFileLabel: "选择或上传数据文件",
      autoSplitTxt: "自动分割章节 (TXT)",
      jsonFormat: "JSON 格式",
      dragDropFile: "拖拽或点击选择文件",
      supportedFormats: "支持 .epub • .txt • .json",
      epubHelp: "📘 EPUB: 直接上传 .epub 文件 — 自动提取所有章节并添加到书架中。",
      txtHelp: "📄 TXT: 粘贴纯文本。系统通过 '第1章...'、'第2章...' 自动分章。",
      jsonHelp: "⚙️ JSON: 数组格式 [{\"title\": \"...\", \"content\": \"...\"}]",
      rawContentLabel: "小说内容 (粘贴纯文本或 JSON)",
      rawContentPlaceholderTxt: "在此处输入或粘贴小说的完整内容...",
      rawContentPlaceholderJson: '[\n  {\n    "title": "第 1 章：开始",\n    "content": "第一章内容..."\n  }\n]',
      cancelBtn: "取消",
      parseAddBtn: "解析并导入小说",
      myShelfTitle: "📚 您的离线书架",
      offlineStorage: "💾 离线存储",
      clearBtn: "清空",
      emptyShelf: "本地存储中没有导入的小说。",
      embedFirstBtn: "导入第一本作品",
      authorPrefix: "作者: ",
      chaptersCount: "章离线内容",
      readingProgress: "📖 正在阅读: ",
      clearBtnTitle: "清空所有离线保存的小说",
      deleteBtnTitle: "从设备删除此小说",
      backToShelf: "书架",
      prevChapter: "上一章",
      nextChapter: "下一章",
      toc: "目录",
      audioAiTitle: "AI 语音朗读",
      settingsTitle: "界面设置",
      readerThemeTitle: "阅读界面",
      fontSizeTitle: "字体大小",
      bgThemeTitle: "背景颜色",
      themeDark: "深色",
      themeGray: "夜灰",
      themeSepia: "复古",
      themeLight: "明亮",
      pageWidthTitle: "页面宽度",
      widthNarrow: "窄版",
      widthMedium: "中等",
      widthWide: "宽版",
      widthFull: "满宽",
      emptyChapterContent: "章节内容为空。",
      bottomPrevChapter: "上一章",
      bottomNextChapter: "下一章",
      tocModalTitle: "作品目录",
      chaptersCountSuffix: "章",
      searchChaptersPlaceholder: "按名称或序号搜索章节...",
      paginationChaptersGroup: "章节",
      noMatchedChapters: "未找到匹配章节。",
      readingBadge: "正读"
    }
  };
  const curT = localT[lang] || localT.vi;

  return (
    <MainLayout hideHeader={isCleanMode}>
      {!activeBook ? (
        <div className={`mx-auto space-y-8 animate-fadeIn ${isCleanMode ? 'max-w-7xl px-6 py-8' : 'max-w-6xl'}`}>
          {/* Hero Header */}
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-500/20 p-8 md:p-12 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-3 max-w-2xl">
              <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 border border-purple-500/30 text-purple-300">
                {curT.offlineFeature}
              </span>
              <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                {curT.embedTitle}
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                {curT.embedDesc}
              </p>
            </div>

            <button
              onClick={() => setShowImportForm(true)}
              className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-full text-xs font-bold shadow-lg shadow-purple-600/20 flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" /> {curT.embedNewBtn}
            </button>
          </div>

          {/* Import Form Container */}
          {showImportForm && (
            <div className="bg-[#12122b]/90 border border-purple-500/20 rounded-2xl p-6 md:p-8 space-y-6 shadow-xl relative animate-slideUp">
              <div className="flex justify-between items-center pb-4 border-b border-white/5">
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-purple-400" /> {curT.importTitle}
                </h3>
                <button 
                  onClick={() => setShowImportForm(false)}
                  className="text-slate-400 hover:text-white text-xs transition-colors"
                >
                  {curT.closeBtn}
                </button>
              </div>

              <form onSubmit={handleImportSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">{curT.bookTitleLabel}</label>
                    <input 
                      type="text" 
                      required 
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={curT.bookTitlePlaceholder}
                      className="w-full bg-[#0a0a16] border border-[#232342] rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">{curT.authorLabel}</label>
                    <input 
                      type="text" 
                      required
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      placeholder={curT.authorPlaceholder}
                      className="w-full bg-[#0a0a16] border border-[#232342] rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">{curT.coverUrlLabel}</label>
                    <input 
                      type="url" 
                      value={coverUrl}
                      onChange={(e) => setCoverUrl(e.target.value)}
                      placeholder="https://example.com/cover.jpg"
                      className="w-full bg-[#0a0a16] border border-[#232342] rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Upload Section */}
                <div className="bg-[#090916] rounded-xl p-6 border border-[#1d1d36] space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{curT.selectFileLabel}</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setImportMode('auto')}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                          importMode === 'auto' ? 'bg-purple-600 text-white' : 'bg-[#1b1b36] text-slate-400'
                        }`}
                      >
                        {curT.autoSplitTxt}
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportMode('json')}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                          importMode === 'json' ? 'bg-purple-600 text-white' : 'bg-[#1b1b36] text-slate-400'
                        }`}
                      >
                        {curT.jsonFormat}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-[#232342] hover:border-purple-500/40 rounded-xl p-6 transition-all bg-[#0d0d1e] relative">
                      <input 
                        type="file" 
                        accept=".txt,.json,.epub"
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <Upload className="w-8 h-8 text-purple-400 mb-2" />
                      <span className="text-xs font-semibold text-slate-300">{curT.dragDropFile}</span>
                      <span className="text-[9px] text-slate-500 mt-1">{curT.supportedFormats}</span>
                    </div>

                    <div className="space-y-3">
                      <span className="text-[10px] text-slate-400 block leading-relaxed space-y-1">
                        {curT.epubHelp}
                        <br />
                        {curT.txtHelp}
                        <br />
                        {curT.jsonHelp}
                      </span>

                      {parseLogs && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg p-3 text-[10px] flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          <span>{parseLogs}</span>
                        </div>
                      )}
                      {fileError && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 text-[10px] flex items-center gap-2">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{fileError}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    {curT.rawContentLabel}
                  </label>
                  <textarea
                    required
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder={
                      importMode === 'json'
                        ? curT.rawContentPlaceholderJson
                        : curT.rawContentPlaceholderTxt
                    }
                    className="w-full h-64 bg-[#0a0a16] border border-[#232342] rounded-xl px-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono transition-colors"
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowImportForm(false)}
                    className="bg-[#1b1b36] hover:bg-[#232346] text-slate-300 px-5 py-2.5 rounded-full text-xs font-bold transition-all"
                  >
                    {curT.cancelBtn}
                  </button>
                  <button
                    type="submit"
                    className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2.5 rounded-full text-xs font-bold shadow-lg shadow-purple-600/25 transition-all"
                  >
                    {curT.parseAddBtn}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Local Bookshelf Grid */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#232342]/30 pb-3">
              <div className="flex items-center flex-wrap gap-3">
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                  {curT.myShelfTitle} ({localBooks.length})
                </h3>
                {localBooks.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setIsEditMode(!isEditMode);
                        setSelectedBookIds(new Set());
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        isEditMode
                          ? 'bg-purple-600/25 border-purple-500/50 text-purple-300 hover:bg-purple-600/35'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {isEditMode 
                        ? (lang === 'vi' ? 'Thoát quản lý' : lang === 'zh' ? '退出管理' : 'Exit management') 
                        : (lang === 'vi' ? 'Quản lý tủ sách' : lang === 'zh' ? '管理书架' : 'Manage shelf')}
                    </button>

                    {isEditMode && (
                      <>
                        <button
                          onClick={handleSelectAll}
                          className="px-3 py-1.5 bg-[#121225] border border-[#1f1f3a] rounded-lg text-xs font-bold text-slate-300 hover:bg-[#1a1a35] transition-all"
                        >
                          {selectedBookIds.size === localBooks.length 
                            ? (lang === 'vi' ? 'Hủy chọn tất cả' : lang === 'zh' ? '取消全选' : 'Deselect all') 
                            : (lang === 'vi' ? 'Chọn tất cả' : lang === 'zh' ? '全选' : 'Select all')}
                        </button>

                        {selectedBookIds.size > 0 && (
                          <button
                            onClick={handleBulkDelete}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-rose-950/20 transition-all active:scale-95 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {lang === 'vi' ? `Xóa đã chọn (${selectedBookIds.size})` : lang === 'zh' ? `删除选中 (${selectedBookIds.size})` : `Delete Selected (${selectedBookIds.size})`}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
              
              {storageInfo && (
                <div className="flex items-center gap-3 text-[11px] bg-[#12122b]/60 border border-[#232342] px-3.5 py-1.5 rounded-xl shadow-inner">
                  <span className="text-slate-400 font-medium flex items-center gap-1">
                    {curT.offlineStorage}: <strong className="text-purple-400 font-bold">{storageInfo.usage} MB</strong> / {storageInfo.quota} MB
                  </span>
                  {localBooks.length > 0 && (
                    <>
                      <div className="w-px h-3 bg-white/10" />
                      <button
                        onClick={handleClearAllData}
                        className="text-red-400 hover:text-red-300 font-extrabold flex items-center gap-1 transition-all"
                        title={curT.clearBtnTitle}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> {curT.clearBtn}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {localBooks.length === 0 ? (
              <div className="border border-dashed border-[#232342] rounded-2xl py-16 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-3">
                <BookOpen className="w-10 h-10 text-slate-600" />
                <span>{curT.emptyShelf}</span>
                <button
                  onClick={() => setShowImportForm(true)}
                  className="bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 border border-purple-500/25 px-4 py-2 rounded-full text-[11px] font-bold mt-2 transition-all"
                >
                  {curT.embedFirstBtn}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {localBooks.map(book => {
                  const isSelected = selectedBookIds.has(book.id);
                  return (
                    <div
                      key={book.id}
                      onClick={(e) => {
                        if (isEditMode) {
                          handleSelectBook(book.id, e);
                        } else {
                          setActiveBook(book);
                        }
                      }}
                      className={`bg-[#12122b]/60 border rounded-2xl p-5 flex gap-4 cursor-pointer transition-all hover:translate-y-[-2px] relative group shadow-md ${
                        isSelected 
                          ? 'border-purple-500 shadow-purple-500/5 bg-purple-950/5' 
                          : 'border-[#232342] hover:border-purple-500/30'
                      }`}
                    >
                      {/* Select Checkbox for Edit Mode */}
                      {isEditMode && (
                        <div 
                          onClick={(e) => handleSelectBook(book.id, e)}
                          className={`absolute top-3 left-3 z-30 w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-all shadow-md ${
                            isSelected 
                              ? 'bg-purple-600 border-purple-500 text-white shadow-purple-500/20' 
                              : 'bg-[#0f101f]/95 border-slate-700/80 text-slate-500 hover:bg-purple-950/25 hover:border-purple-500/50'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      )}

                      {/* Cover image */}
                      <div className={isEditMode ? 'pl-4 transition-all' : 'transition-all'}>
                        {book.cover ? (
                          <img
                            src={book.cover}
                            alt="cover"
                            className="w-[70px] h-[96px] object-cover rounded-xl border border-indigo-950/20 shadow-md shrink-0 bg-[#0f0f1a]"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-[70px] h-[96px] rounded-xl border border-indigo-950/20 bg-[#0f0f26] flex items-center justify-center text-slate-500 shrink-0 shadow-md">
                            <BookOpen className="w-6 h-6 text-purple-500/50" />
                          </div>
                        )}
                      </div>

                      {/* Book Metadata */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div className="space-y-1">
                          <h4 className="text-slate-100 font-extrabold text-sm truncate group-hover:text-purple-400 transition-colors">
                            {book.title}
                          </h4>
                          <p className="text-[11px] text-slate-400 font-semibold truncate">
                            {curT.authorPrefix}{book.author}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {book.chapters.length} {curT.chaptersCount}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[9px] text-slate-400 block truncate font-semibold bg-[#1a1a36]/50 rounded-lg px-2 py-1 border border-white/5">
                            {curT.readingProgress}{book.lastReadChapter}
                          </span>
                        </div>
                      </div>

                      {/* Actions Panel */}
                      {!isEditMode && (
                        <button
                          onClick={(e) => handleDeleteBook(book.id, e)}
                          className="absolute top-4 right-4 p-2 rounded-xl bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
                          title={curT.deleteBtnTitle}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Client-side Local Reader View */
        <div className={`transition-colors duration-300 relative ${
          isCleanMode 
            ? 'w-full min-h-screen rounded-none border-none' 
            : 'min-h-[80vh] rounded-3xl overflow-hidden border shadow-2xl'
        } ${getThemeClass()}`}>
          {/* Top Control Bar */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/5 flex items-center justify-between gap-2 bg-inherit">
            <button
              onClick={handleBackToShelf}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full hover:bg-white/5 text-xs font-bold transition-all text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{curT.backToShelf}</span>
            </button>

            {/* Center Navigation Buttons */}
            <div className="flex items-center gap-0.5 sm:gap-1 bg-black/15 rounded-2xl p-0.5 sm:p-1 border border-white/5">
              <button
                disabled={activeChapterIdx === 0}
                onClick={() => setActiveChapterIdx(prev => prev - 1)}
                className="p-1.5 sm:p-2 rounded-xl hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-all text-slate-300"
                title={curT.prevChapter}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => setShowToc(true)}
                className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-[#0b0c16] hover:bg-[#181d2a] border border-[#232342]/75 text-[11px] sm:text-xs font-bold text-slate-300 transition-all active:scale-95 max-w-[100px] sm:max-w-[240px] truncate"
              >
                <BookOpen className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span className="truncate">{activeBook.chapters[activeChapterIdx]?.title || curT.toc}</span>
              </button>

              <button
                disabled={activeChapterIdx === activeBook.chapters.length - 1}
                onClick={() => setActiveChapterIdx(prev => prev + 1)}
                className="p-1.5 sm:p-2 rounded-xl hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-all text-slate-300"
                title={curT.nextChapter}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Play Audio AI Control */}
              <button
                onClick={handleTTSPlay}
                className={`p-2 rounded-xl border transition-all ${
                  activeAudioObj
                    ? 'bg-purple-600 border-purple-600 text-white shadow shadow-purple-500/25'
                    : 'bg-black/10 border-white/5 text-slate-300 hover:bg-white/5'
                }`}
                title={curT.audioAiTitle}
              >
                {activeAudioObj ? <Volume2 className="w-4 h-4 animate-pulse" /> : <Play className="w-4 h-4 fill-current" />}
              </button>

              {/* Reader Settings Toggle */}
              <div className="relative">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 rounded-xl bg-black/10 border border-white/5 hover:bg-white/5 text-slate-300 transition-all"
                  title={curT.settingsTitle}
                >
                  <Settings className="w-4 h-4" />
                </button>

                {showSettings && (
                  <div className="absolute right-0 mt-3 w-64 bg-[#12122b] border border-purple-500/20 rounded-2xl p-4 shadow-xl z-50 space-y-4 text-slate-300">
                    <h5 className="text-xs font-bold text-white uppercase tracking-wider pb-2 border-b border-white/5">{curT.readerThemeTitle}</h5>
                    
                    {/* Font sizes */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-slate-400">{curT.fontSizeTitle}</span>
                      <div className="flex items-center justify-between">
                        <button 
                          onClick={decreaseFontSize}
                          className="px-3 py-1 bg-[#1c1c3c] rounded-lg text-xs font-bold hover:bg-[#2a2a5a]"
                        >
                          A-
                        </button>
                        <span className="text-xs font-bold">{fontSize}px</span>
                        <button 
                          onClick={increaseFontSize}
                          className="px-3 py-1 bg-[#1c1c3c] rounded-lg text-xs font-bold hover:bg-[#2a2a5a]"
                        >
                          A+
                        </button>
                      </div>
                    </div>

                    {/* Background Themes */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-slate-400">{curT.bgThemeTitle}</span>
                      <div className="grid grid-cols-4 gap-2">
                        <button 
                          onClick={() => setTheme('dark')}
                          className={`h-8 rounded-lg bg-[#0b0c16] border border-white/5 ${theme === 'dark' ? 'ring-2 ring-purple-500' : ''}`}
                          title={curT.themeDark}
                        />
                        <button 
                          onClick={() => setTheme('gray')}
                          className={`h-8 rounded-lg bg-[#181d2a] border border-slate-700 ${theme === 'gray' ? 'ring-2 ring-purple-500' : ''}`}
                          title={curT.themeGray}
                        />
                        <button 
                          onClick={() => setTheme('sepia')}
                          className={`h-8 rounded-lg bg-[#f5eccb] border border-[#e4d5b0] ${theme === 'sepia' ? 'ring-2 ring-purple-500' : ''}`}
                          title={curT.themeSepia}
                        />
                        <button 
                          onClick={() => setTheme('light')}
                          className={`h-8 rounded-lg bg-amber-50 border border-slate-300 ${theme === 'light' ? 'ring-2 ring-purple-500' : ''}`}
                          title={curT.themeLight}
                        />
                      </div>
                    </div>

                    {/* Reader Width */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-slate-400">{curT.pageWidthTitle}</span>
                      <div className="grid grid-cols-4 gap-1 bg-[#0b0c16]/50 p-1 rounded-xl border border-white/5">
                        <button 
                          onClick={() => saveReaderWidth('narrow')}
                          className={`py-1 text-[10px] font-bold rounded-lg transition-all ${readerWidth === 'narrow' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                          {curT.widthNarrow}
                        </button>
                        <button 
                          onClick={() => saveReaderWidth('medium')}
                          className={`py-1 text-[10px] font-bold rounded-lg transition-all ${readerWidth === 'medium' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                          {curT.widthMedium}
                        </button>
                        <button 
                          onClick={() => saveReaderWidth('wide')}
                          className={`py-1 text-[10px] font-bold rounded-lg transition-all ${readerWidth === 'wide' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                          {curT.widthWide}
                        </button>
                        <button 
                          onClick={() => saveReaderWidth('full')}
                          className={`py-1 text-[10px] font-bold rounded-lg transition-all ${readerWidth === 'full' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                          {curT.widthFull}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chapter Content Area */}
          <div className={`px-6 py-12 md:px-16 mx-auto space-y-6 ${getReaderWidthClass()} ${getReaderBg()}`}>
            <h3 className="text-center font-bold text-lg md:text-xl text-slate-100 tracking-tight pb-4 border-b border-white/5">
              {activeBook.chapters[activeChapterIdx]?.title}
            </h3>

            <div 
              style={{ fontSize: `${fontSize}px`, lineHeight: '1.8' }}
              className="space-y-6 whitespace-pre-wrap select-text leading-relaxed tracking-wide font-sans text-justify pt-4"
            >
              {activeBook.chapters[activeChapterIdx]?.content || curT.emptyChapterContent}
            </div>
          </div>

          {/* Bottom Reader Navigation */}
          <div className="px-4 sm:px-6 py-4 sm:py-6 border-t border-white/5 flex items-center justify-between gap-2 bg-inherit">
            <button
              disabled={activeChapterIdx === 0}
              onClick={() => setActiveChapterIdx(prev => prev - 1)}
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-black/10 hover:bg-black/20 disabled:opacity-40 disabled:pointer-events-none text-xs font-bold transition-all active:scale-95 text-slate-300"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>{curT.bottomPrevChapter}</span>
            </button>

            {/* Bottom Center: Table of Contents & Progress Info */}
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              <button
                onClick={() => setShowToc(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 border border-purple-500/20 text-xs font-bold transition-all active:scale-95"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{curT.toc}</span>
              </button>
              <span className="text-[10px] sm:text-xs text-slate-500 font-bold whitespace-nowrap">
                {activeChapterIdx + 1} / {activeBook.chapters.length}
              </span>
            </div>

            <button
              disabled={activeChapterIdx === activeBook.chapters.length - 1}
              onClick={() => setActiveChapterIdx(prev => prev + 1)}
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-black/10 hover:bg-black/20 disabled:opacity-40 disabled:pointer-events-none text-xs font-bold transition-all active:scale-95 text-slate-300"
            >
              <span>{curT.bottomNextChapter}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Table of Contents Modal */}
          {showToc && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm animate-fadeIn p-2 sm:p-4">
              <div className="bg-[#12122b] border border-purple-500/20 rounded-2xl sm:rounded-3xl w-full sm:max-w-2xl h-[90vh] sm:h-[80vh] flex flex-col overflow-hidden shadow-2xl relative">
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                  <div className="space-y-1">
                    <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-purple-400" /> {curT.tocModalTitle}
                    </h4>
                    <p className="text-[10px] text-slate-400">{activeBook.title} — {activeBook.chapters.length} {curT.chaptersCountSuffix}</p>
                  </div>
                  <button
                    onClick={() => setShowToc(false)}
                    className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Search Bar */}
                <div className="p-4 border-b border-white/5 bg-[#0b0c16]/50">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder={curT.searchChaptersPlaceholder}
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setSelectedGroupIdx(0); // reset group pagination when searching
                      }}
                      className="w-full pl-9 pr-4 py-2 bg-[#0b0c16] border border-[#232342] rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Pagination Groups (Only show if search query is empty) */}
                {!searchQuery.trim() && activeBook.chapters.length > 100 && (
                  <div className="px-4 py-2 border-b border-white/5 flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-none scroll-smooth">
                    {Array.from({ length: Math.ceil(activeBook.chapters.length / 100) }).map((_, gIdx) => {
                      const start = gIdx * 100 + 1;
                      const end = Math.min((gIdx + 1) * 100, activeBook.chapters.length);
                      const isActive = selectedGroupIdx === gIdx;
                      return (
                        <button
                          key={gIdx}
                          onClick={() => setSelectedGroupIdx(gIdx)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shrink-0 ${
                            isActive 
                              ? 'bg-purple-600 text-white' 
                              : 'bg-[#1b1b36] text-slate-400 hover:text-white'
                          }`}
                        >
                          {curT.paginationChaptersGroup} {start} - {end}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Chapters Scrollable List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-[#0b0c16]/20">
                  {(() => {
                    // Filtered list
                    let displayedChapters = [];
                    if (searchQuery.trim()) {
                      const query = searchQuery.toLowerCase();
                      displayedChapters = activeBook.chapters
                        .map((chap, idx) => ({ ...chap, idx }))
                        .filter(chap => chap.title.toLowerCase().includes(query));
                    } else {
                      const startIdx = selectedGroupIdx * 100;
                      const endIdx = Math.min(startIdx + 100, activeBook.chapters.length);
                      displayedChapters = activeBook.chapters
                        .slice(startIdx, endIdx)
                        .map((chap, idx) => ({ ...chap, idx: startIdx + idx }));
                    }

                    if (displayedChapters.length === 0) {
                      return (
                        <div className="text-center py-12 text-slate-500 text-xs">
                          {curT.noMatchedChapters}
                        </div>
                      );
                    }

                    return displayedChapters.map((chap) => {
                      const isCurrent = activeChapterIdx === chap.idx;
                      return (
                        <button
                          key={chap.idx}
                          onClick={() => {
                            setActiveChapterIdx(chap.idx);
                            setShowToc(false);
                          }}
                          className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-all ${
                            isCurrent 
                              ? 'bg-purple-600/20 text-purple-300 border border-purple-500/20' 
                              : 'hover:bg-white/5 text-slate-300 border border-transparent'
                          }`}
                        >
                          <span className="truncate">{chap.title}</span>
                          {isCurrent && (
                            <span className="text-[9px] bg-purple-600 text-white px-2 py-0.5 rounded font-extrabold uppercase">{curT.readingBadge}</span>
                          )}
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Floating Audio Player */}
          {activeAudioObj && (
            <AudioPlayer
              book={activeAudioObj}
              onClose={() => setActiveAudioObj(null)}
              onNextChapter={() => {
                if (activeChapterIdx < activeBook.chapters.length - 1) {
                  setActiveChapterIdx(prev => prev + 1);
                }
              }}
            />
          )}
        </div>
      )}
    </MainLayout>
  );
}
