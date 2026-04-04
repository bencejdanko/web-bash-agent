import { useRef, useLayoutEffect, RefObject, useEffect } from 'react';

export const useAutoScroll = (
  containerRef: RefObject<HTMLDivElement | null>,
  dependencies: any[]
) => {
  const isAtBottomRef = useRef(true);
  const lastScrollTopRef = useRef(0);

  const scrollToBottom = (force = false) => {
    const container = containerRef.current;
    if (container && (isAtBottomRef.current || force)) {
      container.scrollTop = container.scrollHeight;
    }
  };

  // Set up observer once
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      scrollToBottom();
    });

    const wrapper = container.querySelector('.message-list-wrapper');
    if (wrapper) {
      observer.observe(wrapper);
    }

    // Initial scroll
    scrollToBottom(true);

    return () => observer.disconnect();
  }, [containerRef]); // Only reset if container changes

  // Also scroll when dependencies change (like new messages)
  useLayoutEffect(() => {
    scrollToBottom();
  }, dependencies);

  const handleScroll = () => {
    const container = containerRef.current;
    if (container) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const atBottom = scrollHeight - scrollTop <= clientHeight + 100;
      
      // If user scrolled up significantly and not at bottom, disable auto-scroll
      if (scrollTop < lastScrollTopRef.current && !atBottom) {
        isAtBottomRef.current = false;
      }
      
      // If user is at bottom, re-enable auto-scroll
      if (atBottom) {
        isAtBottomRef.current = true;
      }
      
      lastScrollTopRef.current = scrollTop;
    }
  };

  return { handleScroll, isAtBottomRef, scrollToBottom };
};
