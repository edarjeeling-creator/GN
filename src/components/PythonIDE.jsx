import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Play, RotateCcw, Save, CheckCircle, Terminal } from 'lucide-react';

const PythonIDE = ({ initialCode = '', onSave, onSubmit, height = '400px' }) => {
  const [code, setCode] = useState(initialCode || 'print("Hello World")');
  const [output, setOutput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [pyodide, setPyodide] = useState(null);
  const [pyodideLoading, setPyodideLoading] = useState(true);
  const consoleEndRef = useRef(null);

  // Initialize Pyodide
  useEffect(() => {
    const initPyodide = async () => {
      try {
        if (!window.loadPyodide) {
          // Dynamically load the script if it's not present
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
          script.async = true;
          document.body.appendChild(script);
          
          await new Promise((resolve) => {
            script.onload = resolve;
          });
        }
        
        const py = await window.loadPyodide({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/',
        });
        
        // Setup custom stdout/stderr to capture output
        py.setStdout({ batched: (msg) => {
          setOutput(prev => prev + msg + '\n');
        }});
        
        py.setStderr({ batched: (msg) => {
          setOutput(prev => prev + '<span style="color: #ef4444">' + msg + '</span>\n');
        }});
        
        setPyodide(py);
        setPyodideLoading(false);
      } catch (err) {
        console.error("Failed to load Pyodide:", err);
        setOutput("Error: Failed to load Python environment. Please check your internet connection.");
        setPyodideLoading(false);
      }
    };
    
    initPyodide();
  }, []);

  // Auto-scroll output
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [output]);

  const handleRun = async () => {
    if (!pyodide) return;
    
    setIsExecuting(true);
    setOutput(''); // Clear previous output
    
    try {
      // Create an async context to handle input()
      // Note: We use window.prompt for a basic interactive input in the browser.
      const runCode = `
import builtins
import js
async def _custom_input(prompt_text=""):
    result = js.prompt(prompt_text)
    if result is None:
        return ""
    return result
builtins.input = _custom_input

# Now run the actual code
${code}
      `;
      
      await pyodide.runPythonAsync(runCode);
    } catch (err) {
      // Format beginner-friendly error messages if possible
      let errorMsg = err.toString();
      if (errorMsg.includes('SyntaxError')) {
        errorMsg = "Oops! SyntaxError: Check for missing quotes (\"\"), brackets (), or colons (:)!\n\n" + errorMsg;
      }
      setOutput(prev => prev + '<span style="color: #ef4444">' + errorMsg + '</span>\n');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleReset = () => {
    setCode(initialCode || 'print("Hello World")');
    setOutput('');
  };

  return (
    <div className="flex flex-col rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
      
      {/* IDE Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Terminal size={18} className="text-blue-400" />
          <span className="font-semibold text-slate-200">Python Editor</span>
          {pyodideLoading && <span className="text-xs text-yellow-400 ml-2 animate-pulse">Loading engine...</span>}
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <RotateCcw size={16} /> Reset
          </button>
          
          {onSave && (
            <button 
              onClick={() => onSave(code)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <Save size={16} /> Save Draft
            </button>
          )}

          <button 
            onClick={handleRun}
            disabled={pyodideLoading || isExecuting}
            className="flex items-center gap-1 px-4 py-1.5 text-sm font-bold rounded-md bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition-colors"
          >
            <Play size={16} /> {isExecuting ? 'Running...' : 'Run Code'}
          </button>
          
          {onSubmit && (
            <button 
              onClick={() => onSubmit(code, output)}
              className="flex items-center gap-1 px-4 py-1.5 text-sm font-bold rounded-md bg-blue-600 text-white hover:bg-blue-500 transition-colors ml-2"
            >
              <CheckCircle size={16} /> Submit Assignment
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row" style={{ height }}>
        
        {/* Code Editor */}
        <div className="w-full md:w-3/5 border-b md:border-b-0 md:border-r border-slate-700">
          <Editor
            height="100%"
            defaultLanguage="python"
            theme="vs-dark"
            value={code}
            onChange={(value) => setCode(value)}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              roundedSelection: false,
              scrollBeyondLastLine: false,
              readOnly: false,
              automaticLayout: true,
            }}
          />
        </div>

        {/* Output Console */}
        <div className="w-full md:w-2/5 bg-slate-950 flex flex-col">
          <div className="px-3 py-1 bg-slate-800 text-xs text-slate-400 font-mono tracking-wider border-b border-slate-700">
            OUTPUT CONSOLE
          </div>
          <div className="p-4 flex-1 overflow-y-auto text-sm font-mono text-slate-300 whitespace-pre-wrap">
            {output ? (
              <div dangerouslySetInnerHTML={{ __html: output }} />
            ) : (
              <span className="text-slate-600 italic">Code output will appear here...</span>
            )}
            <div ref={consoleEndRef} />
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default PythonIDE;
