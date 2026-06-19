import React from 'react';
import { NovaAccount } from '../../types';

interface Props {
  account: NovaAccount;
  active?: boolean;
  onSwitch?: (uid: string) => void;
  onRemove?: (uid: string) => void;
}

export const AccountCard: React.FC<Props> = ({ account, active, onSwitch, onRemove }) => {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl shadow-sm ${active ? 'ring-2 ring-purple-500/60 bg-gradient-to-r from-purple-700/5 to-indigo-700/5' : 'bg-white/60'}`}>
      <img src={account.profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(account.username)}`} alt="avatar" className="w-12 h-12 rounded-full object-cover border" />
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm truncate">{account.username}</div>
        <div className="text-xs text-slate-500 truncate">{account.email}</div>
      </div>
      <div className="flex items-center gap-2">
        {active ? (
          <span className="text-xs text-purple-600 font-bold">Active</span>
        ) : (
          <button onClick={() => onSwitch?.(account.uid)} className="text-xs px-2 py-1 rounded bg-purple-600 text-white">Switch</button>
        )}
        <button onClick={() => onRemove?.(account.uid)} className="text-xs px-2 py-1 rounded border">Remove</button>
      </div>
    </div>
  );
};

export default AccountCard;
