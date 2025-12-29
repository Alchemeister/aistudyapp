import React, { useState, useEffect, useRef } from 'react';
import Draggable from 'react-draggable';

export const Pomodoro = () => {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const nodeRef = useRef(null);
  
  // Load position from local storage
  const savedPos = localStorage.getItem('pomodoro_pos');
  const initialPos = savedPos ? JSON.parse(savedPos) : { x: 0, y: 0 };

  useEffect(() => {
    let interval: any = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      new Notification("Pomodoro Complete!");
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const handleStop = (e: any, data: any) => {
    localStorage.setItem('pomodoro_pos', JSON.stringify({ x: data.x, y: data.y }));
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <Draggable 
      nodeRef={nodeRef} 
      defaultPosition={initialPos}
      onStop={handleStop}
      bounds="body"
    >
      <div 
        ref={nodeRef}
        className="fixed bottom-4 right-4 z-50 cursor-move"
        style={{ touchAction: 'none' }} // Prevent scrolling while dragging on touch
      >
        {isMinimized ? (
          <div className="animate-fade-in shadow-xl rounded-full">
            <button 
              onMouseDown={(e) => e.stopPropagation()} // Allow clicking button without dragging instantly if needed
              onClick={() => setIsMinimized(false)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors text-white shadow-lg border-2 border-white ${isActive ? 'bg-amber-500 animate-pulse' : 'bg-slate-800'}`}
            >
              <i className="fas fa-clock text-lg"></i>
            </button>
          </div>
        ) : (
          <div className="bg-slate-900/95 backdrop-blur text-white rounded-full shadow-2xl p-1.5 pl-5 flex items-center gap-3 animate-fade-in-up border border-slate-700 w-max">
            <span className="font-mono font-bold text-xl w-16 text-center tracking-widest">{fmt(timeLeft)}</span>
            
            <div className="flex gap-1" onMouseDown={(e) => e.stopPropagation()}>
              <button 
                onClick={() => setIsActive(!isActive)}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${isActive ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
              >
                <i className={`fas ${isActive ? 'fa-pause' : 'fa-play'} text-xs`}></i>
              </button>
              
              <button onClick={() => {setIsActive(false); setTimeLeft(25*60)}} className="w-9 h-9 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-300 hover:text-white">
                <i className="fas fa-undo text-xs"></i>
              </button>

              <button onClick={() => setIsMinimized(true)} className="w-9 h-9 rounded-full hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white border-l border-slate-700 rounded-l-none ml-1">
                <i className="fas fa-minus text-xs"></i>
              </button>
            </div>
            
            {/* Drag Handle Indicator */}
            <div className="pr-3 pl-1 text-slate-600 cursor-move">
               <i className="fas fa-grip-vertical"></i>
            </div>
          </div>
        )}
      </div>
    </Draggable>
  );
};