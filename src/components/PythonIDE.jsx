import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Play, RotateCcw, Save, CheckCircle, Terminal, HelpCircle, Loader2 } from 'lucide-react';

const PythonIDE = ({ initialCode = '', onSave, onSubmit, height = '500px' }) => {
  const [code, setCode] = useState(initialCode || 'print("Hello Python!")');
  const [output, setOutput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [pyodide, setPyodide] = useState(null);
  const [pyodideStatus, setPyodideStatus] = useState('Initializing compiler...');
  const [pyodideLoading, setPyodideLoading] = useState(true);
  const [pyodideError, setPyodideError] = useState(null);
  
  // Monaco Load State & Timeout Guard
  const [monacoLoaded, setMonacoLoaded] = useState(false);
  const [useFallbackEditor, setUseFallbackEditor] = useState(false);

  const consoleEndRef = useRef(null);
  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);

  // 1. Monaco Editor Load Timeout (4 seconds fallback)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!monacoLoaded) {
        console.warn("Monaco Editor CDN load timed out. Swapping to highly responsive native fallback editor.");
        setUseFallbackEditor(true);
      }
    }, 4000);

    return () => clearTimeout(timer);
  }, [monacoLoaded]);

  // 2. Pyodide Multi-CDN Resilient Bootstrapper
  useEffect(() => {
    const cdns = [
      {
        js: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js',
        index: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/'
      },
      {
        js: 'https://unpkg.com/pyodide@0.25.0/pyodide.js',
        index: 'https://unpkg.com/pyodide@0.25.0/'
      },
      {
        js: 'https://cdnjs.cloudflare.com/ajax/libs/pyodide/0.25.0/pyodide.js',
        index: 'https://cdnjs.cloudflare.com/ajax/libs/pyodide/0.25.0/'
      }
    ];

    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        // Check if script is already in the document
        const existingScript = document.querySelector(`script[src="${src}"]`);
        if (existingScript) {
          if (window.loadPyodide) {
            resolve();
            return;
          }
          existingScript.onload = resolve;
          existingScript.onerror = reject;
          return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });
    };

    const tryLoadPyodide = async (index = 0) => {
      if (index >= cdns.length) {
        setPyodideError('Failed to download the compiler from all standard mirrors. Please check your internet connection or ask your computer lab teacher.');
        setPyodideLoading(false);
        return;
      }

      const activeCdn = cdns[index];
      setPyodideStatus(`Loading python core (Mirror ${index + 1}/${cdns.length})...`);

      try {
        await loadScript(activeCdn.js);
        
        if (!window.loadPyodide) {
          throw new Error("loadPyodide function undefined after script load");
        }

        setPyodideStatus("Parsing WebAssembly modules...");
        const py = await window.loadPyodide({
          indexURL: activeCdn.index,
        });

        // Setup custom standard outputs
        py.setStdout({
          batched: (msg) => {
            setOutput(prev => prev + msg + '\n');
          }
        });

        py.setStderr({
          batched: (msg) => {
            setOutput(prev => prev + '<span style="color: #f87171">' + msg + '</span>\n');
          }
        });

        setPyodide(py);
        setPyodideLoading(false);
        setPyodideStatus('Ready');
      } catch (err) {
        console.warn(`Pyodide load failed on Mirror ${index + 1}:`, err);
        // Try the next mirror
        tryLoadPyodide(index + 1);
      }
    };

    tryLoadPyodide(0);
  }, []);

  // 3. Keep scroll offset of output synced
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [output]);

  // Sync scroll for the fallback text editor
  const handleScroll = (e) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.target.scrollTop;
    }
  };

  const handleRun = async () => {
    if (!pyodide) return;

    setIsExecuting(true);
    setOutput(''); // Clear output console

    try {
      // Mock CPython's synchronous input to use standard browser window prompts
      const runCode = `
import builtins
import js

async def _custom_input(prompt_text=""):
    result = js.prompt(prompt_text)
    if result is None:
        return ""
    return result

builtins.input = _custom_input

# Run the student code
${code}
`;
      await pyodide.runPythonAsync(runCode);
    } catch (err) {
      let errorMsg = err.toString();
      if (errorMsg.includes('SyntaxError')) {
        errorMsg = "💡 Tip: Check for missing quotes (\"\"), brackets (), or indents!\n\n" + errorMsg;
      }
      setOutput(prev => prev + '<span style="color: #f87171; font-weight: bold;">' + errorMsg + '</span>\n');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleReset = () => {
    setCode(initialCode || 'print("Hello Python!")');
    setOutput('');
  };

  // Generate line numbers array for fallback editor
  const lineCount = code.split('\n').length;
  const lineNumbers = Array.from({ length: Math.max(1, lineCount) }, (_, i) => i + 1);

  return (
    <div className="flex flex-col rounded-lg overflow-hidden border border-slate-700 bg-slate-900 shadow-xl" style={{ minHeight: '520px' }}>
      
      {/* IDE Header Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700 select-none">
        <div className="flex items-center gap-2">
          <Terminal size={20} className="text-sky-400" />
          <span className="font-bold text-slate-200 text-sm tracking-wide">Python Workspace</span>
          {pyodideLoading ? (
            <div className="flex items-center gap-1.5 ml-3 bg-slate-700/60 px-2.5 py-0.5 rounded-full border border-yellow-500/30">
              <Loader2 className="h-3 w-3 text-yellow-400 animate-spin" />
              <span className="text-[10px] text-yellow-400 font-semibold">{pyodideStatus}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 ml-3 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[10px] text-emerald-400 font-bold tracking-wider uppercase">Active Engine</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md text-slate-300 hover:bg-slate-700 hover:text-white transition-all border border-transparent hover:border-slate-600"
          >
            <RotateCcw size={14} /> Reset
          </button>
          
          {onSave && (
            <button 
              onClick={() => onSave(code)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md text-slate-300 hover:bg-slate-700 hover:text-white transition-all border border-transparent hover:border-slate-600"
            >
              <Save size={14} /> Save Draft
            </button>
          )}

          <button 
            onClick={handleRun}
            disabled={pyodideLoading || isExecuting}
            className="flex items-center gap-1.5 px-4.5 py-1.5 text-xs font-bold rounded-md bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 transition-all shadow-md shadow-emerald-900/20 active:scale-95 disabled:active:scale-100"
          >
            <Play size={14} fill="currentColor" /> {isExecuting ? 'Running...' : 'Run Code'}
          </button>
          
          {onSubmit && (
            <button 
              onClick={() => onSubmit(code, output)}
              className="flex items-center gap-1 px-4 py-1.5 text-xs font-bold rounded-md bg-sky-600 text-white hover:bg-sky-500 transition-all shadow-md shadow-sky-900/20 ml-1 active:scale-95"
            >
              <CheckCircle size={14} /> Submit
            </button>
          )}
        </div>
      </div>

      {/* Editor & Console Split Body */}
      <div className="flex flex-col md:flex-row relative flex-1" style={{ height }}>
        
        {/* Monaco Editor / Fallback Textarea Editor */}
        <div className="w-full md:w-3/5 border-b md:border-b-0 md:border-r border-slate-700 bg-slate-950 flex flex-col relative min-h-[300px]">
          
          {/* Fallback notification */}
          {useFallbackEditor && (
            <div className="absolute top-2 right-2 z-20 flex items-center gap-1 text-[10px] bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded text-yellow-400 font-semibold select-none">
              <HelpCircle size={10} /> Local Fallback Active
            </div>
          )}

          {!useFallbackEditor ? (
            <Editor
              height="100%"
              defaultLanguage="python"
              theme="vs-dark"
              value={code}
              onChange={(val) => setCode(val || '')}
              onMount={() => setMonacoLoaded(true)}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                roundedSelection: false,
                scrollBeyondLastLine: false,
                readOnly: false,
                automaticLayout: true,
                padding: { top: 12 },
                scrollbar: {
                  vertical: 'visible',
                  horizontal: 'visible',
                  useShadows: false,
                  verticalScrollbarSize: 10,
                  horizontalScrollbarSize: 10
                }
              }}
            />
          ) : (
            /* Styled Fallback Text Editor (Zero CDN dependencies!) */
            <div className="flex-1 flex font-mono text-sm bg-[#1e1e1e] text-slate-100 overflow-hidden relative p-0 border-t border-slate-800">
              <div 
                ref={lineNumbersRef}
                className="w-12 bg-[#1e1e1e] text-slate-600 text-right pr-3 select-none border-r border-slate-800 pt-3 overflow-hidden text-xs leading-[21px]"
              >
                {lineNumbers.map(n => (
                  <div key={n}>{n}</div>
                ))}
              </div>
              <textarea
                ref={textareaRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onScroll={handleScroll}
                className="flex-1 bg-transparent text-slate-100 p-3 outline-none resize-none font-mono text-sm leading-[21px] overflow-y-auto"
                style={{
                  tabSize: 4,
                  whiteSpace: 'pre',
                  wordWrap: 'normal'
                }}
                placeholder="# Write your python code here..."
              />
            </div>
          )}
        </div>

        {/* Console Panel */}
        <div className="w-full md:w-2/5 bg-[#0b0f19] flex flex-col min-h-[180px]">
          <div className="px-4 py-2 bg-slate-800/40 text-[10px] text-slate-400 font-mono tracking-wider border-b border-slate-800/80 font-bold flex items-center justify-between">
            <span>OUTPUT CONSOLE</span>
            {isExecuting && (
              <span className="text-emerald-400 text-[9px] animate-pulse">● Execution Active</span>
            )}
          </div>
          <div className="p-4 flex-1 overflow-y-auto font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap selection:bg-slate-700">
            {pyodideError ? (
              <div className="text-red-400 p-2 border border-red-500/20 bg-red-500/5 rounded">
                ⚠️ {pyodideError}
              </div>
            ) : output ? (
              <div dangerouslySetInnerHTML={{ __html: output }} />
            ) : (
              <span className="text-slate-600 italic">Code output will appear here after clicking "Run Code"...</span>
            )}
            <div ref={consoleEndRef} />
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default PythonIDE;
