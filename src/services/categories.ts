import { MarketOffer } from "../types";

export const COUPON_CATEGORY = "Cupons";
const FALLBACK_CATEGORY = "Outros";

/**
 * Cada fonte nomeia as categorias do seu jeito ("HD e SSD", "Informatica",
 * "Hardware/SSD/Acessorios"). Reduzimos tudo a um punhado de grupos para que o
 * feed agrupe o mesmo assunto sob um unico titulo.
 */
const categoryRules: { label: string; terms: string[] }[] = [
  { label: "Informatica", terms: ["informatica", "hardware", "hd e ssd", "ssd", "hd", "notebook", "computador", "pc gamer", "monitor", "teclado", "mouse", "impressora", "placa", "processador", "memoria", "armazenamento", "perifericos"] },
  { label: "Celulares", terms: ["celular", "smartphone", "telefone", "tablet", "iphone"] },
  { label: "TV, audio e video", terms: ["tv", "televisor", "audio", "video", "som", "fone", "headphone", "soundbar", "home theater", "projetor", "camera", "filmadora", "drone"] },
  { label: "Games", terms: ["game", "console", "playstation", "xbox", "nintendo", "jogo"] },
  { label: "Eletrodomesticos", terms: ["eletrodomestico", "geladeira", "fogao", "lavadora", "microondas", "ar condicionado", "eletroportatil", "fritadeira", "air fryer", "liquidificador", "cafeteira", "aspirador"] },
  { label: "Casa e moveis", terms: ["casa", "movel", "moveis", "decoracao", "cama", "mesa", "banho", "utensilio", "construcao", "ferramenta", "jardim"] },
  { label: "Moda e acessorios", terms: ["moda", "calcado", "roupa", "vestuario", "relogio", "joia", "bolsa", "mochila", "mala"] },
  { label: "Beleza e saude", terms: ["perfume", "beleza", "saude", "higiene", "cosmetico", "suplemento", "fitness"] },
  { label: "Mercado", terms: ["supermercado", "mercado", "delivery", "bebida", "alimento"] },
  { label: "Esporte e lazer", terms: ["esporte", "lazer", "bicicleta", "academia", "camping", "viagem"] },
  { label: "Bebes e brinquedos", terms: ["bebe", "crianca", "brinquedo", "hobbie", "hobby"] },
  { label: "Livros e papelaria", terms: ["livro", "ebook", "papelaria", "escritorio", "filme", "musica", "seriado"] },
  { label: "Automotivo", terms: ["automovel", "automotivo", "carro", "moto", "peca"] },
  { label: "Pet", terms: ["pet", "petshop", "animal"] }
];

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const matchCategory = (text: string) => {
  const haystack = normalize(text);

  return categoryRules.find((rule) => rule.terms.some((term) => haystack.includes(term)))?.label;
};

/**
 * Resolve a categoria a partir do que a fonte informou e, se nao bastar, do
 * proprio titulo do produto.
 */
export const resolveCategory = (offer: MarketOffer): string => {
  if (offer.category === COUPON_CATEGORY) {
    return COUPON_CATEGORY;
  }

  if (offer.category) {
    const fromSource = matchCategory(offer.category);
    if (fromSource) {
      return fromSource;
    }
  }

  return matchCategory(offer.title) ?? (offer.category?.trim() || FALLBACK_CATEGORY);
};
