import React, { useState } from 'react';
import { Send, Sparkles, Loader2 } from 'lucide-react';

interface ReminderInputProps {
  onSubmit: (text: string) => void;
  isProcessing: boolean;
}

const exampleReminders = [
  "Remind me to buy AAPL if the price drops below $170",
  "Alert me when NVDA goes above $500",
  "Notify me if TSLA drops 5% from current price",
  "Remind me to review my MSFT position next Monday",
  "Alert me when GOOGL hits $150 so I can sell",
];

export const ReminderInput: React.FC<ReminderInputProps> = ({ onSubmit, isProcessing }) => {
  const [inputText, setInputText] = useState('');
  const [showExamples, setShowExamples] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && !isProcessing) {
      onSubmit(inputText.trim());
      setInputText('');
    }
  };

  const handleExampleClick = (example: string) => {
    setInputText(example);
    setShowExamples(false);
  };

  return (
    <div className="bg-surface rounded-xl border border-border p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Create a Reminder</h2>
          <p className="text-sm text-text-secondary">Describe your stock alert in plain English</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="e.g., Remind me to buy AAPL if the price drops below $170..."
            className="w-full h-24 bg-background border border-border rounded-lg px-4 py-3 text-text-primary placeholder-text-secondary resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            disabled={isProcessing}
          />
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowExamples(!showExamples)}
            className="text-sm text-text-secondary hover:text-primary transition-colors"
          >
            {showExamples ? 'Hide examples' : 'Show examples'}
          </button>

          <button
            type="submit"
            disabled={!inputText.trim() || isProcessing}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Create Reminder
              </>
            )}
          </button>
        </div>

        {showExamples && (
          <div className="bg-background rounded-lg p-4 border border-border">
            <p className="text-xs text-text-secondary mb-3 uppercase tracking-wide">Example Reminders</p>
            <div className="space-y-2">
              {exampleReminders.map((example, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleExampleClick(example)}
                  className="w-full text-left text-sm text-text-primary hover:text-primary hover:bg-surface px-3 py-2 rounded-md transition-colors"
                >
                  "{example}"
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default ReminderInput;
