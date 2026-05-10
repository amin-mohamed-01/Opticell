'use client';

import { useState, useEffect } from 'react';

export type FaceState = 'normal' | 'happy' | 'confused' | 'sad';

const TARGETS = {
  normal: {
    color: '#000000', // Black
    lEye: { rx: 12, ry: 16, cy: 80 },
    rEye: { rx: 12, ry: 16, cy: 80 },
    mouth: 'M 65 130 Q 100 130 135 130',
    lBrow: 'M 50 55 Q 65 52 80 55',
    rBrow: 'M 120 55 Q 135 52 150 55',
  },
  happy: {
    color: '#000000', // Black
    lEye: { rx: 14, ry: 8, cy: 75 },
    rEye: { rx: 14, ry: 8, cy: 75 },
    mouth: 'M 60 120 Q 100 160 140 120',
    lBrow: 'M 50 45 Q 65 40 80 50',
    rBrow: 'M 120 50 Q 135 40 150 45',
  },
  confused: {
    color: '#000000', // Black
    lEye: { rx: 12, ry: 16, cy: 80 },
    rEye: { rx: 10, ry: 8, cy: 80 },
    mouth: 'M 70 135 Q 100 125 130 135',
    lBrow: 'M 55 65 Q 65 60 80 65',
    rBrow: 'M 120 45 Q 135 40 150 50',
  },
  sad: {
    color: '#000000', // Black
    lEye: { rx: 12, ry: 12, cy: 85 },
    rEye: { rx: 12, ry: 12, cy: 85 },
    mouth: 'M 65 145 Q 100 125 135 145',
    lBrow: 'M 55 55 Q 65 45 80 60',
    rBrow: 'M 120 60 Q 135 45 145 55',
  }
};

export default function MLFaceAvatar({ state }: { state: FaceState }) {
  const current = TARGETS[state] || TARGETS.normal;

  // Random blinking logic
  const [isBlinking, setIsBlinking] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const blink = () => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 150); // Blink duration

      // Schedule next blink
      const nextBlink = Math.random() * 4000 + 2000; // 2s to 6s
      timeoutId = setTimeout(blink, nextBlink);
    };

    timeoutId = setTimeout(blink, 2000);
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div className="w-full h-full flex items-center justify-center bg-transparent min-h-[1200px]">
      <svg
        viewBox="0 0 200 200"
        className="w-full max-w-[1200px] h-auto drop-shadow-xl animate-float"
      >
        <defs>
          <style>
            {`
              .face-elem {
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
              }
              @keyframes float {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-10px); }
              }
              .animate-float {
                animation: float 4s ease-in-out infinite;
              }
            `}
          </style>
        </defs>

        {/* Head Background - Solid White with subtle gray stroke */}
        <rect
          x="10" y="10"
          width="180" height="180"
          rx="40"
          fill="#ffffff"
          stroke="#cbd5e1"
          strokeWidth="3"
        />

        {/* Face Elements - Solid Black */}
        <g strokeLinecap="round" strokeLinejoin="round" fill="none">
          {/* Left Brow */}
          <path
            className="face-elem"
            d={current.lBrow}
            stroke={current.color}
            strokeWidth="8"
          />

          {/* Right Brow */}
          <path
            className="face-elem"
            d={current.rBrow}
            stroke={current.color}
            strokeWidth="8"
          />

          {/* Left Eye */}
          <ellipse
            className="face-elem"
            cx="65"
            cy={current.lEye.cy}
            rx={current.lEye.rx}
            ry={isBlinking ? 2 : current.lEye.ry}
            fill={current.color}
          />

          {/* Right Eye */}
          <ellipse
            className="face-elem"
            cx="135"
            cy={current.rEye.cy}
            rx={current.rEye.rx}
            ry={isBlinking ? 2 : current.rEye.ry}
            fill={current.color}
          />

          {/* Mouth */}
          <path
            className="face-elem"
            d={current.mouth}
            stroke={current.color}
            strokeWidth="8"
          />
        </g>
      </svg>
    </div>
  );
}
