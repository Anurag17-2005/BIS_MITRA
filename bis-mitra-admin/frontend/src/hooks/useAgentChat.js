import { useState, useEffect, useCallback } from 'react';
import * as api from '../api';
import { getPersona } from '../config/userPersonas';

export function useAgentChat({ clusterId, userPersona }) {
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [llmConfigured, setLlmConfigured] = useState(false);
  const persona = getPersona(userPersona);

  useEffect(() => {
    api.getDemoPrompts().then((d) => setLlmConfigured(!!d.llmConfigured)).catch(() => {});
  }, []);

  useEffect(() => {
    setMessages([]);
  }, [userPersona, clusterId]);

  const send = useCallback(async (text) => {
    const message = String(text || '').trim();
    if (!message || busy || !clusterId) return null;
    setMessages((m) => [...m, { role: 'user', text: message }]);
    setBusy(true);
    try {
      const history = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role,
          text: m.text,
          uiMode: m.uiMode,
          workflow: m.workflow,
          router: m.router,
        }));
      const res = await api.agentChat(message, clusterId, {
        personaMode: persona.agentMode,
        userPersona,
        sessionId: api.getSessionId(),
        userId: userPersona,
        history,
      });
      const assistant = {
        role: 'assistant',
        text: res.answer,
        sources: res.sources,
        uiMode: res.uiMode || res.router?.uiMode || 'knowledge',
        panel: res.panel,
        workflow: res.workflow,
        router: res.router,
        intent: res.intent || res.router?.intent,
        meta: {
          tool: res.probe?.tool || null,
          intent: res.router?.intent || res.intent,
          retrieval: res.retrieval?.type,
          unreadCount: res.unreadCount,
          ruleId: res.rule?.rule_id || res.probe?.rule_id,
          confidence: res.router?.confidence,
        },
      };
      setMessages((m) => [...m, assistant]);
      return assistant;
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: e.message, error: true }]);
      return null;
    } finally {
      setBusy(false);
    }
  }, [busy, clusterId, messages, persona.agentMode, userPersona]);

  const clear = useCallback(() => setMessages([]), []);

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant') || null;

  return {
    messages,
    setMessages,
    busy,
    send,
    clear,
    llmConfigured,
    persona,
    lastAssistant,
  };
}
