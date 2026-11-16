import { StoreName } from "@api/types/Enums.js";

export interface DemoStoreFixture {
  store: StoreName;
  link: string;
  price: number;
}

export interface DemoProductFixture {
  name: string;
  brand: string;
  image: string;
  primaryStore: StoreName;
  stores: DemoStoreFixture[];
}

/**
 * Three real products with real store links. The links are also used by the
 * optional `--with-parser` mode, so keep them pointed at product pages.
 */
export const DEMO_PRODUCTS: DemoProductFixture[] = [
  {
    name: "Rare Beauty Soft Pinch",
    brand: "Rare Beauty",
    image:
      "https://cdn.notinoimg.com/detail_main_uhq/rare_beauty/840122905797_01-o/soft-pinch___260420.jpg",
    primaryStore: StoreName.Notino,
    stores: [
      {
        store: StoreName.Eva,
        link: "https://eva.ua/ua/pr3597495/",
        price: 2225,
      },
      {
        store: StoreName.Makeup,
        link: "https://makeup.com.ua/ua/product/1430603/",
        price: 1580,
      },
      {
        store: StoreName.Notino,
        link: "https://www.notino.ua/rare-beauty/soft-pinch-tonuvalna-olijka-dlja-gub-zi-zvolozhujuchim-efektom/p-16373734/",
        price: 490,
      },
    ],
  },
  {
    name: "got2b Glued 4 Brows & Edges",
    brand: "got2b",
    image:
      "https://pwa-api.eva.ua/img/512/512/resize/1/1/1100784_1_1773674887.jpg",
    primaryStore: StoreName.Eva,
    stores: [
      {
        store: StoreName.Eva,
        link: "https://eva.ua/pr1533950/",
        price: 341,
      },
      {
        store: StoreName.Makeup,
        link: "https://makeup.com.ua/ua/product/1323186/",
        price: 320,
      },
      {
        store: StoreName.Notino,
        link: "https://www.notino.ua/got2b/glued-prozorij-fiksujuchij-gel-dlja-virivnjuvannja-volossja/p-16225312/",
        price: 320,
      },
    ],
  },
  {
    name: "Calvin Klein Euphoria Men",
    brand: "Calvin Klein",
    image:
      "https://u.makeup.com.ua/7/7h/7hbyl5m8y8qm.jpg",
    primaryStore: StoreName.Makeup,
    stores: [
      {
        store: StoreName.Eva,
        link: "https://eva.ua/ua/pr32053/",
        price: 1306,
      },
      {
        store: StoreName.Makeup,
        link: "https://makeup.com.ua/ua/product/906/",
        price: 1306,
      },
      {
        store: StoreName.Notino,
        link: "https://www.notino.ua/calvin-klein/euphoria-men-tualetna-voda-dlja-cholovikiv/p-62506/",
        price: 1320,
      },
    ],
  },
];
