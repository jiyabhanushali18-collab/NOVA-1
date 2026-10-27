import React from 'react';
import { NovaAccount } from '../../types';
import { useI18n } from '../../i18n';

interface Props {
  account: NovaAccount;
  active?: boolean;
  onSwitch?: (uid: string) => void;
  onRemove?: (uid: string) => void;
}

export const AccountCard: React.FC<Props> = ({ account, active, onSwitch, onRemove }) => {
  const { t } = useI18n();
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl shadow-sm border ${active ? 'ring-2 ring-[#553BE2]/60 bg-[#F2EEFF] border-[#553BE2]/30' : 'bg-[#F2EEFF] border-[#E4DFF5]'}`}>
      <img src={account.profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(account.username)}&background=ECE7FF&color=553BE2&bold=true`} alt="avatar" className="w-12 h-12 rounded-full object-cover border border-[#E4DFF5]" />
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm text-[#131426] truncate">{account.username}</div>
        <div className="text-xs text-[#5E667A] truncate">{account.email}</div>
      </div>
      <div className="flex items-center gap-2">
        {active ? (
          <span className="text-xs text-[#553BE2] font-bold">{t('accounts.active')}</span>
        ) : (
          <button onClick={() => onSwitch?.(account.uid)} className="text-xs px-2.5 py-1 rounded-lg bg-[#553BE2] text-white font-semibold">{t('accounts.switch')}</button>
        )}
        <button onClick={() => onRemove?.(account.uid)} className="text-xs px-2.5 py-1 rounded-lg border border-[#E4DFF5] bg-white text-[#5E667A] hover:text-[#131426]">{t('accounts.remove')}</button>
      </div>
    </div>
  );
};

export default AccountCard;
