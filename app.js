const STORAGE_KEY = "ket1975.progress.v1";
const SOURCE_PATH = "./ket-1975.md";
const STATUS = {
  UNVERIFIED: "unverified",
  KNOWN: "known",
  UNKNOWN: "unknown",
};

const state = {
  words: {},
  wordOrderIndex: {},
  sections: {
    unverified: [],
    known: [],
    unknown: [],
  },
  currentWord: null,
  activeTab: STATUS.UNVERIFIED,
  history: [],
  lastLookupAudio: {
    uk: "",
    us: "",
  },
};

const els = {
  currentWord: document.getElementById("current-word"),
  lookupBtn: document.getElementById("lookup-btn"),
  lookupDialog: document.getElementById("lookup-dialog"),
  lookupTitle: document.getElementById("lookup-title"),
  lookupBody: document.getElementById("lookup-body"),
  lookupPronControls: document.getElementById("lookup-pron-controls"),
  playUkBtn: document.getElementById("play-uk-btn"),
  playUsBtn: document.getElementById("play-us-btn"),
  lookupAudio: document.getElementById("lookup-audio"),
  totalCount: document.getElementById("total-count"),
  unverifiedCount: document.getElementById("unverified-count"),
  knownCount: document.getElementById("known-count"),
  unknownCount: document.getElementById("unknown-count"),
  progressRate: document.getElementById("progress-rate"),
  knownBtn: document.getElementById("known-btn"),
  unknownBtn: document.getElementById("unknown-btn"),
  skipBtn: document.getElementById("skip-btn"),
  undoBtn: document.getElementById("undo-btn"),
  exportBtn: document.getElementById("export-btn"),
  resetBtn: document.getElementById("reset-btn"),
  importInput: document.getElementById("import-input"),
  wordList: document.getElementById("word-list"),
  tabs: [...document.querySelectorAll(".tab")],
  tabUnverifiedCount: document.getElementById("tab-unverified-count"),
  tabKnownCount: document.getElementById("tab-known-count"),
  tabUnknownCount: document.getElementById("tab-unknown-count"),
};

async function fetchDictionaryData(word) {
  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return data[0];
  } catch (_error) {
    return null;
  }
}

function extractPronunciationInfo(dictionaryData) {
  const empty = {
    ukAudio: "",
    usAudio: "",
    ukPhonetic: "",
    usPhonetic: "",
    genericPhonetic: "",
  };
  if (!dictionaryData?.phonetics || !Array.isArray(dictionaryData.phonetics)) return empty;

  const normalizeAudio = (audio) => {
    if (typeof audio !== "string" || !audio.trim()) return "";
    if (audio.startsWith("//")) return `https:${audio}`;
    return audio;
  };

  const items = dictionaryData.phonetics.map((item) => ({
    text: typeof item?.text === "string" ? item.text.trim() : "",
    audio: normalizeAudio(item?.audio),
  }));

  const looksUk = (item) => /uk/i.test(item.audio) || /uk/i.test(item.text) || /br/i.test(item.text);
  const looksUs = (item) => /us/i.test(item.audio) || /us/i.test(item.text) || /n_am/i.test(item.text);

  const ukItem = items.find((item) => item.audio && looksUk(item));
  const usItem = items.find((item) => item.audio && looksUs(item));
  const firstAudio = items.find((item) => item.audio);

  const ukText = items.find((item) => item.text && looksUk(item))?.text || "";
  const usText = items.find((item) => item.text && looksUs(item))?.text || "";
  const genericText = items.find((item) => item.text)?.text || dictionaryData?.phonetic || "";

  return {
    ukAudio: ukItem?.audio || firstAudio?.audio || "",
    usAudio: usItem?.audio || firstAudio?.audio || "",
    ukPhonetic: ukText,
    usPhonetic: usText,
    genericPhonetic: genericText,
  };
}

function extractDefinitionFallback(dictionaryData) {
  if (!dictionaryData?.meanings || !Array.isArray(dictionaryData.meanings)) return "";
  const defs = [];
  dictionaryData.meanings.forEach((meaning) => {
    if (!Array.isArray(meaning?.definitions)) return;
    meaning.definitions.slice(0, 2).forEach((definitionItem) => {
      if (typeof definitionItem?.definition === "string" && definitionItem.definition.trim()) {
        defs.push(definitionItem.definition.trim());
      }
    });
  });
  return defs.slice(0, 3).join("; ");
}

function playLookupAudio(audioUrl) {
  if (!audioUrl) return;
  els.lookupAudio.src = audioUrl;
  els.lookupAudio.hidden = false;
  els.lookupAudio.play().catch(() => {
    // Some browsers block autoplay; controls remain available for manual play.
  });
}

async function lookupCurrentWord() {
  const word = state.currentWord;
  if (!word) {
    alert("当前没有可查询单词");
    return;
  }

  els.lookupBtn.disabled = true;
  els.lookupTitle.textContent = `词汇查询：${word}`;
  els.lookupBody.textContent = "查询中...";
  els.lookupAudio.hidden = true;
  els.lookupAudio.removeAttribute("src");
  els.lookupPronControls.hidden = true;
  els.playUkBtn.disabled = true;
  els.playUsBtn.disabled = true;
  state.lastLookupAudio.uk = "";
  state.lastLookupAudio.us = "";

  if (typeof els.lookupDialog.showModal === "function") {
    els.lookupDialog.showModal();
  }

  const dictionaryData = await fetchDictionaryData(word);

  const pronunciation = extractPronunciationInfo(dictionaryData);
  const definitionFallback = extractDefinitionFallback(dictionaryData);
  const resolvedTranslation = definitionFallback || "当前网络下未启用在线翻译";
  const ukLine = pronunciation.ukPhonetic || pronunciation.genericPhonetic || "暂无";
  const usLine = pronunciation.usPhonetic || pronunciation.genericPhonetic || "暂无";
  const parts = [
    `单词：${word}`,
    `翻译：${resolvedTranslation}`,
    `英音音标：${ukLine}`,
    `美音音标：${usLine}`,
  ];
  els.lookupBody.textContent = parts.join("\n");

  state.lastLookupAudio.uk = pronunciation.ukAudio || "";
  state.lastLookupAudio.us = pronunciation.usAudio || "";
  const hasUk = Boolean(state.lastLookupAudio.uk);
  const hasUs = Boolean(state.lastLookupAudio.us);
  els.lookupPronControls.hidden = !(hasUk || hasUs);
  els.playUkBtn.disabled = !hasUk;
  els.playUsBtn.disabled = !hasUs;

  if (hasUk) {
    playLookupAudio(state.lastLookupAudio.uk);
  } else if (hasUs) {
    playLookupAudio(state.lastLookupAudio.us);
  } else {
    els.lookupAudio.hidden = true;
    els.lookupAudio.removeAttribute("src");
  }

  els.lookupBtn.disabled = false;
}

function resetProgress() {
  if (!confirm("确认重置进度吗？这会删除本地 localStorage 进度并刷新页面。")) {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

function parseMarkdownWordSections(content) {
  const lines = content.split(/\r?\n/).map((line) => line.trim());
  let section = null;
  const result = { unverified: [], known: [], unknown: [] };

  for (const line of lines) {
    if (!line) continue;
    if (line === "## 未验证") {
      section = STATUS.UNVERIFIED;
      continue;
    }
    if (line === "## 会背") {
      section = STATUS.KNOWN;
      continue;
    }
    if (line === "## 不会背") {
      section = STATUS.UNKNOWN;
      continue;
    }
    if (section) {
      result[section].push(line);
    }
  }

  return result;
}

function createInitialWords(sections) {
  const words = {};
  const seen = new Set();
  const allWords = [
    ...sections.unverified,
    ...sections.known,
    ...sections.unknown,
  ];

  for (const word of allWords) {
    if (seen.has(word)) continue;
    seen.add(word);
    words[word] = {
      status: STATUS.UNVERIFIED,
      updatedAt: null,
    };
  }

  for (const word of sections.known) {
    if (words[word]) {
      words[word].status = STATUS.KNOWN;
    }
  }
  for (const word of sections.unknown) {
    if (words[word]) {
      words[word].status = STATUS.UNKNOWN;
    }
  }

  return words;
}

function buildWordOrderIndex(sections) {
  const index = {};
  const allWords = [...sections.unverified, ...sections.known, ...sections.unknown];
  let i = 0;
  for (const word of allWords) {
    if (index[word] !== undefined) continue;
    index[word] = i;
    i += 1;
  }
  return index;
}

function getPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.words) return null;
    return parsed;
  } catch (_error) {
    return null;
  }
}

function saveState() {
  const data = {
    version: 1,
    source: "html/ket-1975.md",
    updatedAt: new Date().toISOString(),
    words: state.words,
    history: state.history,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function buildSectionsFromWords() {
  const result = {
    unverified: [],
    known: [],
    unknown: [],
  };
  Object.keys(state.words).forEach((word) => {
    const currentStatus = state.words[word].status;
    result[currentStatus].push(word);
  });

  const bySourceOrder = (a, b) => {
    const ai = state.wordOrderIndex[a] ?? Number.MAX_SAFE_INTEGER;
    const bi = state.wordOrderIndex[b] ?? Number.MAX_SAFE_INTEGER;
    return ai - bi;
  };

  result.unverified.sort(bySourceOrder);
  result.known.sort(bySourceOrder);
  result.unknown.sort(bySourceOrder);
  state.sections = result;
}

function applyPersistedWords(baseWords, persistedWords) {
  Object.keys(baseWords).forEach((word) => {
    const persisted = persistedWords[word];
    if (!persisted || !persisted.status) return;
    if (Object.values(STATUS).includes(persisted.status)) {
      baseWords[word].status = persisted.status;
      baseWords[word].updatedAt = persisted.updatedAt || null;
    }
  });
}

function pickNextWord(afterWord = null) {
  const list = state.sections.unverified;
  if (list.length === 0) {
    state.currentWord = null;
    return;
  }
  if (!afterWord) {
    state.currentWord = list[0];
    return;
  }
  const currentIndex = list.indexOf(afterWord);
  if (currentIndex === -1) {
    state.currentWord = list[0];
    return;
  }
  const nextIndex = (currentIndex + 1) % list.length;
  state.currentWord = list[nextIndex];
}

function setWordStatus(word, status) {
  const current = state.words[word];
  if (!current || current.status === status) return;

  state.history.push({
    word,
    from: current.status,
    to: status,
    at: new Date().toISOString(),
  });

  current.status = status;
  current.updatedAt = new Date().toISOString();
  buildSectionsFromWords();
  pickNextWord(word);
  saveState();
  render();
}

function undoLastAction() {
  const last = state.history.pop();
  if (!last) return;
  if (!state.words[last.word]) return;
  state.words[last.word].status = last.from;
  state.words[last.word].updatedAt = new Date().toISOString();
  buildSectionsFromWords();
  if (!state.currentWord) {
    state.currentWord = last.word;
  }
  saveState();
  render();
}

function renderStats() {
  const total = Object.keys(state.words).length;
  const unverified = state.sections.unverified.length;
  const known = state.sections.known.length;
  const unknown = state.sections.unknown.length;
  const done = known + unknown;
  const progress = total ? ((done / total) * 100).toFixed(1) : "0.0";

  els.totalCount.textContent = String(total);
  els.unverifiedCount.textContent = String(unverified);
  els.knownCount.textContent = String(known);
  els.unknownCount.textContent = String(unknown);
  els.progressRate.textContent = `${progress}%`;
}

function renderCurrentWord() {
  if (!state.currentWord) {
    els.currentWord.textContent = "全部已完成，恭喜！";
    els.knownBtn.disabled = true;
    els.unknownBtn.disabled = true;
    els.skipBtn.disabled = true;
    els.lookupBtn.disabled = true;
    return;
  }

  els.currentWord.textContent = state.currentWord;
  els.knownBtn.disabled = false;
  els.unknownBtn.disabled = false;
  els.skipBtn.disabled = false;
  els.lookupBtn.disabled = false;
}

function renderList() {
  const list = state.sections[state.activeTab] || [];
  els.wordList.innerHTML = "";
  if (list.length === 0) {
    const li = document.createElement("li");
    li.textContent = "暂无单词";
    els.wordList.appendChild(li);
    return;
  }
  const fragment = document.createDocumentFragment();
  list.forEach((word) => {
    const li = document.createElement("li");
    li.textContent = word;
    fragment.appendChild(li);
  });
  els.wordList.appendChild(fragment);
}

function renderTabs() {
  els.tabUnverifiedCount.textContent = String(state.sections.unverified.length);
  els.tabKnownCount.textContent = String(state.sections.known.length);
  els.tabUnknownCount.textContent = String(state.sections.unknown.length);
  els.tabs.forEach((tab) => {
    const active = tab.dataset.tab === state.activeTab;
    tab.classList.toggle("active", active);
  });
}

function render() {
  renderStats();
  renderCurrentWord();
  renderTabs();
  renderList();
}

function serializeSectionsToMarkdown(sections) {
  const lines = [
    "## 未验证",
    ...sections.unverified,
    "",
    "## 会背",
    ...sections.known,
    "",
    "## 不会背",
    ...sections.unknown,
    "",
  ];
  return lines.join("\n");
}

function exportProgress() {
  const markdown = serializeSectionsToMarkdown(state.sections);
  const blob = new Blob([markdown], {
    type: "text/markdown;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ket-1975.md";
  a.click();
  URL.revokeObjectURL(url);
}

function importMarkdownProgress(markdownText) {
  const importedSections = parseMarkdownWordSections(markdownText);
  const importedCount =
    importedSections.unverified.length +
    importedSections.known.length +
    importedSections.unknown.length;

  if (importedCount === 0) {
    alert("导入失败：未识别到单词，请确认 md 结构");
    return;
  }

  Object.keys(state.words).forEach((word) => {
    state.words[word].status = STATUS.UNVERIFIED;
    state.words[word].updatedAt = new Date().toISOString();
  });

  const applyStatus = (words, status) => {
    words.forEach((word) => {
      if (!state.words[word]) return;
      state.words[word].status = status;
      state.words[word].updatedAt = new Date().toISOString();
    });
  };

  applyStatus(importedSections.unverified, STATUS.UNVERIFIED);
  applyStatus(importedSections.known, STATUS.KNOWN);
  applyStatus(importedSections.unknown, STATUS.UNKNOWN);

  buildSectionsFromWords();
  pickNextWord();
  saveState();
  render();
  alert("导入成功：已按 md 内容覆盖当前进度");
}

function bindEvents() {
  els.lookupBtn.addEventListener("click", lookupCurrentWord);
  els.playUkBtn.addEventListener("click", () => {
    playLookupAudio(state.lastLookupAudio.uk);
  });
  els.playUsBtn.addEventListener("click", () => {
    playLookupAudio(state.lastLookupAudio.us);
  });

  els.knownBtn.addEventListener("click", () => {
    if (!state.currentWord) return;
    setWordStatus(state.currentWord, STATUS.KNOWN);
  });

  els.unknownBtn.addEventListener("click", () => {
    if (!state.currentWord) return;
    setWordStatus(state.currentWord, STATUS.UNKNOWN);
  });

  els.skipBtn.addEventListener("click", () => {
    pickNextWord(state.currentWord);
    render();
  });

  els.undoBtn.addEventListener("click", undoLastAction);

  els.exportBtn.addEventListener("click", exportProgress);
  els.resetBtn.addEventListener("click", resetProgress);

  els.importInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      importMarkdownProgress(text);
    } catch (_error) {
      alert("导入失败：无法读取 md 文件");
    } finally {
      event.target.value = "";
    }
  });

  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      state.activeTab = tab.dataset.tab;
      renderTabs();
      renderList();
    });
  });
}

async function init() {
  try {
    const response = await fetch(SOURCE_PATH);
    if (!response.ok) {
      throw new Error(`读取词库失败: ${response.status}`);
    }
    const markdown = await response.text();

    const parsed = parseMarkdownWordSections(markdown);
    state.wordOrderIndex = buildWordOrderIndex(parsed);
    state.words = createInitialWords(parsed);

    const persisted = getPersistedState();
    if (persisted?.words) {
      applyPersistedWords(state.words, persisted.words);
      state.history = Array.isArray(persisted.history) ? persisted.history : [];
    }

    buildSectionsFromWords();
    pickNextWord();
    bindEvents();
    saveState();
    render();
  } catch (error) {
    els.currentWord.textContent = "初始化失败：请确认 ket-1975.md 可访问";
    console.error(error);
  }
}

init();
