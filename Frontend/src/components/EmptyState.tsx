import React from 'react';
import { FileText } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  message: string;
  description?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, message, description }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="text-text-secondary mb-4">
        {icon || <FileText className="w-16 h-16" />}
      </div>
      <h3 className="text-text-primary text-lg font-semibold mb-2">{message}</h3>
      {description && <p className="text-text-secondary text-sm max-w-md">{description}</p>}
    </div>
  );
};

export default EmptyState;

