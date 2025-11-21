import React, { useState, useEffect } from 'react';
import { Calendar } from '../components/Calendar';
import { addDays, format } from 'date-fns';

// Mock data type
interface InspectionEvent {
    id: string;
    title: string;
    date: Date;
    type: 'Annual' | 'Biennial' | 'Triennial' | 'Reinspection';
}

export const SchedulingPage: React.FC = () => {
    const [events, setEvents] = useState<InspectionEvent[]>([]);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newEvent, setNewEvent] = useState({
        unit: '',
        type: 'Annual',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '10:00'
    });

    // Mock fetching data
    useEffect(() => {
        // Simulate API call
        const mockEvents: InspectionEvent[] = [
            { id: '1', title: 'Unit 101 - Annual', date: new Date(), type: 'Annual' },
            { id: '2', title: 'Unit 204 - Re-inspection', date: addDays(new Date(), 2), type: 'Reinspection' },
            { id: '3', title: 'Unit 305 - Biennial', date: addDays(new Date(), 5), type: 'Biennial' },
        ];
        setEvents(mockEvents);
    }, []);

    const handleDateClick = (date: Date) => {
        setSelectedDate(date);
        setNewEvent(prev => ({ ...prev, date: format(date, 'yyyy-MM-dd') }));
        setIsModalOpen(true);
    };

    const handleEventClick = (event: InspectionEvent) => {
        console.log('Event clicked:', event);
        // Open event details logic here
    };

    const handleCreateInspection = (e: React.FormEvent) => {
        e.preventDefault();
        const dateParts = newEvent.date.split('-');
        const timeParts = newEvent.time.split(':');
        const date = new Date(
            parseInt(dateParts[0]),
            parseInt(dateParts[1]) - 1,
            parseInt(dateParts[2]),
            parseInt(timeParts[0]),
            parseInt(timeParts[1])
        );

        const newInspection: InspectionEvent = {
            id: Math.random().toString(36).substr(2, 9),
            title: `${newEvent.unit} - ${newEvent.type}`,
            date: date,
            type: newEvent.type as any
        };

        setEvents([...events, newInspection]);
        setIsModalOpen(false);
        setNewEvent({ unit: '', type: 'Annual', date: format(new Date(), 'yyyy-MM-dd'), time: '10:00' });
    };

    return (
        <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
            {/* Top Bar */}
            <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex justify-between items-center z-10">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Scheduling</h1>
                    <p className="text-sm text-slate-500">Manage inspection appointments and compliance deadlines</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-all">
                        Sync Calendar
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm shadow-blue-200 transition-all flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        New Inspection
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-6 overflow-hidden flex gap-6 relative">
                {/* Sidebar (Filters/Stats) */}
                <aside className="w-80 flex-shrink-0 flex flex-col gap-6">
                    {/* Stats Card */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                        <h3 className="text-sm font-semibold text-slate-900 mb-4">Overview</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-500">Pending</span>
                                <span className="text-sm font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">12</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-500">Scheduled</span>
                                <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{events.length}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-500">Completed</span>
                                <span className="text-sm font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">128</span>
                            </div>
                        </div>
                    </div>

                    {/* Upcoming List */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex-1 overflow-hidden flex flex-col">
                        <h3 className="text-sm font-semibold text-slate-900 mb-4">Upcoming Inspections</h3>
                        <div className="overflow-y-auto flex-1 pr-2 space-y-3 no-scrollbar">
                            {events.sort((a, b) => a.date.getTime() - b.date.getTime()).map(event => (
                                <div key={event.id} className="group p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all cursor-pointer">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-semibold text-slate-400 uppercase">{format(event.date, 'MMM d')}</span>
                                        <span className={`w-2 h-2 rounded-full ${event.type === 'Annual' ? 'bg-blue-500' :
                                            event.type === 'Reinspection' ? 'bg-amber-500' : 'bg-indigo-500'
                                            }`} />
                                    </div>
                                    <h4 className="text-sm font-medium text-slate-900 group-hover:text-blue-700">{event.title}</h4>
                                    <p className="text-xs text-slate-500 mt-1">{format(event.date, 'h:mm a')} - {format(addDays(event.date, 0), 'h:mm a')}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* Calendar Area */}
                <div className="flex-1 h-full">
                    <Calendar
                        events={events}
                        onDateClick={handleDateClick}
                        onEventClick={handleEventClick}
                    />
                </div>

                {/* Modal Overlay */}
                {isModalOpen && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in border border-slate-200">
                            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <h3 className="text-lg font-bold text-slate-900">Schedule Inspection</h3>
                                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <form onSubmit={handleCreateInspection} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Unit Address / ID</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Unit 402"
                                        value={newEvent.unit}
                                        onChange={e => setNewEvent({ ...newEvent, unit: e.target.value })}
                                        className="w-full p-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                                        <input
                                            type="date"
                                            required
                                            value={newEvent.date}
                                            onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                                            className="w-full p-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Time</label>
                                        <input
                                            type="time"
                                            required
                                            value={newEvent.time}
                                            onChange={e => setNewEvent({ ...newEvent, time: e.target.value })}
                                            className="w-full p-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Inspection Type</label>
                                    <select
                                        value={newEvent.type}
                                        onChange={e => setNewEvent({ ...newEvent, type: e.target.value })}
                                        className="w-full p-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                    >
                                        <option value="Annual">Annual</option>
                                        <option value="Biennial">Biennial</option>
                                        <option value="Triennial">Triennial</option>
                                        <option value="Reinspection">Re-inspection</option>
                                    </select>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
                                    >
                                        Schedule
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};
