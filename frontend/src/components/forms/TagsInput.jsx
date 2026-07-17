import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

export function TagsInput({ value = [], onChange, placeholder, className }) {
  const [inputValue, setInputValue] = useState('');

  // If value is passed as string JSON, try parsing, otherwise assume array
  let tags = [];
  try {
    tags = typeof value === 'string' ? JSON.parse(value || '[]') : value;
  } catch (e) {
    tags = [];
  }
  if (!Array.isArray(tags)) tags = [];

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const addTag = () => {
    const trimmed = inputValue.trim();
    const exists = tags.some((tag) => String(tag).trim().toLowerCase() === trimmed.toLowerCase());
    if (trimmed && !exists) {
      const newTags = [...tags, trimmed];
      if (onChange) onChange(newTags);
    }
    setInputValue('');
  };

  const removeTag = (indexToRemove) => {
    const newTags = tags.filter((_, index) => index !== indexToRemove);
    if (onChange) onChange(newTags);
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2 p-1.5 border border-slate-300 rounded-md bg-white focus-within:ring-1 focus-within:ring-[var(--primary)] focus-within:border-[var(--primary)] transition-shadow", className)}>
      {tags.map((tag, index) => (
        <span 
          key={index} 
          className="flex items-center gap-1.5 px-2.5 py-1 text-sm bg-slate-100 text-slate-700 rounded-md border border-slate-200"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(index)}
            className="text-slate-400 hover:text-slate-600 focus:outline-none"
          >
            <X size={14} />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addTag}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] px-1 py-0.5 text-sm bg-transparent border-none focus:outline-none focus:ring-0 text-[var(--text-main)] placeholder:text-slate-400"
      />
    </div>
  );
}
