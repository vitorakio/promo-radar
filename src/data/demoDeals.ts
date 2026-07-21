import { MarketOffer } from "../types";

/**
 * Catalogo de demonstracao. So entra em cena quando nenhuma fonte responde
 * (sem rede, agregador fora do ar) e a interface avisa que o feed nao e real.
 */
export const demoDeals: MarketOffer[] = [
  {
    productKey: "demo-ssd-2tb",
    title: "SSD NVMe 2TB Gen4 com dissipador",
    store: "KaBuM!",
    price: 589.9,
    listPrice: 899.9,
    url: "https://www.kabum.com.br/",
    provider: "Demonstracao",
    category: "HD e SSD",
    storeCount: 7,
    rating: 4.7,
    reviewCount: 320,
    competitiveness: 0.94
  },
  {
    productKey: "demo-notebook-ryzen",
    title: "Notebook Ryzen 7, 16GB RAM, 512GB SSD",
    store: "Amazon",
    price: 2899.9,
    url: "https://www.amazon.com.br/",
    provider: "Demonstracao",
    category: "Notebook",
    storeCount: 12,
    rating: 4.5,
    reviewCount: 880,
    competitiveness: 0.88,
    cashbackValue: 14.5,
    cashbackRate: 0.005
  },
  {
    productKey: "demo-smart-tv",
    title: 'Smart TV 55" 4K com HDR10+',
    store: "Magazine Luiza",
    price: 2199,
    listPrice: 3299,
    url: "https://www.magazineluiza.com.br/",
    provider: "Demonstracao",
    category: "TV",
    storeCount: 9,
    rating: 4.4,
    reviewCount: 410,
    competitiveness: 0.81
  },
  {
    productKey: "demo-air-fryer",
    title: "Air fryer 8L digital",
    store: "Casas Bahia",
    price: 319.9,
    listPrice: 499.9,
    url: "https://www.casasbahia.com.br/",
    provider: "Demonstracao",
    category: "Eletroportateis",
    storeCount: 6,
    rating: 4.6,
    reviewCount: 1500,
    competitiveness: 0.9
  },
  {
    productKey: "demo-fone-importado",
    title: "Fone bluetooth TWS com cancelamento de ruido",
    store: "AliExpress",
    price: 289.9,
    listPrice: 459.9,
    url: "https://pt.aliexpress.com/",
    provider: "Demonstracao",
    category: "Eletronicos",
    storeCount: 3,
    rating: 4.3,
    reviewCount: 260,
    competitiveness: 0.86
  },
  {
    productKey: "demo-console",
    title: "Console bundle com jogo digital",
    store: "Ponto",
    price: 1299.99,
    url: "https://www.pontofrio.com.br/",
    provider: "Demonstracao",
    category: "Games",
    storeCount: 5,
    rating: 4.8,
    reviewCount: 2100,
    competitiveness: 0.97,
    loweringPercent: 28
  }
];
