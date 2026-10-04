import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from './api';
import { PERSONAS, QUICK_BY_PERSONA, getPersona, profileFor } from './personas';
import { ALERTS_BY_PERSONA, APPLICATIONS, DOCUMENTS_BY_PERSONA, MANAK_APPLICATIONS_URL, SERVICES, modeFromResponse } from './demoData';
import { sourceToPdfUrl } from './api';
import { RichText } from './markdown';
import { groupSources, hasPdfFile, openOnBisUrl } from './sources';
import { loadLibraryIndex } from './bisUrls';
import { hiLabel, localizeAlert, sectionLabel, t } from './i18n';
import { PROFILE_SCHEMA, profileLabel } from './profileFields';
import PdfViewer from './PdfViewer';
import VoiceMicInput from './VoiceMicInput';
import { mergeTranscriptParts } from './voiceMerge';

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

const NAV = [
  { id: 'home', icon: '⌂', label: 'Home' },
  { id: 'applications', icon: '▣', label: 'My Applications' },
  { id: 'alerts', icon: '🔔', label: 'My Alerts' },
  { id: 'documents', icon: '📄', label: 'Documents' },
  { id: 'services', icon: '▦', label: 'BIS Services' },
  { id: 'saved', icon: '☆', label: 'Saved' },
];

function usePref(mode, key, fallback) {
  const store = mode === 'preview' ? sessionStorage : localStorage;
  const full = `bis_${mode}_${key}`;
  const [value, setValue] = useState(() => store.getItem(full) || fallback);
  const update = (next) => {
    setValue(next);
    store.setItem(full, next);
  };
  return [value, update];
}

function readChats(mode) {
  const store = mode === 'preview' ? sessionStorage : localStorage;
  try {
    const parsed = JSON.parse(store.getItem(`bis_${mode}_chats`) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function useWidth(key, fallback) {
  const [value, setValue] = useState(() => {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) && n >= 180 ? n : fallback;
  });
  const update = (next) => {
    const width = Math.round(next);
    setValue(width);
    localStorage.setItem(key, String(width));
  };
  return [value, update];
}

function ProfileField({ label, value, onChange }) {
  return (
    <label>
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function initials(name) {
  return String(name || 'U').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

function prettySourceTitle(source) {
  const raw = source?.storage_uri || source?.source_file || '';
  if (raw) {
    const base = String(raw).split('/').pop().replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ');
    return base.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return source?.title || 'Document';
}

export default function PortalApp({
  mode = 'user',
  clusterId: clusterIdProp,
  clusters,
  onClusterChange,
  onExit,
}) {
  const [theme, setTheme] = usePref(mode, 'theme', 'light');
  const [personaId, setPersonaId] = usePref(mode, 'persona', mode === 'preview' ? 'industry' : 'citizen');
  const [lang, setLang] = usePref(mode, 'lang', 'en');
  const [page, setPage] = useState('home');
  const [sidebar, setSidebar] = useState(true);
  const [navW, setNavW] = useWidth('bis_nav_w', 260);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [chats, setChats] = useState(() => readChats(mode));
  const [chatId, setChatId] = useState(null);
  const [editingChat, setEditingChat] = useState(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [clusterId, setClusterId] = useState(clusterIdProp || '');
  const [clusterName, setClusterName] = useState('');
  const [error, setError] = useState('');
  const [selectedApp, setSelectedApp] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [saved, setSaved] = useState([]);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [liveApps, setLiveApps] = useState([]);
  const [modeHint, setModeHint] = useState('');
  const [docNote, setDocNote] = useState('');
  const [profilePersona, setProfilePersona] = useState(personaId);
  const [userProfile, setUserProfile] = useState(() => readJson(`bis_user_profile_${personaId}`, null) || profileFor(personaId));
  const [uploads, setUploads] = useState(() => readJson(`bis_uploads_${personaId}`, []));
  const [libReady, setLibReady] = useState(false);
  const [chatModule, setChatModule] = usePref(mode, 'chatModule', 'knowledge');
  if (profilePersona !== personaId) {
    setProfilePersona(personaId);
    setUserProfile(readJson(`bis_user_profile_${personaId}`, null) || profileFor(personaId));
    setUploads(readJson(`bis_uploads_${personaId}`, []));
    setLiveApps([]);
  }

  const persona = getPersona(personaId);

  useEffect(() => {
    loadLibraryIndex().then(() => setLibReady(true));
  }, []);
  const profile = userProfile?.name ? userProfile : profileFor(personaId);
  const profileName = profile.name || 'BIS user';
  const seedApps = APPLICATIONS[personaId] || APPLICATIONS.industry;
  const apps = [
    ...liveApps,
    ...seedApps.filter((row) => !liveApps.some((live) => live.id === row.id)),
  ];
  const prompts = QUICK_BY_PERSONA[personaId] || QUICK_BY_PERSONA.industry;
  const sessionId = useMemo(() => api.getSessionId(mode, personaId), [mode, personaId]);
  const userId = mode === 'preview' ? `preview-${personaId}` : personaId;

  useEffect(() => {
    if (clusterIdProp) setClusterId(clusterIdProp);
  }, [clusterIdProp]);

  const loadPortalConfig = useCallback(() => {
    if (mode === 'preview' && clusterIdProp) return Promise.resolve();
    return api.getPortalConfig()
      .then((cfg) => {
        if (!clusterIdProp) {
          setClusterId(cfg.publishedClusterId || '');
          setClusterName(cfg.publishedClusterName || '');
        }
        if (!cfg.publishedClusterId && mode === 'user') {
          setError('No knowledge cluster is published yet.');
        } else if (mode === 'user' && cfg.publishedClusterId) {
          setError('');
        }
      })
      .catch(() => setError('Could not reach the BIS MITRA service. Start the admin API on port 5050.'));
  }, [mode, clusterIdProp]);

  useEffect(() => {
    loadPortalConfig();
    if (mode !== 'user') return undefined;
    const onFocus = () => { loadPortalConfig(); };
    window.addEventListener('focus', onFocus);
    const pollId = setInterval(() => { loadPortalConfig(); }, 60_000);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(pollId);
    };
  }, [loadPortalConfig, mode]);

  useEffect(() => {
    setMessages([]);
    setChatId(null);
    setSelectedApp(null);
    setModeHint('');
  }, [personaId]);

  useEffect(() => {
    const store = mode === 'preview' ? sessionStorage : localStorage;
    store.setItem(`bis_${mode}_chats`, JSON.stringify(chats));
  }, [chats, mode]);

  useEffect(() => {
    if (!chatId || messages.length === 0) return;
    setChats((list) => list.map((chat) => {
      if (chat.id !== chatId) return chat;
      const first = messages.find((m) => m.role === 'user')?.text || chat.title;
      return {
        ...chat,
        messages,
        personaId,
        updatedAt: Date.now(),
        title: chat.titleEdited ? chat.title : String(first).slice(0, 52),
      };
    }));
  }, [messages, chatId, personaId]);

  const refreshAlerts = useCallback(async () => {
    try {
      const [ua, ca] = await Promise.all([
        api.getUserAlerts(sessionId, personaId),
        api.getComplianceAlerts(personaId),
      ]);
      const userAlerts = Array.isArray(ua) ? ua : (ua.alerts || []);
      const compliance = Array.isArray(ca) ? ca : (ca.alerts || []);
      const list = [...compliance, ...userAlerts];
      setLiveAlerts(list);
    } catch {
      setLiveAlerts([]);
    }
  }, [personaId, sessionId]);

  const refreshApps = useCallback(async () => {
    try {
      const data = await api.getPortalApplications(sessionId, userId, personaId);
      const list = Array.isArray(data) ? data : (data.applications || []);
      setLiveApps(list);
    } catch {
      setLiveApps([]);
    }
  }, [personaId, sessionId, userId]);

  useEffect(() => {
    refreshAlerts();
    refreshApps();
    const timer = setInterval(() => {
      refreshAlerts();
      refreshApps();
    }, 8000);
    return () => clearInterval(timer);
  }, [refreshAlerts, refreshApps]);

  const alerts = [
    ...(ALERTS_BY_PERSONA[personaId] || []).map((a) => localizeAlert(lang, a)),
    ...liveAlerts
      .filter((a) => {
        const who = a.user_id || a.userId || a.persona;
        return who === personaId || who === userId || a.session_id === sessionId;
      })
      .map((a, i) => ({
        id: a.id || `live-${i}`,
        title: a.title || a.alert_type || 'Alert',
        body: a.message || a.summary || a.body || '',
        time: a.created_at || 'Recent',
        tone: 'amber',
        tag: a.priority || '',
        evidence: a.evidence || null,
      })),
  ];

  const saveUserProfile = (next) => {
    setUserProfile(next);
    localStorage.setItem(`bis_user_profile_${personaId}`, JSON.stringify(next));
  };

  const send = useCallback(async (text, extra = {}) => {
    const message = String(text || '').trim();
    if (!message || busy) return;
    if (!clusterId) {
      setError('No knowledge cluster selected.');
      return;
    }
    setPage('home');
    setInput('');
    let activeChatId = chatId;
    if (!activeChatId) {
      activeChatId = crypto.randomUUID();
      setChatId(activeChatId);
      setChats((list) => [{
        id: activeChatId,
        title: message.slice(0, 52),
        titleEdited: false,
        messages: [],
        personaId,
        updatedAt: Date.now(),
      }, ...list]);
    }
    setMessages((m) => [...m, { role: 'user', text: message }]);
    setBusy(true);
    try {
      const history = messages.map((m) => ({ role: m.role, text: m.text, uiMode: m.uiMode }));
      const typedConfirm = /^(confirm|पुष्टि)/i.test(message);
      const lastPanel = [...messages].reverse().find((m) => m.role === 'assistant')?.panel;
      const res = await api.agentChat(message, clusterId, {
        personaMode: persona.agentMode,
        userPersona: personaId,
        sessionId,
        conversationId: activeChatId,
        userId,
        history,
        language: lang,
        userProfile,
        confirmSubmit: Boolean(extra.confirmSubmit || (typedConfirm && lastPanel?.confirmTable)),
        confirmFields: extra.confirmFields || lastPanel?.confirmTable?.fields || null,
        chatModule,
      });
      const hint = modeFromResponse(res);
      setModeHint(hint);
      setMessages((m) => [...m, {
        role: 'assistant',
        text: res.answer,
        uiMode: res.uiMode,
        chatModule: res.chatModule || chatModule,
        modules: res.modules || [],
        panel: res.panel,
        sources: res.sources || [],
        intent: res.router?.intent || res.intent,
        debug: mode === 'preview' ? {
          intent: res.router?.intent || res.intent,
          tool: res.probe?.tool,
          ruleId: res.rule?.rule_id || res.probe?.rule_id,
          retrieval: res.retrieval?.type,
        } : null,
      }]);
      refreshAlerts();
      refreshApps();
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: e.message, error: true }]);
    } finally {
      setBusy(false);
    }
  }, [busy, chatModule, chatId, clusterId, lang, messages, mode, persona.agentMode, personaId, refreshAlerts, refreshApps, sessionId, userId, userProfile]);

  const startChat = () => {
    setChatId(null);
    setMessages([]);
    setPage('home');
    setInput('');
    setEditingChat(null);
  };

  const openChat = (chat) => {
    setChatId(chat.id);
    setMessages(chat.messages || []);
    setPage('home');
    setEditingChat(null);
  };

  const deleteChat = (id) => {
    setChats((list) => list.filter((chat) => chat.id !== id));
    if (chatId === id) startChat();
  };

  const renameChat = (id, title) => {
    const next = title.trim();
    if (!next) return;
    setChats((list) => list.map((chat) => (
      chat.id === id ? { ...chat, title: next.slice(0, 52), titleEdited: true } : chat
    )));
    setEditingChat(null);
  };

  const beginDrag = (event) => {
    event.preventDefault();
    const startX = event.clientX;
    const start = navW;
    const move = (ev) => {
      const dx = ev.clientX - startX;
      setNavW(Math.min(420, Math.max(200, start + dx)));
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const openPdf = (group, passageId) => {
    const passage = group.passages?.find((p) => p.id === passageId) || group.passages?.[0];
    const source = {
      ...(passage?.source || group),
      storage_uri: group.storage_uri || passage?.source?.storage_uri,
      source_file: group.source_file || passage?.source?.source_file,
      sourceUrl: group.sourceUrl || passage?.source?.sourceUrl || passage?.source?.source_reference,
      bisUrl: group.bisUrl || passage?.source?.bisUrl,
    };
    const url = sourceToPdfUrl(source);
    const bisUrl = openOnBisUrl(source);

    if (!url || !hasPdfFile(source)) {
      if (bisUrl) {
        window.open(bisUrl, '_blank', 'noopener');
        return;
      }
      setDocNote(t(lang, 'noFile'));
      window.setTimeout(() => setDocNote(''), 4000);
      return;
    }
    setError('');
    setPdf({
      url,
      title: group.title || source.title || prettySourceTitle(source),
      passages: (group.passages || []).map((p) => ({
        ...p,
        record_id: p.record_id || p.source?.record_id || p.source?.demo_id,
        evidence: p.evidence?.length ? p.evidence : (p.source?.evidence || []),
        page_number: p.page_number || p.source?.page_number || null,
        page_number_confidence: p.page_number_confidence || p.source?.page_number_confidence || null,
      })),
      activeId: passage?.id || group.passages?.[0]?.id || null,
      bisUrl,
    });
  };

  const myChats = chats.filter((chat) => !chat.personaId || chat.personaId === personaId);

  return (
    <div className={`bis-portal theme-${theme} density-${persona.density} ${mode === 'preview' ? 'is-preview' : ''}`}>
      <header className="bp-top">
        <button type="button" className="bp-icon-btn bp-menu" onClick={() => setSidebar((s) => !s)} aria-label="Menu">☰</button>
        <div className="bp-view-as">
          <span>{t(lang, 'viewAs')}</span>
          <select
            data-testid="portal-persona-select"
            value={personaId}
            onChange={(e) => setPersonaId(e.target.value)}
            aria-label="View as persona"
          >
            {PERSONAS.map((p) => (
              <option key={p.id} value={p.id}>{p.short}</option>
            ))}
          </select>
        </div>
        <div className="bp-search">
          <span>⌕</span>
          <input
            placeholder={t(lang, 'searchPh')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send(input)}
          />
        </div>
        <div className="bp-top-meta">
          {mode === 'preview' && clusters?.length > 0 && (
            <select
              className="bp-select"
              value={clusterId}
              onChange={(e) => {
                setClusterId(e.target.value);
                onClusterChange?.(e.target.value);
              }}
              aria-label="Cluster"
            >
              {clusters.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.published ? ' ★' : ''}</option>
              ))}
            </select>
          )}
          {mode === 'user' && clusterName && (
            <small className="bp-muted" data-testid="portal-knowledge-label">Knowledge · {clusterName}</small>
          )}
          {mode === 'preview' && onExit && (
            <button type="button" className="bp-text-btn" onClick={onExit}>← Maintainer</button>
          )}
          {mode === 'preview' && <span className="bp-preview-pill">Admin preview · not saved to user portal</span>}
        </div>
        <button type="button" className="bp-icon-btn" onClick={() => setPage('alerts')} title="Alerts">
          🔔 {alerts.length > 0 && <em>{Math.min(alerts.length, 9)}</em>}
        </button>
        <button type="button" className="bp-text-btn" onClick={() => setPage('services')}>{t(lang, 'help')}</button>
        <div className="bp-user-wrap">
          <button type="button" className="bp-user" onClick={() => setProfileOpen((v) => !v)} aria-expanded={profileOpen}>
            <span className="bp-avatar">{initials(profileName)}</span>
            <span>
              <strong>{profileName}</strong>
              <small>{hiLabel(lang, profile.org)}</small>
            </span>
          </button>
          {profileOpen && (
            <div className="bp-profile bp-profile-wide">
              <p><strong>{t(lang, 'myProfile')}</strong></p>
              {(PROFILE_SCHEMA[personaId] || PROFILE_SCHEMA.industry).map((key) => (
                <ProfileField
                  key={key}
                  label={profileLabel(lang, key)}
                  value={profile[key] || ''}
                  onChange={(val) => saveUserProfile({ ...profile, [key]: val })}
                />
              ))}
              <button type="button" className="bp-text-btn" onClick={() => setProfileOpen(false)}>{t(lang, 'close')}</button>
            </div>
          )}
        </div>
        <select
          className="bp-select"
          data-testid="portal-lang-select"
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          aria-label="Language"
        >
          <option value="en">EN</option>
          <option value="hi">हिन्दी</option>
        </select>
        <button
          type="button"
          className="bp-text-btn"
          data-testid="portal-theme-toggle"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? '☀ Light' : '☾ Dark'}
        </button>
      </header>

      {error && <div className="bp-banner" data-testid="portal-error-banner">{error}</div>}
      {docNote && <div className="bp-inline-note">{docNote}</div>}

      <div
        className={`bp-body ${sidebar ? 'nav-open' : 'nav-rail'}`}
        style={{ '--nav': sidebar ? `${navW}px` : '68px' }}
      >
        <aside className={`bp-side ${sidebar ? '' : 'is-rail'}`}>
          <div className="bp-brand">
            <span className="bp-logo">▲</span>
            {sidebar && (
              <div>
                <strong>BIS MITRA</strong>
                <small>Intelligent Assistant for Bureau of Indian Standards</small>
              </div>
            )}
            <button type="button" className="bp-icon-btn bp-collapse" onClick={() => setSidebar((s) => !s)} aria-label={sidebar ? 'Collapse sidebar' : 'Expand sidebar'}>
              {sidebar ? '‹' : '›'}
            </button>
          </div>
          <button type="button" className="bp-new" onClick={startChat} title={t(lang, 'newChat')}>
            {sidebar ? `+ ${t(lang, 'newChat')}` : '+'}
          </button>
          <nav>
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                className={page === item.id ? 'on' : ''}
                title={t(lang, item.id === 'applications' ? 'applications' : item.id === 'alerts' ? 'alerts' : item.id === 'documents' ? 'documents' : item.id === 'services' ? 'services' : item.id === 'saved' ? 'saved' : 'home')}
                onClick={() => setPage(item.id)}
              >
                {!sidebar && <span className="bp-nav-ico">{item.icon}</span>}
                {sidebar && t(lang, item.id === 'applications' ? 'applications' : item.id === 'alerts' ? 'alerts' : item.id === 'documents' ? 'documents' : item.id === 'services' ? 'services' : item.id === 'saved' ? 'saved' : 'home')}
                {sidebar && item.id === 'alerts' && <b>{alerts.length}</b>}
              </button>
            ))}
          </nav>
          <div className="bp-recent">
            {sidebar && <small>{t(lang, 'chats')}</small>}
            {myChats.length === 0 && sidebar && <p className="bp-muted">{t(lang, 'noChats')}</p>}
            {myChats.map((chat) => (
              <div key={chat.id} className={`bp-chat-row ${chat.id === chatId ? 'on' : ''}`}>
                {editingChat === chat.id ? (
                  <input
                    className="bp-rename"
                    value={draftTitle}
                    autoFocus
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onBlur={() => renameChat(chat.id, draftTitle)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') renameChat(chat.id, draftTitle);
                      if (e.key === 'Escape') setEditingChat(null);
                    }}
                  />
                ) : (
                  <button type="button" title={chat.title} onClick={() => openChat(chat)}>
                    {sidebar ? chat.title : '💬'}
                  </button>
                )}
                {sidebar && editingChat !== chat.id && (
                  <span className="bp-chat-actions">
                    <button type="button" title="Rename" onClick={() => { setEditingChat(chat.id); setDraftTitle(chat.title); }}>✎</button>
                    <button type="button" title="Delete" onClick={() => deleteChat(chat.id)}>✕</button>
                  </span>
                )}
              </div>
            ))}
          </div>
        </aside>
        <div className="bp-split" role="separator" aria-orientation="vertical" onMouseDown={(e) => sidebar && beginDrag(e)} />

        <main className="bp-main">
          {page === 'home' && (
            <Home
              libReady={libReady}
              persona={persona}
              lang={lang}
              messages={messages}
              busy={busy}
              prompts={prompts}
              modeHint={modeHint}
              input={input}
              setInput={setInput}
              onSend={send}
              onOpenPdf={openPdf}
              onAttachFile={(file) => {
                const reader = new FileReader();
                reader.onload = () => {
                  const row = {
                    id: `up-${Date.now()}`,
                    title: file.name,
                    kind: 'Uploaded',
                    meta: t(lang, 'upload'),
                    size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
                    dataUrl: reader.result,
                    librarySection: 'process',
                  };
                  setUploads((list) => {
                    const next = [row, ...list].slice(0, 8);
                    localStorage.setItem(`bis_uploads_${personaId}`, JSON.stringify(next));
                    return next;
                  });
                };
                reader.readAsDataURL(file);
              }}
              onSave={(text) => setSaved((s) => [{ id: Date.now(), text }, ...s].slice(0, 20))}
            />
          )}
          {page === 'applications' && (
            <Applications
              apps={apps}
              lang={lang}
              selected={selectedApp}
              onSelect={(app) => {
                setSelectedApp(app);
                send(`What is the status of ${app.id}?`);
              }}
            />
          )}
          {page === 'alerts' && (
            <Alerts lang={lang} alerts={alerts} onAsk={(a) => send(`Tell me about this alert: ${a.title}. ${a.body}`)} />
          )}
          {page === 'documents' && (
            <Documents
              lang={lang}
              docs={[...(DOCUMENTS_BY_PERSONA[personaId] || []), ...uploads]}
              onUpload={(file) => {
                const reader = new FileReader();
                reader.onload = () => {
                  const row = {
                    id: `up-${Date.now()}`,
                    title: file.name,
                    kind: 'Uploaded',
                    meta: t(lang, 'upload'),
                    size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
                    dataUrl: reader.result,
                    librarySection: 'process',
                  };
                  setUploads((list) => {
                    const next = [row, ...list].slice(0, 8);
                    localStorage.setItem(`bis_uploads_${personaId}`, JSON.stringify(next));
                    return next;
                  });
                };
                reader.readAsDataURL(file);
              }}
              onOpen={(doc) => {
                if (doc.dataUrl) {
                  const win = window.open();
                  if (win) win.document.write(`<iframe src="${doc.dataUrl}" style="border:0;width:100%;height:100%"></iframe>`);
                  return;
                }
                openPdf({
                  title: doc.title,
                  storage_uri: doc.storage_uri || null,
                  source_file: doc.file || doc.source_file || null,
                  sourceUrl: doc.bisUrl || doc.sourceUrl || null,
                  bisUrl: doc.bisUrl || null,
                  passages: [{
                    id: doc.id || doc.title,
                    label: doc.meta || doc.title,
                    preview: doc.meta || '',
                    source: doc,
                  }],
                });
              }}
            />
          )}
          {page === 'services' && <Services lang={lang} onAsk={send} />}
          {page === 'saved' && (
            <section className="bp-page">
              <h2>{t(lang, 'saved')}</h2>
              {saved.length === 0 && <p className="bp-muted">{t(lang, 'savedEmpty')}</p>}
              {saved.map((s) => <article key={s.id} className="bp-card"><p>{s.text}</p></article>)}
            </section>
          )}
        </main>
      </div>

      {pdf && (
        <PdfViewer
          url={pdf.url}
          title={pdf.title}
          passages={pdf.passages}
          activeId={pdf.activeId}
          bisUrl={pdf.bisUrl}
          openBisLabel={t(lang, 'openBis')}
          onSelect={(id) => setPdf((current) => ({ ...current, activeId: id }))}
          onClose={() => setPdf(null)}
        />
      )}
    </div>
  );
}

function Home({ persona, lang = 'en', libReady = false, messages, busy, prompts, modeHint, input, setInput, onSend, onOpenPdf, onSave, onAttachFile }) {
  const logRef = useRef(null);
  const fileRef = useRef(null);
  const [attachName, setAttachName] = useState('');
  const [voiceError, setVoiceError] = useState('');

  useEffect(() => {
    const node = logRef.current;
    if (node && messages.length) node.scrollTop = node.scrollHeight;
  }, [messages, busy]);

  const appendVoice = (text, meta = {}) => {
    if (meta.replace) {
      setInput(text);
      return;
    }
    setInput((prev) => mergeTranscriptParts(prev, text, { interim: !!meta.interim }));
  };

  const dispatch = () => {
    const base = String(input || '').trim();
    const prefix = attachName ? `[Attachment: ${attachName}] ` : '';
    const message = `${prefix}${base}`.trim();
    if (!message) return;
    onSend(message);
    setAttachName('');
  };

  const pickFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onAttachFile?.(file);
    setAttachName(file.name);
    e.target.value = '';
  };
  return (
    <div className={`bp-chat ${messages.length === 0 ? 'is-empty' : ''}`}>
      <div className="bp-log" ref={logRef}>
        {messages.length === 0 && (
          <div className="bp-welcome">
            <h2>{t(lang, 'greeting')}</h2>
            <p>{t(lang, 'greetingSub')}</p>
            <div className="bp-tiles">
              {prompts.map((p) => (
                <button key={p.label} type="button" onClick={() => onSend(lang === 'hi' && p.promptHi ? p.promptHi : p.prompt)}>
                  <strong>{hiLabel(lang, p.label)}</strong>
                </button>
              ))}
            </div>
            <h3>{t(lang, 'popular')}</h3>
            <div className="bp-services">
              {SERVICES.map((s) => (
                <button key={s.title} type="button" onClick={() => onSend(s.prompt)}>
                  <strong>{hiLabel(lang, s.title)}</strong>
                  <small>{hiLabel(lang, s.text)}</small>
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <article key={i} className={`bp-msg ${m.role}`}>
            {m.role === 'assistant' && <div className="bp-mitra">▲</div>}
            <div>
              {m.role === 'assistant' && <header><strong>BIS MITRA</strong><time>now</time></header>}
              {m.role === 'assistant' && !m.error ? <RichText text={m.text} /> : <p>{m.text}</p>}
              {m.role === 'assistant' && (
                <ResponseCards
                  lang={lang}
                  panel={m.panel}
                  uiMode={m.uiMode}
                  onConfirm={() => onSend(t(lang, 'confirm'), { confirmSubmit: true, confirmFields: m.panel?.confirmTable?.fields })}
                  onAction={(prompt) => onSend(prompt)}
                />
              )}
              {m.role === 'assistant' && m.modules?.length > 0 && (
                <div className="bp-module-tags">
                  {m.modules.map((mod) => (
                    <span key={mod.id} title={mod.detail || ''}>{mod.label}</span>
                  ))}
                </div>
              )}
              {m.role === 'assistant' && m.panel?.noVerifiedSources && !(m.sources?.length) && (
                <p className="bp-source-warn">{t(lang, 'noVerifiedSources')}</p>
              )}
              {m.sources?.length > 0 && (
                <p className="bp-source-intro"><strong>{t(lang, 'sourceEvidence')}</strong> · {t(lang, 'sourceRelevance')}</p>
              )}
              {m.sources?.length > 0 && <SourceGroups libReady={libReady} lang={lang} sources={m.sources} onOpen={onOpenPdf} />}
              {m.role === 'assistant' && !m.error && (
                <button type="button" className="bp-text-btn" onClick={() => onSave(m.text)}>{t(lang, 'save')}</button>
              )}
            </div>
          </article>
        ))}
        {busy && <p className="bp-muted">{t(lang, 'thinking')}</p>}
      </div>
      <div className="bp-composer bp-composer-slim">
        {modeHint && <span className="bp-mode bp-mode-topic">{modeHint}</span>}
        {attachName && <span className="bp-attach-chip">📎 {attachName}</span>}
        {voiceError && <span className="bp-voice-status">{voiceError}</span>}
        <div className="bp-input bp-input-slim">
          <input
            data-testid="portal-chat-input"
            placeholder={t(lang, 'askAnything')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && dispatch()}
            aria-label={t(lang, 'askAnything')}
          />
          <div className="bp-input-actions">
            <button type="button" className="bp-input-tool" title={t(lang, 'attach')} onClick={() => fileRef.current?.click()}>📎</button>
            <input ref={fileRef} type="file" hidden onChange={pickFile} />
            <VoiceMicInput
              uiLang={lang}
              disabled={busy}
              onAppend={appendVoice}
              onError={setVoiceError}
              embedded
            />
            <button
              type="button"
              className="bp-send bp-input-tool"
              data-testid="portal-send"
              disabled={busy || (!input.trim() && !attachName)}
              onClick={dispatch}
              title={t(lang, 'askMitra') || 'Send'}
            >
              ➤
            </button>
          </div>
        </div>
        <p className="bp-composer-hint">{t(lang, 'composerHint')}</p>
        {messages.length > 0 && (
          <div className="bp-follow">
            {prompts.slice(0, 6).map((p) => (
              <button key={p.label} type="button" onClick={() => onSend(lang === 'hi' && p.promptHi ? p.promptHi : p.prompt)}>{hiLabel(lang, p.label)}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SourceGroups({ sources, onOpen, lang = 'en', libReady = false }) {
  const groups = useMemo(() => groupSources(sources), [sources, libReady]);
  if (!groups.length) return null;
  return (
    <div className="bp-source-groups">
      {groups.map((group) => {
        const bisLink = openOnBisUrl({
          ...group,
          storage_uri: group.storage_uri || group.source_file,
          sourceUrl: group.sourceUrl,
        });
        const pdf = hasPdfFile(group) && !!(group.storage_uri || group.source_file);
        if (!group.title && !bisLink && !pdf) return null;
        return (
          <article key={group.key} className="bp-source-card">
            <div className="bp-source-head">
              {group.title ? (
                <span>{pdf ? '📄' : '🔗'} {group.title}</span>
              ) : (
                <span>{pdf ? '📄' : '🔗'}</span>
              )}
              <div className="bp-source-actions">
                {pdf && group.passages.length > 0 && (
                  <button type="button" className="bp-btn-primary bp-btn-sm" onClick={() => onOpen(group, group.passages[0]?.id)}>
                    {t(lang, 'view')}
                  </button>
                )}
                {pdf && !group.passages.length && (
                  <button type="button" className="bp-btn-primary bp-btn-sm" onClick={() => onOpen(group, null)}>
                    {t(lang, 'view')}
                  </button>
                )}
                {bisLink && (
                  <a className="bp-btn-secondary bp-btn-sm" href={bisLink} target="_blank" rel="noreferrer">{t(lang, 'openBis')}</a>
                )}
              </div>
            </div>
            {group.passages.length > 0 && (
              <ul>
                {group.passages.map((passage) => (
                  <li key={passage.id}>
                    <button type="button" onClick={() => onOpen(group, passage.id)}>
                      {passage.section ? (
                        <strong>{passage.section}</strong>
                      ) : passage.label ? (
                        <strong>{passage.label.slice(0, 48)}{passage.label.length > 48 ? '…' : ''}</strong>
                      ) : null}
                      {passage.preview && passage.preview !== passage.label && (
                        <span>{passage.preview.slice(0, 100)}{passage.preview.length > 100 ? '…' : ''}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </article>
        );
      })}
    </div>
  );
}

function ResponseCards({ panel, uiMode, lang = 'en', onConfirm, onAction }) {
  if (panel?.checklist) {
    const c = panel.checklist;
    return (
      <div className="bp-card bp-compliance-result" data-testid="portal-compliance-card">
        <header><small>Import / FMCS checklist</small><strong>{c.standard}</strong></header>
        <div className="bp-grid4">
          <div className="tone-blue"><small>Product</small><p>{c.product}</p></div>
          <div className="tone-green"><small>QCO</small><p>{c.qco}</p></div>
          <div className="tone-amber"><small>Pathway</small><p>{c.pathway}</p></div>
          <div className="tone-purple"><small>Source</small><p>{c.source}</p></div>
        </div>
        <ul>{(c.documents || []).map((row) => <li key={row}>{row}</li>)}</ul>
        {c.air_required && <p className="bp-muted">AIR (Form-VI) required · Factory inspection: {c.factory_inspection ? 'Yes' : 'No'}</p>}
        {panel.action?.prompt && (
          <button type="button" className="bp-btn-primary" onClick={() => onAction?.(panel.action.prompt)}>
            {panel.action.label || 'Continue'}
          </button>
        )}
      </div>
    );
  }
  if (panel?.matching) {
    const m = panel.matching;
    return (
      <div className="bp-card">
        <small>Recommended laboratory</small>
        <strong>{m.recommended}</strong>
        <p>{m.lab_code} · {m.city}, {m.state} · {m.demo_id}</p>
        <p className="bp-muted">{m.reason}</p>
        {m.scope && <p>Scope: {m.scope}</p>}
      </div>
    );
  }
  if (panel?.verification) {
    const v = panel.verification;
    return (
      <div className="bp-verify bp-card">
        <strong>{v.verification_result || (v.verified ? 'VERIFIED' : 'MISMATCH')}</strong>
        <p>{v.identifier || v.huid}</p>
        {v.manufacturer && <p>{v.manufacturer} · {v.product}</p>}
        {v.flag_reason && <p className="bp-muted">{v.flag_reason}</p>}
      </div>
    );
  }
  if (panel?.calculation) {
    const calc = panel.calculation;
    return (
      <div className="bp-card">
        <small>Gold value estimate</small>
        <p>{calc.formula}</p>
        <strong>{calc.estimated_value_inr != null ? `₹${calc.estimated_value_inr.toLocaleString('en-IN')}` : 'Provide 24K price per gram'}</strong>
        <p className="bp-muted">{calc.caveat}</p>
      </div>
    );
  }
  if (panel?.case) {
    const c = panel.case;
    return (
      <div className="bp-card">
        <small>Enforcement case</small>
        <strong>{c.case_id}</strong>
        <p>{c.manufacturer} · {c.product} · {c.standard}</p>
        <p>Licence: {c.licence} · Surveillance: {c.surveillance_ref}</p>
        {c.evidence_required?.length > 0 && (
          <section><h4>Evidence to record</h4><ul>{c.evidence_required.map((row) => <li key={row}>{row}</li>)}</ul></section>
        )}
        {c.evidence_history?.length > 0 && (
          <section><h4>Evidence history</h4><ul>{c.evidence_history.slice(0, 5).map((e) => <li key={e.evidence_id}>{e.evidence_id} · {e.product_description}</li>)}</ul></section>
        )}
      </div>
    );
  }
  if (panel?.compliance) {
    const result = panel.compliance;
    return (
      <div className="bp-card bp-compliance-result" data-testid="portal-compliance-card">
        <header>
          <small>Standards / Compliance Result</small>
          <strong>{result.standard_number}</strong>
        </header>
        <div className="bp-grid4">
          <div className="tone-blue"><small>Product category</small><p>{result.product_category}</p></div>
          <div className="tone-green"><small>Status</small><p>{result.status}</p></div>
          <div className="tone-amber"><small>Applicability</small><p>{result.applicability}</p></div>
          <div className="tone-purple"><small>Source</small><p>{result.source}</p></div>
        </div>
        <div className="bp-compliance-lists">
          <section><h4>Requirements</h4><ul>{result.requirements.map((row) => <li key={row}>{row}</li>)}</ul></section>
          <section><h4>Tests</h4><ul>{result.tests.map((row) => <li key={row}>{row}</li>)}</ul></section>
          <section><h4>Documents</h4><ul>{result.documents.map((row) => <li key={row}>{row}</li>)}</ul></section>
        </div>
        <p className="bp-muted">{result.demo_notice}</p>
        {panel.action?.prompt && (
          <button type="button" className="bp-btn-primary" onClick={() => onAction?.(panel.action.prompt)}>
            {panel.action.label || 'Continue'}
          </button>
        )}
      </div>
    );
  }
  if (panel?.confirmTable) {
    const table = panel.confirmTable;
    return (
      <div className="bp-card bp-confirm">
        <p>{t(lang, 'confirmHint')}</p>
        <table>
          <thead><tr>{table.columns.map((col) => <th key={col}>{col}</th>)}</tr></thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i}>{row.map((cell, j) => <td key={j}>{cell || '—'}</td>)}</tr>
            ))}
          </tbody>
        </table>
        {table.missing?.length > 0 && <p className="bp-muted">{table.missing.join(', ')}</p>}
        <a href={panel.bisApplicationsUrl || MANAK_APPLICATIONS_URL} target="_blank" rel="noreferrer">{t(lang, 'applicationsLink')}</a>
        <button type="button" className="bp-btn-primary" onClick={onConfirm}>{t(lang, 'confirm')}</button>
      </div>
    );
  }
  if (!panel || !uiMode || uiMode === 'chat') return null;
  if (uiMode === 'workflow') {
    return (
      <div>
        <div className="bp-grid4">
          <div className="tone-green"><small>Status / Eligibility</small><p>{panel.status || panel.eligibility || panel.service_name || 'See requirements for this service.'}</p></div>
          <div className="tone-blue"><small>Application</small><p>{panel.record_id || panel.standard || panel.is_number || 'Linked Indian Standard'}</p></div>
          <div className="tone-amber"><small>Key documents</small>
            <ul>{(panel.required_documents || ['Form-I', 'Test report', 'Undertaking']).slice(0, 4).map((d) => <li key={d}>{d}</li>)}</ul>
          </div>
          <div className="tone-purple"><small>Next step</small><p>{panel.next_action || panel.current_step || 'Continue in MITRA'}</p></div>
        </div>
        {panel.status_history?.length > 0 && (
          <div className="bp-card">
            <strong>Status timeline</strong>
            <ol>
              {panel.status_history.map((event, index) => (
                <li key={`${event.at || event.changed_at}-${index}`}>
                  <strong>{event.status || event.new_status}</strong>
                  {' · '}{event.changed_by || 'System'}
                  {' · '}{event.at || event.changed_at}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    );
  }
  if (uiMode === 'verification') {
    return (
      <div className="bp-verify">
        <strong>{panel.status || 'Result'}</strong>
        <p>{panel.evidence?.company_name || panel.evidence?.status || 'Registry record'}</p>
      </div>
    );
  }
  if (uiMode === 'comparison' && panel.comparison?.rows?.length) {
    const cmp = panel.comparison;
    return (
      <div className="bp-card">
        <small>Standard comparison</small>
        <strong>{cmp.old_is_number} → {cmp.new_is_number}</strong>
        <table>
          <thead><tr><th>Aspect</th><th>Previous</th><th>Current</th></tr></thead>
          <tbody>
            {cmp.rows.slice(0, 8).map((row, i) => (
              <tr key={i}>
                <td>{row.parameter_field || row.aspect}</td>
                <td>{row.old_value || row.old_requirement}</td>
                <td>{row.new_value || row.new_requirement}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (uiMode === 'comparison') {
    return <div className="bp-card"><small>Comparison</small><p>{panel.comparison?.title || panel.comparison?.is_number || panel.outcome || 'Standard comparison'}</p></div>;
  }
  if (uiMode === 'alert' && panel.alerts?.length) {
    return (
      <div className="bp-card">
        {panel.alerts.slice(0, 3).map((a, i) => <p key={i}>{a.title || a.alert_type}</p>)}
      </div>
    );
  }
  if (panel.status) {
    return (
      <div>
        <div className="bp-status">
          <div><small>Status</small><strong>{panel.status}</strong></div>
          {panel.record_id && <div><small>Record</small><strong>{panel.record_id}</strong></div>}
          {panel.next_action && <div><small>Next action</small><strong>{panel.next_action}</strong></div>}
        </div>
        {panel.status_history?.length > 0 && (
          <div className="bp-card">
            <strong>Status timeline</strong>
            <ol>
              {panel.status_history.map((event, index) => (
                <li key={`${event.at || event.changed_at}-${index}`}>
                  <strong>{event.status || event.new_status}</strong>
                  {' · '}{event.changed_by || 'System'}
                  {' · '}{event.at || event.changed_at}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    );
  }
  if (panel.action?.prompt) {
    return (
      <button type="button" className="bp-btn-primary" onClick={() => onAction?.(panel.action.prompt)}>
        {panel.action.label || 'Continue'}
      </button>
    );
  }
  return null;
}

function Applications({ apps, selected, onSelect, lang = 'en' }) {
  return (
    <section className="bp-page">
      <header className="bp-page-head">
        <h2>{t(lang, 'applications')}</h2>
        <a href={MANAK_APPLICATIONS_URL} target="_blank" rel="noreferrer">{t(lang, 'applicationsLink')}</a>
        <span>{apps.length} {t(lang, 'records')}</span>
      </header>
      <div className="bp-app-list">
        {apps.map((app) => (
          <article key={app.id} className={`bp-app ${selected?.id === app.id ? 'on' : ''}`}>
            <div>
              <strong>{app.id}</strong>
              <span className={`pill ${app.tone}`}>{app.status}</span>
            </div>
            <p>{app.type} · {app.product}</p>
            {(app.manufacturer || app.is_number) && (
              <small>{[app.manufacturer, app.is_number].filter(Boolean).join(' · ')}</small>
            )}
            <small>{app.stage} · Submitted {app.submitted}</small>
            {app.status_history?.length > 0 && (
              <details>
                <summary>Status timeline</summary>
                <ol>
                  {app.status_history.map((event, index) => (
                    <li key={`${event.changed_at || event.at}-${index}`}>
                      <strong>{event.new_status || event.status}</strong>
                      {' · '}{event.changed_by || 'System'}
                      {' · '}{event.changed_at || event.at}
                    </li>
                  ))}
                </ol>
              </details>
            )}
            <button type="button" className="bp-btn-primary" onClick={() => onSelect(app)}>{t(lang, 'askMitra')}</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function Alerts({ alerts, onAsk, lang = 'en' }) {
  return (
    <section className="bp-page">
      <h2>{t(lang, 'alerts')}</h2>
      <div className="bp-app-list">
        {alerts.map((a) => (
          <article key={a.id} className="bp-app">
            <div><strong>{a.title}</strong>{a.tag && <span className="pill amber">{a.tag}</span>}</div>
            <p>{a.body}</p>
            {a.evidence?.changed_by && (
              <small>Changed by {a.evidence.changed_by} · {a.evidence.changed_at || a.time}</small>
            )}
            <small>{a.time}</small>
            <button type="button" className="bp-btn-primary" onClick={() => onAsk(a)}>{t(lang, 'visit')}</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function Documents({ docs, onOpen, onUpload, lang = 'en' }) {
  const sections = useMemo(() => {
    const map = new Map();
    docs.forEach((d) => {
      const key = d.librarySection || 'process';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(d);
    });
    return [...map.entries()];
  }, [docs]);

  const openBis = (d) => {
    const url = d.bisUrl || openOnBisUrl(d);
    if (url) window.open(url, '_blank', 'noopener');
  };

  return (
    <section className="bp-page">
      <header className="bp-page-head">
        <h2>{t(lang, 'documents')}</h2>
        <label className="bp-upload bp-btn-primary">
          {t(lang, 'upload')}
          <input type="file" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) onUpload(file); e.target.value = ''; }} />
        </label>
      </header>
      {sections.map(([section, rows]) => (
        <div key={section} className="bp-doc-section">
          <h3>{sectionLabel(lang, section)}</h3>
          <div className="bp-app-list">
            {rows.map((d) => {
              const pdf = hasPdfFile(d) || Boolean(d.dataUrl);
              return (
                <article key={d.id} className="bp-app">
                  <div><strong>{d.title}</strong><span className="pill blue">{d.kind}</span></div>
                  <p>{d.meta}</p>
                  <small>{pdf ? 'PDF' : t(lang, 'openBis')} · {d.size}</small>
                  <div className="bp-row-actions">
                    {pdf && <button type="button" className="bp-btn-primary" onClick={() => onOpen(d)}>{t(lang, 'view')}</button>}
                    <button type="button" className="bp-btn-secondary" onClick={() => openBis(d)}>{t(lang, 'openBis')}</button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

function Services({ onAsk, lang = 'en' }) {
  return (
    <section className="bp-page">
      <h2>{t(lang, 'services')}</h2>
      <div className="bp-services">
        {SERVICES.map((s) => (
          <button key={s.title} type="button" onClick={() => onAsk(s.prompt)}>
            <span>{s.icon}</span>
            <strong>{hiLabel(lang, s.title)}</strong>
            <small>{hiLabel(lang, s.text)}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function Context({ persona, last, prompts, alerts, app, onAsk, onOpenPdf, showDebug, lang = 'en', libReady = false }) {
  const panel = last?.panel;
  return (
    <>
      <section>
        <h4>{t(lang, 'context')} <span className="dot">{t(lang, 'active')}</span></h4>
        <p><small>{t(lang, 'viewingAs')}</small><br /><strong>{hiLabel(lang, persona.label)}</strong></p>
        {panel?.service_name && <p><small>Service</small><br />{panel.service_name}</p>}
        {panel?.status && <p><small>Status</small><br />{panel.status}</p>}
        {app && (
          <div className="bp-mini">
            <strong>{app.id}</strong>
            <span className={`pill ${app.tone}`}>{app.status}</span>
            <small>{app.product}</small>
          </div>
        )}
      </section>
      <section>
        <h4>{t(lang, 'quick')}</h4>
        {prompts.slice(0, 5).map((p) => (
          <button key={p.label} type="button" className="bp-link" onClick={() => onAsk(lang === 'hi' && p.promptHi ? p.promptHi : p.prompt)}>{p.icon} {hiLabel(lang, p.label)}</button>
        ))}
      </section>
      {last?.sources?.length > 0 && (
        <section>
          <h4>{t(lang, 'sources')}</h4>
          <SourceGroups libReady={libReady} lang={lang} sources={last.sources} onOpen={onOpenPdf} />
        </section>
      )}
      <section>
        <h4>{t(lang, 'yourAlerts')}</h4>
        {alerts.map((a) => (
          <button key={a.id} type="button" className="bp-link" onClick={() => onAsk(`Explain this alert: ${a.title}`)}>
            🔔 {a.title}
          </button>
        ))}
      </section>
      {showDebug && last?.debug && (
        <details>
          <summary>Debug info</summary>
          <p>Intent: {last.debug.intent || '—'}</p>
          <p>Tool: {last.debug.tool || '—'}</p>
          <p>Rule: {last.debug.ruleId || '—'}</p>
          <p>Retrieval: {last.debug.retrieval || '—'}</p>
        </details>
      )}
    </>
  );
}
