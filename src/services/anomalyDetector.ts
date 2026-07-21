import { MarketOffer } from "../types";
import { PriceBaseline } from "./priceHistory";

/**
 * Quao fora do normal esta o preco. A ordem importa: "provavel erro" so e usado
 * quando ha evidencia forte, para o rotulo nao perder o sentido.
 */
export type AnomalyLevel = "price-error" | "far-below" | "below" | "normal";

export type AnomalySignal = {
  level: AnomalyLevel;
  /** 0-100, usado para ordenar a lista de vigilancia. */
  score: number;
  /** Frase curta explicando o que disparou o sinal. */
  reason: string;
  /** Queda apurada, quando existe base para calcular. */
  dropPercent?: number;
  /** Preco de referencia que serviu de comparacao. */
  reference?: number;
  /** De onde veio a referencia. */
  referenceSource?: "history" | "store";
  /** Leituras acumuladas deste produto neste aparelho. */
  readings: number;
};

/** Queda vs. historico que caracteriza erro de anuncio. */
const HISTORY_ERROR_DROP = 70;
/** Queda vs. historico que ja e "muito abaixo do comum". */
const HISTORY_FAR_DROP = 45;
/** Queda vs. historico digna de acompanhamento. */
const HISTORY_WATCH_DROP = 20;

/** Desconto anunciado pela loja que sugere erro, sem historico para confirmar. */
const STORE_ERROR_DISCOUNT = 85;
const STORE_FAR_DISCOUNT = 60;
const STORE_WATCH_DISCOUNT = 35;

/** Leituras necessarias para a mediana local valer como referencia. */
const MIN_READINGS_FOR_HISTORY = 3;

const percentDrop = (reference: number, price: number) =>
  Math.round(((reference - price) / reference) * 100);

const levelScore: Record<AnomalyLevel, number> = {
  "price-error": 90,
  "far-below": 65,
  below: 40,
  normal: 10
};

/**
 * Avalia uma oferta do AliExpress. O historico local e a evidencia mais forte:
 * ele compara o produto com ele mesmo. O desconto anunciado pela loja entra
 * como sinal secundario, porque preco cheio inflado e comum no varejo.
 */
export const detectAnomaly = (
  offer: MarketOffer,
  baseline: PriceBaseline | undefined
): AnomalySignal => {
  const readings = baseline?.sampleCount ?? 0;

  if (offer.priceError) {
    return {
      level: "price-error",
      score: 99,
      reason: "Anunciado pela comunidade como erro de preco.",
      readings
    };
  }

  const hasHistory = Boolean(baseline && readings >= MIN_READINGS_FOR_HISTORY);

  if (hasHistory && baseline) {
    const drop = baseline.reference > offer.price ? percentDrop(baseline.reference, offer.price) : 0;
    const level: AnomalyLevel =
      drop >= HISTORY_ERROR_DROP ? "price-error" : drop >= HISTORY_FAR_DROP ? "far-below" : drop >= HISTORY_WATCH_DROP ? "below" : "normal";

    if (level !== "normal") {
      return {
        level,
        // Quedas maiores sobem dentro da mesma faixa, sem invadir a faixa acima.
        score: Math.min(99, levelScore[level] + Math.round(drop / 5)),
        reason: `${drop}% abaixo da mediana de ${readings} leituras deste produto.`,
        dropPercent: drop,
        reference: baseline.reference,
        referenceSource: "history",
        readings
      };
    }

    /*
     * Com historico confiavel a conversa acaba aqui. O "preco cheio" do anuncio
     * costuma vir inflado, e deixar esse ramo rodar marcaria como erro de preco
     * um produto que as leituras mostram estar no valor de sempre.
     */
    return {
      level: "normal",
      score: levelScore.normal,
      reason: `Dentro do normal em ${readings} leituras deste produto.`,
      reference: baseline.reference,
      referenceSource: "history",
      readings
    };
  }

  if (offer.listPrice && offer.listPrice > offer.price) {
    const drop = percentDrop(offer.listPrice, offer.price);
    const level: AnomalyLevel =
      drop >= STORE_ERROR_DISCOUNT ? "price-error" : drop >= STORE_FAR_DISCOUNT ? "far-below" : drop >= STORE_WATCH_DISCOUNT ? "below" : "normal";

    if (level !== "normal") {
      return {
        level,
        score: Math.min(89, levelScore[level] + Math.round(drop / 6)),
        reason: `${drop}% abaixo do preco cheio anunciado pela loja.`,
        dropPercent: drop,
        reference: offer.listPrice,
        referenceSource: "store",
        readings
      };
    }
  }

  return {
    level: "normal",
    score: levelScore.normal,
    reason:
      readings > 0
        ? `Dentro do normal em ${readings} ${readings === 1 ? "leitura" : "leituras"}.`
        : "Primeira leitura. O preco entra na base para comparacoes futuras.",
    readings
  };
};

export const anomalyLabel: Record<AnomalyLevel, string> = {
  "price-error": "Provavel erro",
  "far-below": "Muito abaixo",
  below: "Abaixo do comum",
  normal: "Normal"
};
