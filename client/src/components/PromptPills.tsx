import React from 'react';
import { Sparkles } from 'lucide-react';

interface PromptPillsProps {
  prompts: string[];
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
}

export const PromptPills: React.FC<PromptPillsProps> = ({
  prompts,
  onSelectPrompt,
  disabled = false,
}) => {
  if (!prompts || prompts.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar">
      <div className="flex items-center gap-1.5 shrink-0 text-slate-400 text-xs font-medium pl-1">
        <Sparkles className="w-3.5 h-3.5 text-rzp-accent" />
        <span className="hidden sm:inline">Suggested:</span>
      </div>
      {prompts.map((prompt, idx) => (
        <button
          key={idx}
          disabled={disabled}
          onClick={() => onSelectPrompt(prompt)}
          className="shrink-0 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium border border-slate-800 hover:border-rzp-accent/40 transition shadow-sm active:scale-95 disabled:opacity-50"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
};
