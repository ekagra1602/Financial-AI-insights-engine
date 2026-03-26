import React, { useState, useEffect, useRef } from 'react';
import { X, Mail, CheckCircle, AlertCircle, Bell, Loader2 } from 'lucide-react';
import {
    getAccountSettings,
    saveEmail,
    confirmEmail,
    toggleEmailNotifications,
    AccountSettings,
} from '../services/api';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

const AccountModal: React.FC<Props> = ({ isOpen, onClose }) => {
    const [settings, setSettings] = useState<AccountSettings | null>(null);
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            loadSettings();
        }
    }, [isOpen]);

    // Close on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClick);
        }
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isOpen, onClose]);

    const loadSettings = async () => {
        try {
            const data = await getAccountSettings();
            setSettings(data);
            setEmail(data.email || '');
            setMessage(null);
            setCode('');
        } catch {
            console.error('Failed to load settings');
        }
    };

    const handleSaveEmail = async () => {
        if (!email.trim() || !email.includes('@')) {
            setMessage({ text: 'Please enter a valid email address', type: 'error' });
            return;
        }
        setLoading(true);
        try {
            await saveEmail(email.trim());
            setMessage({ text: 'Confirmation code sent! Check your inbox.', type: 'success' });
            await loadSettings();
        } catch {
            setMessage({ text: 'Failed to save email', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (code.length !== 6) {
            setMessage({ text: 'Please enter the 6-digit code', type: 'error' });
            return;
        }
        setLoading(true);
        try {
            const result = await confirmEmail(code);
            if (result.confirmed) {
                setMessage({ text: 'Email confirmed! You can now enable notifications.', type: 'success' });
                await loadSettings();
            } else {
                setMessage({ text: 'Invalid code. Please try again.', type: 'error' });
            }
        } catch {
            setMessage({ text: 'Confirmation failed', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleToggleNotifications = async () => {
        if (!settings) return;
        const newVal = !settings.email_notifications_enabled;
        setLoading(true);
        try {
            await toggleEmailNotifications(newVal);
            await loadSettings();
            setMessage({
                text: newVal ? 'Email notifications enabled!' : 'Email notifications disabled',
                type: 'success',
            });
        } catch {
            setMessage({ text: 'Failed to update', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-10 md:pt-20 px-3 md:px-0"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
            <div ref={modalRef}
                className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <h2 className="text-lg font-bold text-text-primary">Account Settings</h2>
                    <button onClick={onClose}
                        className="p-1 rounded-lg hover:bg-background transition-colors text-text-secondary hover:text-text-primary">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5">
                    {/* Status message */}
                    {message && (
                        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${message.type === 'success'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                            {message.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                            {message.text}
                        </div>
                    )}

                    {/* Email Input Section */}
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                            <Mail className="w-4 h-4 inline mr-1.5 mb-0.5" />
                            Email Address
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="your@email.com"
                                className="flex-1 bg-background border border-border rounded-lg px-4 py-2.5 text-text-primary text-sm focus:outline-none focus:border-primary transition-colors"
                            />
                            <button
                                onClick={handleSaveEmail}
                                disabled={loading}
                                className="px-4 py-2.5 bg-primary hover:bg-primary/80 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                {settings?.email_confirmed && email === settings.email ? 'Resend' : 'Save'}
                            </button>
                        </div>
                        {settings?.email_confirmed && email === settings.email && (
                            <div className="mt-2 flex items-center gap-1.5 text-emerald-400 text-xs">
                                <CheckCircle className="w-3.5 h-3.5" /> Email confirmed
                            </div>
                        )}
                    </div>

                    {/* Confirmation Code Section */}
                    {settings?.email && !settings.email_confirmed && (
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Confirmation Code
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="6-digit code"
                                    maxLength={6}
                                    className="flex-1 bg-background border border-border rounded-lg px-4 py-2.5 text-text-primary text-sm text-center tracking-[0.4em] font-mono focus:outline-none focus:border-primary transition-colors"
                                />
                                <button
                                    onClick={handleConfirm}
                                    disabled={loading || code.length !== 6}
                                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                    Confirm
                                </button>
                            </div>
                            <p className="mt-2 text-xs text-text-secondary">
                                Check your email for the 6-digit confirmation code.
                            </p>
                        </div>
                    )}

                    {/* Email Notifications Toggle */}
                    {settings?.email_confirmed && (
                        <div className="flex items-center justify-between p-4 bg-background rounded-xl border border-border">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${settings.email_notifications_enabled ? 'bg-emerald-500/15' : 'bg-background'}`}>
                                    <Bell className={`w-5 h-5 ${settings.email_notifications_enabled ? 'text-emerald-400' : 'text-text-secondary'}`} />
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-text-primary">Email Notifications</div>
                                    <div className="text-xs text-text-secondary">Receive alerts via email</div>
                                </div>
                            </div>
                            <button
                                onClick={handleToggleNotifications}
                                disabled={loading}
                                className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${settings.email_notifications_enabled ? 'bg-emerald-500' : 'bg-border'
                                    }`}
                            >
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 ${settings.email_notifications_enabled ? 'translate-x-6' : 'translate-x-0'
                                    }`} />
                            </button>
                        </div>
                    )}

                    {/* Info */}
                    <p className="text-xs text-text-secondary leading-relaxed">
                        When enabled, you'll receive email alerts for price movements, morning gaps, momentum shifts, and news briefings for your watchlist stocks.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AccountModal;
