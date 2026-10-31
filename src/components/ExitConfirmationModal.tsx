import React from 'react';
import { useBackHandler } from '../services/backButtonService';

interface ExitConfirmationModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  isDarkMode?: boolean;
}

export const ExitConfirmationModal: React.FC<ExitConfirmationModalProps> = ({
  isOpen,
  onCancel,
  onConfirm,
  isDarkMode = true,
}) => {
  // If exit confirmation is open, pressing Android back cancels the exit
  useBackHandler('exit-confirmation-dialog', () => {
    onCancel();
    return true;
  }, 110, isOpen);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-modal-title"
      aria-describedby="exit-modal-desc"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 select-none"
    >
      <div
        className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl border transition-colors duration-200 animate-scale-up ${
          isDarkMode
            ? 'bg-slate-900 border-slate-800 text-white shadow-black/60'
            : 'bg-white border-[#E4DFF5] text-[#131426] shadow-xl shadow-[#553BE2]/10'
        }`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-rose-500 text-2xl font-bold">
              exit_to_app
            </span>
          </div>
          <div>
            <h3 id="exit-modal-title" className="text-lg font-black tracking-tight leading-tight">
              Exit NOVA
            </h3>
            <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'}`}>
              Application Confirmation
            </p>
          </div>
        </div>

        <p
          id="exit-modal-desc"
          className={`text-sm leading-relaxed mb-6 font-medium ${
            isDarkMode ? 'text-slate-200' : 'text-[#3E4756]'
          }`}
        >
          Are you sure you want to exit NOVA?
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer border ${
              isDarkMode
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                : 'bg-slate-100 hover:bg-slate-200 text-[#131426] border-slate-200'
            }`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 transition-all active:scale-95 cursor-pointer shadow-md shadow-rose-500/20"
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  );
};
