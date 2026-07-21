import { Platform } from "react-native";
import { isExtension } from "../platform/extension";

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/**
 * Leitor com CORS liberado. No navegador o fetch direto nas lojas e bloqueado
 * pela politica de origem, entao passamos por ele pedindo o HTML bruto.
 */
const READER_PROXY = "https://r.jina.ai/";

const DIRECT_TIMEOUT_MS = 15000;
const PROXY_TIMEOUT_MS = 45000;

export class HttpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * A extensao roda no navegador mas nao sofre a restricao dele: o fetch sai com
 * as permissoes de host declaradas no manifesto, entao as lojas respondem direto,
 * como no app instalado, e as fontes que dependem de acesso direto ficam ativas.
 */
export const isWeb = Platform.OS === "web" && !isExtension;

const fetchWithTimeout = async (url: string, timeoutMs: number, headers: Record<string, string>) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { headers, signal: controller.signal });

    if (!response.ok) {
      throw new HttpError(`HTTP ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new HttpError(`Tempo esgotado apos ${Math.round(timeoutMs / 1000)}s`);
    }

    throw error instanceof HttpError ? error : new HttpError(describeError(error));
  } finally {
    clearTimeout(timeoutId);
  }
};

const fetchDirect = (url: string, accept: string) =>
  fetchWithTimeout(url, DIRECT_TIMEOUT_MS, {
    "User-Agent": BROWSER_USER_AGENT,
    "Accept-Language": "pt-BR,pt;q=0.9",
    Accept: accept
  });

const fetchThroughProxy = (url: string) =>
  fetchWithTimeout(`${READER_PROXY}${url}`, PROXY_TIMEOUT_MS, {
    // Sem esse header o leitor devolve markdown e perdemos o JSON embutido da pagina.
    "x-return-format": "html"
  });

type FetchOptions = {
  /**
   * Alguns endpoints (APIs de loja) so respondem ao acesso direto e devolvem erro
   * atraves do leitor; nesses casos o fallback so atrasaria a falha.
   */
  allowProxy?: boolean;
};

/** Busca o HTML de uma pagina publica. */
export const fetchPageHtml = async (url: string, options: FetchOptions = {}): Promise<string> => {
  const allowProxy = options.allowProxy ?? true;

  if (isWeb) {
    if (!allowProxy) {
      throw new HttpError("Indisponivel no navegador");
    }

    return fetchThroughProxy(url);
  }

  try {
    return await fetchDirect(url, "text/html,application/xhtml+xml");
  } catch (error) {
    if (!allowProxy) {
      throw error;
    }

    return fetchThroughProxy(url);
  }
};

/** Busca um endpoint JSON. Sempre direto: proxies quebram o corpo da resposta. */
export const fetchJson = async <T>(url: string): Promise<T> => {
  const body = await fetchDirect(url, "application/json");

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new HttpError("Resposta JSON invalida");
  }
};

export const describeError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string" ? error : "Falha desconhecida";
};
