import { useState, useEffect, useRef } from 'react';
import Draggable from 'react-draggable';

export const Pomodoro = () => {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const nodeRef = useRef(null);
  
  // Load position safely
  const getSavedPos = () => {
    try {
      const savedPos = localStorage.getItem('pomodoro_pos');
      // Check if it looks like JSON before parsing, or catch the error
      return savedPos ? JSON.parse(savedPos) : undefined;
    } catch (e) {
      // If data is corrupted (SyntaxError), return undefined to reset position
      console.warn("Resetting Pomodoro position due to data corruption.");
      return undefined;
    }
  };

  const initialPos = getSavedPos();

  useEffect(() => {
    let interval: any = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification("Pomodoro Complete!");
      }
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const handleStop = (e: any, data: any) => {
    // Save as simple JSON object
    const pos = { x: data.x, y: data.y };
    localStorage.setItem('pomodoro_pos', JSON.stringify(pos));
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    // Fixed Overlay Wrapper - This fills the screen and acts as the "Parent" boundary
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
        <Draggable 
          nodeRef={nodeRef} 
          defaultPosition={initialPos}
          onStop={handleStop}
          handle=".drag-handle"
          bounds="parent" // Strictly constrained to the fixed inset-0 wrapper (Viewport)
        >
          <div 
            ref={nodeRef}
            // Absolute positioning sets the initial spot to Bottom-Left
            className="absolute bottom-6 left-6 pointer-events-auto" 
          >
            {isMinimized ? (
              <div className="relative group">
                 {/* Drag Handle Overlay */}
                 <div className="drag-handle absolute inset-0 cursor-move z-10 rounded-full" title="Drag Timer"></div>
                <button 
                  onClick={() => setIsMinimized(false)}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors text-white shadow-lg border-4 border-white relative z-0 ${isActive ? 'bg-amber-500 animate-pulse' : 'bg-slate-800'}`}
                  aria-label="Expand Timer"
                >
                  <i className="fas fa-clock text-xl"></i>
                  {isActive && <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white"></div>}
                </button>
              </div>
            ) : (
              <div className="bg-slate-900/95 backdrop-blur text-white rounded-full shadow-2xl p-2 pl-6 flex items-center gap-4 border border-slate-700 w-max">
                <span className="font-mono font-bold text-2xl w-20 text-center tracking-widest select-none cursor-default">{fmt(timeLeft)}</span>
                
                <div className="flex gap-2 relative z-20">
                  <button 
                    onClick={() => setIsActive(!isActive)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-sm active:scale-95 ${isActive ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
                    aria-label={isActive ? "Pause" : "Start"}
                  >
                    <i className={`fas ${isActive ? 'fa-pause' : 'fa-play'} text-sm`}></i>
                  </button>
                  
                  <button onClick={() => {setIsActive(false); setTimeLeft(25*60)}} className="w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-300 hover:text-white active:scale-95" aria-label="Reset">
                    <i className="fas fa-undo text-sm"></i>
                  </button>

                  <div className="w-px h-6 bg-slate-700 mx-1 self-center"></div>

                  <button onClick={() => setIsMinimized(true)} className="w-10 h-10 rounded-full hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white" aria-label="Minimize">
                    <i className="fas fa-minus text-sm"></i>
                  </button>
                </div>
                
                {/* Drag Handle */}
                <div className="drag-handle pr-3 pl-2 text-slate-500 cursor-move flex items-center justify-center h-full hover:text-slate-300 transition-colors border-l border-slate-800/50 py-2">
                   <i className="fas fa-grip-vertical text-lg"></i>
                </div>
              </div>
            )}
          </div>
        </Draggable>
    </div>
  );
};