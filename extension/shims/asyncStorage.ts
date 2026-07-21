/**
 * AsyncStorage sobre chrome.storage.local.
 *
 * O popup e o service worker precisam ler e escrever o mesmo estado, e o
 * AsyncStorage do react-native-web guarda tudo no localStorage, que nao existe
 * dentro de um service worker. As duas builds da extensao (a interface, pelo
 * Metro, e o worker, pelo esbuild) trocam o modulo original por este.
 *
 * Implementa apenas a superficie que o app usa; o resto do AsyncStorage nao tem
 * chamador aqui e ficaria sem cobertura.
 */

const area = chrome.storage.local;

const AsyncStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const stored = await area.get(key);
    const value = stored[key];

    return typeof value === "string" ? value : null;
  },

  setItem: async (key: string, value: string): Promise<void> => {
    await area.set({ [key]: value });
  },

  removeItem: async (key: string): Promise<void> => {
    await area.remove(key);
  },

  clear: async (): Promise<void> => {
    await area.clear();
  },

  getAllKeys: async (): Promise<string[]> => Object.keys(await area.get(null))
};

export default AsyncStorage;
