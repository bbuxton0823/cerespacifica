import React, { useState } from 'react';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths,
    isToday
} from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface Event {
    id: string;
    title: string;
    date: Date;
    type: 'Annual' | 'Biennial' | 'Triennial' | 'Reinspection';
    color?: string;
}

interface CalendarProps {
    events?: Event[];
    onDateClick?: (date: Date) => void;
    onEventClick?: (event: Event) => void;
}

export const Calendar: React.FC<CalendarProps> = ({ events = [], onDateClick, onEventClick }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const goToToday = () => setCurrentMonth(new Date());

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60 bg-white/50">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-semibold text-slate-900 tracking-tight">
                        {format(currentMonth, 'MMMM yyyy')}
                    </h2>
                    <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                        <button onClick={prevMonth} className="p-1.5 hover:bg-white rounded-md transition-all text-slate-500 hover:text-slate-900 hover:shadow-sm">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button onClick={goToToday} className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900">Today</button>
                        <button onClick={nextMonth} className="p-1.5 hover:bg-white rounded-md transition-all text-slate-500 hover:text-slate-900 hover:shadow-sm">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                </div>

                {/* View Switcher (Mock) */}
                <div className="flex bg-slate-100 rounded-lg p-0.5 text-sm font-medium">
                    <button className="px-3 py-1 bg-white rounded-md shadow-sm text-slate-900">Month</button>
                    <button className="px-3 py-1 text-slate-500 hover:text-slate-900">Week</button>
                    <button className="px-3 py-1 text-slate-500 hover:text-slate-900">Day</button>
                </div>
            </div>

            {/* Days Header */}
            <div className="grid grid-cols-7 border-b border-slate-200/60 bg-slate-50/50">
                {weekDays.map(day => (
                    <div key={day} className="py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 flex-1 auto-rows-fr bg-slate-100 gap-px border-b border-slate-200">
                {days.map((day, dayIdx) => {
                    const dayEvents = events.filter(evt => isSameDay(evt.date, day));
                    const isSelectedMonth = isSameMonth(day, monthStart);
                    const isCurrentDay = isToday(day);

                    return (
                        <div
                            key={day.toString()}
                            onClick={() => onDateClick?.(day)}
                            className={cn(
                                "bg-white min-h-[120px] p-2 transition-colors hover:bg-slate-50 cursor-pointer relative group",
                                !isSelectedMonth && "bg-slate-50/30 text-slate-400"
                            )}
                        >
                            <div className="flex justify-between items-start">
                                <span className={cn(
                                    "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                                    isCurrentDay ? "bg-blue-500 text-white" : "text-slate-700",
                                    !isSelectedMonth && "text-slate-400"
                                )}>
                                    {format(day, 'd')}
                                </span>
                                {dayEvents.length > 0 && (
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                                        {dayEvents.length}
                                    </span>
                                )}
                            </div>

                            <div className="mt-2 space-y-1">
                                {dayEvents.map(event => (
                                    <div
                                        key={event.id}
                                        onClick={(e) => { e.stopPropagation(); onEventClick?.(event); }}
                                        className={cn(
                                            "text-xs px-2 py-1 rounded-md truncate shadow-sm border border-transparent transition-all hover:scale-[1.02]",
                                            !event.color && event.type === 'Annual' && "bg-blue-50 text-blue-700 border-blue-100",
                                            !event.color && event.type === 'Biennial' && "bg-indigo-50 text-indigo-700 border-indigo-100",
                                            !event.color && event.type === 'Triennial' && "bg-purple-50 text-purple-700 border-purple-100",
                                            !event.color && event.type === 'Reinspection' && "bg-amber-50 text-amber-700 border-amber-100"
                                        )}
                                        style={event.color ? { backgroundColor: `${event.color}20`, color: event.color, borderColor: `${event.color}40` } : {}}
                                    >
                                        <span className="font-medium mr-1">•</span>
                                        {event.title}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
