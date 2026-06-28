export type LunchCategory = 'eat_out' | 'takeout' | 'home';

export type LunchPhoto = {
  id: string;
  mimeType: string;
  dataUrl: string;
};

export type LunchRecord = {
  id: string;
  date: string;
  category: LunchCategory;
  menuName?: string;
  shopId?: string;
  shopName?: string;
  cost?: number;
  rating?: number;
  photo?: LunchPhoto;
  memo?: string;
  createdAt: string;
  updatedAt: string;
};

export type ShopCategory = 'eat_out' | 'takeout';

export type Shop = {
  id: string;
  name: string;
  category: ShopCategory;
  createdAt: string;
  updatedAt: string;
};

export type LunchFormState = {
  category: LunchCategory;
  menuName: string;
  shopId: string;
  newShopName: string;
  shopName: string;
  cost: string;
  rating: number;
  photo?: LunchPhoto;
  memo: string;
};
