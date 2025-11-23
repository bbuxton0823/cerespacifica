import React, { useState, useEffect, useRef } from 'react';

interface LogEntry {
    timestamp: string;
    type: 'log' | 'error' | 'warn';
    message: string;
    details?: any;
}

export const DebugLog: React.FC = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Save original console methods
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;

        const addLog = (type: 'log' | 'error' | 'warn', args: any[]) => {
            const message = args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');

            setLogs(prev => [...prev, {
                timestamp: new Date().toLocaleTimeString(),
                type,
                message
            }]);
        };

        // Override console methods
        console.log = (...args) => {
            originalLog(...args);
            addLog('log', args);
        };

        console.error = (...args) => {
            originalError(...args);
            addLog('error', args);
        };

        console.warn = (...args) => {
            originalWarn(...args);
            addLog('warn', args);
        };

        // Capture unhandled errors
        const handleError = (event: ErrorEvent) => {
            addLog('error', [event.message]);
        };

        // Capture unhandled promise rejections
        const handleRejection = (event: PromiseRejectionEvent) => {
            addLog('error', ['Unhandled Promise Rejection:', event.reason]);
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleRejection);

        return () => {
            // Restore original methods
            console.log = originalLog;
            console.error = originalError;
            console.warn = originalWarn;
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleRejection);
        };
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        if (isOpen && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, isOpen]);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-full shadow-lg z-50 hover:bg-gray-700 text-sm font-mono"
            >
                🐞 Debug Logs ({logs.filter(l => l.type === 'error').length} Errors)
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 w-[600px] h-[400px] bg-gray-900 text-white rounded-lg shadow-2xl z-50 flex flex-col border border-gray-700 font-mono text-xs">
            <div className="flex justify-between items-center p-2 border-b border-gray-700 bg-gray-800 rounded-t-lg">
                <span className="font-bold">Debug Console</span>
                <div className="flex gap-2">
                    <button
                        onClick={() => setLogs([])}
                        className="px-2 py-1 hover:bg-gray-700 rounded text-gray-300"
                    >
                        Clear
                    </button>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="px-2 py-1 hover:bg-gray-700 rounded text-gray-300"
                    >
                        Close
                    </button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {logs.length === 0 && (
                    <div className="text-gray-500 italic p-2">No logs yet...</div>
                )}
                {logs.map((log, index) => (
                    <div key={index} className={`p-1 rounded ${log.type === 'error' ? 'bg-red-900/30 text-red-200' :
                            log.type === 'warn' ? 'bg-yellow-900/30 text-yellow-200' :
                                'text-gray-300'
                        }`}>
                        <span className="text-gray-500 mr-2">[{log.timestamp}]</span>
                        <span className={`font-bold mr-2 uppercase text-[10px] ${log.type === 'error' ? 'text-red-400' :
                                log.type === 'warn' ? 'text-yellow-400' :
                                    'text-blue-400'
                            }`}>{log.type}</span>
                        <span className="whitespace-pre-wrap break-words">{log.message}</span>
                    </div>
                ))}
                <div ref={logsEndRef} />
            </div>
        </div>
    );
};
