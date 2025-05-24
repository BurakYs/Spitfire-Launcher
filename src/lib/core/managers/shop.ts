import ky from 'ky';
import type { SpitfireShop, SpitfireShopItem, SpitfireShopSection } from '$types/game/shop';
import { brShopStore } from '$lib/stores';

const spitfireAPIService = ky.extend({
  prefixUrl: 'https://api.rookie-spitfire.xyz/epic',
});

export default class ShopManager {
  static async fetch() {
    const response = await spitfireAPIService.get<SpitfireShop>('shop').json();
    brShopStore.set(response);

    return response;
  }

  static groupBySections(offers: SpitfireShopItem[]) {
    return offers.reduce<SpitfireShopSection[]>((acc, item) => {
      const sectionName = item.section.name || 'Other';
      const section = acc.find((section) => section.name === sectionName);

      if (section) {
        section.items.push(item);
      } else {
        acc.push({
          name: sectionName,
          id: item.section.id,
          items: [item]
        });
      }

      return acc;
    }, []);
  }
}