/**
 * Multi-account storage helpers — no Redux, no circular deps.
 * Accounts saved at @kuwai_accounts: [{ token, user }]
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ACCOUNTS_KEY = '@kuwai_accounts';

export async function loadAccounts() {
  const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveAccounts(accounts) {
  await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export async function upsertCurrentAccount(token, user) {
  const accounts = await loadAccounts();
  const idx = accounts.findIndex((a) => a.user?.phone === user?.phone);
  if (idx >= 0) accounts[idx] = { token, user };
  else accounts.unshift({ token, user });
  await saveAccounts(accounts);
}
