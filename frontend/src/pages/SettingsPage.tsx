import React, { useState } from 'react';

export const SettingsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'appearance' | 'about'>('profile');

    // Mock State
    const [notifications, setNotifications] = useState({
        email: true,
        sms: false,
        push: true,
        weeklyDigest: true
    });

    const [profile, setProfile] = useState({
        name: 'Inspector Gadget',
        email: 'inspector@cerespacifica.com',
        role: 'Senior Inspector',
        agency: 'Ceres Pacifica PHA'
    });

    return (
        <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 z-10">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Settings</h1>
                <p className="text-sm text-slate-500">Manage your account preferences and application settings</p>
            </header>

            <main className="flex-1 overflow-hidden flex">
                {/* Sidebar Navigation */}
                <aside className="w-64 border-r border-slate-200 bg-white flex flex-col">
                    <nav className="p-4 space-y-1">
                        <button
                            onClick={() => setActiveTab('profile')}
                            className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'profile' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <i className="fas fa-user w-5 text-center"></i> Profile
                        </button>
                        <button
                            onClick={() => setActiveTab('notifications')}
                            className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'notifications' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <i className="fas fa-bell w-5 text-center"></i> Notifications
                        </button>
                        <button
                            onClick={() => setActiveTab('appearance')}
                            className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'appearance' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <i className="fas fa-paint-brush w-5 text-center"></i> Appearance
                        </button>
                        <button
                            onClick={() => setActiveTab('about')}
                            className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'about' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <i className="fas fa-info-circle w-5 text-center"></i> About
                        </button>
                    </nav>
                </aside>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-2xl mx-auto">

                        {/* PROFILE TAB */}
                        {activeTab === 'profile' && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Personal Information</h2>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center text-2xl text-slate-500">
                                                <i className="fas fa-user"></i>
                                            </div>
                                            <button className="text-sm font-medium text-blue-600 hover:text-blue-700">Change Avatar</button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Full Name</label>
                                                <input
                                                    type="text"
                                                    value={profile.name}
                                                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                                                    className="w-full p-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Email Address</label>
                                                <input
                                                    type="email"
                                                    value={profile.email}
                                                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                                                    className="w-full p-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Role</label>
                                            <input
                                                type="text"
                                                value={profile.role}
                                                readOnly
                                                className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 text-sm cursor-not-allowed"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Agency Details</h2>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Agency Name</label>
                                        <input
                                            type="text"
                                            value={profile.agency}
                                            readOnly
                                            className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 text-sm cursor-not-allowed"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* NOTIFICATIONS TAB */}
                        {activeTab === 'notifications' && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Notification Preferences</h2>
                                    <div className="space-y-4">
                                        {[
                                            { id: 'email', label: 'Email Notifications', desc: 'Receive inspection assignments and updates via email.' },
                                            { id: 'push', label: 'Push Notifications', desc: 'Receive real-time alerts on your device.' },
                                            { id: 'sms', label: 'SMS Alerts', desc: 'Get text messages for urgent compliance deadlines.' },
                                            { id: 'weeklyDigest', label: 'Weekly Digest', desc: 'A summary of your inspection activities sent every Monday.' },
                                        ].map((item) => (
                                            <div key={item.id} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                                                <div>
                                                    <h3 className="text-sm font-medium text-slate-900">{item.label}</h3>
                                                    <p className="text-xs text-slate-500">{item.desc}</p>
                                                </div>
                                                <button
                                                    onClick={() => setNotifications({ ...notifications, [item.id]: !notifications[item.id as keyof typeof notifications] })}
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifications[item.id as keyof typeof notifications] ? 'bg-blue-600' : 'bg-slate-200'}`}
                                                >
                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notifications[item.id as keyof typeof notifications] ? 'translate-x-6' : 'translate-x-1'}`} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* APPEARANCE TAB */}
                        {activeTab === 'appearance' && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Theme</h2>
                                    <div className="grid grid-cols-3 gap-4">
                                        <button className="p-4 rounded-xl border-2 border-blue-500 bg-slate-50 flex flex-col items-center gap-2">
                                            <div className="w-full h-20 bg-white rounded-lg border border-slate-200 shadow-sm"></div>
                                            <span className="text-sm font-medium text-blue-700">Light</span>
                                        </button>
                                        <button className="p-4 rounded-xl border-2 border-transparent hover:border-slate-300 bg-slate-900 flex flex-col items-center gap-2">
                                            <div className="w-full h-20 bg-slate-800 rounded-lg border border-slate-700 shadow-sm"></div>
                                            <span className="text-sm font-medium text-slate-300">Dark</span>
                                        </button>
                                        <button className="p-4 rounded-xl border-2 border-transparent hover:border-slate-300 bg-slate-100 flex flex-col items-center gap-2">
                                            <div className="w-full h-20 bg-gradient-to-br from-white to-slate-200 rounded-lg border border-slate-200 shadow-sm"></div>
                                            <span className="text-sm font-medium text-slate-600">System</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ABOUT TAB */}
                        {activeTab === 'about' && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 text-center">
                                    <div className="w-20 h-20 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center text-white text-3xl mb-4 shadow-lg shadow-blue-200">
                                        <i className="fas fa-home"></i>
                                    </div>
                                    <h2 className="text-xl font-bold text-slate-900">Ceres Pacifica HQS</h2>
                                    <p className="text-sm text-slate-500 mb-6">Version 1.0.0 (Beta)</p>

                                    <div className="text-left space-y-4 border-t border-slate-100 pt-6">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">Build Date</span>
                                            <span className="font-medium text-slate-900">Nov 20, 2025</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">Environment</span>
                                            <span className="font-medium text-slate-900">Production</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">Support</span>
                                            <a href="#" className="font-medium text-blue-600 hover:underline">support@cerespacifica.com</a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </main>
        </div>
    );
};
