import { useEffect, useState } from 'react';
import { NovaAccount } from '../types';
import accountService from '../services/accountService';

export const useActiveAccount = (opts?: { onAccountSwitched?: (acc?: NovaAccount) => void }) => {
  const [activeUid, setActiveUid] = useState<string | undefined>(() => accountService.getActiveLocalAccount());
  const [activeAccount, setActiveAccount] = useState<NovaAccount | undefined>(() => {
    const list = accountService.getLocalAccounts();
    return list.find((a) => a.uid === accountService.getActiveLocalAccount());
  });

  useEffect(() => {
    accountService.setActiveLocalAccount(activeUid);
  }, [activeUid]);

  useEffect(() => {
    if (!activeUid) {
      setActiveAccount(undefined);
      opts?.onAccountSwitched?.(undefined);
      return;
    }
    const list = accountService.getLocalAccounts();
    const local = list.find((a) => a.uid === activeUid);
    if (local) {
      setActiveAccount(local);
      opts?.onAccountSwitched?.(local);
      return;
    }

    // fetch profile from firebase as fallback
    (async () => {
      const profile = await accountService.fetchProfileFromFirebase(activeUid);
      if (profile) {
        const acc: NovaAccount = {
          uid: activeUid,
          username: (profile.username as string) || (profile.email as string) || activeUid,
          email: (profile.email as string) || '',
          name: profile.name as string | undefined,
          profilePhoto: profile.profilePhoto as string | undefined,
          createdAt: profile.createdAt ? Number(profile.createdAt) : Date.now()
        };
        setActiveAccount(acc);
        opts?.onAccountSwitched?.(acc);
      } else {
        setActiveAccount(undefined);
        opts?.onAccountSwitched?.(undefined);
      }
    })();
  }, [activeUid]);

  const setActiveAccountUid = (uid?: string) => {
    setActiveUid(uid);
  };

  return { activeUid, activeAccount, setActiveAccountUid };
};

export default useActiveAccount;
