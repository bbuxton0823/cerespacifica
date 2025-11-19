
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

// --- HELPER COMPONENTS ---

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
        <div className="bg-green-600 p-4 text-white flex justify-between items-center">
          <h2 className="text-xl font-bold"><i className="fas fa-book-open mr-2"></i> Quick Start Guide ({slide + 1}/4)</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white"><i className="fas fa-times text-2xl"></i></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 relative">
          {/* SLIDE 1: SETUP */}
          {slide === 0 && (
            <div className="space-y-8 text-center">
              <h3 className="text-2xl font-bold text-slate-800">1. Voice & Setup</h3>
              <p className="text-slate-600 max-w-xl mx-auto">Select your <strong>Inspection Type</strong>, fill details with your voice, and let AI handle the formatting.</p>
              
              <div className="relative max-w-md mx-auto bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg mt-8">
                 <label className="block text-left text-xs text-slate-400 mb-1">Tenant Name</label>
                 <div className="flex gap-2">
                    <div className="flex-1 bg-slate-900 border border-slate-600 rounded-lg p-3 text-slate-300 text-sm text-left">Jane Doe...</div>
                    <button className="p-3 bg-red-500/20 border border-red-500 rounded-lg text-white">
                       <MicActiveIcon />
                    </button>
                 </div>
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
              </div>
            </div>
          )}

          {/* SLIDE 2: CHECKLIST */}
          {slide === 1 && (
            <div className="space-y-6 text-center">
              <h3 className="text-2xl font-bold text-slate-800">2. The Inspection Checklist</h3>
              <p className="text-slate-600">Each item has controls for passing, failing, and adding evidence.</p>
              <div className="relative max-w-2xl mx-auto bg-white border border-slate-300 rounded-xl p-4 shadow-lg text-left mt-6">
                 <div className="flex justify-between items-start mb-2">
                    <span className="font-medium text-slate-700">1.5 Window Condition</span>
                    <div className="flex space-x-1">
                      <button className="px-2 py-1 text-xs font-bold rounded bg-slate-100 text-slate-400 border">24H</button>
                      <button className="p-2 rounded-lg text-slate-300 bg-slate-50"><CheckIcon /></button>
                      <button className="p-2 rounded-lg bg-red-100 text-red-600"><FailIcon /></button>
                    </div>
                 </div>
                 <ArrowAnnotation className="-top-8 right-40" text="Toggle 24-Hour Emergency" />
                 <ArrowAnnotation className="-top-8 right-4" text="Pass / Fail" />
                 <div className="relative mt-2">
                    <div className="w-full p-2 bg-slate-900 rounded text-white text-sm min-h-[60px]">Broken glass pane...</div>
                    <div className="absolute bottom-2 right-2 flex space-x-2">
                       <button className="p-1.5 bg-slate-700 rounded text-white"><CameraIcon /></button>
                       <button className="p-1.5 bg-slate-700 rounded text-yellow-400"><WandIcon /></button>
                       <button className="p-1.5 bg-red-500 rounded text-white"><MicIcon /></button>
                    </div>
                 </div>
              </div>
            </div>
          )}

          {/* SLIDE 3: NAV */}
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
                    </div>
                 </div>
                 <div className="bg-white p-4 rounded-xl shadow border border-slate-200">
                    <button className="w-full py-2 bg-slate-200 text-slate-700 font-bold rounded mb-2 flex items-center justify-center gap-2">
                       <PlusIcon /> Add Bedroom
                    </button>
                 </div>
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
                     <div className="text-left"><div className="font-bold">Official HUD 52580</div></div>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow flex items-center gap-4 border-l-4 border-green-600">
                     <div className="bg-green-100 p-3 rounded-full text-green-600"><i className="fas fa-file-pdf"></i></div>
                     <div className="text-left"><div className="font-bold">Custom Report</div></div>
                  </div>
               </div>
               <div className="bg-yellow-50 p-4 rounded-lg text-yellow-800 text-sm font-medium border border-yellow-200">
                 Don't forget to capture <strong>Signatures</strong> (Inspector + Tenant/Owner) before exporting!
               </div>
               <button onClick={onClose} className="w-full max-w-xs mx-auto py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg text-lg hover:bg-green-700 transform hover:scale-105 transition-all">
                 Get Started
               </button>
             </div>
          )}
        </div>
        
        {/* Footer Controls */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-between items-center">
          <button onClick={prevSlide} disabled={slide === 0} className="text-slate-500 disabled:opacity-30 hover:text-slate-800 font-medium flex items-center gap-2 px-3 py-2 rounded hover:bg-slate-200">
            <ArrowLeftIcon /> Back
          </button>
          <div className="flex gap-2">
            {[0,1,2,3].map(i => (
              <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === slide ? 'bg-green-600 w-4' : 'bg-slate-300'}`}></div>
            ))}
          </div>
          {slide < 3 ? (
            <button onClick={nextSlide} className="text-green-600 font-bold flex items-center gap-2 px-3 py-2 rounded hover:bg-green-50">
              Next <ArrowRightIcon />
            </button>
          ) : (
            <div className="w-20"></div> 
          )}
        </div>
      </div>
    </div>
  );
};

// --- SIGNATURE PAD COMPONENT ---
const SignaturePad = ({ 
  onSave, 
  label 
}: { 
  onSave: (data: string) => void; 
  label: string;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000';
      }
    }
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
    e.preventDefault(); // Prevent scrolling on touch
    setIsDrawing(true);
    const { x, y } = getPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  };

  const draw = (e: any) => {
    e.preventDefault();
    if (!isDrawing) return;
    const { x, y } = getPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    ctx?.lineTo(x, y);
    ctx?.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current && hasSignature) {
      onSave(canvasRef.current.toDataURL());
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasSignature(false);
      onSave('');
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
      <label className="block text-sm font-bold text-slate-700 mb-2">{label}</label>
      <div className="relative border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 touch-none h-40">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair rounded-lg"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 pointer-events-none">
            Sign Here
          </div>
        )}
      </div>
      <button 
        onClick={clear}
        className="mt-2 text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
      >
        <EraserIcon /> Clear Signature
      </button>
    </div>
  );
};

// --- VOICE INPUT COMPONENT ---
const VoiceInput = ({ 
  value, 
  onChange, 
  onAiRequest, 
  placeholder, 
  className = "",
  isProcessing = false
}: { 
  value: string; 
  onChange: (val: string) => void; 
  onAiRequest?: (text: string) => void;
  placeholder?: string;
  className?: string;
  isProcessing?: boolean;
}) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Speech recognition not supported in this browser.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;

    recognitionRef.current.onstart = () => setIsListening(true);
    recognitionRef.current.onend = () => setIsListening(false);
    recognitionRef.current.onerror = (event: any) => {
      console.error("Speech Error", event.error);
      setIsListening(false);
    };

    recognitionRef.current.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (onAiRequest) {
        onAiRequest(transcript);
      } else {
        onChange(transcript);
      }
    };

    recognitionRef.current.start();
  };

  return (
    <div className={`relative ${className}`}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-900 text-white border border-slate-700 rounded-lg p-3 pr-24 min-h-[80px] focus:ring-2 focus:ring-green-500 focus:outline-none placeholder-slate-500"
      />
      <div className="absolute bottom-2 right-2 flex space-x-2">
        {onAiRequest && (
          <button
            onClick={() => onAiRequest(value)}
            disabled={isProcessing || !value.trim()}
            className="p-2 rounded-full bg-slate-700 text-yellow-400 hover:bg-slate-600 disabled:opacity-50 transition-colors"
            title="AI Format & Check"
          >
            {isProcessing ? <WandSpinIcon /> : <WandIcon />}
          </button>
        )}
        <button
          onClick={startListening}
          disabled={isListening || isProcessing}
          className={`p-2 rounded-full transition-all ${
            isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-700 text-white hover:bg-slate-600'
          }`}
          title="Dictate"
        >
           {isListening ? <MicActiveIcon /> : <MicIcon />}
        </button>
      </div>
    </div>
  );
};

// --- LOCATION SELECTOR COMPONENT ---
const LocationSelector = ({ 
  location, 
  onChange 
}: { 
  location: RoomLocation; 
  onChange: (loc: RoomLocation) => void; 
}) => {
  const toggle = (field: keyof RoomLocation, val: string) => {
    onChange({ ...location, [field]: location[field as keyof RoomLocation] === val ? '' : val });
  };

  return (
    <div className="flex items-center space-x-2 bg-white p-2 rounded-md border border-slate-200 mb-3 shadow-sm overflow-x-auto">
      <span className="text-xs font-bold text-slate-500 uppercase mr-2">Loc:</span>
      
      {/* Horizontal */}
      <div className="flex rounded-md shadow-sm" role="group">
        {['L', 'C', 'R'].map((opt) => (
          <button
            key={opt}
            onClick={() => toggle('horizontal', opt)}
            className={`px-3 py-1 text-xs font-medium border first:rounded-l-md last:rounded-r-md ${
              location.horizontal === opt 
                ? 'bg-blue-600 text-white border-blue-600' 
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>

      <div className="h-4 w-px bg-slate-300 mx-2"></div>

      {/* Vertical */}
      <div className="flex rounded-md shadow-sm" role="group">
        {['F', 'C', 'R'].map((opt) => (
          <button
            key={opt}
            onClick={() => toggle('vertical', opt)}
            className={`px-3 py-1 text-xs font-medium border first:rounded-l-md last:rounded-r-md ${
              location.vertical === opt 
                ? 'bg-blue-600 text-white border-blue-600' 
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>

      <div className="h-4 w-px bg-slate-300 mx-2"></div>

      <div className="flex items-center space-x-1">
        <span className="text-xs text-slate-500 font-bold">FL:</span>
        <input 
          type="text" 
          value={location.floor}
          onChange={(e) => onChange({ ...location, floor: e.target.value })}
          className="w-12 text-xs p-1 bg-slate-900 text-white border border-slate-700 rounded text-center focus:ring-1 focus:ring-blue-500"
          placeholder="#"
        />
      </div>
    </div>
  );
};

// --- MAIN APP COMPONENT ---

export default function App() {
  const [view, setView] = useState<'setup' | 'inspection' | 'summary'>('setup');
  const [details, setDetails] = useState<UnitDetails>(INITIAL_DETAILS);
  const [sections, setSections] = useState<RoomSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeAiItem, setActiveAiItem] = useState<string | null>(null);
  const [inspectorSignature, setInspectorSignature] = useState('');
  const [secondarySignature, setSecondarySignature] = useState('');
  const [signerType, setSignerType] = useState<'Tenant' | 'Owner' | 'Landlord Representative' | 'Other'>('Tenant');
  const [generalNotes, setGeneralNotes] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showTutorial, setShowTutorial] = useState(true);

  // --- EFFECTS ---
  useEffect(() => {
    // Fetch city/state when zip is 5 chars
    if (details.zipCode.length === 5) {
      fetch(`https://api.zippopotam.us/us/${details.zipCode}`)
        .then(res => res.json())
        .then(data => {
          if (data.places && data.places[0]) {
            setDetails(prev => ({
              ...prev,
              city: data.places[0]['place name'],
              state: data.places[0]['state abbreviation']
            }));
          }
        })
        .catch(err => console.error("Zip lookup failed", err));
    }
  }, [details.zipCode]);

  const startInspection = () => {
    const dynamicSections = [...INITIAL_SECTIONS];
    
    // 1. Handle Bedrooms: If 0 (Studio), remove generic bedroom. If >0, add specific count.
    // Filter out any existing 'bedroom' types from INITIAL just in case
    let finalSections = dynamicSections.filter(s => s.type !== 'bedroom');

    if (details.bedrooms > 0) {
      // Insert bedrooms after Living Room (index 1 usually)
      const bedroomSections = [];
      for (let i = 1; i <= details.bedrooms; i++) {
        bedroomSections.push(ROOM_TEMPLATES.bedroom(i));
      }
      // Find index of kitchen to insert before, or just append appropriately
      // Typical order: Living, Kitchen, Bath...
      // We'll insert after Living Room
      const livingIndex = finalSections.findIndex(s => s.type === 'living_room');
      if (livingIndex !== -1) {
        finalSections.splice(livingIndex + 1, 0, ...bedroomSections);
      } else {
        finalSections.push(...bedroomSections);
      }
    }

    // 2. Handle Bathrooms
    const bathroomSections = [];
    // Remove existing default bathroom if any
    finalSections = finalSections.filter(s => s.type !== 'bathroom');
    
    for (let i = 1; i <= details.bathrooms; i++) {
      bathroomSections.push(ROOM_TEMPLATES.bathroom(i));
    }
    // Insert after kitchen
    const kitchenIndex = finalSections.findIndex(s => s.type === 'kitchen');
    if (kitchenIndex !== -1) {
      finalSections.splice(kitchenIndex + 1, 0, ...bathroomSections);
    } else {
      finalSections.push(...bathroomSections);
    }

    // Re-index check: ensure Secondary is present
    if (!finalSections.find(s => s.type === 'secondary')) {
      // Add secondary before Exterior
      const extIndex = finalSections.findIndex(s => s.type === 'exterior');
      if (extIndex !== -1) {
        finalSections.splice(extIndex, 0, INITIAL_SECTIONS.find(s => s.type === 'secondary')!);
      }
    }

    setSections(finalSections);
    setView('inspection');
  };

  const resetApp = () => {
    setShowResetConfirm(true);
  };

  const confirmReset = () => {
    const preservedPha = details.phaName; // Keep PHA name
    const preservedInspector = details.inspectorName; // Keep Inspector name

    setDetails({
      ...INITIAL_DETAILS,
      phaName: preservedPha,
      inspectorName: preservedInspector
    });
    setSections([]);
    setInspectorSignature('');
    setSecondarySignature('');
    setGeneralNotes('');
    setView('setup');
    setShowResetConfirm(false);
  };

  // --- ACTIONS ---

  const handleVoiceCommand = async (transcript: string, sectionId?: string, itemId?: string) => {
    setLoading(true);
    if (itemId) setActiveAiItem(itemId);

    // If we have explicit item context, focus the AI on that
    let targetItem = null;
    if (sectionId && itemId) {
      const section = sections.find(s => s.id === sectionId);
      targetItem = section?.items.find(i => i.id === itemId);
    }

    // Augment transcript if target known
    const fullQuery = targetItem 
      ? `Regarding ${targetItem.label}: ${transcript}`
      : transcript;

    const result = await processVoiceCommand(fullQuery, sections);

    if (result.success) {
      // If specific item targeted or identified by AI
      const targetSId = sectionId || result.sectionId;
      const targetIId = itemId || result.itemId;

      if (targetSId && targetIId) {
        setSections(prev => prev.map(sec => {
          if (sec.id === targetSId) {
            return {
              ...sec,
              items: sec.items.map(item => {
                if (item.id === targetIId) {
                  return {
                    ...item,
                    status: result.status || item.status,
                    comment: result.comment || item.comment,
                    is24Hour: result.is24Hour,
                    responsibility: result.responsibility || item.responsibility
                  };
                }
                return item;
              })
            };
          }
          return sec;
        }));
      } else if (result.comment) {
        // Fallback: add to general notes if no item matched
        setGeneralNotes(prev => prev + "\n" + result.comment);
      }
    }
    setLoading(false);
    setActiveAiItem(null);
  };

  const toggleStatus = (sectionId: string, itemId: string, status: InspectionStatus) => {
    setSections(prev => prev.map(sec => {
      if (sec.id === sectionId) {
        return {
          ...sec,
          items: sec.items.map(item => {
            if (item.id === itemId) {
              return { ...item, status: item.status === status ? InspectionStatus.PENDING : status };
            }
            return item;
          })
        };
      }
      return sec;
    }));
  };

  const toggle24Hour = (sectionId: string, itemId: string) => {
    setSections(prev => prev.map(sec => {
      if (sec.id === sectionId) {
        return {
          ...sec,
          items: sec.items.map(item => {
            if (item.id === itemId) {
              return { ...item, is24Hour: !item.is24Hour };
            }
            return item;
          })
        };
      }
      return sec;
    }));
  };

  const setResponsibility = (sectionId: string, itemId: string, resp: 'Owner' | 'Tenant') => {
    setSections(prev => prev.map(sec => {
      if (sec.id === sectionId) {
        return {
          ...sec,
          items: sec.items.map(item => {
            if (item.id === itemId) {
              return { ...item, responsibility: resp };
            }
            return item;
          })
        };
      }
      return sec;
    }));
  };

  const addPhoto = (sectionId: string, itemId: string, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setSections(prev => prev.map(sec => {
        if (sec.id === sectionId) {
          return {
            ...sec,
            items: sec.items.map(item => {
              if (item.id === itemId) {
                return { ...item, photos: [...(item.photos || []), base64] };
              }
              return item;
            })
          };
        }
        return sec;
      }));
    };
    reader.readAsDataURL(file);
  };

  const addNewRoom = (type: 'bedroom' | 'bathroom') => {
    const count = sections.filter(s => s.type === type).length + 1;
    const template = type === 'bedroom' ? ROOM_TEMPLATES.bedroom : ROOM_TEMPLATES.bathroom;
    const newSection = template(count); // ID conflict might occur if we deleted rooms, simple logic for now
    // Ensure unique ID
    newSection.id = `${type}_added_${Date.now()}`;
    
    // Insert before exterior or secondary
    const insertIdx = sections.findIndex(s => s.type === 'exterior' || s.type === 'secondary');
    const newSections = [...sections];
    if (insertIdx !== -1) {
      newSections.splice(insertIdx, 0, newSection);
    } else {
      newSections.push(newSection);
    }
    setSections(newSections);
  };

  const handlePassSection = (sectionId: string) => {
    setSections(prev => prev.map(sec => {
      if (sec.id === sectionId) {
        return {
          ...sec,
          items: sec.items.map(item => {
            // Preserve FAIL, N/A, INCONCLUSIVE
            if (item.status === InspectionStatus.FAIL || 
                item.status === InspectionStatus.NOT_APPLICABLE || 
                item.status === InspectionStatus.INCONCLUSIVE) {
              return item;
            }
            // Only change PENDING (or already PASS) to PASS
            return { ...item, status: InspectionStatus.PASS };
          })
        };
      }
      return sec;
    }));
  };

  // --- PDF GENERATORS ---

  const generateHUD52580 = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(16);
    doc.text("Inspection Checklist", 14, 15);
    doc.setFontSize(10);
    doc.text("U.S. Department of Housing and Urban Development", 14, 20);
    doc.text("Office of Public and Indian Housing", 14, 25);
    doc.text("OMB Approval No. 2577-0169", 150, 15);
    
    // General Info Box
    const startY = 35;
    doc.rect(14, startY, 182, 45);
    
    doc.setFontSize(9);
    doc.text(`Name of Family: ${details.tenantName}`, 16, startY + 6);
    doc.text(`Tenant ID: ${details.tenantId}`, 100, startY + 6);
    
    doc.text(`Inspector: ${details.inspectorName}`, 16, startY + 14);
    doc.text(`PHA: ${details.phaName}`, 100, startY + 14);

    doc.text(`Address: ${details.address}, ${details.city}, ${details.state} ${details.zipCode}`, 16, startY + 22);
    
    doc.text(`Date of Inspection: ${details.inspectionDate}`, 16, startY + 30);
    doc.text(`Type: ${details.inspectionType}`, 100, startY + 30);
    
    doc.text(`Unit Type: ${details.unitType}`, 16, startY + 38);
    doc.text(`Year Built: ${details.yearBuilt}`, 100, startY + 38);

    // Overall Decision Logic
    // FAIL if any item is FAIL.
    // INCONCLUSIVE if NO fails but at least one INCONCLUSIVE.
    // PASS otherwise.
    let overallStatus = 'PASS';
    let hasFail = false;
    let hasInconclusive = false;

    sections.forEach(s => s.items.forEach(i => {
      if (i.status === InspectionStatus.FAIL) hasFail = true;
      if (i.status === InspectionStatus.INCONCLUSIVE) hasInconclusive = true;
    }));

    if (hasFail) overallStatus = 'FAIL';
    else if (hasInconclusive) overallStatus = 'INCONCLUSIVE';

    // Summary Box
    doc.setFillColor(240, 240, 240);
    doc.rect(14, startY + 50, 182, 15, 'F');
    doc.text(`Summary Decision: ${overallStatus}`, 16, startY + 60);
    doc.text(`Bedrooms: ${details.bedrooms}`, 100, startY + 60);

    // Inspection Table
    const tableRows: any[] = [];
    sections.forEach(section => {
      // Section Header Row
      tableRows.push([{ content: section.title, colSpan: 5, styles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: 'bold' } }]);
      
      section.items.forEach(item => {
        // Map Status to columns
        const isPass = item.status === InspectionStatus.PASS ? 'X' : '';
        const isFail = item.status === InspectionStatus.FAIL ? 'X' : '';
        const isInconc = item.status === InspectionStatus.INCONCLUSIVE ? 'X' : '';
        
        let comment = item.comment;
        if (item.is24Hour) comment = `[24 HR FAIL] ${comment}`;
        if (item.status === InspectionStatus.FAIL && item.responsibility) {
          comment = `[Resp: ${item.responsibility}] ${comment}`;
        }
        if (item.photos && item.photos.length > 0) comment += ` (See Photo Addendum)`;

        tableRows.push([
          item.label,
          isPass,
          isFail,
          isInconc,
          comment
        ]);
      });
    });

    autoTable(doc, {
      startY: startY + 70,
      head: [['Item', 'Pass', 'Fail', 'Inc', 'Comment']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [50, 50, 50] },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 15, halign: 'center' },
        2: { cellWidth: 15, halign: 'center' },
        3: { cellWidth: 15, halign: 'center' },
        4: { cellWidth: 'auto' }
      }
    });

    // Signatures Page
    doc.addPage();
    doc.text("Certifications", 14, 20);
    
    if (inspectorSignature) {
       doc.text("Inspector Signature:", 14, 40);
       doc.addImage(inspectorSignature, 'PNG', 14, 45, 60, 20);
       doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 70);
    }

    if (secondarySignature) {
       doc.text(`${signerType} Signature:`, 100, 40);
       doc.addImage(secondarySignature, 'PNG', 100, 45, 60, 20);
       doc.text(`Date: ${new Date().toLocaleDateString()}`, 100, 70);
    }

    // Photo Addendum
    let hasPhotos = false;
    sections.forEach(s => s.items.forEach(i => { if (i.photos?.length) hasPhotos = true; }));
    
    if (hasPhotos) {
      doc.addPage();
      doc.setFontSize(16);
      doc.text("Photo Addendum", 14, 15);
      let yPos = 25;
      
      sections.forEach(section => {
        section.items.forEach(item => {
          if (item.photos && item.photos.length > 0) {
            // Check if we need new page
            if (yPos > 250) {
              doc.addPage();
              yPos = 20;
            }
            doc.setFontSize(12);
            doc.text(`${section.title} - ${item.label}`, 14, yPos);
            yPos += 5;
            
            item.photos.forEach(photo => {
               if (yPos > 220) {
                 doc.addPage();
                 yPos = 20;
               }
               try {
                 doc.addImage(photo, 'JPEG', 14, yPos, 80, 60);
                 yPos += 65;
               } catch (e) {
                 console.error("Error adding image to PDF", e);
               }
            });
            yPos += 10;
          }
        });
      });
    }

    doc.save(`HUD-52580-${details.address.replace(/\s/g, '_')}.pdf`);
  };

  const generateCustomPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor(22, 163, 74);
    doc.text("Ceres Pacifica HQS Inspection Report", 105, 15, { align: 'center' });
    
    // Details
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`Date: ${details.inspectionDate}`, 14, 25);
    doc.text(`Inspector: ${details.inspectorName}`, 14, 30);
    doc.text(`PHA: ${details.phaName}`, 14, 35);
    doc.text(`Type: ${details.inspectionType}`, 100, 25);
    doc.text(`Tenant: ${details.tenantName} (ID: ${details.tenantId})`, 14, 45);
    doc.text(`Address: ${details.address}, ${details.city}, ${details.state}`, 14, 50);

    // General Notes
    if (generalNotes) {
      doc.setFontSize(12);
      doc.text("General Inspection Notes:", 14, 60);
      doc.setFontSize(10);
      const splitNotes = doc.splitTextToSize(generalNotes, 180);
      doc.text(splitNotes, 14, 65);
    }

    let yPos = generalNotes ? 80 : 60;

    // Table of items
    const tableBody: any[] = [];
    sections.forEach(section => {
      // Location text
      let locText = '';
      if (section.location.horizontal || section.location.vertical || section.location.floor) {
        locText = ` (Loc: ${section.location.horizontal}/${section.location.vertical} Fl:${section.location.floor})`;
      }
      tableBody.push([{ content: section.title + locText, colSpan: 3, styles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: 'bold' } }]);
      
      section.items.forEach(item => {
        const statusColor = item.status === InspectionStatus.FAIL ? [220, 38, 38] : [0, 0, 0];
        let label = item.label;
        if (item.is24Hour) label += " [24H FAIL]";
        
        let notes = item.comment;
        if (item.status === InspectionStatus.FAIL && item.responsibility) {
          notes = `[Resp: ${item.responsibility}] ${notes}`;
        }

        tableBody.push([
          { content: label, styles: { textColor: statusColor } },
          { content: item.status, styles: { fontStyle: 'bold' } },
          notes
        ]);
      });
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Item', 'Status', 'Notes']],
      body: tableBody,
      theme: 'grid'
    });

    // Signatures on Custom Report
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    if (inspectorSignature) {
      doc.text("Inspector Signature", 14, finalY);
      doc.addImage(inspectorSignature, 'PNG', 14, finalY + 5, 50, 15);
    }
    if (secondarySignature) {
      doc.text(`${signerType} Signature`, 100, finalY);
      doc.addImage(secondarySignature, 'PNG', 100, finalY + 5, 50, 15);
    }

    doc.save(`HQS_Report_${details.address.replace(/\s/g, '_')}.pdf`);
  };


  // --- RENDER ---

  if (view === 'setup') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 p-4 flex flex-col items-center">
        <h1 className="text-3xl font-bold text-green-700 mb-2 text-center">Ceres Pacifica HQS Inspections</h1>
        <p className="text-slate-500 mb-6">Setup Inspection Details</p>
        
        <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-2xl space-y-4 border border-slate-200">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Inspection Type</label>
              <select
                className="w-full p-3 bg-slate-900 text-white rounded-lg"
                value={details.inspectionType}
                onChange={e => setDetails({...details, inspectionType: e.target.value as any})}
              >
                <option>Initial</option>
                <option>Annual</option>
                <option>Reinspection</option>
                <option>Special</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">PHA Name</label>
               <div className="relative">
                <input 
                  type="text" 
                  className="w-full p-3 bg-slate-900 text-white rounded-lg pr-10"
                  value={details.phaName}
                  onChange={e => setDetails({...details, phaName: e.target.value})}
                />
                <button 
                  onClick={() => {/* Simple voice handler logic inline or generalized */}}
                  className="absolute right-2 top-2 text-slate-400 hover:text-white"
                >
                  <MicIcon />
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Tenant Name</label>
            <VoiceInput 
              value={details.tenantName}
              onChange={(val) => setDetails({...details, tenantName: val})}
              className="h-12"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Tenant ID / T-Code</label>
            <input 
               type="text"
               value={details.tenantId}
               onChange={e => setDetails({...details, tenantId: e.target.value})}
               className="w-full p-3 bg-slate-900 text-white rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Address</label>
            <VoiceInput 
              value={details.address}
              onChange={(val) => setDetails({...details, address: val})}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
               <label className="block text-sm font-bold text-slate-700 mb-1">Zip Code</label>
               <input 
                  type="text" 
                  maxLength={5}
                  value={details.zipCode}
                  onChange={e => setDetails({...details, zipCode: e.target.value.replace(/\D/g,'')})}
                  className="w-full p-3 bg-slate-900 text-white rounded-lg"
                  placeholder="12345"
               />
            </div>
            <div>
               <label className="block text-sm font-bold text-slate-700 mb-1">City</label>
               <input type="text" readOnly value={details.city} className="w-full p-3 bg-slate-800 text-slate-400 rounded-lg cursor-not-allowed" />
            </div>
            <div>
               <label className="block text-sm font-bold text-slate-700 mb-1">State</label>
               <input type="text" readOnly value={details.state} className="w-full p-3 bg-slate-800 text-slate-400 rounded-lg cursor-not-allowed" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Unit Type</label>
              <select 
                className="w-full p-3 bg-slate-900 text-white rounded-lg"
                value={details.unitType}
                onChange={e => setDetails({...details, unitType: e.target.value as any})}
              >
                <option>S/F Detached</option>
                <option>Duplex/Triplex</option>
                <option>Town House</option>
                <option>Apartment</option>
                <option>Manufactured</option>
                <option>SRO</option>
                <option>Shared Housing</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Year Built</label>
              <div className="relative">
                <input 
                  type="number" 
                  value={details.yearBuilt}
                  onChange={e => setDetails({...details, yearBuilt: parseInt(e.target.value) || 1980})}
                  className="w-full p-3 bg-slate-900 text-white rounded-lg"
                />
                {details.yearBuilt < 1978 ? (
                  <div className="absolute right-2 top-2 px-2 py-1 bg-orange-500 text-white text-xs font-bold rounded animate-pulse">
                    Pre-1978 (Lead)
                  </div>
                ) : (
                  <div className="absolute right-2 top-2 px-2 py-1 bg-green-500 text-white text-xs font-bold rounded">
                    Post-1978
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Bedrooms</label>
              <select 
                className="w-full p-3 bg-slate-900 text-white rounded-lg"
                value={details.bedrooms}
                onChange={e => setDetails({...details, bedrooms: parseInt(e.target.value)})}
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
              <label className="block text-sm font-bold text-slate-700 mb-1">Bathrooms</label>
              <select 
                className="w-full p-3 bg-slate-900 text-white rounded-lg"
                value={details.bathrooms}
                onChange={e => setDetails({...details, bathrooms: parseInt(e.target.value)})}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3+</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Inspector Name</label>
            <input 
              className="w-full p-3 bg-slate-900 text-white rounded-lg"
              value={details.inspectorName}
              onChange={e => setDetails({...details, inspectorName: e.target.value})}
            />
          </div>

          <button 
            onClick={startInspection}
            className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg text-lg transition-all mt-6"
          >
            Start Inspection
          </button>

          <button
            onClick={() => setShowTutorial(true)}
            className="w-full py-2 text-slate-500 hover:text-green-600 font-medium text-sm flex items-center justify-center gap-2"
          >
            <HelpIcon /> View Quick Start Guide
          </button>
        </div>
        <TutorialOverlay isOpen={showTutorial} onClose={() => setShowTutorial(false)} />
      </div>
    );
  }

  if (view === 'inspection') {
    return (
      <div className="min-h-screen bg-slate-100 pb-20">
        {/* Header */}
        <header className="bg-green-700 text-white p-4 sticky top-0 z-40 shadow-md flex justify-between items-center">
           <div className="font-bold text-lg truncate max-w-[200px]">{details.address || "New Inspection"}</div>
           <div className="flex space-x-3">
             <button onClick={resetApp} className="bg-green-800 p-2 rounded-full hover:bg-green-900" title="Restart">
               <RestartIcon />
             </button>
             <button 
               onClick={() => setView('summary')}
               className="bg-white text-green-700 px-4 py-2 rounded-lg font-bold text-sm hover:bg-green-50"
             >
               Finish
             </button>
           </div>
        </header>

        {/* Main Content */}
        <div className="max-w-3xl mx-auto p-4 space-y-6">
          
          {/* General Voice Command */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 sticky top-20 z-30">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Global Voice Command</label>
            <div className="flex items-center gap-2">
               <div className="flex-1">
                  <VoiceInput 
                    value="" 
                    onChange={() => {}} 
                    onAiRequest={(txt) => handleVoiceCommand(txt)}
                    isProcessing={loading}
                    placeholder="Speak any observation (e.g., 'Kitchen sink is leaking')"
                    className="h-12" 
                  />
               </div>
            </div>
            {loading && <div className="text-xs text-green-600 mt-1 animate-pulse font-bold"><WandSpinIcon /> AI Processing...</div>}
          </div>

          {/* Room Sections */}
          {sections.map(section => (
            <div key={section.id} className="bg-white rounded-xl shadow-md overflow-hidden border border-slate-200">
              <div className="bg-green-600 p-3 text-white flex justify-between items-center">
                <h3 className="font-bold text-lg">{section.title}</h3>
                <span className="text-xs bg-green-800 px-2 py-1 rounded-full">{section.items.filter(i => i.status === InspectionStatus.FAIL).length} Fails</span>
              </div>
              
              <div className="p-4">
                {/* Location Selector for this room */}
                <LocationSelector 
                  location={section.location} 
                  onChange={(loc) => {
                    setSections(prev => prev.map(s => s.id === section.id ? {...s, location: loc} : s));
                  }}
                />

                <div className="space-y-4">
                  {section.items.map(item => (
                    <div key={item.id} className={`border-b border-slate-100 pb-4 last:border-0 ${item.status === InspectionStatus.FAIL ? 'bg-red-50 -mx-4 px-4 pt-2' : ''}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center max-w-[60%]">
                          <span className="font-medium text-slate-800">{item.label}</span>
                          <Tooltip text={item.hqsGuidance} />
                          {item.is24Hour && <span className="ml-2 text-[10px] bg-red-600 text-white px-1 py-0.5 rounded font-bold flex items-center gap-1"><ClockIcon /> 24H</span>}
                        </div>
                        
                        {/* Status Buttons */}
                        <div className="flex flex-wrap gap-1 justify-end">
                           <button 
                             onClick={() => toggle24Hour(section.id, item.id)}
                             className={`px-2 py-1 rounded text-xs font-bold border ${item.is24Hour ? 'bg-red-800 text-white border-red-800' : 'bg-slate-100 text-slate-400 border-slate-200'}`}
                           >
                             24H
                           </button>
                           <button 
                             onClick={() => toggleStatus(section.id, item.id, InspectionStatus.NOT_APPLICABLE)}
                             className={`p-2 rounded-lg text-xs font-bold ${item.status === InspectionStatus.NOT_APPLICABLE ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                           >
                             N/A
                           </button>
                           <button 
                             onClick={() => toggleStatus(section.id, item.id, InspectionStatus.PASS)}
                             className={`p-2 rounded-lg ${item.status === InspectionStatus.PASS ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-300'}`}
                           >
                             <CheckIcon />
                           </button>
                           <button 
                             onClick={() => toggleStatus(section.id, item.id, InspectionStatus.FAIL)}
                             className={`p-2 rounded-lg ${item.status === InspectionStatus.FAIL ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-300'}`}
                           >
                             <FailIcon />
                           </button>
                        </div>
                      </div>

                      {/* FAIL Responsibility Selector */}
                      {item.status === InspectionStatus.FAIL && (
                        <div className="flex items-center justify-end gap-2 mb-2 mt-1">
                          <span className="text-[10px] font-bold uppercase text-slate-500">Responsibility:</span>
                          <button 
                            onClick={() => setResponsibility(section.id, item.id, 'Owner')}
                            className={`px-3 py-1 rounded text-xs font-bold border ${item.responsibility === 'Owner' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-300'}`}
                          >
                            Owner
                          </button>
                          <button 
                            onClick={() => setResponsibility(section.id, item.id, 'Tenant')}
                            className={`px-3 py-1 rounded text-xs font-bold border ${item.responsibility === 'Tenant' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-500 border-slate-300'}`}
                          >
                            Tenant
                          </button>
                        </div>
                      )}

                      {/* Notes & Photos */}
                      <div className="mt-2 space-y-2">
                        <VoiceInput 
                           value={item.comment}
                           onChange={(val) => {
                             setSections(prev => prev.map(s => s.id === section.id ? {
                               ...s, items: s.items.map(i => i.id === item.id ? {...i, comment: val} : i)
                             } : s));
                           }}
                           onAiRequest={(txt) => handleVoiceCommand(txt, section.id, item.id)}
                           isProcessing={activeAiItem === item.id && loading}
                           placeholder="Notes..."
                        />
                        
                        {/* Photo Button */}
                        <div className="flex items-center gap-2 mt-2">
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer bg-slate-200 px-3 py-2 rounded hover:bg-slate-300">
                            <CameraIcon /> Add Photo
                            <input 
                               type="file" 
                               accept="image/*" 
                               capture="environment" 
                               className="hidden" // Keep standard hidden logic or robust opacity logic if debugging
                               style={{ opacity: 0, position: 'absolute', width: 1, height: 1 }}
                               onChange={(e) => {
                                 if (e.target.files && e.target.files[0]) {
                                   addPhoto(section.id, item.id, e.target.files[0]);
                                 }
                               }}
                            />
                          </label>
                          {item.photos && item.photos.length > 0 && (
                            <span className="text-xs text-blue-600 font-bold">{item.photos.length} Photos Attached</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pass All Footer */}
                <div className="mt-6 pt-4 border-t border-slate-200 flex justify-end">
                  <button 
                    onClick={() => handlePassSection(section.id)}
                    className="text-green-600 font-bold text-sm flex items-center gap-2 px-4 py-2 rounded-lg bg-green-50 hover:bg-green-100 border border-green-200 transition-colors"
                  >
                    <CheckIcon /> Pass Remaining Items
                  </button>
                </div>

              </div>
            </div>
          ))}

          {/* Add Rooms */}
          <div className="flex gap-4 justify-center py-6">
            <button onClick={() => addNewRoom('bedroom')} className="flex items-center gap-2 px-4 py-2 bg-slate-200 rounded-full text-slate-700 font-bold hover:bg-slate-300">
              <PlusIcon /> Add Bedroom
            </button>
            <button onClick={() => addNewRoom('bathroom')} className="flex items-center gap-2 px-4 py-2 bg-slate-200 rounded-full text-slate-700 font-bold hover:bg-slate-300">
              <PlusIcon /> Add Bathroom
            </button>
          </div>

        </div>
        <ConfirmationModal 
           isOpen={showResetConfirm} 
           title="Restart Inspection?" 
           message="Are you sure? All unsaved progress for this unit will be lost." 
           onConfirm={confirmReset} 
           onCancel={() => setShowResetConfirm(false)} 
        />
      </div>
    );
  }

  // SUMMARY VIEW
  return (
    <div className="min-h-screen bg-slate-50 p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">Inspection Summary</h2>
      
      {/* General Notes */}
      <div className="bg-white p-6 rounded-xl shadow-md mb-6">
        <h3 className="font-bold text-lg mb-4">Detailed General Inspection Notes</h3>
        <VoiceInput 
           value={generalNotes}
           onChange={setGeneralNotes}
           onAiRequest={(txt) => handleVoiceCommand(txt)} // Use generic handler
           isProcessing={loading}
           placeholder="Enter overall property notes, neighborhood conditions, etc."
        />
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
         <SignaturePad label="Inspector Signature" onSave={setInspectorSignature} />
         <div className="flex flex-col gap-2">
            <div className="bg-white border border-slate-200 rounded-lg p-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Signer</label>
              <select 
                value={signerType} 
                onChange={(e: any) => setSignerType(e.target.value)}
                className="w-full bg-transparent font-bold text-slate-800 outline-none"
              >
                <option>Tenant</option>
                <option>Owner</option>
                <option>Landlord Representative</option>
                <option>Other</option>
              </select>
            </div>
            <SignaturePad label={`${signerType} Signature`} onSave={setSecondarySignature} />
         </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button 
          onClick={generateHUD52580}
          className="flex items-center justify-center gap-2 py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700"
        >
          <FilePdfIcon /> Generate HUD 52580
        </button>
        <button 
          onClick={generateCustomPDF}
          className="flex items-center justify-center gap-2 py-4 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700"
        >
          <FilePdfIcon /> Generate Custom Report
        </button>
      </div>

      <div className="mt-8 flex flex-col gap-4">
         <button 
           onClick={() => setView('inspection')}
           className="text-slate-500 hover:text-slate-800 font-medium"
         >
           Back to Checklist
         </button>
         
         <button
           onClick={resetApp}
           className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-900"
         >
           <RestartIcon /> Start New Inspection
         </button>
      </div>
      
      <ConfirmationModal 
           isOpen={showResetConfirm} 
           title="Start New Inspection?" 
           message="This will clear all current data. Ensure you have downloaded your reports first." 
           onConfirm={confirmReset} 
           onCancel={() => setShowResetConfirm(false)} 
      />
    </div>
  );
}
