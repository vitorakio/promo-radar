/**
 * Recorte do react-native para o service worker.
 *
 * O worker so carrega a camada de servicos: nada de componentes, apenas o Platform
 * que os servicos consultam para decidir como buscar e como notificar. Puxar o
 * react-native de verdade arrastaria a arvore de interface inteira para dentro de
 * um ambiente que nao tem DOM.
 *
 * OS reporta "web" porque e o navegador que executa a varredura; quem diferencia
 * a extensao da aba comum e o isExtension, que ali enxerga o chrome.runtime.id.
 */

type PlatformSelectSpec<T> = {
  web?: T;
  native?: T;
  default?: T;
  [key: string]: T | undefined;
};

export const Platform = {
  OS: "web" as const,
  select: <T,>(spec: PlatformSelectSpec<T>): T | undefined => spec.web ?? spec.default
};
