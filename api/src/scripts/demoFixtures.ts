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
 * Nine real products from the three supported stores. The links are also used
 * by the optional `--with-parser` mode, so keep them pointed at product pages.
 */
export const DEMO_PRODUCTS: DemoProductFixture[] = [
  {
    name: "got2b Glued 4 Brows & Edges",
    brand: "got2b",
    image:
      "https://pwa-api.eva.ua/img/512/512/resize/1/1/1100784_1_1773674887.jpg",
    primaryStore: StoreName.Eva,
    stores: [
      {
        store: StoreName.Eva,
        link: "https://eva.ua/ua/pr1533950/",
        price: 341,
      },
    ],
  },
  {
    name: "Biodance Hydro Cera-Nol Real Deep Sheet Mask",
    brand: "Biodance",
    image:
      "https://pwa-api.eva.ua/img/512/512/resize/9/0/902047_1_1786374084.jpg",
    primaryStore: StoreName.Eva,
    stores: [
      {
        store: StoreName.Eva,
        link: "https://eva.ua/ua/pr1398568/",
        price: 199,
      },
    ],
  },
  {
    name: "TIGI Bed Head Masterpiece Hairspray Extra Strong Hold Level 4",
    brand: "TIGI",
    image:
      "https://pwa-api.eva.ua/img/512/512/resize/6/7/678122_1_1754654229.jpg",
    primaryStore: StoreName.Eva,
    stores: [
      {
        store: StoreName.Eva,
        link: "https://eva.ua/ua/pr582993/",
        price: 676,
      },
    ],
  },
  {
    name: "Valentino Born In Roma Vanilla Bliss",
    brand: "Valentino",
    image: "https://u.makeup.com.ua/a/ap/apdan0wwbg0w.jpg",
    primaryStore: StoreName.Makeup,
    stores: [
      {
        store: StoreName.Makeup,
        link: "https://makeup.com.ua/ua/product/1655377/",
        price: 1714,
      },
    ],
  },
  {
    name: "Giorgio Armani My Way Sunny Vanilla",
    brand: "Giorgio Armani",
    image: "https://u.makeup.com.ua/q/qi/qiadxdizozod.jpg",
    primaryStore: StoreName.Makeup,
    stores: [
      {
        store: StoreName.Makeup,
        link: "https://makeup.com.ua/ua/product/1631531/",
        price: 2285,
      },
    ],
  },
  {
    name: "Moschino Toy 2 Yummy",
    brand: "Moschino",
    image: "https://u.makeup.com.ua/l/le/leokhah1qdtw.jpg",
    primaryStore: StoreName.Makeup,
    stores: [
      {
        store: StoreName.Makeup,
        link: "https://makeup.com.ua/ua/product/1643285/",
        price: 2120,
      },
    ],
  },
  {
    name: "Gucci Flora Gorgeous Gardenia",
    brand: "Gucci",
    image:
      "https://cdn.notinoimg.com/detail_main_uhq/gucci/3616302022472_01-o/flora-gorgeous-gardenia___210726.jpg",
    primaryStore: StoreName.Notino,
    stores: [
      {
        store: StoreName.Notino,
        link: "https://www.notino.ua/gucci/flora-gorgeous-gardenia-parfumovana-voda-dlja-zhinok/",
        price: 3510,
      },
    ],
  },
  {
    name: "NARS Radiant Creamy Concealer",
    brand: "NARS",
    image:
      "https://cdn.notinoimg.com/detail_main_uhq/nars/607845012344_01/radiant-creamy-concealer___221123.jpg",
    primaryStore: StoreName.Notino,
    stores: [
      {
        store: StoreName.Notino,
        link: "https://www.notino.ua/nars/radiant-creamy-concealer-osvitljujuchij-korektor/p-16167132/",
        price: 1250,
      },
    ],
  },
  {
    name: "The Ordinary Azelaic Acid Suspension 10%",
    brand: "The Ordinary",
    image:
      "https://cdn.notinoimg.com/detail_main_uhq/the_ordinary/769915199178_01-o/azelaic-acid-suspension-10___231128.jpg",
    primaryStore: StoreName.Notino,
    stores: [
      {
        store: StoreName.Notino,
        link: "https://www.notino.ua/the-ordinary/azelaic-acid-suspension-10-rozjasnjujuchij-krem/p-16204759/",
        price: 1190,
      },
    ],
  },
];
