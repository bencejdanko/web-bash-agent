import React, { useRef, useLayoutEffect } from 'react';
import { MarkdownOutput } from './MarkdownOutput';
import { useTextHeight } from '../hooks/useTextHeight';

interface ThinkingBlockProps {
  content: string;
  isActive: boolean;
  sidebarWidth: number;
}

/**
 * ThinkingBlock handles reasoning content with internal auto-scrolling
 * and pretext-based height prediction for stable layouts.
 */
export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ content, isActive, sidebarWidth }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Predict height using pretext to help parent collapsible and avoid layout jumps
  // 14px Inter, 1.6 line height (22.4px), with some padding (12px)
  const predictedHeight = useTextHeight(content, '14px Inter', sidebarWidth - 32, 22.4, 12);

  useLayoutEffect(() => {
    if (containerRef.current && isActive) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [content, isActive]);

  return (
    <div 
      ref={containerRef}
      className="thinking-scroll-container"
      style={{
        minHeight: content ? `${Math.min(predictedHeight, 220)}px` : 0
      }}
    >
      <MarkdownOutput content={content} className="reasoning-markdown" color="var(--agent-text-subtle)" />
    </div>
  );
};
