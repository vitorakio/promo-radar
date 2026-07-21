/**
 * Recorte do expo-notifications para o service worker.
 *
 * Na extensao o aviso sai por chrome.notifications: o notificationService desvia
 * antes de chegar aqui. O modulo existe porque o import e estatico e o pacote de
 * verdade depende do runtime nativo do Expo, ausente no navegador.
 */

export const setNotificationHandler = () => undefined;

export const setNotificationChannelAsync = async () => undefined;

export const getPermissionsAsync = async () => ({ status: "granted" as const });

export const requestPermissionsAsync = async () => ({ status: "granted" as const });

export const AndroidImportance = { MAX: 5 } as const;

export const AndroidNotificationPriority = { MAX: "max" } as const;

export const scheduleNotificationAsync = async () => "";
