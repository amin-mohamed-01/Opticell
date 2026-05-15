'use client';

import { useState, useEffect } from 'react';
import { Monitor, Smartphone, Tablet, X } from 'lucide-react';

export default function DeviceRestriction() {
  const [showWarning, setShowWarning] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check screen size on mount and on resize
    const checkSize = () => {
      if (window.innerWidth < 1024 && !dismissed) {
        setShowWarning(true);
      } else {
        setShowWarning(false);
      }
    };

    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, [dismissed]);

  if (!showWarning) return null;

  return (
    <div className="dr-overlay">
      <div className="dr-modal">
        <button className="dr-close" onClick={() => setDismissed(true)}>
          <X size={18} />
        </button>

        <div className="dr-icon-container">
          <div className="dr-icon-bg">
            <Monitor size={48} className="dr-icon-main" />
            <div className="dr-icon-sub-mobile">
              <Smartphone size={20} />
            </div>
            <div className="dr-icon-sub-tablet">
              <Tablet size={24} />
            </div>
          </div>
        </div>

        <div className="dr-content">
          <h2 className="dr-title">أفضل تجربة على الكمبيوتر</h2>
          <p className="dr-description">
            لوحة التحكم OptiCell مصممة ومحسنة للشاشات الكبيرة. للحصول على أفضل تجربة مراقبة وتحليل، يرجى استخدام جهاز كمبيوتر.
          </p>

          <div className="dr-divider" />

          <h2 className="dr-title-en">Desktop Recommended</h2>
          <p className="dr-description-en">
            The OptiCell dashboard is optimized for larger screens. For the best monitoring and analysis experience, please use a desktop computer.
          </p>
        </div>

        <button className="dr-continue-btn" onClick={() => setDismissed(true)}>
          المتابعة على أي حال • Continue Anyway
        </button>
      </div>

      <style jsx>{`
        .dr-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(12px);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: fadeIn 0.3s ease-out;
        }

        .dr-modal {
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 32px;
          max-width: 480px;
          width: 100%;
          padding: 40px;
          position: relative;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          text-align: center;
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .dr-close {
          position: absolute;
          top: 20px;
          right: 20px;
          background: #f3f4f6;
          border: none;
          color: #6b7280;
          width: 36px;
          height: 36px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .dr-close:hover {
          background: #e5e7eb;
          color: #111827;
          transform: rotate(90deg);
        }

        .dr-icon-container {
          display: flex;
          justify-content: center;
          margin-bottom: 24px;
        }

        .dr-icon-bg {
          position: relative;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          width: 100px;
          height: 100px;
          border-radius: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 20px -5px rgba(37, 99, 235, 0.4);
        }

        .dr-icon-sub-mobile, .dr-icon-sub-tablet {
          position: absolute;
          background: white;
          color: #2563eb;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .dr-icon-sub-mobile {
          bottom: -5px;
          right: -5px;
          padding: 4px;
          border: 2px solid #f3f4f6;
        }

        .dr-icon-sub-tablet {
          top: -5px;
          left: -5px;
          padding: 6px;
          border: 2px solid #f3f4f6;
        }

        .dr-title {
          font-size: 1.5rem;
          font-weight: 800;
          color: #111827;
          margin-bottom: 12px;
        }

        .dr-title-en {
          font-size: 1.25rem;
          font-weight: 700;
          color: #374151;
          margin-bottom: 8px;
        }

        .dr-description {
          font-size: 0.95rem;
          color: #4b5563;
          line-height: 1.6;
          margin-bottom: 20px;
        }

        .dr-description-en {
          font-size: 0.85rem;
          color: #6b7280;
          line-height: 1.5;
          margin-bottom: 24px;
        }

        .dr-divider {
          height: 1px;
          background: #e5e7eb;
          margin: 0 auto 20px;
          width: 60px;
        }

        .dr-continue-btn {
          background: #111827;
          color: white;
          border: none;
          padding: 14px 28px;
          border-radius: 16px;
          font-weight: 600;
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 0.2s;
          width: 100%;
        }

        .dr-continue-btn:hover {
          background: #374151;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .dr-continue-btn:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
}
