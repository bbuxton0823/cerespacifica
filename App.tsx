
import React, { useState, useEffect, useRef } from 'react';
import { INITIAL_SECTIONS, ROOM_TEMPLATES } from './constants';
import { InspectionStatus, RoomSection, UnitDetails, InspectionItem, RoomLocation } from './types';
import { processVoiceCommand } from './services/geminiService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- TYPES FOR SPEECH API ---
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

// --- CONSTANTS ---
const INITIAL_DETAILS: UnitDetails = {
  phaName: '',
  inspectionType: 'Initial',
  tenantName: '',
  tenantId: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  unitType: 'S/F Detached',
  yearBuilt: 1980,
  bedrooms: 1,
  bathrooms: 1,
  inspectionDate: new Date().toISOString().split('T')[0],
  inspectorName: ''
};

// --- ICONS ---
const MicIcon = () => <i className="fas fa-microphone"></i>;
const MicActiveIcon = () => <i className="fas fa-microphone-lines text-red-500 animate-pulse"></i>;
const CheckIcon = () => <i className="fas fa-check-circle"></i>;
const FailIcon = () => <i className="fas fa-times-circle text-red-600"></i>;
const InfoIcon = () => <i className="fas fa-info-circle text-blue-500"></i>;
const PrintIcon = () => <i className="fas fa-print"></i>;
const FilePdfIcon = () => <i className="fas fa-file-pdf"></i>;
const WandIcon = () => <i className="fas fa-wand-magic-sparkles text-yellow-400"></i>;
const WandSpinIcon = () => <i className="fas fa-wand-magic-sparkles text-yellow-400 animate-spin"></i>;
const ClockIcon = () => <i className="fas fa-clock"></i>;
const CameraIcon = () => <i className="fas fa-camera"></i>;
const TrashIcon = () => <i className="fas fa-trash"></i>;
const PlusIcon = () => <i className="fas fa-plus-circle"></i>;
const EraserIcon = () => <i className="fas fa-eraser"></i>;
const RestartIcon = () => <i className="fas fa-redo"></i>;
const HelpIcon = () => <i className="fas fa-question-circle"></i>;
const ArrowRightIcon = () => <i className="fas fa-arrow-right"></i>;
const ArrowLeftIcon = () => <i className="fas fa-arrow-left"></i>;

// --- COMPONENTS ---

const Tooltip = ({ text }: { text: string }) => (
  <div className="group relative inline-block ml-2">
    <InfoIcon />
    <div className="invisible group-hover:visible absolute z-50 w-64 p-2 mt-1 text-sm text-white bg-gray-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity -left-20 md:left-0 pointer-events-none">
      {text}
    </div>
  </div>
);

const ConfirmationModal = ({ 
  isOpen, 
  onConfirm, 
  onCancel, 
  title, 
  message 
}: { 
  isOpen: boolean; 
  onConfirm: () => void; 
  onCancel: () => void; 
  title: string; 
  message: string; 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 animate-fade-in">
        <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-slate-600 mb-6">{message}</p>
        <div className="flex justify-end space-x-3">
          <button 
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 font-medium"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium"
          >
            Confirm Reset
          </button>
        </div>
      </div>
    </div>
  );
};

// --- TUTORIAL OVERLAY COMPONENT ---
const TutorialOverlay = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [slide, setSlide] = useState(0);

  if (!isOpen) return null;

  const nextSlide = () => setSlide(prev => Math.min(prev + 1, 3));
  const prevSlide = () => setSlide(prev => Math.max(prev - 1, 0));

  // SVG Arrow Helper
  const ArrowAnnotation = ({ className, text }: { className: string, text: string }) => (
    <div className={`absolute flex flex-col items-center ${className} z-20`}>
      <div className="bg-yellow-300 text-slate-900 text-xs font-bold px-2 py-1 rounded shadow-lg mb-1 whitespace-nowrap border border-yellow-400">
        {text}
      </div>
      <svg width="40" height="40" viewBox="0 0 40 40" className="fill-yellow-400 drop-shadow-md filter">
        <path d="M20 0 L20 30 M10 20 L20 35 L30 20" stroke="currentColor" strokeWidth="4" fill="none" />
      </svg>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-green-600 p-4 text-white flex justify-between items-center">
          <h2 className="text-xl font-bold"><i className="fas fa-book-open mr-2"></i> Quick Start Guide ({slide + 1}/4)</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white"><i className="fas fa-times text-2xl"></i></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 relative">
          
          {/* SLIDE 1: SETUP & VOICE */}
          {slide === 0 && (
            <div className="space-y-8 text-center">
              <h3 className="text-2xl font-bold text-slate-800">1. Voice & Setup</h3>
              <p className="text-slate-600 max-w-xl mx-auto">Select your <strong>Inspection Type</strong>, fill details with your voice, and let AI handle the formatting.</p>
              
              <div className="relative max-w-md mx-auto bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg mt-8">
                 {/* Mock Setup Input */}
                 <label className="block text-left text-xs text-slate-400 mb-1">Tenant Name</label>
                 <div className="flex gap-2">
                    <div className="flex-1 bg-slate-900 border border-slate-600 rounded-lg p-3 text-slate-300 text-sm text-left">Jane Doe...</div>
                    <button className="p-3 bg-red-500/20 border border-red-500 rounded-lg text-white">
                       <MicActiveIcon />
                    </button>
                 </div>
                 
                 {/* Annotation */}
                 <div className="absolute -right-24 top-8 hidden md:flex flex-row items-center">
                    <svg width="60" height="20" className="rotate-180 mr-2 text-yellow-500"><path d="M0 10 L50 10 M40 0 L50 10 L40 20" stroke="currentColor" strokeWidth="3" fill="none"/></svg>
                    <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm font-bold border border-yellow-300">Tap to Speak</span>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto mt-8">
                <div className="bg-white p-3 rounded-lg shadow text-center border">
                  <div className="text-orange-500 text-2xl mb-1"><i className="fas fa-clipboard-check"></i></div>
                  <div className="text-xs font-bold text-slate-700">Inspection Type</div>
                  <div className="text-[10px] text-slate-500">Initial, Annual, Special...</div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow text-center border">
                  <div className="text-green-600 text-2xl mb-1"><i className="fas fa-map-marker-alt"></i></div>
                  <div className="text-xs font-bold text-slate-700">Zip Code</div>
                  <div className="text-[10px] text-slate-500">Auto-fills City/State</div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow text-center border">
                  <div className="text-blue-600 text-2xl mb-1"><i className="fas fa-calendar-alt"></i></div>
                  <div className="text-xs font-bold text-slate-700">Year Built</div>
                  <div className="text-[10px] text-slate-500">Alerts for Lead Paint</div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow text-center border">
                  <div className="text-purple-600 text-2xl mb-1"><i className="fas fa-building"></i></div>
                  <div className="text-xs font-bold text-slate-700">Rooms</div>
                  <div className="text-[10px] text-slate-500">Generates checklist</div>
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 2: INSPECTION ROW */}
          {slide === 1 && (
            <div className="space-y-6 text-center">
              <h3 className="text-2xl font-bold text-slate-800">2. The Inspection Checklist</h3>
              <p className="text-slate-600">Each item has controls for passing, failing, and adding evidence.</p>

              {/* MOCK UI ROW */}
              <div className="relative max-w-2xl mx-auto bg-white border border-slate-300 rounded-xl p-4 shadow-lg text-left mt-6">
                 <div className="flex justify-between items-start mb-2">
                    <span className="font-medium text-slate-700">1.5 Window Condition</span>
                    <div className="flex space-x-1">
                      <button className="px-2 py-1 text-xs font-bold rounded bg-slate-100 text-slate-400 border">24H</button>
                      <button className="p-2 rounded-lg text-slate-300 bg-slate-50"><CheckIcon /></button>
                      <button className="p-2 rounded-lg bg-red-100 text-red-600"><FailIcon /></button>
                    </div>
                 </div>
                 {/* Annotations */}
                 <ArrowAnnotation className="-top-8 right-40" text="Toggle 24-Hour Emergency" />
                 <ArrowAnnotation className="-top-8 right-4" text="Pass / Fail" />

                 <div className="relative mt-2">
                    <div className="w-full p-2 bg-slate-900 rounded text-white text-sm min-h-[60px]">
                       Broken glass pane...
                    </div>
                    <div className="absolute bottom-2 right-2 flex space-x-2">
                       <button className="p-1.5 bg-slate-700 rounded text-white"><CameraIcon /></button>
                       <button className="p-1.5 bg-slate-700 rounded text-yellow-400"><WandIcon /></button>
                       <button className="p-1.5 bg-red-500 rounded text-white"><MicIcon /></button>
                    </div>
                    
                    {/* Annotations */}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 flex gap-4">
                       <div className="flex flex-col items-center">
                          <svg width="20" height="20" viewBox="0 0 20 20" className="text-slate-400 mb-1"><path d="M10 20 L10 0 L5 5 M10 0 L15 5" stroke="currentColor" fill="none"/></svg>
                          <span className="text-xs font-bold bg-slate-200 px-2 rounded">Evidence</span>
                       </div>
                       <div className="flex flex-col items-center">
                          <svg width="20" height="20" viewBox="0 0 20 20" className="text-slate-400 mb-1"><path d="M10 20 L10 0 L5 5 M10 0 L15 5" stroke="currentColor" fill="none"/></svg>
                          <span className="text-xs font-bold bg-yellow-100 px-2 rounded">AI Fix</span>
                       </div>
                    </div>
                 </div>
              </div>
              <div className="text-sm text-slate-500 bg-blue-50 p-3 rounded-lg inline-block border border-blue-100">
                 <i className="fas fa-lightbulb text-blue-500 mr-2"></i>
                 <strong>Tip:</strong> Click the "Magic Wand" <WandIcon /> to have AI rewrite your rough notes into professional HQS language!
              </div>
            </div>
          )}

          {/* SLIDE 3: NAVIGATION */}
          {slide === 2 && (
            <div className="space-y-8 text-center">
              <h3 className="text-2xl font-bold text-slate-800">3. Navigation & Location</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto items-center">
                 <div className="bg-white p-4 rounded-xl shadow border border-slate-200 relative">
                    <div className="text-left font-bold text-slate-600 mb-2 text-sm">Location Selector (Top of Card)</div>
                    <div className="flex gap-2 text-xs">
                       <div className="border rounded px-2 py-1 bg-blue-600 text-white">L</div>
                       <div className="border rounded px-2 py-1">C</div>
                       <div className="border rounded px-2 py-1">R</div>
                       <span className="mx-1">/</span>
                       <div className="border rounded px-2 py-1">F</div>
                       <div className="border rounded px-2 py-1">C</div>
                       <input className="w-10 bg-slate-900 text-white text-center rounded" value="2" readOnly />
                    </div>
                    <div className="mt-4 text-sm text-slate-600">
                       Identify room position: <strong>Left/Right</strong> and <strong>Front/Rear</strong>.
                    </div>
                 </div>

                 <div className="bg-white p-4 rounded-xl shadow border border-slate-200">
                    <button className="w-full py-2 bg-slate-200 text-slate-700 font-bold rounded mb-2 flex items-center justify-center gap-2">
                       <PlusIcon /> Add Bedroom
                    </button>
                    <div className="text-sm text-slate-600">
                       Found an extra room? Tap "Add Bedroom" or "Add Bathroom" at the top of the list.
                    </div>
                 </div>
              </div>

              <div className="max-w-md mx-auto bg-slate-50 border border-slate-200 p-4 rounded-lg mt-6">
                 <div className="flex justify-end">
                    <button className="text-green-600 font-bold text-sm flex items-center gap-1 px-3 py-2 rounded bg-green-50 border border-green-200">
                       <CheckIcon /> Pass Remaining Items
                    </button>
                 </div>
                 <p className="text-xs text-slate-500 mt-2">
                    Use this button at the bottom of a card to <strong>Pass</strong> all items you haven't marked as Fail. It won't overwrite your Fails!
                 </p>
              </div>
            </div>
          )}

          {/* SLIDE 4: REPORTS */}
          {slide === 3 && (
             <div className="space-y-8 text-center">
               <h3 className="text-2xl font-bold text-slate-800">4. Finishing Up</h3>
               <div className="flex flex-col gap-4 max-w-sm mx-auto">
                  <div className="bg-white p-4 rounded-xl shadow flex items-center gap-4 border-l-4 border-blue-600">
                     <div className="bg-blue-100 p-3 rounded-full text-blue-600"><i className="fas fa-file-contract"></i></div>
                     <div className="text-left">
                        <div className="font-bold">Official HUD 52580</div>
                        <div className="text-xs text-slate-500">Generates the exact government form.</div>
                     </div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-xl shadow flex items-center gap-4 border-l-4 border-green-600">
                     <div className="bg-green-100 p-3 rounded-full text-green-600"><i className="fas fa-file-pdf"></i></div>
                     <div className="text-left">
                        <div className="font-bold">Custom Report</div>
                        <div className="text-xs text-slate-500">Includes photos and detailed AI notes.</div>
                     </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl shadow flex items-center gap-4 border-l-4 border-slate-600">
                     <div className="bg-slate-100 p-3 rounded-full text-slate-600"><i className="fas fa-redo"></i></div>
                     <div className="text-left">
                        <div className="font-bold">Start New Inspection</div>
                        <div className="text-xs text-slate-500">Clears all data for the next house.</div>
                     </div>
                  </div>
               </div>
               
               <div className="bg-yellow-50 p-4 rounded-lg max-w-lg mx-auto text-sm text-yellow-800 border border-yellow-200">
                  <i className="fas fa-star mr-2"></i>
                  <strong>Pro Tip:</strong> Don't forget to sign the digital signature pad on the Summary screen before generating reports!
               </div>
             </div>
          )}

        </div>

        {/* Footer Nav */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-between items-center">
           <button 
             onClick={prevSlide} 
             disabled={slide === 0}
             className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 ${slide === 0 ? 'text-slate-300' : 'text-slate-700 hover:bg-slate-200'}`}
           >
             <ArrowLeftIcon /> Previous
           </button>
           
           <div className="flex gap-2">
              {[0,1,2,3].map(i => (
                 <div key={i} className={`w-2 h-2 rounded-full ${i === slide ? 'bg-green-600' : 'bg-slate-300'}`}></div>
              ))}
           </div>

           {slide < 3 ? (
             <button 
               onClick={nextSlide}
               className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center gap-2 shadow"
             >
               Next <ArrowRightIcon />
             </button>
           ) : (
             <button 
               onClick={onClose}
               className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold flex items-center gap-2 shadow animate-pulse"
             >
               Get Started <CheckIcon />
             </button>
           )}
        </div>
      </div>
    </div>
  );
};

const LocationSelector = ({ 
  location, 
  onChange 
}: { 
  location: RoomLocation, 
  onChange: (loc: RoomLocation) => void 
}) => {
  const toggleH = (val: 'L'|'C'|'R') => {
    onChange({ ...location, horizontal: location.horizontal === val ? '' : val });
  };
  const toggleV = (val: 'F'|'C'|'R') => {
    onChange({ ...location, vertical: location.vertical === val ? '' : val });
  };

  return (
    <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex flex-wrap gap-4 items-center text-xs sm:text-sm">
      <div className="flex items-center gap-2">
        <span className="font-bold text-slate-600">Loc:</span>
        <div className="flex rounded-md shadow-sm" role="group">
          {['L', 'C', 'R'].map((l) => (
            <button
              key={l}
              onClick={() => toggleH(l as any)}
              className={`px-3 py-1 border border-slate-300 first:rounded-l-md last:rounded-r-md ${
                location.horizontal === l ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <span className="text-slate-400 mx-1">/</span>
        <div className="flex rounded-md shadow-sm" role="group">
          {['F', 'C', 'R'].map((l) => (
            <button
              key={l}
              onClick={() => toggleV(l as any)}
              className={`px-3 py-1 border border-slate-300 first:rounded-l-md last:rounded-r-md ${
                location.vertical === l ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-bold text-slate-600">Floor:</span>
        <input 
          type="text" 
          className="w-16 p-1 border border-slate-700 rounded text-center bg-slate-900 text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          placeholder="#"
          value={location.floor}
          onChange={(e) => onChange({...location, floor: e.target.value})}
        />
      </div>
    </div>
  );
};

const SignaturePad = ({ onEnd }: { onEnd: (base64: string | null) => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Handle resizing
    const resize = () => {
        const parent = canvas.parentElement;
        if(parent) {
            canvas.width = parent.clientWidth;
            canvas.height = parent.clientHeight;
        }
    };
    window.addEventListener('resize', resize);
    resize();

    return () => window.removeEventListener('resize', resize);
  }, []);

  const getPos = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: any) => {
    e.preventDefault();
    setIsDrawing(true);
    setHasContent(true);
    const { x, y } = getPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#000';
    }
  };

  const draw = (e: any) => {
    e.preventDefault();
    if (!isDrawing) return;
    const { x, y } = getPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const endDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
      onEnd(canvasRef.current.toDataURL());
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasContent(false);
      onEnd(null);
    }
  };

  return (
    <div className="relative w-full h-32 bg-white border border-slate-300 rounded-lg touch-none">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={endDrawing}
        onMouseLeave={endDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={endDrawing}
      />
      {hasContent && (
        <button 
          onClick={clear}
          className="absolute top-2 right-2 p-1 bg-slate-200 hover:bg-slate-300 rounded text-slate-600"
          title="Clear Signature"
        >
          <EraserIcon />
        </button>
      )}
      {!hasContent && (
         <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300">
            Sign Here
         </div>
      )}
    </div>
  );
};

const VoiceInput = ({ 
  label, 
  value, 
  onChange, 
  onVoiceStart, 
  isListening,
  isProcessing,
  onMagicClick,
  onCameraClick,
  photos = []
}: { 
  label?: string, 
  value: string, 
  onChange: (val: string) => void, 
  onVoiceStart: () => void, 
  isListening: boolean,
  isProcessing?: boolean,
  onMagicClick?: () => void,
  onCameraClick?: () => void,
  photos?: string[]
}) => (
  <div className="relative w-full">
    {label && <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>}
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-3 pr-24 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 min-h-[80px]"
        placeholder="Type or dictate notes..."
      />
      <div className="absolute bottom-2 right-2 flex space-x-2">
        {onCameraClick && (
          <button
            onClick={onCameraClick}
            className="p-2 rounded-full bg-slate-700 hover:bg-slate-600 text-white transition-colors"
            title="Add Photo"
          >
            <CameraIcon />
          </button>
        )}
        {onMagicClick && (
          <button
            onClick={onMagicClick}
            className="p-2 rounded-full bg-slate-700 hover:bg-purple-600 text-white transition-colors"
            title="AI Analyze & Format"
          >
            {isProcessing ? <WandSpinIcon /> : <WandIcon />}
          </button>
        )}
        <button
          onClick={onVoiceStart}
          className={`p-2 rounded-full transition-colors ${isListening ? 'bg-red-100' : 'bg-slate-700 hover:bg-slate-600'} text-white`}
          title="Dictate"
        >
          {isListening ? <MicActiveIcon /> : <MicIcon />}
        </button>
      </div>
    </div>
    {photos && photos.length > 0 && (
      <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
        {photos.map((photo, idx) => (
          <div key={idx} className="relative flex-shrink-0">
            <img src={photo} alt="evidence" className="h-16 w-16 object-cover rounded border border-slate-600" />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"></div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// --- MAIN APP ---

export default function App() {
  const [step, setStep] = useState<'setup' | 'inspection' | 'summary'>('setup');
  const [details, setDetails] = useState<UnitDetails>(INITIAL_DETAILS);
  const [sections, setSections] = useState<RoomSection[]>(INITIAL_SECTIONS);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // New state for AI activity
  const [listeningTarget, setListeningTarget] = useState<string | null>(null); // ID of item being listened to
  const [generalNotes, setGeneralNotes] = useState('');
  const [generalPhotos, setGeneralPhotos] = useState<string[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [secondarySignature, setSecondarySignature] = useState<string | null>(null); // Tenant/Owner Sig
  const [signerType, setSignerType] = useState<'Tenant' | 'Owner' | 'Landlord Representative'>('Tenant');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showTutorial, setShowTutorial] = useState(true);
  
  // Camera ref - Defined once at top level
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activePhotoTarget = useRef<{sectionId: string, itemId: string} | 'general' | null>(null);
  const recognitionRef = useRef<any>(null);

  // --- RESET APP ---
  const requestReset = () => {
    setShowResetConfirm(true);
  };

  const confirmReset = () => {
    stopSpeechRecognition();
    // Preserve the current PHA Name for the next inspection
    const currentPha = details.phaName;
    
    // Reset details but re-apply the preserved PHA name
    setDetails({
      ...INITIAL_DETAILS,
      phaName: currentPha
    });

    // We use a deep copy of initial sections to ensure clean state
    setSections(JSON.parse(JSON.stringify(INITIAL_SECTIONS)));
    setGeneralNotes('');
    setGeneralPhotos([]);
    setSignature(null);
    setSecondarySignature(null);
    setSignerType('Tenant');
    setIsListening(false);
    setIsProcessing(false);
    setListeningTarget(null);
    setStep('setup');
    window.scrollTo(0, 0);
    setShowResetConfirm(false);
  };

  // --- SPEECH RECOGNITION HELPER ---
  const startSpeechRecognition = (
    onResult: (transcript: string) => void, 
    onEnd: () => void
  ) => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      onEnd();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
      onEnd();
    };

    recognition.onend = () => {
      setIsListening(false);
      // Don't clear target immediately if processing needs to happen
      // setListeningTarget(null); 
      onEnd();
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  // --- ZIP CODE LOOKUP ---
  const handleZipCodeChange = async (zip: string) => {
    setDetails(prev => ({ ...prev, zipCode: zip }));

    if (zip.length === 5) {
        try {
            const response = await fetch(`https://api.zippopotam.us/us/${zip}`);
            if (response.ok) {
                const data = await response.json();
                if (data.places && data.places.length > 0) {
                    setDetails(prev => ({
                        ...prev,
                        zipCode: zip,
                        city: data.places[0]['place name'],
                        state: data.places[0]['state abbreviation']
                    }));
                }
            }
        } catch (error) {
            console.error("Failed to fetch zip data", error);
        }
    }
  };

  // --- INITIALIZATION LOGIC ---
  const startInspection = () => {
    // Deep copy INITIAL_SECTIONS to ensure no reference retention
    let newSections = JSON.parse(JSON.stringify(INITIAL_SECTIONS));

    // 1. Handle Bedrooms (Logic: Studio = 0 bedrooms)
    const bedroomTemplates = [];
    if (details.bedrooms > 0) {
      for (let i = 1; i <= details.bedrooms; i++) {
        bedroomTemplates.push(ROOM_TEMPLATES.bedroom(i));
      }
    } 
    // If 0 bedrooms (Studio), we DO NOT add any bedroom sections.
    // The Living Room serves as the sleeping area.

    // 2. Handle Bathrooms
    const bathroomTemplates = [];
    // Start from 2 because Bathroom 1 is in INITIAL_SECTIONS (index 2)
    for (let i = 2; i <= details.bathrooms; i++) {
      bathroomTemplates.push(ROOM_TEMPLATES.bathroom(i));
    }

    // Base Structure in INITIAL_SECTIONS:
    // 0: Living Room
    // 1: Kitchen
    // 2: Bathroom 1
    // 3: Secondary Room
    // 4: Building Exterior
    // 5: Heating
    // 6: Health & Safety

    const baseStart = newSections.slice(0, 3); // Living, Kitchen, Bath1
    const baseEnd = newSections.slice(3); // Secondary, Ext, Heating, General

    // Combine: BaseStart + Extra Baths + Bedrooms + BaseEnd
    const combinedSections = [...baseStart, ...bathroomTemplates, ...bedroomTemplates, ...baseEnd];
    
    setSections(combinedSections);
    setStep('inspection');
    window.scrollTo(0, 0);
  };

  // --- ADD ROOM DYNAMICALLY ---
  const addBedroom = () => {
    const currentCount = sections.filter(s => s.type === 'bedroom').length;
    const nextNum = currentCount + 1;
    const newBedroom = ROOM_TEMPLATES.bedroom(nextNum);
    
    // Insert before Secondary Room or Building Exterior
    const insertIdx = sections.findIndex(s => s.id === 'secondary_room' || s.id === 'building_ext');
    const newSections = [...sections];
    
    if (insertIdx !== -1) {
      newSections.splice(insertIdx, 0, newBedroom);
    } else {
      // Fallback: just before the end (Health & Safety) or at end
      newSections.splice(newSections.length - 2, 0, newBedroom);
    }

    setSections(newSections);
    setDetails(prev => ({ ...prev, bedrooms: prev.bedrooms + 1 }));
  };

  const addBathroom = () => {
    const currentCount = sections.filter(s => s.type === 'bathroom').length;
    const nextNum = currentCount + 1;
    const newBathroom = ROOM_TEMPLATES.bathroom(nextNum);

    // Insert after the last bathroom
    // Find last index of bathroom
    let lastBathIdx = -1;
    for (let i = sections.length - 1; i >= 0; i--) {
        if (sections[i].type === 'bathroom') {
            lastBathIdx = i;
            break;
        }
    }

    const newSections = [...sections];
    if (lastBathIdx !== -1) {
        newSections.splice(lastBathIdx + 1, 0, newBathroom);
    } else {
        // Should not happen as Bath 1 is standard, but insert after kitchen if needed
        newSections.splice(2, 0, newBathroom);
    }

    setSections(newSections);
    setDetails(prev => ({ ...prev, bathrooms: prev.bathrooms + 1 }));
  };

  // --- PHOTO LOGIC ---
  const handleCameraClick = (target: {sectionId: string, itemId: string} | 'general') => {
    activePhotoTarget.current = target;
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activePhotoTarget.current) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        
        if (activePhotoTarget.current === 'general') {
          setGeneralPhotos(prev => [...prev, base64]);
        } else {
          const { sectionId, itemId } = activePhotoTarget.current;
          updateItem(sectionId, itemId, {
            photos: (prevPhotos: string[]) => [...(prevPhotos || []), base64]
          });
        }
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- UPDATE HELPERS ---
  const updateItem = (sectionId: string, itemId: string, updates: Partial<InspectionItem> | any) => {
    setSections(prev => prev.map(sec => {
      if (sec.id !== sectionId) return sec;
      return {
        ...sec,
        items: sec.items.map(item => {
          if (item.id !== itemId) return item;
          
          // Handle function updates for photos
          const newPhotos = typeof updates.photos === 'function' 
            ? updates.photos(item.photos)
            : updates.photos || item.photos;

          return { ...item, ...updates, photos: newPhotos };
        })
      };
    }));
  };

  const updateSection = (sectionId: string, updates: Partial<RoomSection>) => {
    setSections(prev => prev.map(sec => {
        if (sec.id !== sectionId) return sec;
        return { ...sec, ...updates };
    }));
  };

  const handlePassSection = (sectionId: string) => {
    setSections(prev => prev.map(sec => {
      if (sec.id !== sectionId) return sec;
      return {
        ...sec,
        items: sec.items.map(item => {
          // PRESERVE: FAIL, INCONCLUSIVE, NOT_APPLICABLE
          if (
            item.status === InspectionStatus.FAIL || 
            item.status === InspectionStatus.INCONCLUSIVE || 
            item.status === InspectionStatus.NOT_APPLICABLE
          ) {
            return item;
          }
          // Otherwise set to PASS
          return { ...item, status: InspectionStatus.PASS };
        })
      };
    }));
  };

  // --- AI & VOICE ---
  const handleVoiceCommand = (targetId?: {sectionId: string, itemId: string, currentLabel?: string}) => {
    if (isListening) {
      stopSpeechRecognition();
      return;
    }

    // Set visual target
    if (targetId) setListeningTarget(targetId.itemId);

    startSpeechRecognition(async (transcript) => {
      console.log("Heard:", transcript);
      setIsProcessing(true); // Show spinner

      try {
        // If targetId is present, we treat this as a direct command/update for that item
        if (targetId) {
          // Pass context to AI: "User said X about Item Y"
          const contextTranscript = `Regarding ${targetId.currentLabel || 'this item'}: ${transcript}`;
          
          const result = await processVoiceCommand(contextTranscript, sections);
          
          if (result.success) {
            updateItem(targetId.sectionId, targetId.itemId, {
              comment: result.comment,
              is24Hour: result.is24Hour,
              status: result.status !== InspectionStatus.PENDING ? (result.status as string) : undefined
            });
          }
        } else {
          // General voice command mode
          const result = await processVoiceCommand(transcript, sections);
          if (result.success && result.sectionId && result.itemId) {
            updateItem(result.sectionId, result.itemId, {
              status: result.status,
              comment: result.comment,
              is24Hour: result.is24Hour
            });
          } else if (result.success) {
            // Fallback to general notes
            setGeneralNotes(prev => prev + (prev ? '\n' : '') + `[AI Note]: ${result.comment}`);
          }
        }
      } catch (e) {
        console.error("AI Processing Error", e);
      } finally {
        setIsProcessing(false);
        setListeningTarget(null);
      }
    }, () => {
      if(!isProcessing) setListeningTarget(null);
    });
  };

  // Handle simple dictation for setup fields (no AI summarization needed)
  const handleDictation = (fieldSetter: (val: string) => void) => {
    if (isListening) {
      stopSpeechRecognition();
      return;
    }
    startSpeechRecognition((transcript) => {
      fieldSetter(transcript);
    }, () => {});
  };

  const handleMagicAnalysis = async (text: string, targetId: {sectionId: string, itemId: string, currentLabel?: string}) => {
    if (!text.trim()) return;
    setIsProcessing(true);
    setListeningTarget(targetId.itemId);
    
    try {
      const contextTranscript = `Regarding ${targetId.currentLabel || 'this item'}: ${text}`;
      const result = await processVoiceCommand(contextTranscript, sections);
      if (result.success) {
        updateItem(targetId.sectionId, targetId.itemId, {
          comment: result.comment,
          is24Hour: result.is24Hour,
          status: result.status !== InspectionStatus.PENDING ? (result.status as string) : undefined
        });
      }
    } finally {
      setIsProcessing(false);
      setListeningTarget(null);
    }
  };

  // --- OFFICIAL HUD FORM REPLICA GENERATOR ---
  const generateOfficialHUDForm = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // Combine full address
    const fullAddress = `${details.address}, ${details.city}, ${details.state} ${details.zipCode}`;

    // --- HEADER ---
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Inspection Checklist", 14, 15);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Housing Choice Voucher Program", 14, 20);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("U.S. Department of Housing", pageWidth / 2, 15, { align: "center" });
    doc.text("and Urban Development", pageWidth / 2, 20, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text("Office of Public and Indian Housing", pageWidth / 2, 25, { align: "center" });

    doc.setFontSize(8);
    doc.text("OMB Approval No. 2577-0169", pageWidth - 14, 15, { align: "right" });
    doc.text("(Exp. 04/30/2026)", pageWidth - 14, 20, { align: "right" });

    // --- SECTION A: GENERAL INFORMATION ---
    let y = 35;
    doc.setFillColor(230, 230, 230);
    doc.rect(14, y, pageWidth - 28, 6, 'F');
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("A. General Information", 16, y + 4.5);
    
    y += 6;
    // Top Row
    autoTable(doc, {
      startY: y,
      head: [['Inspected Unit', 'Year Constructed', 'Housing Type', 'PHA']],
      body: [[
        fullAddress,
        details.yearBuilt.toString(), 
        details.unitType,
        details.phaName
      ]],
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', lineWidth: 0.1 },
      bodyStyles: { lineWidth: 0.1 },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 30 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 40 }
      }
    });
    
    y = (doc as any).lastAutoTable.finalY;

    // Second Row (Tenant/Inspector/T-Code)
    autoTable(doc, {
        startY: y,
        head: [['Tenant Name', 'Tenant ID Number', 'Inspector', 'Date of Inspection']],
        body: [[details.tenantName, details.tenantId, details.inspectorName || "_________________", details.inspectionDate]],
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', lineWidth: 0.1 },
        bodyStyles: { lineWidth: 0.1 }
    });
    y = (doc as any).lastAutoTable.finalY;

    // Third Row (Type of Inspection)
    const checkbox = (label: string, checked: boolean) => `[${checked ? 'X' : ' '}] ${label}`;
    const inspectionTypeString = 
        checkbox("Initial", details.inspectionType === 'Initial') + "  " +
        checkbox("Special", details.inspectionType === 'Special') + "  " +
        checkbox("Reinspection", details.inspectionType === 'Reinspection') + "  " +
        checkbox("Annual", details.inspectionType === 'Annual');

    autoTable(doc, {
        startY: y,
        head: [['Type of Inspection', 'Date of Last Inspection', 'PHA']],
        body: [[
            inspectionTypeString,
            "_________________",
            details.phaName
        ]],
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', lineWidth: 0.1 },
        bodyStyles: { lineWidth: 0.1 }
    });
    y = (doc as any).lastAutoTable.finalY;

    // --- SECTION B: SUMMARY DECISION ---
    y += 5;
    doc.setFillColor(230, 230, 230);
    doc.rect(14, y, pageWidth - 28, 6, 'F');
    doc.text("B. Summary Decision On Unit", 16, y + 4.5);
    
    y += 6;

    // STRICT LOGIC:
    // 1. FAIL if ANY fail.
    // 2. INCONCLUSIVE if NO fail AND at least one Inconclusive.
    // 3. PASS otherwise (even if some items are Pending - assumed inspector has verified remainder)
    const hasFail = sections.some(s => s.items.some(i => i.status === InspectionStatus.FAIL));
    const hasInconclusive = sections.some(s => s.items.some(i => i.status === InspectionStatus.INCONCLUSIVE));
    
    const overallStatus = hasFail 
      ? 'FAIL' 
      : hasInconclusive 
      ? 'INCONCLUSIVE' 
      : 'PASS';

    autoTable(doc, {
      startY: y,
      head: [['Decision', 'Number of Bedrooms', 'Number of Sleeping Rooms']],
      body: [[
        `[${overallStatus === 'PASS' ? 'X' : ' '}] Pass   [${overallStatus === 'FAIL' ? 'X' : ' '}] Fail   [${overallStatus === 'INCONCLUSIVE' ? 'X' : ' '}] Inconc.`,
        details.bedrooms.toString(),
        details.bedrooms.toString() // Simplification for now
      ]],
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', lineWidth: 0.1 },
      bodyStyles: { lineWidth: 0.1 }
    });
    y = (doc as any).lastAutoTable.finalY + 5;

    // --- CHECKLIST TABLE ---
    const tableRows: any[] = [];
    sections.forEach(section => {
      // Section Header Row with Location Data
      let titleText = section.title.toUpperCase();
      if (section.location.horizontal || section.location.vertical || section.location.floor) {
          titleText += ` (Loc: ${section.location.horizontal || '-'}/${section.location.vertical || '-'} Fl: ${section.location.floor || '-'})`;
      }

      tableRows.push([{ 
        content: titleText, 
        colSpan: 6, 
        styles: { fillColor: [220, 220, 220], fontStyle: 'bold' } 
      }]);

      section.items.forEach(item => {
        tableRows.push([
          item.id,
          item.label,
          item.status === InspectionStatus.PASS ? 'X' : '',
          item.status === InspectionStatus.FAIL ? (item.is24Hour ? 'X (24H)' : 'X') : '',
          item.status === InspectionStatus.INCONCLUSIVE ? 'X' : (item.status === InspectionStatus.NOT_APPLICABLE ? 'N/A' : ''),
          item.comment || ''
        ]);
      });
    });

    autoTable(doc, {
      startY: y,
      head: [['Item No.', 'Description', 'Yes/Pass', 'No/Fail', 'In/Conc', 'Comment']],
      body: tableRows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1 },
      headStyles: { fillColor: [50, 50, 50], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 50 },
        2: { cellWidth: 15, halign: 'center' },
        3: { cellWidth: 15, halign: 'center' },
        4: { cellWidth: 15, halign: 'center' },
        5: { cellWidth: 'auto' }
      }
    });

    // --- SIGNATURES PAGE ---
    doc.addPage();
    doc.setFontSize(14);
    doc.text("Certifications & Signatures", 14, 20);
    
    let sigY = 40;
    
    // Inspector
    doc.setFontSize(10);
    doc.text("Inspector Signature:", 14, sigY);
    if (signature) {
        doc.addImage(signature, 'PNG', 14, sigY + 5, 60, 30);
    }
    doc.text("Date: " + details.inspectionDate, 80, sigY + 20);

    // Secondary (Tenant/Owner)
    sigY += 50;
    const signerLabel = signerType === 'Tenant' ? "Tenant Signature:" : "Owner/Agent Signature:";
    doc.text(signerLabel, 14, sigY);
    if (secondarySignature) {
        doc.addImage(secondarySignature, 'PNG', 14, sigY + 5, 60, 30);
    }
    doc.text("Date: " + details.inspectionDate, 80, sigY + 20);


    // --- PHOTO ADDENDUM ---
    const allPhotos: {label: string, data: string}[] = [];
    sections.forEach(s => s.items.forEach(i => {
      if (i.photos) i.photos.forEach(p => allPhotos.push({ label: `${s.title} - ${i.label}`, data: p }));
    }));
    generalPhotos.forEach(p => allPhotos.push({ label: "General Evidence", data: p }));

    if (allPhotos.length > 0) {
      doc.addPage();
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Photo Addendum", pageWidth/2, 20, { align: "center" });
      
      let py = 40;
      allPhotos.forEach((photo, idx) => {
        if (py > 200) {
          doc.addPage();
          py = 40;
        }
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Photo ${idx+1}: ${photo.label}`, 20, py - 5);
        try {
            doc.addImage(photo.data, 'JPEG', 20, py, 80, 60);
        } catch (e) {
            doc.text("[Image Error]", 20, py + 30);
        }
        py += 75;
      });
    }

    doc.save(`HUD-52580-${details.tenantName || 'Inspection'}.pdf`);
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // Combine full address
    const fullAddress = `${details.address}, ${details.city}, ${details.state} ${details.zipCode}`;

    doc.setFontSize(20);
    doc.setTextColor(22, 163, 74); // Green header
    doc.text("Ceres Pacifica HQS Inspections", pageWidth / 2, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`PHA: ${details.phaName}`, 20, 30); // PHA Name
    doc.text(`Tenant: ${details.tenantName}`, 20, 40);
    doc.text(`Tenant ID: ${details.tenantId}`, 120, 40); // Added to header
    doc.text(`Address: ${fullAddress}`, 20, 50);
    doc.text(`Date: ${details.inspectionDate}`, 20, 60);
    doc.text(`Inspector: ${details.inspectorName}`, 120, 60);
    doc.text(`Unit Type: ${details.unitType}`, 20, 70);
    doc.text(`Year Built: ${details.yearBuilt}`, 120, 70);
    doc.text(`Inspection Type: ${details.inspectionType}`, 20, 80); // Added Inspection Type

    let y = 90; // Adjusted Y start

    // Check for general notes
    if (generalNotes) {
      doc.setFontSize(14);
      doc.setTextColor(22, 163, 74);
      doc.text("General Inspection Notes", 20, y);
      y += 10;
      doc.setFontSize(10);
      doc.setTextColor(0);
      const splitNotes = doc.splitTextToSize(generalNotes, pageWidth - 40);
      doc.text(splitNotes, 20, y);
      y += splitNotes.length * 7 + 10;
    }

    sections.forEach((section) => {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      // Draw header bg
      doc.setFillColor(22, 163, 74);
      doc.rect(15, y - 6, pageWidth - 30, 10, 'F');
      
      // Title + Location
      let titleText = section.title;
      if (section.location.horizontal || section.location.vertical || section.location.floor) {
          titleText += `   [Loc: ${section.location.horizontal}/${section.location.vertical} Floor: ${section.location.floor}]`;
      }
      doc.text(titleText, 20, y);
      y += 12;

      section.items.forEach(item => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }

        const statusColor = item.status === InspectionStatus.FAIL 
          ? [220, 38, 38] // Red
          : item.status === InspectionStatus.PASS 
          ? [22, 163, 74] // Green
          : [100, 116, 139]; // Slate
        
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(item.label, 20, y);
        
        doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
        doc.setFont("helvetica", "bold");
        let statusText: string = item.status;
        if (item.status === InspectionStatus.FAIL && item.is24Hour) statusText += " (24HR)";
        doc.text(statusText, 140, y, { align: "right" });
        
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0);
        
        if (item.comment) {
          y += 5;
          doc.setFontSize(9);
          doc.setTextColor(80, 80, 80);
          const comment = `Note: ${item.comment}`;
          const splitComment = doc.splitTextToSize(comment, 150);
          doc.text(splitComment, 25, y);
          y += splitComment.length * 4;
        }
        
        y += 8;
        doc.setDrawColor(200);
        doc.line(20, y-2, pageWidth-20, y-2);
      });
      y += 10;
    });

    // Photo Addendum
    const allPhotos: {label: string, data: string}[] = [];
    // Collect item photos
    sections.forEach(s => s.items.forEach(i => {
      if (i.photos) i.photos.forEach(p => allPhotos.push({ label: `${s.title} - ${i.label}`, data: p }));
    }));
    // Collect general photos
    generalPhotos.forEach(p => allPhotos.push({ label: "General Evidence", data: p }));

    if (allPhotos.length > 0) {
      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(0);
      doc.text("Photo Addendum", pageWidth/2, 20, { align: "center" });
      
      let py = 40;
      allPhotos.forEach((photo, idx) => {
        if (py > 200) {
          doc.addPage();
          py = 40;
        }
        doc.setFontSize(10);
        doc.text(`Photo ${idx+1}: ${photo.label}`, 20, py - 5);
        try {
            doc.addImage(photo.data, 'JPEG', 20, py, 80, 60);
        } catch (e) {
            doc.text("[Image Error]", 20, py + 30);
        }
        py += 75;
      });
    }

    // Signatures on Custom Report
    if (y > 220) doc.addPage();
    else y += 20;
    
    doc.setFontSize(12);
    doc.setTextColor(0);
    
    // Inspector
    doc.text("Inspector Signature:", 20, y);
    if (signature) {
        doc.addImage(signature, 'PNG', 20, y + 5, 60, 30);
    }
    
    // Secondary
    const signerLabel = signerType === 'Tenant' ? "Tenant Signature:" : "Owner/Agent Signature:";
    doc.text(signerLabel, 120, y);
    if (secondarySignature) {
        doc.addImage(secondarySignature, 'PNG', 120, y + 5, 60, 30);
    }

    doc.save(`HQS_Report_${details.tenantName.replace(/\s/g, '_')}.pdf`);
  };

  // --- RENDER ---

  if (step === 'setup') {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col items-center justify-center relative">
        <TutorialOverlay isOpen={showTutorial} onClose={() => setShowTutorial(false)} />
        
        <button onClick={() => setShowTutorial(true)} className="absolute top-4 right-4 text-white hover:text-green-400 text-2xl">
           <HelpIcon />
        </button>

        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-green-500 mb-2">Ceres Pacifica HQS Inspections</h1>
            <p className="text-slate-400">Voice-Enabled Inspection Assistant</p>
            <button onClick={() => setShowTutorial(true)} className="mt-4 text-sm text-green-400 underline hover:text-green-300">
               <i className="fas fa-book mr-1"></i> How to use this app
            </button>
          </div>

          <div className="bg-slate-800 p-6 rounded-xl shadow-xl space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Public Housing Authority (PHA)</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={details.phaName}
                  onChange={e => setDetails({...details, phaName: e.target.value})}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white"
                  placeholder="e.g. LA County Housing Authority"
                />
                <button onClick={() => handleDictation(v => setDetails({...details, phaName: v}))} className="p-3 bg-slate-700 rounded-lg text-white hover:bg-slate-600">
                  {isListening ? <MicActiveIcon /> : <MicIcon />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Type of Inspection</label>
              <select
                value={details.inspectionType}
                onChange={e => setDetails({...details, inspectionType: e.target.value as any})}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white"
              >
                <option value="Initial">Initial</option>
                <option value="Reinspection">Reinspection</option>
                <option value="Special">Special</option>
                <option value="Annual">Annual</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Tenant Name</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={details.tenantName}
                  onChange={e => setDetails({...details, tenantName: e.target.value})}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white"
                  placeholder="Jane Doe"
                />
                <button onClick={() => handleDictation(v => setDetails({...details, tenantName: v}))} className="p-3 bg-slate-700 rounded-lg text-white hover:bg-slate-600">
                  {isListening ? <MicActiveIcon /> : <MicIcon />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Tenant ID / Code</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={details.tenantId}
                  onChange={e => setDetails({...details, tenantId: e.target.value})}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white"
                  placeholder="T-12345 or A-987"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Street Address</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={details.address}
                  onChange={e => setDetails({...details, address: e.target.value})}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white"
                  placeholder="123 Main St, Apt 4B"
                />
                <button onClick={() => handleDictation(v => setDetails({...details, address: v}))} className="p-3 bg-slate-700 rounded-lg text-white hover:bg-slate-600">
                  {isListening ? <MicActiveIcon /> : <MicIcon />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                 <label className="block text-sm text-slate-400 mb-1">Zip Code</label>
                 <input 
                   type="text" 
                   value={details.zipCode}
                   onChange={e => handleZipCodeChange(e.target.value)}
                   className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white"
                   placeholder="90210"
                   maxLength={5}
                 />
              </div>
              <div>
                 <label className="block text-sm text-slate-400 mb-1">City</label>
                 <input 
                   type="text" 
                   value={details.city}
                   onChange={e => setDetails({...details, city: e.target.value})}
                   className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white"
                   placeholder="Beverly Hills"
                 />
              </div>
              <div>
                 <label className="block text-sm text-slate-400 mb-1">State</label>
                 <input 
                   type="text" 
                   value={details.state}
                   onChange={e => setDetails({...details, state: e.target.value})}
                   className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white"
                   placeholder="CA"
                 />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Bedrooms</label>
                <select 
                  value={details.bedrooms}
                  onChange={e => setDetails({...details, bedrooms: parseInt(e.target.value)})}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white"
                >
                  <option value={0}>0 (Studio)</option>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5+</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Bathrooms</label>
                <select 
                  value={details.bathrooms}
                  onChange={e => setDetails({...details, bathrooms: parseInt(e.target.value)})}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4+</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Unit Type</label>
              <select 
                value={details.unitType}
                onChange={e => setDetails({...details, unitType: e.target.value as any})}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white"
              >
                <option value="S/F Detached">Single Family Detached</option>
                <option value="Duplex/Triplex">Duplex/Triplex</option>
                <option value="Town House">Town House</option>
                <option value="Apartment">Apartment</option>
                <option value="Manufactured">Manufactured (Mobile Home)</option>
                <option value="SRO">Single Room Occupancy (SRO)</option>
                <option value="Shared Housing">Shared Housing</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Year Built</label>
              <input 
                type="number" 
                value={details.yearBuilt}
                onChange={e => setDetails({...details, yearBuilt: parseInt(e.target.value)})}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white"
              />
              {details.yearBuilt < 1978 ? (
                <div className="text-xs text-yellow-500 mt-1">⚠️ Pre-1978: Lead Paint Regulations Apply</div>
              ) : (
                <div className="text-xs text-green-500 mt-1">✅ Post-1978: Lead Paint Exempt</div>
              )}
            </div>

            <button 
              onClick={startInspection}
              className="w-full py-4 bg-green-600 hover:bg-green-500 rounded-lg font-bold text-lg transition-colors shadow-lg shadow-green-900/20"
            >
              Start Inspection
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- INSPECTION VIEW ---
  return (
    <div className="min-h-screen pb-20 bg-slate-100 text-slate-900">
      <TutorialOverlay isOpen={showTutorial} onClose={() => setShowTutorial(false)} />
      
      <ConfirmationModal 
        isOpen={showResetConfirm}
        onConfirm={confirmReset}
        onCancel={() => setShowResetConfirm(false)}
        title="Restart Inspection?"
        message="Are you sure you want to start a fresh inspection? All current data, including photos and signatures, will be permanently lost."
      />

      {/* CAMERA INPUT (Hidden) */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileInputRef}
        onChange={handlePhotoUpload}
        className="absolute opacity-0 pointer-events-none"
      />

      {/* HEADER */}
      <header className="bg-slate-900 text-white p-4 sticky top-0 z-10 shadow-md flex justify-between items-center">
        <div className="flex items-center gap-3 overflow-hidden">
           <h1 className="font-bold text-lg truncate">Ceres HQS: {details.address}</h1>
           {/* RESTART BUTTON */}
           <button 
             onClick={requestReset}
             className="text-slate-400 hover:text-white transition-colors"
             title="Restart Inspection"
           >
             <RestartIcon />
           </button>
           {/* HELP BUTTON */}
           <button onClick={() => setShowTutorial(true)} className="text-slate-400 hover:text-white transition-colors" title="Help / Tutorial">
             <HelpIcon />
           </button>
        </div>
        <button 
          onClick={() => setStep(step === 'inspection' ? 'summary' : 'inspection')}
          className="bg-blue-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-500 flex-shrink-0"
        >
          {step === 'inspection' ? 'Summary' : 'Back to List'}
        </button>
      </header>

      <main className="p-4 max-w-3xl mx-auto space-y-6">
        
        {step === 'inspection' ? (
          <>
            {/* DYNAMIC ROOM CONTROLS */}
            <div className="flex gap-2 mb-4">
               <button onClick={addBedroom} className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 rounded text-slate-700 font-semibold text-sm flex items-center justify-center gap-2">
                 <PlusIcon /> Add Bedroom
               </button>
               <button onClick={addBathroom} className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 rounded text-slate-700 font-semibold text-sm flex items-center justify-center gap-2">
                 <PlusIcon /> Add Bathroom
               </button>
            </div>

            {sections.map((section) => (
              <div key={section.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
                {/* SECTION HEADER - GREEN */}
                <div className="bg-green-600 text-white px-4 py-3 flex justify-between items-center">
                  <h2 className="font-bold text-lg">{section.title}</h2>
                </div>

                {/* LOCATION TOOLBAR */}
                <LocationSelector 
                  location={section.location} 
                  onChange={(loc) => updateSection(section.id, { location: loc })}
                />

                <div className="divide-y divide-slate-100">
                  {section.items.map((item) => (
                    <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-700">{item.id} {item.label}</span>
                          <Tooltip text={item.hqsGuidance} />
                        </div>
                        <div className="flex space-x-1">
                          {/* 24H TOGGLE */}
                          <button
                            onClick={() => updateItem(section.id, item.id, { is24Hour: !item.is24Hour })}
                            className={`px-2 py-1 text-xs font-bold rounded border ${item.is24Hour ? 'bg-red-900 text-white border-red-900' : 'bg-slate-100 text-slate-400 border-slate-200'}`}
                            title="Toggle 24-Hour Emergency Fail"
                          >
                            24H
                          </button>

                          <button
                            onClick={() => updateItem(section.id, item.id, { status: InspectionStatus.PASS })}
                            className={`p-2 rounded-lg ${item.status === InspectionStatus.PASS ? 'bg-green-100 text-green-600' : 'text-slate-300 hover:bg-slate-100'}`}
                          >
                            <CheckIcon />
                          </button>
                          <button
                            onClick={() => updateItem(section.id, item.id, { status: InspectionStatus.FAIL })}
                            className={`p-2 rounded-lg ${item.status === InspectionStatus.FAIL ? 'bg-red-100 text-red-600' : 'text-slate-300 hover:bg-slate-100'}`}
                          >
                            <FailIcon />
                          </button>
                          <button
                            onClick={() => updateItem(section.id, item.id, { status: InspectionStatus.NOT_APPLICABLE })}
                            className={`px-2 py-1 text-xs font-bold rounded ${item.status === InspectionStatus.NOT_APPLICABLE ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                          >
                            N/A
                          </button>
                        </div>
                      </div>
                      
                      {/* VISUAL INDICATOR FOR 24 HR FAIL */}
                      {item.status === InspectionStatus.FAIL && item.is24Hour && (
                         <div className="mb-2 inline-flex items-center gap-1 bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-bold border border-red-200">
                           <ClockIcon /> 24-HOUR EMERGENCY FAIL
                         </div>
                      )}

                      {/* NOTES INPUT */}
                      {(item.status === InspectionStatus.FAIL || item.status === InspectionStatus.INCONCLUSIVE || item.comment || listeningTarget === item.id) && (
                        <VoiceInput
                          value={item.comment}
                          onChange={(val) => updateItem(section.id, item.id, { comment: val })}
                          isListening={listeningTarget === item.id && isListening}
                          isProcessing={listeningTarget === item.id && isProcessing}
                          onVoiceStart={() => handleVoiceCommand({ sectionId: section.id, itemId: item.id, currentLabel: item.label })}
                          onMagicClick={() => handleMagicAnalysis(item.comment, { sectionId: section.id, itemId: item.id, currentLabel: item.label })}
                          onCameraClick={() => handleCameraClick({ sectionId: section.id, itemId: item.id })}
                          photos={item.photos}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* PASS ALL FOOTER */}
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                   <button 
                     onClick={() => handlePassSection(section.id)}
                     className="text-green-600 hover:text-green-700 text-sm font-semibold flex items-center gap-1 px-3 py-2 rounded hover:bg-green-50 transition-colors"
                   >
                     <CheckIcon /> Pass Remaining Items
                   </button>
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className="bg-white rounded-xl shadow-xl p-6 space-y-6">
            <h2 className="text-2xl font-bold border-b pb-4">Inspection Summary</h2>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
               <div>
                 <span className="block text-slate-500">PHA</span>
                 <span className="font-medium">{details.phaName}</span>
               </div>
               <div>
                 <span className="block text-slate-500">Tenant</span>
                 <span className="font-medium">{details.tenantName}</span>
               </div>
               <div>
                 <span className="block text-slate-500">Address</span>
                 <span className="font-medium">{details.address}</span>
               </div>
            </div>

            {/* FAIL SUMMARY */}
            <div className="space-y-2">
              <h3 className="font-bold text-red-600">Failed Items</h3>
              {sections.flatMap(s => s.items).filter(i => i.status === InspectionStatus.FAIL).length === 0 ? (
                <p className="text-slate-500 italic">No failed items.</p>
              ) : (
                sections.map(section => {
                  const fails = section.items.filter(i => i.status === InspectionStatus.FAIL);
                  if (fails.length === 0) return null;
                  return (
                    <div key={section.id} className="bg-red-50 p-3 rounded-lg border border-red-100">
                      <h4 className="font-semibold text-red-800 text-sm mb-2">{section.title}</h4>
                      <ul className="space-y-1">
                        {fails.map(item => (
                          <li key={item.id} className="text-sm text-red-700 flex justify-between">
                            <span>{item.label} {item.is24Hour && <strong>(24HR)</strong>}</span>
                            <span className="italic text-slate-600">{item.comment}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })
              )}
            </div>

            {/* GENERAL NOTES */}
            <div className="space-y-2">
              <h3 className="font-bold text-slate-800">Detailed General Inspection Notes</h3>
              <VoiceInput 
                value={generalNotes}
                onChange={setGeneralNotes}
                isListening={listeningTarget === 'general' && isListening}
                isProcessing={listeningTarget === 'general' && isProcessing}
                onVoiceStart={() => handleVoiceCommand()} // General mode
                onCameraClick={() => handleCameraClick('general')}
                photos={generalPhotos}
              />
            </div>

            {/* INSPECTOR SIGNATURE */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium mb-2">Inspector Signature</label>
              <SignaturePad onEnd={setSignature} />
            </div>

            {/* SECONDARY SIGNATURE */}
            <div className="border-t pt-4">
                <div className="flex justify-between items-end mb-2">
                    <label className="block text-sm font-medium">Who is signing?</label>
                    <select 
                        className="bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                        value={signerType}
                        onChange={(e) => setSignerType(e.target.value as any)}
                    >
                        <option value="Tenant">Tenant</option>
                        <option value="Owner">Owner</option>
                        <option value="Landlord Representative">Landlord Representative</option>
                    </select>
                </div>
                <label className="block text-sm font-medium text-slate-500 mb-1">
                    {signerType} Signature
                </label>
                <SignaturePad onEnd={setSecondarySignature} />
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <button 
                onClick={generatePDF}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold flex items-center justify-center gap-2"
              >
                <FilePdfIcon /> Download Report
              </button>
              <button 
                onClick={generateOfficialHUDForm}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center justify-center gap-2"
              >
                <FilePdfIcon /> Generate Official HUD 52580
              </button>
              <div className="border-t border-slate-200 my-2"></div>
              <button 
                onClick={requestReset}
                className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold flex items-center justify-center gap-2"
              >
                <RestartIcon /> Finish & Start New Inspection
              </button>
            </div>
          </div>
        )}
      </main>

      {/* GLOBAL VOICE FAB */}
      <button
        onClick={() => handleVoiceCommand()}
        className={`fixed bottom-6 right-6 p-4 rounded-full shadow-2xl transition-all transform hover:scale-110 z-50 ${isListening ? 'bg-red-500 animate-pulse' : 'bg-blue-600 hover:bg-blue-500'}`}
      >
        {isProcessing ? <WandSpinIcon /> : <i className={`fas fa-microphone text-white text-xl`}></i>}
      </button>
    </div>
  );
}
