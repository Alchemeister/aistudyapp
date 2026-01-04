
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// #region agent log
fetch('http://127.0.0.1:7242/ingest/195104b7-eab3-4c79-8f2a-a9a461713290',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.tsx:4',message:'Entry point React check',data:{reactType:typeof React,reactKeys:React?Object.keys(React).slice(0,20):'null',reactCreateContextType:typeof React.createContext,reactCreateContextIsFunction:typeof React.createContext==='function',reactVersion:React.version||'unknown'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
// #endregion

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
