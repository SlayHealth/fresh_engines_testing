import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Heart, Sparkles, MessageSquare, Loader2 } from 'lucide-react';
import styles from './ReportChatDrawer.module.css';
import { API_URL } from '../config/api';
import { apiFetch } from '../utils/api';

// Backend-generated suggestions (grounded in this couple's real report data
// and — once there's a conversation — what's already been asked, see
// chat.controller.js's generateSuggestions) are always preferred. This
// static list is only a last-resort UI fallback for the brief window before
// that first response lands, or if the backend ever returns none.
const DEFAULT_SUGGESTIONS = {
  chronic: [
    "Explain my glycemic risk simply",
    "What lifestyle next-steps will help me?",
    "Can you explain HbA1c vs IDRS?",
    "Is my cholesterol level alarming?"
  ],
  mfr: [
    "Explain our Fecundability Index simply",
    "How can we improve our fertility score?",
    "What do our semen parameters mean?",
    "Explain AMH and ovarian reserve"
  ],
  usg: [
    "What does Fatty Liver Grade mean?",
    "Are there any signs of concern in my kidneys?",
    "Explain USG findings in plain terms",
    "What diet changes will help my liver health?"
  ]
};

const parseMarkdown = (text) => {
  if (!text) return '';
  const parts = text.split(/(\*\*.*?\*\*)/gs);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

export default function ReportChatDrawer({
  isOpen,
  onClose,
  sessionId,
  onSessionCreated,
  reportId,
  partnerReportId,
  engineType,
  contextMetadata
}) {
  const [activeSessionId, setActiveSessionId] = useState(sessionId || null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  // Starts on the static per-engine fallback so chips aren't empty on the
  // very first paint, then gets replaced by the backend's real,
  // report-grounded suggestions as soon as any API call returns them.
  const [suggestions, setSuggestions] = useState(DEFAULT_SUGGESTIONS[engineType] || []);

  const messagesEndRef = useRef(null);
  const drawerRef = useRef(null);
  const closeButtonRef = useRef(null);

  // Sync prop sessionId to state
  useEffect(() => {
    if (sessionId) {
      setActiveSessionId(sessionId);
    }
  }, [sessionId]);

  // Handle open drawer actions
  useEffect(() => {
    if (isOpen) {
      if (activeSessionId) {
        fetchChatHistory(activeSessionId);
      } else {
        initializeSession();
      }
    }
  }, [isOpen, activeSessionId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // Escape-to-close, focus the close button on open, and trap Tab focus within the drawer
  useEffect(() => {
    if (!isOpen) return;

    closeButtonRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !drawerRef.current) return;

      const focusable = drawerRef.current.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const initializeSession = async () => {
    setIsInitializing(true);
    setError(null);
    try {
      const response = await apiFetch(`${API_URL}/api/chat/session`, {
        method: 'POST',
        body: JSON.stringify({
          report_id: reportId || null,
          partner_report_id: partnerReportId || null,
          engine_type: engineType,
          context_metadata: contextMetadata || {}
        })
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to initialize session');
      }

      setActiveSessionId(data.sessionId);
      if (onSessionCreated) {
        onSessionCreated(data.sessionId);
      }

      // Add a friendly welcome message
      setMessages([
        {
          role: 'assistant',
          content: getWelcomeMessage(engineType)
        }
      ]);
      if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
      }
    } catch (err) {
      console.error('Error initializing chat session:', err);
      setError('Could not start a conversation session. Please try again.');
    } finally {
      setIsInitializing(false);
    }
  };

  const fetchChatHistory = async (sessId) => {
    setIsInitializing(true);
    setError(null);
    try {
      const response = await apiFetch(`${API_URL}/api/chat/session/${sessId}/history`);
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to load chat history');
      }

      if (data.messages && data.messages.length > 0) {
        setMessages(data.messages);
      } else {
        setMessages([
          {
            role: 'assistant',
            content: getWelcomeMessage(engineType)
          }
        ]);
      }
      if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
      }
    } catch (err) {
      console.error('Error loading chat history:', err);
      setError('Failed to load past chat messages.');
    } finally {
      setIsInitializing(false);
    }
  };

  const getWelcomeMessage = (type) => {
    switch (type) {
      case 'chronic':
        return "Hi, I'm SlayHealth's AI assistant. I've read through your chronic risk factors and metabolic biomarkers — ask me anything, or let's talk through what a healthier shared lifestyle could look like.";
      case 'mfr':
        return "Hi, I'm SlayHealth's AI assistant. I've looked at your fertility indicators and ovarian/semen reserves. Let's talk through what these mean in plain language, and how you might optimize your path forward.";
      case 'usg':
        return "Hi, I'm SlayHealth's AI assistant. I've reviewed your abdominal ultrasound findings (kidneys, liver, prostate, etc.). Ask me anything about your scan, and I can walk through lifestyle tips that support those organs.";
      default:
        return "Hi, I'm SlayHealth's AI assistant. Ask me anything about your report — I'll explain it in plain language.";
    }
  };

  const handleSend = async (textToSend) => {
    const text = textToSend || inputText;
    if (!text.trim() || isSending || !activeSessionId) return;

    if (!textToSend) {
      setInputText('');
    }

    // Append user message
    const newMsg = { role: 'user', content: text.trim() };
    setMessages((prev) => [...prev, newMsg]);
    setIsSending(true);
    setError(null);

    try {
      const response = await apiFetch(`${API_URL}/api/chat/message`, {
        method: 'POST',
        body: JSON.stringify({
          sessionId: activeSessionId,
          message: text.trim()
        })
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to send message');
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message or fetch AI reply. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <>
      <div 
        className={`${styles.overlay} ${isOpen ? styles.overlayActive : ''}`} 
        onClick={onClose}
      />
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Ask about your report — AI assistant chat"
        className={`${styles.drawer} ${isOpen ? styles.drawerActive : ''}`}
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <div className={styles.avatar}>
              <Sparkles size={20} />
            </div>
            <div className={styles.titleArea}>
              <h3 className={styles.title}>Ask about your report</h3>
              <span className={styles.subtitle}>AI assistant, not a human reviewer</span>
            </div>
          </div>
          <button ref={closeButtonRef} className={styles.closeButton} onClick={onClose} aria-label="Close Chat">
            <X size={20} />
          </button>
        </div>

        {/* Message Panel */}
        <div className={styles.messageArea}>
          {isInitializing ? (
            <div className={styles.loadingSpinner}>
              <Loader2 className="animate-spin mr-2" size={18} />
              <span>Analyzing reports...</span>
            </div>
          ) : (
            <>
              {messages.map((msg, index) => (
                <div 
                  key={index} 
                  className={`${styles.messageRow} ${
                    msg.role === 'user' ? styles.messageRowUser : styles.messageRowAssistant
                  }`}
                >
                  <div 
                    className={`${styles.bubble} ${
                      msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant
                    }`}
                  >
                    {parseMarkdown(msg.content)}
                  </div>
                </div>
              ))}

              {isSending && (
                <div className={`${styles.messageRow} ${styles.messageRowAssistant}`}>
                  <div className={`${styles.bubble} ${styles.bubbleAssistant}`}>
                    <div className={styles.typingIndicator}>
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className={styles.errorState}>
            <span>{error}</span>
            <button onClick={() => activeSessionId ? fetchChatHistory(activeSessionId) : initializeSession()}>
              Retry
            </button>
          </div>
        )}

        {/* Quick Suggestion Chips */}
        {!isInitializing && suggestions.length > 0 && (
          <div className={styles.suggestionsSection}>
            <div className={styles.suggestionsTitle}>Suggested Questions</div>
            <div className={styles.chipsContainer}>
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  className={styles.suggestionChip}
                  onClick={() => handleSend(suggestion)}
                  disabled={isSending}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input area */}
        <div className={styles.inputArea}>
          <input
            type="text"
            className={styles.input}
            placeholder="Ask about your report..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isInitializing || isSending}
          />
          <button
            className={styles.sendButton}
            onClick={() => handleSend()}
            disabled={isInitializing || isSending || !inputText.trim()}
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </>
  );
}
