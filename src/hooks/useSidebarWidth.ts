import { useState, useLayoutEffect, RefObject } from 'react';

export const useSidebarWidth = (containerRef: RefObject<HTMLDivElement | null>) => {
  const [sidebarWidth, setSidebarWidth] = useState(380);

  useLayoutEffect(() => {
    if (containerRef.current) {
      setSidebarWidth(containerRef.current.clientWidth - 32); // subtract padding
    }
    
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setSidebarWidth(entries[0].contentRect.width - 32);
      }
    });
    
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => observer.disconnect();
  }, [containerRef]);

  return sidebarWidth;
};
