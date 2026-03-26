import React, { useState, useEffect } from 'react';
import Chatbot, { Message } from '../components/Chatbot';
import ChatHistorySidebar, { ChatConversation } from '../components/ChatHistorySidebar';

const STORAGE_KEY_CONVERSATIONS = 'chatbot_conversations';
const STORAGE_KEY_MESSAGES = 'chatbot_messages_';

export const ChatbotPage: React.FC = () => {
  const userId = localStorage.getItem('userId') || `user-${Date.now()}`;
  if (!localStorage.getItem('userId')) {
    localStorage.setItem('userId', userId);
  }

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // Load conversations from localStorage on mount
  useEffect(() => {
    const savedConversations = localStorage.getItem(STORAGE_KEY_CONVERSATIONS);
    if (savedConversations) {
      const parsed = JSON.parse(savedConversations);
      const convs = parsed.map((conv: any) => ({
        ...conv,
        timestamp: new Date(conv.timestamp),
        stockTickers: conv.stockTickers || [] // Handle old conversations without stockTickers
      }));
      setConversations(convs);
      
      // Set the most recent conversation as active
      if (convs.length > 0) {
        setActiveConversationId(convs[0].id);
      }
    } else {
      // Create first conversation
      createNewChat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load messages for active conversation
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    // Load messages synchronously (localStorage is fast)
    const savedMessages = localStorage.getItem(STORAGE_KEY_MESSAGES + activeConversationId);
    
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const msgs = parsed.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
          setMessages(msgs);
          return;
        }
      } catch (error) {
        console.error('Error parsing saved messages:', error);
      }
    }
    
    // No saved messages or empty array - show welcome message
    setMessages([{
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your financial AI assistant. I can help you with stock information, market analysis, news, and more. How can I assist you today?',
      timestamp: new Date()
    }]);
  }, [activeConversationId]);

  // Save conversations to localStorage
  const saveConversations = (convs: ChatConversation[]) => {
    localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(convs));
    setConversations(convs);
  };

  // Save messages to localStorage
  const saveMessages = (convId: string, msgs: Message[]) => {
    localStorage.setItem(STORAGE_KEY_MESSAGES + convId, JSON.stringify(msgs));
  };

  // Extract stock tickers from text (common ticker patterns)
  const extractStockTickers = (text: string): string[] => {
    const tickerPattern = /\b([A-Z]{1,5})\b/g;
    const commonTickers = [
      'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX', 'AMD',
      'QCOM', 'INTC', 'IBM', 'ORCL', 'CRM', 'ADBE', 'CSCO', 'AVGO', 'TXN', 'AMAT',
      'MU', 'LRCX', 'KLAC', 'MCHP', 'SWKS', 'QRVO', 'NXPI', 'ON', 'MPWR', 'MRVL',
      'SPY', 'QQQ', 'DIA', 'IWM', 'VTI', 'VOO', 'VEA', 'VWO', 'BND', 'AGG'
    ];
    
    const matches = text.match(tickerPattern);
    if (!matches) return [];
    
    const foundTickers = matches
      .filter(ticker => commonTickers.includes(ticker))
      .filter((ticker, index, self) => self.indexOf(ticker) === index); // Remove duplicates
    
    return foundTickers.slice(0, 5); // Limit to 5 tickers
  };

  // Generate conversation summary from messages
  const generateConversationSummary = (messages: Message[]): string => {
    const userMessages = messages.filter(msg => msg.role === 'user');
    
    // Don't generate summary if there are no user messages (only welcome message)
    if (userMessages.length === 0) {
      return 'New Chat';
    }

    // Get first few user messages to create a summary
    const firstMessages = userMessages.slice(0, 3).map(msg => msg.content).join(' ');
    
    // Extract key topics
    const topics: string[] = [];
    
    // Check for stock-related queries
    if (firstMessages.toLowerCase().includes('price') || firstMessages.toLowerCase().includes('stock')) {
      const tickers = extractStockTickers(firstMessages);
      if (tickers.length > 0) {
        topics.push(`${tickers.join(', ')} Stock Analysis`);
      } else {
        topics.push('Stock Price Query');
      }
    }
    
    // Check for market trends
    if (firstMessages.toLowerCase().includes('market') || firstMessages.toLowerCase().includes('trend')) {
      topics.push('Market Trends');
    }
    
    // Check for news
    if (firstMessages.toLowerCase().includes('news') || firstMessages.toLowerCase().includes('latest')) {
      topics.push('Financial News');
    }
    
    // Check for portfolio
    if (firstMessages.toLowerCase().includes('portfolio') || firstMessages.toLowerCase().includes('investment')) {
      topics.push('Portfolio Analysis');
    }
    
    // Check for earnings
    if (firstMessages.toLowerCase().includes('earnings') || firstMessages.toLowerCase().includes('revenue')) {
      topics.push('Earnings Analysis');
    }

    // If we found topics, create a summary
    if (topics.length > 0) {
      return topics.join(' • ');
    }

    // Otherwise, create a smart summary from first message
    const firstMessage = userMessages[0].content.trim();
    
    // Remove common question words
    const cleaned = firstMessage
      .replace(/^(what|how|when|where|why|tell me|show me|can you|i want|i need)\s+/i, '')
      .trim();
    
    // Capitalize first letter
    const capitalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    
    // Limit length
    if (capitalized.length <= 60) {
      return capitalized;
    }
    
    // Try to cut at a sentence boundary
    const sentenceEnd = capitalized.substring(0, 57).lastIndexOf('.');
    if (sentenceEnd > 30) {
      return capitalized.substring(0, sentenceEnd + 1);
    }
    
    // Cut at word boundary
    const wordEnd = capitalized.substring(0, 57).lastIndexOf(' ');
    if (wordEnd > 30) {
      return capitalized.substring(0, wordEnd) + '...';
    }
    
    return capitalized.substring(0, 57) + '...';
  };

  // Create a new chat
  const createNewChat = () => {
    // Save current conversation's messages before switching
    if (activeConversationId && messages.length > 0) {
      saveMessages(activeConversationId, messages);
    }

    const newId = `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newConversation: ChatConversation = {
      id: newId,
      title: 'New Chat',
      lastMessage: '',
      timestamp: new Date(),
      messageCount: 0,
      stockTickers: []
    };

    const updatedConversations = [newConversation, ...conversations];
    saveConversations(updatedConversations);
    
    // Clear messages immediately to prevent old messages from being used
    setMessages([]);
    
    // Set new conversation as active - this will trigger useEffect to load fresh messages
    setActiveConversationId(newId);
  };

  // Select a conversation
  const handleSelectConversation = (conversationId: string) => {
    // Don't switch if already on this conversation
    if (conversationId === activeConversationId) {
      return;
    }

    // Save current conversation's messages before switching
    if (activeConversationId && messages.length > 0) {
      saveMessages(activeConversationId, messages);
    }

    // Switch to the selected conversation - this will trigger useEffect to load messages
    // The useEffect will handle clearing and loading messages
    setActiveConversationId(conversationId);
  };

  // Delete a conversation
  const handleDeleteConversation = (conversationId: string) => {
    const updatedConversations = conversations.filter(conv => conv.id !== conversationId);
    saveConversations(updatedConversations);
    localStorage.removeItem(STORAGE_KEY_MESSAGES + conversationId);

    // If deleted conversation was active, switch to another or create new
    if (activeConversationId === conversationId) {
      if (updatedConversations.length > 0) {
        setActiveConversationId(updatedConversations[0].id);
      } else {
        createNewChat();
      }
    }
  };

  // Handle messages change from Chatbot component
  const handleMessagesChange = (newMessages: Message[]) => {
    if (!activeConversationId) return;

    // Only update if messages actually changed (prevent unnecessary re-renders)
    const currentIds = messages.map(m => m.id).join(',');
    const newIds = newMessages.map(m => m.id).join(',');
    
    if (currentIds !== newIds) {
      setMessages(newMessages);
      saveMessages(activeConversationId, newMessages);
    } else {
      // Messages haven't changed, just save to be safe
      saveMessages(activeConversationId, newMessages);
      return;
    }

    // Use functional update to get latest conversations state
    setConversations((prevConversations) => {
      // Get current conversations from state or localStorage
      const currentConversations = prevConversations.length > 0 ? prevConversations : 
        JSON.parse(localStorage.getItem(STORAGE_KEY_CONVERSATIONS) || '[]').map((conv: any) => ({
          ...conv,
          timestamp: new Date(conv.timestamp),
          stockTickers: conv.stockTickers || []
        }));

      // Check if the active conversation exists in the conversations list
      const activeConv = currentConversations.find((conv: ChatConversation) => conv.id === activeConversationId);
      if (!activeConv) {
        // Conversation doesn't exist yet, don't update metadata
        return currentConversations;
      }

      // Update conversation metadata - only if there are user messages
      const userMessages = newMessages.filter(msg => msg.role === 'user');
      if (userMessages.length === 0) {
        // No user messages yet, keep conversations as is
        return currentConversations;
      }

      const lastUserMessage = userMessages[userMessages.length - 1];
      
      // Extract stock tickers from all messages
      const allText = newMessages.map(msg => msg.content).join(' ');
      const stockTickers = extractStockTickers(allText);
      
      // Generate summary title - only update if title is still "New Chat"
      const summary = generateConversationSummary(newMessages);
      
      const updatedConversations = currentConversations.map((conv: ChatConversation) => {
        if (conv.id === activeConversationId) {
          // Only update title if it's still "New Chat" to prevent overwriting existing titles
          // Also ensure summary is not "New Chat" (which means no user messages found)
          const newTitle = (conv.title === 'New Chat' && summary !== 'New Chat') 
            ? summary 
            : conv.title;
          
          return {
            ...conv,
            title: newTitle,
            lastMessage: lastUserMessage.content,
            timestamp: lastUserMessage.timestamp,
            messageCount: newMessages.length,
            stockTickers: stockTickers
          };
        }
        return conv;
      });
      
      // Save to localStorage
      localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(updatedConversations));
      
      return updatedConversations;
    });
  };

  return (
    <div className="flex h-[calc(100vh-80px)] w-full">
      {/* Sidebar */}
      <div className="flex-shrink-0">
        <ChatHistorySidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onNewChat={createNewChat}
          onDeleteConversation={handleDeleteConversation}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-surface border-l border-border overflow-hidden">
        <div className="border-b border-border p-4 bg-surface-light">
          <h1 className="text-2xl font-semibold text-text-primary">Financial AI Assistant</h1>
          <p className="text-sm text-text-secondary mt-1">
            Ask me about stocks, market trends, news, or any financial questions
          </p>
        </div>
        <div className="flex-1 overflow-hidden">
          {activeConversationId && (
            <Chatbot
              key={activeConversationId}
              userId={userId}
              conversationId={activeConversationId}
              initialMessages={messages}
              onMessagesChange={handleMessagesChange}
            />
          )}
        </div>
      </div>
    </div>
  );
};
