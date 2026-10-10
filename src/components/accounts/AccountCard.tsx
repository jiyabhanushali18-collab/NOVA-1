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
    <div className={`flex items-center gap-3 p-3 rounded-xl shadow-sm border ${active ? 'ring-2 ring-[#5B45E7]/60 bg-[#F0EDFF] border-[#5B45E7]/30' : 'bg-[#F4F1FF] border-[#E8E5F0]'}`}>
      <img src={account.profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(account.username)}&background=EAE5FF&color=5B45E7&bold=true`} alt="avatar" className="w-12 h-12 rounded-full object-cover border border-[#E8E5F0]" />
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm text-[#17182B] truncate">{account.username}</div>
        <div className="text-xs text-[#697386] truncate">{account.email}</div>
      </div>
      <div className="flex items-center gap-2">
        {active ? (
          <span className="text-xs text-[#5B45E7] font-bold">Active</span>
        ) : (
          <button onClick={() => onSwitch?.(account.uid)} className="text-xs px-2.5 py-1 rounded-lg bg-[#5B45E7] text-white font-semibold">Switch</button>
        )}
        <button onClick={() => onRemove?.(account.uid)} className="text-xs px-2.5 py-1 rounded-lg border border-[#E8E5F0] bg-white text-[#697386] hover:text-[#17182B]">Remove</button>
      </div>
    </div>
  );
};

export default AccountCard;
