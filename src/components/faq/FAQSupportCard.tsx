import React, { useState } from 'react';
import { HelpCircle, AlertCircle, Home, MessageSquare, Send, CheckCircle2, X } from 'lucide-react';
import { ScreenId } from '../../types';

interface FAQSupportCardProps {
  onNavigate: (screen: ScreenId) => void;
  isDarkMode?: boolean;
}

export const FAQSupportCard: React.FC<FAQSupportCardProps> = ({
  onNavigate,
  isDarkMode = false
}) => {
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportIssue, setReportIssue] = useState('');
  const [reportCategory, setReportCategory] = useState('bug');
  const [reportSubmitted, setReportSubmitted] = useState(false);

  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportIssue.trim()) return;

    try {
      const existingReports = JSON.parse(localStorage.getItem('nova_problem_reports') || '[]');
      existingReports.push({
        id: `report-${Date.now()}`,
        category: reportCategory,
        description: reportIssue.trim(),
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
      });
      localStorage.setItem('nova_problem_reports', JSON.stringify(existingReports));
    } catch {}

    setReportSubmitted(true);
    setTimeout(() => {
      setReportSubmitted(false);
      setReportIssue('');
      setIsReportModalOpen(false);
    }, 1800);
  };

  return (
    <>
      <div
        className={`rounded-3xl p-5 border transition-all duration-200 relative overflow-hidden ${
          isDarkMode
            ? 'bg-slate-900/90 border-slate-800 shadow-[0_8px_30px_rgba(0,0,0,0.5)]'
            : 'bg-white border-[#E4DFF5] shadow-[0_8px_30px_rgba(85,59,226,0.06)]'
        }`}
      >
        {/* Glow Accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#553BE2]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#553BE2]/10 flex items-center justify-center text-[#553BE2] shrink-0">
              <HelpCircle className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3
                className={`text-sm font-black tracking-tight ${
                  isDarkMode ? 'text-white' : 'text-[#131426]'
                }`}
              >
                Still need help?
              </h3>
              <p
                className={`text-[11px] font-medium leading-tight ${
                  isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'
                }`}
              >
                We&apos;re here to help you get the most out of NOVA.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            {/* 1. Contact Support */}
            <button
              type="button"
              onClick={() => setIsContactModalOpen(true)}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
                isDarkMode
                  ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white'
                  : 'bg-[#F7F5FC] border-[#E4DFF5] text-[#131426] hover:bg-[#F2EEFF] hover:text-[#553BE2]'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#553BE2]" />
              <span>Contact Support</span>
            </button>

            {/* 2. Report a Problem */}
            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
                isDarkMode
                  ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white'
                  : 'bg-[#F7F5FC] border-[#E4DFF5] text-[#131426] hover:bg-[#F2EEFF] hover:text-[#553BE2]'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              <span>Report a Problem</span>
            </button>

            {/* 3. Return to Home */}
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold bg-[#553BE2] hover:bg-[#472FC9] text-white shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Return to Home</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal 1: Contact Support Info Dialog */}
      {isContactModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-support-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
        >
          <div
            className={`w-full max-w-sm rounded-3xl p-5 border space-y-4 shadow-2xl ${
              isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-[#E4DFF5] text-[#131426]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#553BE2]/10 flex items-center justify-center text-[#553BE2]">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <h4 id="contact-support-title" className="text-sm font-black">
                  Contact Support
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsContactModalOpen(false)}
                className={`p-1.5 rounded-xl transition-colors ${
                  isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              className={`rounded-2xl p-3.5 border text-xs leading-relaxed space-y-2 ${
                isDarkMode ? 'bg-slate-800/60 border-slate-700/80 text-slate-300' : 'bg-[#F7F5FC] border-[#E4DFF5] text-[#5E667A]'
              }`}
            >
              <p>
                <strong className="text-[#553BE2]">Configuration Notice:</strong> Direct operator customer support email and hotline configurations are currently marked as{' '}
                <em>[Pending Confirmation - Insert Verified Support Email]</em> in NOVA&apos;s legal documents pending production deployment verification.
              </p>
              <p>
                In the meantime, our intelligent <strong>Stylist AI</strong> is available 24/7 inside the app to assist with fit questions, outfit coordination, and product navigation.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsContactModalOpen(false);
                  onNavigate('chat');
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#553BE2] hover:bg-[#472FC9] text-white text-xs font-bold transition-all"
              >
                Chat with Stylist AI
              </button>
              <button
                type="button"
                onClick={() => setIsContactModalOpen(false)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                  isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-[#E4DFF5] text-[#5E667A] hover:bg-slate-100'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Report a Problem Dialog */}
      {isReportModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-problem-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
        >
          <div
            className={`w-full max-w-sm rounded-3xl p-5 border space-y-4 shadow-2xl ${
              isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-[#E4DFF5] text-[#131426]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <h4 id="report-problem-title" className="text-sm font-black">
                  Report a Problem
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className={`p-1.5 rounded-xl transition-colors ${
                  isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {reportSubmitted ? (
              <div className="py-6 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h5 className="text-xs font-bold text-emerald-500">Problem Reported</h5>
                <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'}`}>
                  Thank you! Your feedback has been saved to device logs for engineering analysis.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="space-y-3">
                <div className="space-y-1">
                  <label className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-300' : 'text-[#131426]'}`}>
                    Issue Type
                  </label>
                  <select
                    value={reportCategory}
                    onChange={(e) => setReportCategory(e.target.value)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-medium border focus:outline-none focus:ring-1 focus:ring-[#553BE2] ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-[#E4DFF5] text-[#131426]'
                    }`}
                  >
                    <option value="bug">Software Bug / Glitch</option>
                    <option value="tryon">AR Try-On Fitting Issue</option>
                    <option value="stylist">Stylist AI Issue</option>
                    <option value="account">Account & Sign-In</option>
                    <option value="suggestion">Feature Suggestion</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-300' : 'text-[#131426]'}`}>
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={reportIssue}
                    onChange={(e) => setReportIssue(e.target.value)}
                    placeholder="Describe what happened or steps to reproduce..."
                    className={`w-full py-2 px-3 rounded-xl text-xs font-medium border focus:outline-none focus:ring-1 focus:ring-[#553BE2] resize-none ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-[#E4DFF5] text-[#131426] placeholder:text-slate-400'
                    }`}
                    required
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#553BE2] hover:bg-[#472FC9] text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Report</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsReportModalOpen(false)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                      isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-[#E4DFF5] text-[#5E667A] hover:bg-slate-100'
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};
