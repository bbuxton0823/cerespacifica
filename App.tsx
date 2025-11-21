import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';

const InspectionApp = lazy(() => import('@/frontend/src/pages/InspectionApp'));
const SchedulingPage = lazy(() => import('@/frontend/src/pages/SchedulingPage').then(module => ({ default: module.SchedulingPage })));
const SettingsPage = lazy(() => import('@/frontend/src/pages/SettingsPage').then(module => ({ default: module.SettingsPage })));

const NavLink = ({ to, icon, label }: { to: string, icon: string, label: string }) => {
    const location = useLocation();
    const isActive = location.pathname === to;

    return (
        <Link
            to={to}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${isActive ? 'text-blue-600 bg-blue-50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
        >
            <i className={`fas ${icon} text-xl`}></i>
            <span className="text-[10px] font-medium">{label}</span>
        </Link>
    );
};

const Layout = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className="h-screen flex flex-col bg-slate-50">
            <div className="flex-1 overflow-hidden relative">
                {children}
            </div>

            {/* Bottom Navigation Bar */}
            <nav className="bg-white border-t border-slate-200 px-6 py-2 flex justify-around items-center z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <NavLink to="/" icon="fa-clipboard-check" label="Inspection" />
                <NavLink to="/scheduling" icon="fa-calendar-alt" label="Scheduling" />
                <NavLink to="/history" icon="fa-history" label="History" />
                <NavLink to="/settings" icon="fa-cog" label="Settings" />
            </nav>
        </div>
    );
};

export default function App() {
    return (
        <Router>
            <Layout>
                <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-slate-400">Loading interface…</div>}>
                    <Routes>
                        <Route path="/" element={<InspectionApp />} />
                        <Route path="/scheduling" element={<SchedulingPage />} />
                        <Route path="/history" element={<div className="p-10 text-center text-slate-500">History Coming Soon</div>} />
                        <Route path="/settings" element={<SettingsPage />} />
                    </Routes>
                </Suspense>
            </Layout>
        </Router>
    );
}
