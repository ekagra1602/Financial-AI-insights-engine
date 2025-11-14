import React, { useState } from 'react';
import { MessageSquare, Plus, Search, Trash2 } from 'lucide-react';

export interface ChatConversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  messageCount: number;
  stockTickers: string[];
}

interface ChatHistorySidebarProps {
  conversations: ChatConversation[];
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (conversationId: string) => void;
}

const ChatHistorySidebar: React.FC<ChatHistorySidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const filteredConversations = conversations.filter(conv => {
    const query = searchQuery.toLowerCase();
    return (
      conv.title.toLowerCase().includes(query) ||
      conv.lastMessage.toLowerCase().includes(query) ||
      conv.stockTickers.some(ticker => ticker.toLowerCase().includes(query))
    );
  });

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="w-64 bg-surface border-r border-border flex flex-col h-full">
      {/* New Chat Button */}
      <div className="p-4 border-b border-border">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-3 px-4 py-3 bg-surface-light hover:bg-surface-light/80 rounded-lg transition-colors text-text-primary"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">New chat</span>
        </button>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            type="text"
            placeholder="Search chats"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-light border border-border rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-8 text-text-secondary text-sm">
              {searchQuery ? 'No chats found' : 'No chat history'}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    activeConversationId === conversation.id
                      ? 'bg-primary/20 text-primary'
                      : 'hover:bg-surface-light text-text-primary'
                  }`}
                  onClick={() => onSelectConversation(conversation.id)}
                  onMouseEnter={() => setHoveredId(conversation.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <MessageSquare className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-medium text-sm truncate flex-1">
                        {conversation.title}
                      </div>
                      {conversation.stockTickers && conversation.stockTickers.length > 0 && (
                        <div className="flex gap-1 flex-shrink-0">
                          {conversation.stockTickers.slice(0, 3).map((ticker) => (
                            <span
                              key={ticker}
                              className="px-1.5 py-0.5 bg-primary/20 text-primary text-xs font-semibold rounded"
                            >
                              {ticker}
                            </span>
                          ))}
                          {conversation.stockTickers.length > 3 && (
                            <span className="px-1.5 py-0.5 bg-surface-light text-text-secondary text-xs rounded">
                              +{conversation.stockTickers.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-text-secondary truncate mt-0.5">
                      {conversation.lastMessage}
                    </div>
                    <div className="text-xs text-text-secondary mt-1">
                      {formatTime(conversation.timestamp)}
                    </div>
                  </div>
                  {hoveredId === conversation.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(conversation.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-surface rounded"
                      title="Delete chat"
                    >
                      <Trash2 className="w-4 h-4 text-text-secondary hover:text-negative" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatHistorySidebar;

