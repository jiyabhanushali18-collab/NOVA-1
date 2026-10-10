import React, { useState } from 'react';
import { NovaAccount } from '../../types';
import AddAccountView from './AddAccountView';
import ManageAccountsView from './ManageAccountsView';
import accountService from '../../services/accountService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  accounts: NovaAccount[];
  activeUid?: string;
  onSwitch: (uid?: string) => void;
  onAdd: (acc: NovaAccount) => void;
  onRemove: (uid: string) => void;
  onLogout: () => void;
}

export const AccountSwitcherModal: React.FC<Props> = ({ isOpen, onClose, accounts, activeUid, onSwitch, onAdd, onRemove, onLogout }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAdd = (acc: NovaAccount) => {
    const existing = accounts.find((a) => a.uid === acc.uid);
    if (!existing) {
      if (accounts.length >= 5) {
        setToast('You can manage up to 5 NOVA accounts on one device.');
        return;
      }
      onAdd(acc);
      accountService.saveLocalAccounts([acc, ...accounts].slice(0, 5));
      // clear any previous recent activity for this uid so a new account starts empty
      try { localStorage.removeItem(`recent_activity_${acc.uid}`); } catch {}
      accountService.setActiveLocalAccount(acc.uid);
      onSwitch(acc.uid);
    } else {
      // existing account: set active
      onSwitch(acc.uid);
    }
    setShowAdd(false);
    setTimeout(() => onClose(), 250);
  };

  const handleRemove = (uid: string) => {
    onRemove(uid);
    const next = accounts.filter((a) => a.uid !== uid);
    accountService.saveLocalAccounts(next);
    if (activeUid === uid) {
      const first = next[0];
      accountService.setActiveLocalAccount(first?.uid);
      if (first) onSwitch(first.uid);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md mx-auto p-4 pb-6 bg-white rounded-t-3xl border-t border-[#E8E5F0] shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-[#17182B]">Accounts</h3>
          <button onClick={onClose} className="text-[#697386] hover:text-[#17182B] font-semibold text-sm">Close</button>
        </div>

        {toast && <div className="mb-3 text-sm text-amber-700 bg-amber-50 p-2 rounded-xl border border-amber-200">{toast}</div>}

        {!showAdd ? (
          <>
            <ManageAccountsView accounts={accounts} activeUid={activeUid} onSwitch={onSwitch} onRemove={handleRemove} />

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setShowAdd(true)} disabled={accounts.length >= 5} className={`py-2 rounded-xl ${accounts.length >= 5 ? 'bg-[#EAE5FF] text-[#9AA3B5]' : 'bg-[#5B45E7] text-white font-bold hover:opacity-95 transition-opacity'}`}>
                Add Account
              </button>
              <button
                onClick={() => {
                  accountService.setActiveLocalAccount(undefined);
                  onSwitch(undefined);
                  onClose();
                  onLogout();
                }}
                className="py-2 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors"
              >
                Log Out
              </button>
            </div>
          </>
        ) : (
          <AddAccountView onAdded={handleAdd} />
        )}
      </div>
    </div>
  );
};

export default AccountSwitcherModal;
