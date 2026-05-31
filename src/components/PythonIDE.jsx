import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Play, RotateCcw, Save, CheckCircle, Terminal, Maximize2, Minimize2, Sparkles, Loader2 } from 'lucide-react';

const highlightPython = (source) => {
  if (!source) return '';
  
  // Escape HTML characters
  let escaped = source
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
    
  const keywords = [
    'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 
    'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 
    'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 
    'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 
    'try', 'while', 'with', 'yield'
  ];
  
  const builtins = [
    'print', 'input', 'len', 'range', 'str', 'int', 'float', 'list', 
    'dict', 'set', 'tuple', 'bool', 'type', 'open', 'sum', 'min', 'max'
  ];

  const placeholders = [];
  let tokenCounter = 0;
  
  const addPlaceholder = (html) => {
    const token = `___TOKEN_${tokenCounter++}___`;
    placeholders.push({ token, html });
    return token;
  };
  
  // A. Protect Strings
  escaped = escaped.replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, (match) => {
    return addPlaceholder(`<span style="color: #a3e635;">${match}</span>`);
  });
  
  escaped = escaped.replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, (match) => {
    return addPlaceholder(`<span style="color: #a3e635;">${match}</span>`);
  });
  
  // B. Protect Comments
  escaped = escaped.replace(/#[^\n]*/g, (match) => {
    return addPlaceholder(`<span style="color: #64748b; font-style: italic;">${match}</span>`);
  });
  
  // C. Color Def and Class definitions
  escaped = escaped.replace(/\b(def|class)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, p1, p2) => {
    return `${addPlaceholder(`<span style="color: #f43f5e; font-weight: bold;">${p1}</span>`)} ${addPlaceholder(`<span style="color: #38bdf8; font-weight: bold;">${p2}</span>`)}`;
  });
  
  // D. Color Keywords
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'g');
    escaped = escaped.replace(regex, () => {
      return addPlaceholder(`<span style="color: #f43f5e; font-weight: bold;">${keyword}</span>`);
    });
  });
  
  // E. Color Builtins
  builtins.forEach(builtin => {
    const regex = new RegExp(`\\b${builtin}\\b`, 'g');
    escaped = escaped.replace(regex, () => {
      return addPlaceholder(`<span style="color: #38bdf8;">${builtin}</span>`);
    });
  });
  
  // F. Color Numbers
  escaped = escaped.replace(/\b\d+\b/g, (match) => {
    return addPlaceholder(`<span style="color: #fb923c;">${match}</span>`);
  });
  
  // Restore placeholders
  for (let i = placeholders.length - 1; i >= 0; i--) {
    escaped = escaped.replace(placeholders[i].token, placeholders[i].html);
  }
  
  return escaped;
};

const PythonIDE = ({ initialCode = '', onSave, onSubmit, height = '500px' }) => {
  const [code, setCode] = useState(initialCode || 'print("Hello Python!")');
  const [output, setOutput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [pyodide, setPyodide] = useState(null);
  const [pyodideStatus, setPyodideStatus] = useState('Initializing compiler...');
  const [pyodideLoading, setPyodideLoading] = useState(true);
  const [pyodideError, setPyodideError] = useState(null);
  
  // Custom states
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [useMonaco, setUseMonaco] = useState(false); // Default to our highly responsive native editor to prevent loading hangs!
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const consoleEndRef = useRef(null);
  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);
  const highlightRef = useRef(null);

  // 1. Pyodide Multi-CDN Resilient Bootstrapper
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
      setPyodideStatus(`Loading engine (Mirror ${index + 1}/${cdns.length})...`);

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
        tryLoadPyodide(index + 1);
      }
    };

    tryLoadPyodide(0);
  }, []);

  // Sync scroll for the fallback text editor
  const handleScroll = (e) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.target.scrollTop;
    }
    if (highlightRef.current) {
      highlightRef.current.scrollTop = e.target.scrollTop;
      highlightRef.current.scrollLeft = e.target.scrollLeft;
    }
  };

  // Sync scroll for textarea in case of external layout shifts
  useEffect(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, [code]);

  // Keep scroll offset of output synced
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [output]);

  const handleRun = async () => {
    if (!pyodide) return;

    setIsExecuting(true);
    setOutput(''); // Clear output console

    try {
      // Clean synchronous prompt inputs (prevents coroutine errors!)
      const runCode = `
import builtins
import js

def _custom_input(prompt_text=""):
    result = js.prompt(prompt_text)
    if result is None:
        return ""
    return str(result)

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

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const newCode = code.substring(0, start) + '    ' + code.substring(end);
      setCode(newCode);
      setTimeout(() => {
        e.target.selectionStart = e.target.selectionEnd = start + 4;
      }, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const lines = code.substring(0, start).split('\n');
      const currentLine = lines[lines.length - 1];
      
      const match = currentLine.match(/^\s*/);
      let indent = match ? match[0] : '';
      
      if (currentLine.trim().endsWith(':')) {
        indent += '    ';
      }
      
      const newCode = code.substring(0, start) + '\n' + indent + code.substring(start);
      setCode(newCode);
      
      setTimeout(() => {
        e.target.selectionStart = e.target.selectionEnd = start + 1 + indent.length;
      }, 0);
    }
  };

  // Generate line numbers array
  const lineCount = code.split('\n').length;
  const lineNumbers = Array.from({ length: Math.max(1, lineCount) }, (_, i) => i + 1);

  // Outer layout styles depending on full screen mode
  const containerStyle = isFullScreen ? {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    zIndex: 99999,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#0f172a',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  } : {
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid #334155',
    backgroundColor: '#0f172a',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
    minHeight: isMobile ? 'auto' : '500px',
    width: '100%',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  };

  return (
    <div style={containerStyle}>
      
      {/* IDE Header Toolbar */}
      <div 
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1.25rem',
          backgroundColor: '#1e293b',
          borderBottom: '1px solid #334155',
          userSelect: 'none',
          gap: isMobile ? '0.75rem' : '0.5rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Terminal size={20} style={{ color: '#38bdf8' }} />
            <span style={{ fontWeight: 'bold', color: '#e2e8f0', fontSize: '0.875rem', letterSpacing: '0.025em' }}>Python Workspace</span>
          </div>
          
          {pyodideLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginLeft: '0.5rem', backgroundColor: '#334155', padding: '0.25rem 0.625rem', borderRadius: '9999px', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
              <Loader2 className="animate-spin" size={12} style={{ color: '#eab308' }} />
              <span style={{ fontSize: '10px', color: '#eab308', fontWeight: '600' }}>{pyodideStatus}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginLeft: '0.5rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '0.25rem 0.625rem', borderRadius: '9999px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <span style={{ height: '6px', width: '6px', borderRadius: '50%', backgroundColor: '#34d399' }}></span>
              <span style={{ fontSize: '10px', color: '#34d399', fontWeight: 'bold', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Active Engine</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
          {/* Toggle Monaco vs Native Text Editor */}
          <button
            onClick={() => setUseMonaco(!useMonaco)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.375rem 0.75rem',
              fontSize: '11px',
              fontWeight: '600',
              borderRadius: '6px',
              color: useMonaco ? '#38bdf8' : '#94a3b8',
              backgroundColor: useMonaco ? 'rgba(56, 189, 248, 0.1)' : '#1e293b',
              border: useMonaco ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid #334155',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            title="Toggle between standard editor and simple/responsive text editor"
          >
            <Sparkles size={12} /> {useMonaco ? "Standard Mode" : "Simple Mode (Instant)"}
          </button>

          <button 
            onClick={handleReset}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.375rem 0.75rem',
              fontSize: '11px',
              fontWeight: '600',
              borderRadius: '6px',
              color: '#cbd5e1',
              backgroundColor: '#334155',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <RotateCcw size={13} /> Reset
          </button>
          
          {onSave && (
            <button 
              onClick={() => onSave(code)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.375rem 0.75rem',
                fontSize: '11px',
                fontWeight: '600',
                borderRadius: '6px',
                color: '#cbd5e1',
                backgroundColor: '#334155',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <Save size={13} /> Save Draft
            </button>
          )}

          <button 
            onClick={handleRun}
            disabled={pyodideLoading || isExecuting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.375rem 1.125rem',
              fontSize: '11px',
              fontWeight: 'bold',
              borderRadius: '6px',
              backgroundColor: '#059669',
              color: 'white',
              border: 'none',
              cursor: (pyodideLoading || isExecuting) ? 'not-allowed' : 'pointer',
              opacity: (pyodideLoading || isExecuting) ? 0.5 : 1,
              transition: 'all 0.2s',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
          >
            <Play size={13} fill="currentColor" /> {isExecuting ? 'Running...' : 'Run Code'}
          </button>
          
          {onSubmit && (
            <button 
              onClick={() => onSubmit(code, output)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.375rem 1rem',
                fontSize: '11px',
                fontWeight: 'bold',
                borderRadius: '6px',
                backgroundColor: '#0284c7',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginLeft: '0.25rem'
              }}
            >
              <CheckCircle size={13} /> Submit
            </button>
          )}

          {/* Full Screen Mode Toggle Button */}
          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.375rem 0.75rem',
              fontSize: '11px',
              fontWeight: '600',
              borderRadius: '6px',
              color: '#38bdf8',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginLeft: '0.25rem'
            }}
            title={isFullScreen ? "Exit Full Screen Mode" : "Open Full Screen Workspace"}
          >
            {isFullScreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            {isFullScreen ? "Exit Full Screen" : "Full Screen"}
          </button>
        </div>
      </div>

      {/* Editor & Console Split Body */}
      <div 
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          flex: 1,
          height: isFullScreen ? (isMobile ? 'calc(100vh - 120px)' : 'calc(100vh - 50px)') : (isMobile ? 'auto' : height),
          position: 'relative',
          borderTop: '1px solid #1e293b'
        }}
      >
        
        {/* Editor Area */}
        <div 
          style={{
            width: isMobile ? '100%' : '60%',
            height: isMobile ? '320px' : '100%',
            borderRight: isMobile ? 'none' : '1px solid #334155',
            borderBottom: isMobile ? '1px solid #334155' : 'none',
            backgroundColor: '#1e1e1e',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative'
          }}
        >
          {useMonaco ? (
            <Editor
              height="100%"
              defaultLanguage="python"
              theme="vs-dark"
              value={code}
              onChange={(val) => setCode(val || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                roundedSelection: false,
                scrollBeyondLastLine: false,
                readOnly: false,
                automaticLayout: true,
                padding: { top: 12 }
              }}
            />
          ) : (
            /* Highly Responsive, Styled Fallback Text Editor (Zero CDN dependencies!) */
            <div 
              style={{
                flex: 1,
                display: 'flex',
                fontFamily: 'monospace',
                fontSize: '14px',
                backgroundColor: '#1e1e1e',
                color: '#f8fafc',
                overflow: 'hidden',
                position: 'relative',
                margin: 0
              }}
            >
              <div 
                ref={lineNumbersRef}
                style={{
                  width: '44px',
                  backgroundColor: '#181818',
                  color: '#64748b',
                  textAlign: 'right',
                  paddingRight: '12px',
                  userSelect: 'none',
                  borderRight: '1px solid #2d3748',
                  paddingTop: '12px',
                  overflow: 'hidden',
                  fontSize: '12px',
                  lineHeight: '22px'
                }}
              >
                {lineNumbers.map(n => (
                  <div key={n} style={{ height: '22px' }}>{n}</div>
                ))}
              </div>
              
              <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                {/* The highlighted code pre block behind */}
                <pre
                  ref={highlightRef}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    margin: 0,
                    padding: '12px 16px',
                    backgroundColor: '#1e1e1e',
                    color: '#f8fafc',
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    lineHeight: '22px',
                    whiteSpace: 'pre',
                    overflow: 'hidden',
                    pointerEvents: 'none',
                    border: 'none',
                    boxSizing: 'border-box'
                  }}
                  dangerouslySetInnerHTML={{ __html: highlightPython(code) + '\n\n' }}
                />
                
                {/* The transparent interactive textarea on top */}
                <textarea
                  ref={textareaRef}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onScroll={handleScroll}
                  onKeyDown={handleKeyDown}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'transparent',
                    color: 'transparent', // Make text transparent so the colored code behind shows through!
                    caretColor: '#38bdf8', // Keep the blinking cursor visible and styled!
                    padding: '12px 16px',
                    outline: 'none',
                    resize: 'none',
                    border: 'none',
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    lineHeight: '22px',
                    overflow: 'auto',
                    whiteSpace: 'pre',
                    boxSizing: 'border-box'
                  }}
                  placeholder="# Write your python code here... (Type or Paste instantly!)"
                />
              </div>
            </div>
          )}
        </div>

        {/* Console Panel */}
        <div 
          style={{
            width: isMobile ? '100%' : '40%',
            backgroundColor: '#090d16',
            display: 'flex',
            flexDirection: 'column',
            height: isMobile ? '250px' : '100%'
          }}
        >
          <div 
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'rgba(30, 41, 59, 0.4)',
              fontSize: '10px',
              color: '#94a3b8',
              fontFamily: 'monospace',
              letterSpacing: '0.05em',
              borderBottom: '1px solid rgba(51, 65, 85, 0.8)',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span>OUTPUT CONSOLE</span>
            {isExecuting && (
              <span style={{ color: '#34d399', fontSize: '9px' }}>● Execution Active</span>
            )}
          </div>
          <div 
            style={{
              padding: '1rem',
              flex: 1,
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '12px',
              color: '#cbd5e1',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap'
            }}
          >
            {pyodideError ? (
              <div style={{ color: '#f87171', padding: '0.5rem', border: '1px solid rgba(248, 113, 113, 0.2)', backgroundColor: 'rgba(248, 113, 113, 0.05)', borderRadius: '4px' }}>
                ⚠️ {pyodideError}
              </div>
            ) : output ? (
              <div dangerouslySetInnerHTML={{ __html: output }} />
            ) : (
              <span style={{ color: '#475569', fontStyle: 'italic' }}>Code output will appear here after clicking "Run Code"...</span>
            )}
            <div ref={consoleEndRef} />
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default PythonIDE;
