import { useRef, useLayoutEffect, RefObject } from 'react';

export const useAutoScroll = (
  containerRef: RefObject<HTMLDivElement | null>,
  dependencies: any[]
) => {
  const isAtBottomRef = useRef(true);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scrollToBottom = () => {
      if (isAtBottomRef.current) {
        container.scrollTop = container.scrollHeight;
      }
    };

    scrollToBottom();

    const observer = new ResizeObserver(() => {
      scrollToBottom();
    });

    const wrapper = container.querySelector('.message-list-wrapper');
    if (wrapper) {
      observer.observe(wrapper);
    }

    return () => observer.disconnect();
  }, dependencies);

  const handleScroll = () => {
    const container = containerRef.current;
    if (container) {
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;
      isAtBottomRef.current = isAtBottom;
    }
  };

  return { handleScroll, isAtBottomRef };
};
