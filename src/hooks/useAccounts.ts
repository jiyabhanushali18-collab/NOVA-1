import { useEffect, useState } from 'react';
import { NovaAccount } from '../types';
import accountService from '../services/accountService';

export const useAccounts = () => {
  const [accounts, setAccounts] = useState<NovaAccount[]>(() => accountService.getLocalAccounts());

  useEffect(() => {
    accountService.saveLocalAccounts(accounts);
  }, [accounts]);

  const addAccount = (acc: NovaAccount) => {
    setAccounts((prev) => {
      const existing = prev.find((a) => a.uid === acc.uid);
      if (existing) return prev;
      const next = [acc, ...prev].slice(0, 5);
      return next;
    });
  };

  const removeAccount = (uid: string) => {
    setAccounts((prev) => prev.filter((a) => a.uid !== uid));
  };

  const replaceAccounts = (next: NovaAccount[]) => {
    setAccounts(next.slice(0, 5));
  };

  return { accounts, addAccount, removeAccount, replaceAccounts };
};

export default useAccounts;
