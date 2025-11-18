import React, { useState, useEffect, useRef } from 'react';
import { INITIAL_SECTIONS, ROOM_TEMPLATES } from './constants';
import { InspectionStatus, RoomSection, UnitDetails, InspectionItem } from './types';
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

// --- ICONS ---
const MicIcon = () => <i className="fas fa-microphone"></i>;
const MicActiveIcon = () => <i className="fas fa-microphone-lines text-red-500 animate-pulse"></i>;
const CheckIcon = () => <i className="fas fa-check-circle"></i>; // Removed text-green-600 to allow inheritance in button
const FailIcon = () => <i className="fas fa-times-circle text-red-600"></i>;
const InfoIcon = () => <i className="fas fa-info-circle text-blue-500"></i>;
const PrintIcon = () => <i className="fas fa-print"></i>;
const WandIcon = () => <i className="fas fa-wand-magic-sparkles text-yellow-400"></i>;
const ClockIcon = () => <i className="fas fa-clock"></i>;
const CameraIcon = () => <i className="fas fa-camera"></i>;
const TrashIcon = () => <i className="fas fa-trash"></i>;
const PlusIcon = () => <i className="fas fa-plus-circle"></i>;

// --- COMPONENTS ---

const Tooltip = ({ text }: { text: string }) => (
  <div className="group relative inline-block ml-2">
    <InfoIcon />
    <div className="invisible group-hover:visible absolute z-50 w-64 p-2 mt-1 text-sm text-white bg-gray-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity -left-20 md:left-0 pointer-events-none">
      {text}
    </div>
  </div>
);

const VoiceInput = ({ 
  label, 
  value, 
  onChange, 
  onVoiceStart, 
  isListening,
  onMagicClick,
  onCameraClick,
  photos = []
}: { 
  label?: string, 
  value: string, 
  onChange: (val: string) => void, 
  onVoiceStart: () => void, 
  isListening: boolean,
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
            <WandIcon />
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
  const [details, setDetails] = useState<UnitDetails>({
    tenantName: '',
    address: '',
    unitType: 'S/F Detached',
    yearBuilt: 1980,
    bedrooms: 1,
    bathrooms: 1,
    inspectionDate: new Date().toISOString().split('T')[0],
    inspectorName: ''
  });
  const [sections, setSections] = useState<RoomSection[]>(INITIAL_SECTIONS);
  const [isListening, setIsListening] = useState(false);
  const [listeningTarget, setListeningTarget] = useState<string | null>(null); // ID of item being listened to
  const [generalNotes, setGeneralNotes] = useState('');
  const [generalPhotos, setGeneralPhotos] = useState<string[]>([]);
  
  // Camera ref - Defined once at top level
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activePhotoTarget = useRef<{sectionId: string, itemId: string} | 'general' | null>(null);
  const recognitionRef = useRef<any>(null);

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
      setListeningTarget(null);
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

  // --- INITIALIZATION LOGIC ---
  const startInspection = () => {
    let newSections = [...INITIAL_SECTIONS];

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

      // If targetId is present, we treat this as a direct command/update for that item
      if (targetId) {
        // Pass context to AI: "User said X about Item Y"
        // We prefix the transcript with the context so the AI knows what to focus on
        const contextTranscript = `Regarding ${targetId.currentLabel || 'this item'}: ${transcript}`;
        
        const result = await processVoiceCommand(contextTranscript, sections);
        
        if (result.success) {
          updateItem(targetId.sectionId, targetId.itemId, {
            comment: result.comment,
            is24Hour: result.is24Hour,
            status: result.status !== InspectionStatus.PENDING ? result.status : undefined
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
    }, () => {
      setListeningTarget(null);
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
    const contextTranscript = `Regarding ${targetId.currentLabel || 'this item'}: ${text}`;
    const result = await processVoiceCommand(contextTranscript, sections);
    if (result.success) {
      updateItem(targetId.sectionId, targetId.itemId, {
        comment: result.comment,
        is24Hour: result.is24Hour,
        status: result.status !== InspectionStatus.PENDING ? result.status : undefined
      });
    }
  };

  // --- PDF GENERATION ---
  const generatePDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(0, 100, 0);
    doc.text("Ceres Pacifica HQS Inspections", 105, 15, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    
    // Info Table
    autoTable(doc, {
      startY: 25,
      head: [['Tenant', 'Address', 'Owner']],
      body: [[details.tenantName, details.address, '']],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 2 }
    });

    // Details Table
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 5,
      head: [['Inspection Type', 'Unit Type', 'Bedrooms', 'Year Built']],
      body: [[
        'Initial / Annual', 
        details.unitType, 
        details.bedrooms === 0 ? '0 (Studio)' : details.bedrooms,
        `${details.yearBuilt} ${details.yearBuilt < 1978 ? '(Lead Regs Apply)' : ''}`
      ]],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 2 }
    });

    let currentY = doc.lastAutoTable.finalY + 10;

    // Sections
    sections.forEach(section => {
      // Check page break
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(12);
      doc.setFillColor(220, 252, 231); // Green-100
      doc.rect(14, currentY, 182, 8, 'F');
      doc.text(section.title, 16, currentY + 6);
      currentY += 10;

      const rows = section.items.map(item => [
        item.label,
        item.status,
        // Add 24 Hour Flag to comment if applicable
        (item.is24Hour ? '[24 HR FAIL] ' : '') + item.comment
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Item', 'Status', 'Comments']],
        body: rows,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 30 },
          2: { cellWidth: 'auto' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 1) {
            const status = data.cell.raw as string;
            if (status === 'FAIL') data.cell.styles.textColor = [200, 0, 0];
            if (status === 'PASS') data.cell.styles.textColor = [0, 150, 0];
          }
        }
      });

      currentY = doc.lastAutoTable.finalY + 5;
    });

    // General Notes
    if (generalNotes) {
      if (currentY > 240) { doc.addPage(); currentY = 20; }
      doc.setFontSize(12);
      doc.text("General Inspection Notes:", 14, currentY);
      doc.setFontSize(10);
      doc.text(generalNotes, 14, currentY + 7, { maxWidth: 180 });
      currentY += 30; // Approx height
    }

    // Signatures
    if (currentY > 240) { doc.addPage(); currentY = 20; }
    doc.line(14, currentY + 15, 80, currentY + 15);
    doc.text("Inspector Signature", 14, currentY + 20);
    
    doc.line(110, currentY + 15, 180, currentY + 15);
    doc.text("Tenant/Owner Signature", 110, currentY + 20);

    // Photo Addendum
    const allPhotos: {label: string, src: string}[] = [];
    sections.forEach(s => s.items.forEach(i => {
      if (i.photos) i.photos.forEach(p => allPhotos.push({label: `${s.title} - ${i.label}`, src: p}));
    }));
    generalPhotos.forEach(p => allPhotos.push({label: 'General', src: p}));

    if (allPhotos.length > 0) {
      doc.addPage();
      doc.setFontSize(14);
      doc.text("Photo Addendum", 105, 15, { align: 'center' });
      
      let photoY = 25;
      let photoX = 15;
      
      allPhotos.forEach((photo, idx) => {
        if (photoY > 240) {
          doc.addPage();
          photoY = 20;
        }
        
        try {
            doc.addImage(photo.src, 'JPEG', photoX, photoY, 50, 50);
            doc.setFontSize(8);
            doc.text(photo.label, photoX, photoY + 55);
        } catch (e) {
            console.error("Error adding image to PDF", e);
        }

        photoX += 60;
        if (photoX > 140) {
          photoX = 15;
          photoY += 65;
        }
      });
    }

    doc.save(`HQS_Inspection_${details.address.replace(/\s+/g, '_')}.pdf`);
  };

  // --- RENDER ---

  return (
    <>
      {/* Global File Input for Camera - Always Available */}
      <input 
        type="file" 
        accept="image/*" 
        capture="environment" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={handlePhotoUpload} 
      />

      {step === 'setup' && (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
          <div className="max-w-md w-full space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-green-400 mb-2">Ceres Pacifica HQS Inspections</h1>
              <p className="text-slate-400">New Inspection Setup</p>
            </div>
            
            <div className="bg-slate-800 p-6 rounded-xl shadow-lg space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300">Tenant Name</label>
                <div className="flex gap-2 mt-1">
                  <input 
                    type="text" 
                    className="flex-1 p-3 rounded-lg bg-slate-900 border border-slate-700 text-white focus:ring-2 focus:ring-green-500 outline-none"
                    value={details.tenantName}
                    onChange={e => setDetails({...details, tenantName: e.target.value})}
                    placeholder="John Doe"
                  />
                  <button 
                    onClick={() => handleDictation(val => setDetails(prev => ({...prev, tenantName: val})))}
                    className={`p-3 rounded-lg text-white ${isListening ? 'bg-red-500 animate-pulse' : 'bg-slate-700'}`}
                  >
                    <MicIcon />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300">Address</label>
                <div className="flex gap-2 mt-1">
                  <input 
                    type="text" 
                    className="flex-1 p-3 rounded-lg bg-slate-900 border border-slate-700 text-white focus:ring-2 focus:ring-green-500 outline-none"
                    value={details.address}
                    onChange={e => setDetails({...details, address: e.target.value})}
                    placeholder="123 Main St"
                  />
                  <button 
                    onClick={() => handleDictation(val => setDetails(prev => ({...prev, address: val})))}
                    className={`p-3 rounded-lg text-white ${isListening ? 'bg-red-500 animate-pulse' : 'bg-slate-700'}`}
                  >
                    <MicIcon />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300">Unit Type</label>
                <select 
                  value={details.unitType}
                  onChange={(e) => setDetails({...details, unitType: e.target.value as any})}
                  className="w-full p-3 mt-1 rounded-lg bg-slate-900 border border-slate-700 text-white focus:ring-2 focus:ring-green-500 outline-none"
                >
                  <option value="S/F Detached">S/F Detached</option>
                  <option value="Duplex/Triplex">Duplex/Triplex</option>
                  <option value="Town House">Town House</option>
                  <option value="Apartment">Apartment</option>
                  <option value="Manufactured">Manufactured (Mobile Home)</option>
                  <option value="SRO">SRO</option>
                  <option value="Shared Housing">Shared Housing</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300">Year Built</label>
                  <input 
                    type="number" 
                    className="w-full p-3 mt-1 rounded-lg bg-slate-900 border border-slate-700 text-white"
                    value={details.yearBuilt}
                    onChange={e => setDetails({...details, yearBuilt: parseInt(e.target.value)})}
                  />
                  {details.yearBuilt < 1978 ? (
                    <span className="text-xs text-amber-400 font-bold">⚠️ Lead Regs Apply</span>
                  ) : (
                    <span className="text-xs text-green-400">✅ Lead Exempt</span>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">Bedrooms</label>
                  <select 
                    className="w-full p-3 mt-1 rounded-lg bg-slate-900 border border-slate-700 text-white"
                    value={details.bedrooms}
                    onChange={e => setDetails({...details, bedrooms: parseInt(e.target.value)})}
                  >
                    <option value={0}>0 (Studio)</option>
                    {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">Bathrooms</label>
                  <select 
                    className="w-full p-3 mt-1 rounded-lg bg-slate-900 border border-slate-700 text-white"
                    value={details.bathrooms}
                    onChange={e => setDetails({...details, bathrooms: parseInt(e.target.value)})}
                  >
                    {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              <button 
                onClick={startInspection}
                className="w-full py-4 bg-green-600 hover:bg-green-500 rounded-lg font-bold text-lg transition-colors shadow-lg shadow-green-900/50"
              >
                Start Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'inspection' && (
        <div className="min-h-screen bg-slate-100 pb-20">
          
          {/* Header */}
          <header className="bg-slate-900 text-white p-4 sticky top-0 z-20 shadow-md flex justify-between items-center">
             <div>
               <h2 className="font-bold">{details.address || 'New Inspection'}</h2>
               <p className="text-xs text-slate-400">{details.unitType} • {details.bedrooms === 0 ? 'Studio' : `${details.bedrooms} Bed`} / {details.bathrooms} Bath</p>
             </div>
             <button onClick={() => setStep('summary')} className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 font-bold text-sm">
               Finish
             </button>
          </header>

          <div className="max-w-3xl mx-auto p-4 space-y-6">
            {sections.map(section => (
              <div key={section.id} className="bg-white rounded-xl shadow overflow-hidden">
                {/* Section Header - UNIFIED GREEN */}
                <div className="bg-green-600 text-white p-4 flex justify-between items-center">
                  <h3 className="font-bold text-lg">{section.title}</h3>
                </div>

                <div className="divide-y divide-slate-100">
                  {section.items.map(item => (
                    <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center">
                           <span className="font-medium text-slate-900">{item.id} {item.label}</span>
                           <Tooltip text={item.hqsGuidance} />
                           {item.is24Hour && (
                             <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded border border-red-200 flex items-center">
                               <ClockIcon /> <span className="ml-1">24 HR</span>
                             </span>
                           )}
                        </div>
                        <div className="flex space-x-1">
                          <button 
                            onClick={() => updateItem(section.id, item.id, { status: InspectionStatus.PASS, is24Hour: false })}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${item.status === 'PASS' ? 'bg-green-600 text-white scale-110 shadow-lg' : 'bg-slate-200 text-slate-400 hover:bg-green-100'}`}
                          >
                            P
                          </button>
                          <button 
                            onClick={() => updateItem(section.id, item.id, { status: InspectionStatus.FAIL })}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${item.status === 'FAIL' ? 'bg-red-600 text-white scale-110 shadow-lg' : 'bg-slate-200 text-slate-400 hover:bg-red-100'}`}
                          >
                            F
                          </button>
                          
                          {/* 24-HOUR TOGGLE BUTTON */}
                          <button 
                            onClick={() => updateItem(section.id, item.id, { is24Hour: !item.is24Hour })}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all font-bold text-[10px] ${item.is24Hour ? 'bg-red-900 text-white scale-110 shadow-lg border-2 border-red-500' : 'bg-slate-200 text-slate-400 hover:bg-red-100'}`}
                            title="Toggle 24-Hour Emergency Fail"
                          >
                            24H
                          </button>

                          <button 
                            onClick={() => updateItem(section.id, item.id, { status: InspectionStatus.INCONCLUSIVE })}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${item.status === 'INCONCLUSIVE' ? 'bg-amber-500 text-white scale-110' : 'bg-slate-200 text-slate-400 hover:bg-amber-100'}`}
                          >
                            I
                          </button>

                          <button 
                            onClick={() => updateItem(section.id, item.id, { status: InspectionStatus.NOT_APPLICABLE })}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all font-bold text-xs ${item.status === 'N/A' ? 'bg-slate-600 text-white scale-110' : 'bg-slate-200 text-slate-400 hover:bg-slate-300'}`}
                            title="Not Applicable"
                          >
                            N/A
                          </button>
                        </div>
                      </div>
                      
                      {/* Enhanced Input Area */}
                      <VoiceInput 
                         value={item.comment}
                         onChange={(val) => updateItem(section.id, item.id, { comment: val })}
                         onVoiceStart={() => handleVoiceCommand({sectionId: section.id, itemId: item.id, currentLabel: item.label})}
                         isListening={isListening && listeningTarget === item.id}
                         onMagicClick={() => handleMagicAnalysis(item.comment, {sectionId: section.id, itemId: item.id, currentLabel: item.label})}
                         onCameraClick={() => handleCameraClick({sectionId: section.id, itemId: item.id})}
                         photos={item.photos}
                      />
                    </div>
                  ))}
                </div>

                {/* Pass All Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                  <button 
                    onClick={() => handlePassSection(section.id)}
                    className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold shadow transition-colors flex items-center"
                  >
                    <CheckIcon /><span className="ml-2">Pass All</span>
                  </button>
                </div>

              </div>
            ))}

            {/* ADD ROOM BUTTONS */}
            <div className="flex justify-center gap-4 py-4">
               <button onClick={addBedroom} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg flex items-center font-medium">
                 <PlusIcon /> <span className="ml-2">Add Bedroom</span>
               </button>
               <button onClick={addBathroom} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg flex items-center font-medium">
                 <PlusIcon /> <span className="ml-2">Add Bathroom</span>
               </button>
            </div>

          </div>

          {/* Global Mic Button */}
          <div className="fixed bottom-6 right-6">
            <button 
              onClick={() => handleVoiceCommand()}
              className={`w-16 h-16 rounded-full shadow-2xl flex items-center justify-center text-2xl transition-all ${isListening && !listeningTarget ? 'bg-red-600 animate-pulse' : 'bg-blue-600 hover:bg-blue-500'} text-white`}
            >
               {isListening && !listeningTarget ? <i className="fas fa-stop"></i> : <i className="fas fa-microphone"></i>}
            </button>
          </div>
        </div>
      )}

      {step === 'summary' && (
        <div className="min-h-screen bg-slate-100 p-4">
          <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6 space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-800">Inspection Summary</h2>
              <p className="text-slate-500">{details.address}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
               <div className="p-3 bg-slate-50 rounded">
                 <span className="block text-slate-400 text-xs">PASSED ITEMS</span>
                 <span className="text-xl font-bold text-green-600">
                   {sections.reduce((acc, s) => acc + s.items.filter(i => i.status === 'PASS').length, 0)}
                 </span>
               </div>
               <div className="p-3 bg-slate-50 rounded">
                 <span className="block text-slate-400 text-xs">FAILED ITEMS</span>
                 <span className="text-xl font-bold text-red-600">
                   {sections.reduce((acc, s) => acc + s.items.filter(i => i.status === 'FAIL').length, 0)}
                 </span>
               </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Detailed General Inspection Notes</label>
              <VoiceInput 
                value={generalNotes}
                onChange={setGeneralNotes}
                onVoiceStart={() => handleVoiceCommand()}
                isListening={isListening && !listeningTarget}
                onCameraClick={() => handleCameraClick('general')}
                photos={generalPhotos}
              />
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setStep('inspection')}
                className="flex-1 py-3 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                Back to Edit
              </button>
              <button 
                onClick={generatePDF}
                className="flex-1 py-3 rounded-lg bg-green-600 text-white font-bold hover:bg-green-500 shadow flex items-center justify-center gap-2"
              >
                <PrintIcon /> Generate PDF Report
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}