import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Heart, Sparkles, MessageSquare, Loader2 } from 'lucide-react';
import styles from './ReportChatDrawer.module.css';
import { API_URL } from '../config/api';
import { apiFetch } from '../utils/api';

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

  const messagesEndRef = useRef(null);

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
        return "Hi there! I am your SlayHealth premarital health counselor. I've reviewed your chronic risk factors and metabolic biomarkers. Let me know what questions you have or how I can guide you towards a healthier lifestyle together!";
      case 'mfr':
        return "Hello! I am your premarital fertility counselor. I have analyzed your MFR fertility and ovarian/semen reserves. Let's talk about what these indicators mean in a warm, simple way, and explore how you can optimize your path forward.";
      case 'usg':
        return "Hi! I am your health counselor. I've analyzed your abdominal ultrasound parameters (kidneys, liver, prostate, etc.). Ask me anything about your USG report, and we can go over positive lifestyle tips to keep your organs happy!";
      default:
        return "Hello! I am your friendly health counselor. How can I help you understand your wellness reports today?";
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

  const suggestions = DEFAULT_SUGGESTIONS[engineType] || [];

  return (
    <>
      <div 
        className={`${styles.overlay} ${isOpen ? styles.overlayActive : ''}`} 
        onClick={onClose}
      />
      <div className={`${styles.drawer} ${isOpen ? styles.drawerActive : ''}`}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <div className={styles.avatar}>
              <Sparkles size={20} />
            </div>
            <div className={styles.titleArea}>
              <h3 className={styles.title}>AI Health Counselor</h3>
              <span className={styles.subtitle}>Empathetic, jargon-free guidance</span>
            </div>
          </div>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close Chat">
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
            placeholder="Ask counselor anything..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isInitializing || isSending}
          />
          <button
            className={styles.sendButton}
            onClick={() => handleSend()}
            disabled={isInitializing || isSending || !inputText.trim()}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </>
  );
}
