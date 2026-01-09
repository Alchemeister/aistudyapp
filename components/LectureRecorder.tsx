
import React, { useState, useEffect, useRef, type FC } from 'react';
import { Mic, Square, RotateCcw } from 'lucide-react';
import { Lecture } from '../types';

interface Props {
  onSave: (lecture: Partial<Lecture>, blob?: Blob) => void;
  onCancel: () => void;
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const uuid = () => Math.random().toString(36).substring(2, 9);

// Fix for TypeScript not knowing about webkitSpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export const LectureRecorder: FC<Props> = ({ onSave, onCancel, onToast }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [permissionError, setPermissionError] = useState(false);
  
  // Audio Logic Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Visualizer Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number>(0);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript + '. ';
          }
        }
        if (final) {
          setTranscript(prev => prev + final);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
             console.warn('Speech recognition error', event.error);
        }
      };
      
      // Keep alive logic
      recognition.onend = () => {
         // Don't auto-restart if we explicitly stopped or if we are done
         if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            try { recognition.start(); } catch(e) {}
         }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      stopRecordingCleanup();
    };
  }, []);

  const startVisualizer = (stream: MediaStream) => {
    if (!canvasRef.current) return;
    
    // Safety check for AudioContext limit
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;

      const audioCtx = new AudioCtxClass();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      
      source.connect(analyser);
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      sourceRef.current = source;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const draw = () => {
        if (!analyserRef.current) return;
        
        animationFrameRef.current = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        // Clear canvas
        ctx.fillStyle = '#f8fafc'; // Matches bg-slate-50
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          barHeight = dataArray[i] / 2;
          
          // Dynamic Blue Color
          ctx.fillStyle = `rgb(${59}, 130, ${246})`; // Tailwind Blue-500
          ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

          x += barWidth + 1;
        }
      };

      draw();
    } catch (e) {
      console.error("Visualizer error", e);
    }
  };

  const stopVisualizer = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (sourceRef.current) sourceRef.current.disconnect();
    if (analyserRef.current) analyserRef.current.disconnect();
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(e => console.error(e));
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Start Media Recorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        stopVisualizer();
      };

      mediaRecorder.start();

      // Start Visualizer
      startVisualizer(stream);

      // Start Transcription
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          // Already started or busy
        }
      }

      setIsRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(prev => prev + 1), 1000);
      setPermissionError(false);
      
    } catch (err) {
      console.error("Mic Access Error:", err);
      setPermissionError(true);
      onToast("Microphone access denied. Please allow permission.", "error");
    }
  };

  const stopRecordingCleanup = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
  };

  const handleStop = () => {
    stopRecordingCleanup();
  };

  const handleSave = () => {
    const lecture: Partial<Lecture> = {
      id: uuid(),
      title: `Recording ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`,
      date: new Date().toISOString(),
      transcript: transcript || "(No transcript generated)",
      sourceType: 'recording'
    };
    onSave(lecture, audioBlob || undefined);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
            <div>
                <h3 className="text-lg font-bold">Record Lecture</h3>
                <p className="text-xs text-slate-400 opacity-80">Capture audio & real-time transcription.</p>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 ${isRecording ? 'bg-red-500/20 text-red-400 animate-pulse border border-red-500/50' : 'bg-slate-800 text-slate-400'}`}>
                <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500' : 'bg-slate-500'}`}></div>
                {isRecording ? 'REC' : 'READY'}
            </div>
        </div>

        {/* Visualizer / Timer */}
        <div className="bg-slate-50 border-b border-slate-200 p-8 flex flex-col items-center justify-center relative overflow-hidden h-48">
            <div className={`text-5xl font-mono font-bold tracking-widest mb-4 z-10 ${isRecording ? 'text-slate-800' : 'text-slate-300'}`}>
                {formatTime(duration)}
            </div>
            
            {/* Real Canvas Visualizer */}
            <canvas 
                ref={canvasRef} 
                width={400} 
                height={100}
                className="absolute bottom-0 left-0 w-full h-full opacity-50 pointer-events-none"
            />
            
            {!isRecording && audioBlob && (
                <div className="mt-2 w-full max-w-xs z-10">
                    <audio controls src={URL.createObjectURL(audioBlob)} className="w-full h-10 shadow-sm rounded-full" />
                </div>
            )}
        </div>

        {/* Transcript */}
        <div className="flex-1 p-4 overflow-y-auto bg-white min-h-[200px] flex flex-col">
            <div className="flex justify-between items-center mb-2">
               <label className="text-xs font-bold text-slate-400 uppercase">Live Transcript</label>
               {isRecording && <span className="text-[10px] text-green-600 font-bold animate-pulse">● Listening</span>}
            </div>
            <textarea 
                className="w-full flex-1 p-3 border border-slate-200 rounded-lg text-sm leading-relaxed focus:ring-2 focus:ring-primary outline-none resize-none bg-slate-50 text-slate-700"
                placeholder={isRecording ? "Speech will appear here..." : "Transcript is empty. Start recording to generate text."}
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
            />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            {permissionError ? (
                <p className="text-xs text-red-500 font-bold">Mic access denied.</p>
            ) : (
                 <div className="flex gap-2">
                     {!isRecording && !audioBlob && (
                         <button onClick={startRecording} className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95" title="Start Recording">
                             <Mic className="w-6 h-6" />
                         </button>
                     )}
                     {isRecording && (
                         <button onClick={handleStop} className="w-12 h-12 rounded-full bg-slate-800 hover:bg-slate-900 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95" title="Stop Recording">
                             <Square className="w-6 h-6" />
                         </button>
                     )}
                     {!isRecording && audioBlob && (
                         <button onClick={() => { setAudioBlob(null); setTranscript(''); startRecording(); }} className="w-12 h-12 rounded-full bg-white border border-slate-300 text-slate-500 hover:text-red-500 flex items-center justify-center shadow-sm hover:shadow-md transition-all" title="Re-record">
                             <RotateCcw className="w-5 h-5" />
                         </button>
                     )}
                 </div>
            )}

            <div className="flex gap-3">
                <button onClick={onCancel} className="px-4 py-2 text-slate-500 font-bold text-sm hover:text-slate-800">Discard</button>
                <button 
                  onClick={handleSave} 
                  disabled={isRecording || (!audioBlob && !transcript)} 
                  className="px-6 py-2 bg-primary text-white font-bold text-sm rounded-lg shadow-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    Save Lecture
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
