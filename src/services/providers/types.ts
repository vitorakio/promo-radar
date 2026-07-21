import { MarketOffer } from "../../types";

/**
 * aggregator: compara varias lojas de uma vez (Buscape, Zoom).
 * store: busca direto no site da loja (Amazon, KaBuM).
 * curator: comunidade que garimpa promocao, cupom e erro de preco (Promobit).
 */
export type ProviderKind = "aggregator" | "store" | "curator";

/** Uma consulta que o provider sabe fazer, com o rotulo mostrado no progresso. */
export type SearchTaskSpec = {
  query: string;
  label: string;
};

export type SearchProvider = {
  key: string;
  /** Nome exibido como fonte da oferta. */
  name: string;
  kind: ProviderKind;
  /**
   * False para fontes que dependem de acesso direto: no navegador a politica de
   * origem bloqueia a chamada e nao ha proxy que devolva a resposta utilizavel.
   */
  availableOnWeb: boolean;
  /** Cada provider decide como transformar as palavras-chave em consultas. */
  buildTasks: (keywords: string[]) => SearchTaskSpec[];
  search: (query: string) => Promise<MarketOffer[]>;
};

const NEXT_DATA_OPEN = '<script id="__NEXT_DATA__" type="application/json">';
const NEXT_DATA_CLOSE = "</script>";

/**
 * Recorta o JSON que o Next.js embute na pagina. O HTML tem centenas de KB,
 * entao localizar por indice evita rodar regex sobre o documento inteiro.
 */
export const readNextData = (html: string): unknown => {
  const start = html.indexOf(NEXT_DATA_OPEN);
  if (start === -1) {
    return undefined;
  }

  const jsonStart = start + NEXT_DATA_OPEN.length;
  const end = html.indexOf(NEXT_DATA_CLOSE, jsonStart);
  if (end === -1) {
    return undefined;
  }

  try {
    return JSON.parse(html.slice(jsonStart, end));
  } catch {
    return undefined;
  }
};

const HTML_ENTITIES: Record<string, string> = {
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " "
};

/** Titulos chegam com entidades HTML escapadas tanto no JSON quanto no markup. */
export const decodeEntities = (value: string) =>
  value.replace(/&(?:quot|apos|#39|amp|lt|gt|nbsp);/g, (match) => HTML_ENTITIES[match] ?? match);

/** Converte "1.614,90" (e variantes com R$) para 1614.9. */
export const parseBrlNumber = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const digits = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(digits);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

/**
 * Lojas exibem o valor da parcela em markup parecido com o do preco anterior, e
 * agregadores as vezes trazem 0,01 como placeholder. So aceitamos como "preco de"
 * o que for maior que o atual e ainda plausivel.
 */
export const sanitizeListPrice = (listPrice: number | undefined, price: number) => {
  if (!listPrice || listPrice <= price || listPrice > price * 5) {
    return undefined;
  }

  return listPrice;
};

/** Consulta por palavra-chave: o padrao para lojas e agregadores. */
export const keywordTasks = (providerName: string) => (keywords: string[]): SearchTaskSpec[] =>
  keywords.map((keyword) => ({ query: keyword, label: `${providerName}: ${keyword}` }));
