import React from 'react';

type InlinePart =
  | { type: 'text'; content: string }
  | { type: 'bold'; content: string }
  | { type: 'code'; content: string }
  | { type: 'link'; label: string; url: string };

function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const regex = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(\*\*([^*]+)\*\*)|(`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    if (match[1]) {
      parts.push({ type: 'link', label: match[2], url: match[3] });
    } else if (match[4]) {
      parts.push({ type: 'bold', content: match[5] });
    } else if (match[6]) {
      parts.push({ type: 'code', content: match[7] });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }
  return parts;
}

export function SafeMarkdownText({ content }: { content: string }) {
  const paragraphs = content.split(/\n\n+/);

  return (
    <div className="agent-markdown-body">
      {paragraphs.map((para, pIdx) => {
        const lines = para.split('\n');
        return (
          <p key={pIdx} className="agent-markdown-p">
            {lines.map((line, lIdx) => (
              <span key={lIdx} style={{ display: lIdx > 0 ? 'block' : 'inline' }}>
                {parseInline(line).map((part, partIdx) => {
                  if (part.type === 'link') {
                    return (
                      <a
                        key={partIdx}
                        href={part.url}
                        target="_blank"
                        rel="noreferrer"
                        className="agent-markdown-link"
                      >
                        {part.label} ↗
                      </a>
                    );
                  }
                  if (part.type === 'bold') {
                    return <strong key={partIdx}>{part.content}</strong>;
                  }
                  if (part.type === 'code') {
                    return <code key={partIdx} className="agent-markdown-code">{part.content}</code>;
                  }
                  return <span key={partIdx}>{part.content}</span>;
                })}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
