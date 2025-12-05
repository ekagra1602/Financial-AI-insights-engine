import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Loader2, Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatbotProps {
  userId?: string;
  conversationId?: string;
  initialMessages?: Message[];
  onMessagesChange?: (messages: Message[]) => void;
}

const Chatbot: React.FC<ChatbotProps> = ({ userId: _userId, conversationId, initialMessages, onMessagesChange }) => {
  const defaultMessage: Message = {
    id: '1',
    role: 'assistant',
    content: 'Hello! I\'m your financial AI assistant. I can help you with stock information, market analysis, news, and more. How can I assist you today?',
    timestamp: new Date()
  };

  const [messages, setMessages] = useState<Message[]>(initialMessages || [defaultMessage]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
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


  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

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
      // Real API call
      const response = await fetch('/api/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      const responseText = data.response || 'I apologize, but I couldn\'t process your request at this time.';

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I\'m sorry, I encountered an error. Please try again or check your connection.',
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

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
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
              className={`max-w-[70%] rounded-lg px-4 py-3 ${message.role === 'user'
                ? 'bg-primary text-background'
                : 'bg-surface border border-border text-text-primary'
                }`}
            >
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

