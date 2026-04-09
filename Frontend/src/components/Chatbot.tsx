import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Loader2, Bot, User, Volume2, Square } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  stockData?: {
    name: string;
    ticker: string;
    price: number | null;
    change: number | null;
    percent: number | null;
    high: number | null;
    low: number | null;
    mcap: string;
    industry: string;
    logo?: string;
  };
}

interface ChatbotProps {
  userId?: string;
  conversationId?: string;
  initialMessages?: Message[];
  onMessagesChange?: (messages: Message[]) => void;
}

interface ChatRequestOptions {
  eli5?: boolean;
  includeNews?: boolean;
  ticker?: string;
  improveSummary?: boolean;
  history?: { role: string; content: string }[];
}

const API_TIMEOUT_MS = 35000;
const RETRY_DELAY_MS = 400;

const buildChatEndpoints = (): string[] => {
  const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').trim();
  const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, '');

  return Array.from(new Set([
    '/api/v1/chat',
    `${normalizedBaseUrl}/api/v1/chat`,
  ]));
};

const postChatMessage = async (message: string, options: ChatRequestOptions = {}): Promise<string> => {
  const payload = JSON.stringify({
    message,
    eli5: Boolean(options.eli5),
    include_news: Boolean(options.includeNews),
    ticker: options.ticker || null,
    improve_summary: Boolean(options.improveSummary),
    history: options.history || null,
  });
  const endpoints = buildChatEndpoints();
  let lastError: unknown;

  for (const endpoint of endpoints) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: payload,
          signal: controller.signal,
        });

        if (!response.ok) {
          let detail = '';
          const contentType = response.headers.get('content-type') || '';
          try {
            if (contentType.includes('application/json')) {
              const body = await response.json();
              detail = String(body?.detail || body?.response || '').trim();
            } else {
              detail = (await response.text()).trim();
            }
          } catch {
            detail = '';
          }

          throw new Error(`HTTP_${response.status}:${detail || response.statusText || 'Request failed'}`);
        }

        const data = await response.json();
        if (typeof data?.response !== 'string') {
          throw new Error('INVALID_PAYLOAD');
        }

        return data; // Return full object
      } catch (error) {
        lastError = error;
        console.error(`Chat request failed via ${endpoint} (attempt ${attempt}):`, error);

        const canRetry = error instanceof TypeError || (error instanceof DOMException && error.name === 'AbortError');
        if (attempt < 2 && canRetry) {
          await new Promise((resolve) => window.setTimeout(resolve, RETRY_DELAY_MS));
          continue;
        }

        break;
      } finally {
        window.clearTimeout(timeoutId);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('All chat endpoints failed');
};

const Chatbot: React.FC<ChatbotProps> = ({ userId: _userId, conversationId, initialMessages, onMessagesChange }) => {
  const defaultMessage: Message = {
    id: '1',
    role: 'assistant',
    content: 'Hello! I\'m your financial AI assistant. I can fetch and summarize the **latest market news**, provide **company-specific insights**, and explain complex concepts in **ELI5 mode**. \n\nHow can I help you today?',
    timestamp: new Date()
  };

  const [messages, setMessages] = useState<Message[]>(initialMessages || [defaultMessage]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [eli5Mode, setEli5Mode] = useState(false);
  const [activeSpeechId, setActiveSpeechId] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (!availableVoices.length) return;

      // Prioritize natural voices: Google (Chrome Cloud-based), Samantha (macOS), or Premium descriptors
      const bestVoice = 
        availableVoices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) ||
        availableVoices.find(v => v.name.includes('Samantha')) ||
        availableVoices.find(v => v.name.includes('Premium')) ||
        availableVoices.find(v => v.lang.startsWith('en')) ||
        availableVoices[0];

      setSelectedVoice(bestVoice);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      if (window.speechSynthesis) {
         window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);
  const isInitialMount = useRef(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Reset isInitialMount when conversationId changes
  useEffect(() => {
    isInitialMount.current = true;
  }, [conversationId]);

  // Update messages when initialMessages prop changes (when switching conversations)
  useEffect(() => {
    // Only update if initialMessages actually changed (prevent unnecessary updates)
    if (initialMessages) {
      if (initialMessages.length > 0) {
        // Check if messages are actually different to prevent flickering
        const currentIds = messages.map(m => m.id).join(',');
        const newIds = initialMessages.map(m => m.id).join(',');
        if (currentIds !== newIds) {
          setMessages(initialMessages);
        }
      } else {
        // Empty array - clear messages
        setMessages([]);
      }
    } else {
      // Undefined - use default
      setMessages([defaultMessage]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessages, conversationId]);

  // Notify parent of message changes (but avoid calling on mount with initial messages)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (onMessagesChange && messages.length > 0) {
      onMessagesChange(messages);
    }
  }, [messages, onMessagesChange]);


  const handleSendMessage = async (text: string, options: ChatRequestOptions = {}) => {
    if (!text.trim() || isLoading) return;

    let resolvedOptions: ChatRequestOptions = { ...options };
    let backendText = text;

    // If user asks for "better summary", reuse the latest news context.
    if (/better summary|improve summary|more detailed summary/i.test(text)) {
      const latestNewsMessage = [...messages]
        .reverse()
        .find((m) => m.role === 'assistant' && /Latest\s+.+\s+News Summaries/i.test(m.content));

      if (latestNewsMessage) {
        const tickerMatch = latestNewsMessage.content.match(/Latest\s+([A-Za-z]+)\s+News Summaries/i);
        const inferredTicker = tickerMatch?.[1] && tickerMatch[1].toLowerCase() !== 'market'
          ? tickerMatch[1].toUpperCase()
          : undefined;

        resolvedOptions = {
          ...resolvedOptions,
          includeNews: true,
          improveSummary: true,
          ticker: inferredTicker,
        };
        backendText = inferredTicker
          ? `Give me a better summary of the latest ${inferredTicker} news.`
          : 'Give me a better summary of the latest market news.';
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const result = await postChatMessage(backendText, {
        eli5: eli5Mode || resolvedOptions.eli5,
        includeNews: resolvedOptions.includeNews,
        ticker: resolvedOptions.ticker,
        improveSummary: resolvedOptions.improveSummary,
        history: messages.map(m => ({ role: m.role, content: m.content })),
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: (result as any).response,
        timestamp: new Date(),
        stockData: (result as any).stock_data
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const rawError = error instanceof Error ? error.message : '';
      const isTimeout = (error instanceof DOMException && error.name === 'AbortError')
        || rawError.includes('AbortError');
      const isNetwork = error instanceof TypeError || rawError.includes('Failed to fetch');
      let friendlyMessage = '';

      if (rawError.startsWith('HTTP_')) {
        const [statusPart, detailPart] = rawError.replace('HTTP_', '').split(':', 2);
        const statusCode = Number(statusPart);
        const detail = (detailPart || '').trim();

        if (statusCode === 400) {
          friendlyMessage = `Request issue: ${detail || 'Please update your message and try again.'}`;
        } else if (statusCode === 429) {
          friendlyMessage = 'Upstream API rate limit reached. Please wait 30-60 seconds and retry.';
        } else if (statusCode >= 500) {
          friendlyMessage = `Backend error (${statusCode})${detail ? `: ${detail}` : ''}. Please retry.`;
        } else {
          friendlyMessage = `Request failed (${statusCode})${detail ? `: ${detail}` : ''}.`;
        }
      } else if (rawError === 'INVALID_PAYLOAD') {
        friendlyMessage = 'Received an invalid response from backend. Please retry.';
      } else if (isTimeout) {
        friendlyMessage = 'The request timed out. Please retry in a moment.';
      } else if (isNetwork) {
        friendlyMessage = 'I couldn\'t reach the backend chat service. Make sure backend is running at http://127.0.0.1:8000, then try again.';
      } else {
        friendlyMessage = 'Request failed unexpectedly. Please try again.';
      }

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: friendlyMessage,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRecording) {
      stopRecording();
      return;
    }
    handleSendMessage(inputText);
  };

  const startRecording = () => {
    // Check if SpeechRecognition is available
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      let finalTranscript = inputText;

      recognition.onstart = () => {
        setIsRecording(true);
        setIsListening(true);
        setInterimTranscript('');
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = finalTranscript;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += (final ? ' ' : '') + transcript;
            setInterimTranscript('');
          } else {
            interim += transcript;
            setInterimTranscript(interim);
          }
        }

        // Update input field with final + interim transcript
        const displayText = final + (interim ? ' ' + interim : '');
        setInputText(displayText);
        finalTranscript = final;
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'no-speech') {
          // User stopped speaking, continue listening
          return;
        }
        if (event.error === 'not-allowed') {
          alert('Microphone access denied. Please enable microphone permissions.');
          stopRecording();
        }
      };

      recognition.onend = () => {
        // If still in recording state, restart (continuous mode)
        // Use a ref to check the actual recording state
        if (recognitionRef.current === recognition) {
          try {
            recognition.start();
          } catch (e) {
            // Recognition already started or was stopped
            setIsListening(false);
            setInterimTranscript('');
          }
        } else {
          setIsListening(false);
          setInterimTranscript('');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      alert('Failed to start voice recognition. Please try again.');
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      setIsRecording(false);
      setIsListening(false);
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setInterimTranscript('');

      // If there's text in the input, send it
      if (inputText.trim()) {
        handleSendMessage(inputText.trim());
        setInputText('');
      }
    }
  };

  const cleanTextForSpeech = (text: string): string => {
    return text
      .replace(/###\s+/g, '') // Remove headers
      .replace(/\*\*/g, '')   // Remove bold
      .replace(/\*/g, '')    // Remove italic
      .replace(/🔗\s*\[.*?\]\(.*?\)/g, '') // Remove link buttons
      .replace(/\[.*?\]\(.*?\)/g, '')    // Remove markdown links
      .replace(/---/g, ' ')   // Remove separators
      .replace(/>\s+/g, '')   // Remove quotes
      .replace(/####\s+/g, '') // Remove subheaders
      .trim();
  };

  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setActiveSpeechId(null);
    }
  };

  const speakMessage = (id: string, text: string) => {
    if (!window.speechSynthesis) {
      alert('Text-to-speech is not supported in this browser.');
      return;
    }

    if (activeSpeechId === id) {
      stopSpeaking();
      return;
    }

    // Stop any current speech
    stopSpeaking();

    const cleanedText = cleanTextForSpeech(text);
    const utterance = new SpeechSynthesisUtterance(cleanedText);

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    // rate 1.0 is default, but ensuring rate speeds are fully normal
    utterance.rate = 1.0; 
    utterance.pitch = 1.0;

    utterance.onend = () => setActiveSpeechId(null);
    utterance.onerror = (e) => {
      console.error('TTS Error:', e);
      setActiveSpeechId(null);
    };

    setActiveSpeechId(id);
    window.speechSynthesis.speak(utterance);
  };

  // Cleanup recognition and speech on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const requestLatestMarketNews = () => {
    handleSendMessage('Give me the latest market news summaries.', { includeNews: true });
  };

  const requestLatestCompanyNews = () => {
    if (!inputText.trim()) {
      setInputText('Give me the latest news summary for AAPL.');
      return;
    }
    handleSendMessage(inputText, { includeNews: true });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
          >
            {message.role === 'assistant' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <Bot className="w-5 h-5 text-background" />
              </div>
            )}
            <div
              className={`max-w-[70%] rounded-lg px-4 py-3 relative group ${message.role === 'user'
                ? 'bg-primary text-background'
                : 'bg-surface border border-border text-text-primary'
                }`}
            >
              {message.role === 'assistant' && (
                <button
                  onClick={() => speakMessage(message.id, message.content)}
                  className={`absolute -right-10 top-0 p-2 rounded-full transition-all opacity-0 group-hover:opacity-100 bg-surface-light border border-border hover:bg-surface-dark ${activeSpeechId === message.id ? 'opacity-100 text-primary border-primary' : 'text-text-secondary'}`}
                  title={activeSpeechId === message.id ? "Stop speaking" : "Listen to summary"}
                >
                  {activeSpeechId === message.id ? (
                    <Square className="w-4 h-4 fill-current" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
              )}
              {message.role === 'assistant' && message.stockData && (
                <div className="mb-3 p-3 bg-surface-dark border border-border rounded-md shadow-sm">
                  <div className="flex items-center gap-2 mb-1.5">
                    {message.stockData.logo && (
                      <img src={message.stockData.logo} alt={message.stockData.name} className="w-5 h-5 rounded-full" />
                    )}
                    <div className={`w-2.5 h-2.5 rounded-full ${(message.stockData.change || 0) >= 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="font-bold text-sm text-text-primary">
                      {message.stockData.name} ({message.stockData.ticker})
                    </span>
                  </div>
                  <div className="text-xs text-text-secondary space-y-1">
                    <p>
                      <span className="font-semibold text-text-primary">Price:</span> ${message.stockData.price} 
                      <span className={ (message.stockData.change || 0) >= 0 ? 'text-green-500' : 'text-red-500' }>
                         ({(message.stockData.change || 0) >= 0 ? '+' : ''}{message.stockData.change} / {(message.stockData.percent || 0) >= 0 ? '+' : ''}{message.stockData.percent}%)
                      </span>
                    </p>
                    <p>
                      Details: Range: <span className="text-text-primary">${message.stockData.low} - ${message.stockData.high}</span> . Market Cap: <span className="text-text-primary">{message.stockData.mcap}</span> . Industry: <span className="text-text-primary">{message.stockData.industry}</span>
                    </p>
                  </div>
                </div>
              )}
              <div className={`text-sm prose max-w-none ${message.role === 'assistant' ? 'prose-invert' : ''
                }`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
              <p className={`text-xs mt-1 ${message.role === 'user' ? 'text-background/70' : 'text-text-secondary'
                }`}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            {message.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-light flex items-center justify-center">
                <User className="w-5 h-5 text-text-primary" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <Bot className="w-5 h-5 text-background" />
            </div>
            <div className="bg-surface border border-border rounded-lg px-4 py-3">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border p-4 bg-surface">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setEli5Mode(prev => !prev)}
            className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${eli5Mode
              ? 'bg-primary text-background border-primary'
              : 'bg-surface-light text-text-secondary border-border hover:text-text-primary'
              }`}
          >
            {eli5Mode ? 'ELI5: ON' : 'ELI5: OFF'}
          </button>
          <button
            type="button"
            onClick={requestLatestMarketNews}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-md border border-border bg-surface-light text-text-secondary hover:text-text-primary text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Latest Market News
          </button>
          <button
            type="button"
            onClick={requestLatestCompanyNews}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-md border border-border bg-surface-light text-text-secondary hover:text-text-primary text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Summarize Typed Ticker News
          </button>
        </div>
        <form onSubmit={handleTextSubmit} className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isRecording ? "Listening..." : "Type your message or use voice..."}
              className="w-full px-4 py-3 bg-surface-light border border-border rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              disabled={isLoading}
            />
            {isListening && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {interimTranscript && (
                  <span className="text-xs text-text-secondary italic">({interimTranscript})</span>
                )}
                <div className="w-3 h-3 bg-negative rounded-full animate-pulse" />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={toggleRecording}
            disabled={isLoading}
            className={`px-4 py-3 rounded-lg transition-colors ${isRecording
              ? 'bg-negative text-white hover:bg-negative/90'
              : 'bg-surface-light text-text-primary hover:bg-surface-light/80 border border-border'
              }`}
            title={isRecording ? 'Stop recording' : 'Start voice recording'}
          >
            {isRecording ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            onClick={(e) => {
              if (isRecording) {
                e.preventDefault();
                stopRecording();
              }
            }}
            className="px-4 py-3 bg-primary text-background rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={isRecording ? "Stop recording and send" : "Send message"}
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
        <p className="text-xs text-text-secondary mt-2 text-center">
          {isRecording ? 'Speaking... Your words appear as you talk. Click microphone to stop and send.' : 'Click microphone to start voice input - your words will appear as you speak'}
        </p>
      </div>
    </div>
  );
};

export default Chatbot;
