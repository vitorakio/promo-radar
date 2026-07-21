const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Tempo decorrido em linguagem curta ("ha 3h", "ha 2 dias"). Devolve undefined
 * para datas invalidas ou no futuro, para nao exibir informacao sem sentido.
 */
export const formatElapsed = (isoDate: string | undefined, now = Date.now()): string | undefined => {
  if (!isoDate) {
    return undefined;
  }

  const timestamp = Date.parse(isoDate);
  if (Number.isNaN(timestamp)) {
    return undefined;
  }

  const elapsed = now - timestamp;
  // Pequenas diferencas de relogio entre o aparelho e a fonte nao sao erro.
  if (elapsed < -5 * MINUTE) {
    return undefined;
  }

  if (elapsed < MINUTE) {
    return "agora";
  }

  if (elapsed < HOUR) {
    return `ha ${Math.floor(elapsed / MINUTE)}min`;
  }

  if (elapsed < DAY) {
    return `ha ${Math.floor(elapsed / HOUR)}h`;
  }

  const days = Math.floor(elapsed / DAY);
  if (days < 30) {
    return `ha ${days} ${days === 1 ? "dia" : "dias"}`;
  }

  const months = Math.floor(days / 30);
  return `ha ${months} ${months === 1 ? "mes" : "meses"}`;
};
