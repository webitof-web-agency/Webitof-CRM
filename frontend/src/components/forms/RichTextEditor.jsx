import { useEffect, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Heading3,
  Link2,
  List,
  ListOrdered,
  RemoveFormatting
} from 'lucide-react';
import { cn } from '../../lib/cn';

const COMMANDS = [
  { command: 'bold', label: 'Bold (Ctrl+B)', Icon: Bold },
  { command: 'italic', label: 'Italic (Ctrl+I)', Icon: Italic },
  { command: 'underline', label: 'Underline (Ctrl+U)', Icon: Underline },
  { command: 'formatBlock', value: '<h3>', label: 'Heading (H3)', Icon: Heading3 },
  { command: 'insertUnorderedList', label: 'Bullet list', Icon: List },
  { command: 'insertOrderedList', label: 'Numbered list', Icon: ListOrdered },
  { command: 'removeFormat', label: 'Clear formatting', Icon: RemoveFormatting }
];

function normalizeContentToHtml(raw) {
  if (!raw) return '';
  const text = String(raw);
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  // Convert plain text line breaks and bullets into clean HTML paragraphs
  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '<p><br></p>';
      return `<p>${trimmed}</p>`;
    })
    .join('');
}

export function RichTextEditor({
  value = '',
  onChange,
  placeholder = 'Add custom quotation content...',
  className = '',
  minHeight = '400px',
  resizable = false
}) {
  const editorRef = useRef(null);
  const focusedRef = useRef(false);
  const parsedMinHeight = typeof minHeight === 'number' ? minHeight : (parseInt(minHeight, 10) || 400);
  const [editorHeight, setEditorHeight] = useState(parsedMinHeight);

  useEffect(() => {
    setEditorHeight(parsedMinHeight);
  }, [parsedMinHeight]);

  useEffect(() => {
    if (!editorRef.current || !resizable) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = Math.round(entry.contentRect.height);
        // Only accept height if it is at least parsedMinHeight to prevent collapse on initial layout/tab switch
        if (h >= parsedMinHeight) {
          setEditorHeight(h);
        }
      }
    });
    ro.observe(editorRef.current);
    return () => ro.disconnect();
  }, [resizable, parsedMinHeight]);

  useEffect(() => {
    if (!editorRef.current || focusedRef.current) return;
    const formatted = normalizeContentToHtml(value);
    if (editorRef.current.innerHTML !== formatted) {
      editorRef.current.innerHTML = formatted;
    }
  }, [value]);

  function runCommand(command, commandValue = null) {
    editorRef.current?.focus();
    if (command === 'formatBlock') {
      document.execCommand('formatBlock', false, commandValue);
    } else {
      document.execCommand(command, false, commandValue);
    }
    onChange?.(editorRef.current?.innerHTML || '');
  }

  function addLink() {
    const href = window.prompt('Enter link URL');
    if (!href) return;
    runCommand('createLink', href);
  }

  return (
    <div className={cn('overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 shadow-2xs transition-all', className)}>
      {/* Formatting Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 bg-slate-50/90 px-2.5 py-1.5">
        <div className="flex items-center gap-1 flex-wrap">
          {COMMANDS.map(({ command, value: cmdVal, label, Icon }) => (
            <button
              key={`${command}-${cmdVal || ''}`}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runCommand(command, cmdVal)}
              className="rounded-lg p-1.5 text-slate-600 transition hover:bg-white hover:text-blue-700 hover:shadow-2xs cursor-pointer"
              title={label}
              aria-label={label}
            >
              <Icon size={14} />
            </button>
          ))}
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={addLink}
            className="rounded-lg p-1.5 text-slate-600 transition hover:bg-white hover:text-blue-700 hover:shadow-2xs cursor-pointer"
            title="Add link"
            aria-label="Add link"
          >
            <Link2 size={14} />
          </button>
        </div>
      </div>

      {/* Editable Content Area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        style={{
          minHeight: `${parsedMinHeight}px`,
          height: resizable ? `${editorHeight}px` : undefined,
          resize: resizable ? 'vertical' : 'none'
        }}
        onFocus={() => { focusedRef.current = true; }}
        onBlur={(event) => {
          focusedRef.current = false;
          onChange?.(event.currentTarget.innerHTML);
        }}
        onInput={(event) => onChange?.(event.currentTarget.innerHTML)}
        className={cn(
          "rich-text-editor w-full px-4 py-3 text-sm leading-relaxed text-slate-800 outline-none overflow-y-auto",
          resizable && "resize-y",
          "empty:before:pointer-events-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]",
          "[&_a]:text-blue-600 [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6 [&_p]:mb-2 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-slate-900 [&_h3]:mb-1.5"
        )}
      />

      {resizable && (
        <div className="flex items-center justify-between px-3 py-1 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 select-none">
          <span>WYSIWYG Rich Editor</span>
          <span className="flex items-center gap-1 text-slate-400">
            Drag bottom-right corner to resize ⇲
          </span>
        </div>
      )}
    </div>
  );
}

