import React, { useRef, useLayoutEffect } from 'react';
import { MarkdownOutput } from './MarkdownOutput';

interface ThinkingBlockProps {
  content: string;
  isActive: boolean;
}

/**
 * ThinkingBlock handles reasoning content with internal auto-scrolling
 */
export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ content, isActive }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (containerRef.current && isActive) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [content, isActive]);

  return (
    <div 
      ref={containerRef}
      className="thinking-scroll-container"
    >
      <MarkdownOutput content={content} className="reasoning-markdown" color="#374151" />
    </div>
  );
};
