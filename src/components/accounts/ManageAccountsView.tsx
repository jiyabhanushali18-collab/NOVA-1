import React from 'react';
import { NovaAccount } from '../../types';
import AccountCard from './AccountCard';
import { useI18n } from '../../i18n';

interface Props {
  accounts: NovaAccount[];
  activeUid?: string;
  onSwitch: (uid: string) => void;
  onRemove: (uid: string) => void;
}

export const ManageAccountsView: React.FC<Props> = ({ accounts, activeUid, onSwitch, onRemove }) => {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      {accounts.length === 0 && <div className="text-sm text-[#5E667A]">{t('accounts.noAccounts')}</div>}
      <div className="grid gap-2">
        {accounts.map((a) => (
          <AccountCard key={a.uid} account={a} active={a.uid === activeUid} onSwitch={onSwitch} onRemove={onRemove} />
        ))}
      </div>
    </div>
  );
};

export default ManageAccountsView;
