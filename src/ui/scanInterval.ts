import { ScanIntervalMinutes } from "../types";

export const scanIntervals: ScanIntervalMinutes[] = [5, 10, 15, 30, 60];

export const formatInterval = (value: ScanIntervalMinutes) => (value === 60 ? "1 hora" : `${value} min`);

/** Contagem regressiva em mm:ss para o proximo ciclo automatico. */
export const formatCountdown = (msRemaining: number) => {
  const totalSeconds = Math.max(0, Math.round(msRemaining / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};
