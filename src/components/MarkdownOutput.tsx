import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownOutputProps {
  content: string;
  className?: string;
  color?: string;
}

const formatMentions = (children: React.ReactNode): React.ReactNode => {
  return React.Children.map(children, child => {
    if (typeof child === 'string') {
      const parts = child.split(/(@(?:file|dir):[^\s]+)/g);
      return parts.map((part, i) => 
        (part.match(/^@(?:file|dir):[^\s]+/)) 
          ? <span key={part + i} className="mention-tag">{part}</span> 
          : part
      );
    }
    return child;
  });
};

export const MarkdownOutput: React.FC<MarkdownOutputProps> = ({ content, className, color = '#111827' }) => {
  return (
    <div className={`markdown-output ${className || ''}`} style={{ fontSize: '14px', color, lineHeight: '1.6' }}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          ul: ({ ...props }) => <ul style={{ paddingLeft: '20px', marginBottom: '12px' }} {...props} />,
          ol: ({ ...props }) => <ol style={{ paddingLeft: '20px', marginBottom: '12px' }} {...props} />,
          p: ({ ...props }) => <p style={{ marginBottom: '12px', color: 'inherit' }} {...props}>{formatMentions(props.children)}</p>,
          code: ({ ...props }) => <code style={{ backgroundColor: '#f3f4f6', padding: '2px 4px', borderRadius: '4px', fontSize: '0.9em', fontFamily: 'JetBrains Mono', color: '#111827' }} {...props} />,
          strong: ({ ...props }) => <strong style={{ fontWeight: 600, color: 'inherit' }} {...props} />,
          h1: ({ ...props }) => <h1 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'inherit' }} {...props}>{formatMentions(props.children)}</h1>,
          h2: ({ ...props }) => <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: 'inherit' }} {...props}>{formatMentions(props.children)}</h2>,
          h3: ({ ...props }) => <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px', color: 'inherit' }} {...props}>{formatMentions(props.children)}</h3>,
          li: ({ ...props }) => <li style={{ marginBottom: '4px' }} {...props}>{formatMentions(props.children)}</li>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
