import React, { useState, useEffect } from 'react';

interface LiveTimerProps {
  startTime: number;
}

/**
 * Live timer component for real-time counting
 */
export const LiveTimer: React.FC<LiveTimerProps> = ({ startTime }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const update = () => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return <>{elapsed}s</>;
};
