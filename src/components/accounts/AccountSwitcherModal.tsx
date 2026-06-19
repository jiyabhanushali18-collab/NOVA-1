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
  onSwitch: (uid: string) => void;
  onAdd: (acc: NovaAccount) => void;
  onRemove: (uid: string) => void;
}

export const AccountSwitcherModal: React.FC<Props> = ({ isOpen, onClose, accounts, activeUid, onSwitch, onAdd, onRemove }) => {
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
      <div className="relative w-full max-w-md mx-auto p-4 pb-6 bg-gradient-to-br from-purple-900/40 via-indigo-900/30 to-slate-900/20 rounded-t-3xl backdrop-blur-md border-t border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-white">Accounts</h3>
          <button onClick={onClose} className="text-white/80">Close</button>
        </div>

        {toast && <div className="mb-3 text-sm text-amber-300">{toast}</div>}

        {!showAdd ? (
          <>
            <ManageAccountsView accounts={accounts} activeUid={activeUid} onSwitch={onSwitch} onRemove={handleRemove} />

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setShowAdd(true)} disabled={accounts.length >= 5} className={`py-2 rounded ${accounts.length >= 5 ? 'bg-slate-600/30 text-slate-400' : 'bg-white text-black font-bold'}`}>
                Add Account
              </button>
              <button onClick={() => { accountService.setActiveLocalAccount(undefined); onSwitch(undefined as any); onClose(); }} className="py-2 rounded bg-red-600 text-white">Log Out</button>
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
