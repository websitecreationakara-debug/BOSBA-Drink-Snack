import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Locale = "en" | "km" | "ja";

export const LOCALES: { code: Locale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "km", label: "ខ្មែរ" },
  { code: "ja", label: "日本語" },
];

const en = {
  "lang.name": "English",
  // top bar
  "bar.storeLocator": "Store Locator",
  "bar.delivery": "Free chilled delivery on orders over {threshold}$",
  "theme.light": "Light",
  "theme.dark": "Dark",
  // nav
  "nav.allCategories": "All Categories",
  "nav.browse": "Browse",
  "nav.allProducts": "All Products",
  "nav.searchPlaceholder": "Search tuna, salmon, uni, scallops...",
  "nav.wishlist": "Wishlist",
  "nav.signIn": "Sign in",
  "nav.adminDashboard": "Admin Dashboard",
  "nav.myOrders": "My Orders",
  "nav.myAddresses": "My Addresses",
  "nav.account": "Account",
  "nav.signOut": "Sign out",
  "nav.cart": "Cart",
  // home
  "home.premiumSelection": "Our Premium Selection",
  "home.finestProducts": "Shop Our Finest Products",
  "home.viewAll": "View all",
  "home.shopByCategory": "Shop by Category",
  "home.shopByCategorySub": "From sashimi to shellfish, all in one place.",
  "home.shop": "Shop",
  "feature.delivery.title": "Chilled Delivery",
  "feature.delivery.body": "Free shipping on orders over ${threshold}",
  "feature.sashimi.title": "Sashimi Grade",
  "feature.sashimi.body": "Sourced from Japanese waters",
  "feature.quality.title": "Quality Promise",
  "feature.quality.body": "Inspected at the market at dawn",
  "feature.cold.title": "Cold-Chain Fresh",
  "feature.cold.body": "Packed on ice, shipped overnight",
  "cta.member": "Become a member",
  "cta.title": "Earn points every time you shop.",
  "cta.body":
    "Collect 1 point for every $5 you spend at BOSBA Premium Foods. Save up your points and redeem them for free products.",
  "cta.join": "Join BOSBA Plus",
  // product
  "product.addToCart": "Add to cart",
  "product.noImage": "No image",
  "product.from": "from",
  "product.selectOptions": "Select options",
  // shop
  "shop.title": "BOSBA Premium Foods",
  "shop.count": "{n} products",
  "shop.filters": "Filters",
  "shop.clearAll": "Clear all",
  "shop.search": "Search",
  "shop.searchPlaceholder": "Tuna, salmon, uni...",
  "shop.categories": "Categories",
  "shop.allProducts": "All Products",
  "shop.price": "Price",
  "shop.offers": "Offers",
  "shop.onSaleOnly": "On sale only",
  "shop.sort": "Sort",
  "shop.sort.featured": "Featured",
  "shop.sort.priceAsc": "Price: Low to High",
  "shop.sort.priceDesc": "Price: High to Low",
  "shop.sort.rating": "Top Rated",
  "shop.noProducts": "No products found",
  "shop.noProductsSub": "Try adjusting your filters or search term.",
  "shop.clearFilters": "Clear filters",
  // offers
  "nav.offers": "Offers",
  "offers.title": "Special Offers",
  "offers.subtitle": "Limited-time deals on our premium picks.",
  "offers.empty": "No active offers right now — check back soon!",
  "offers.viewAll": "View all offers",
  "offers.ends": "Ends {date}",
  "offer.kind.limited": "Limited Offer",
  "offer.kind.seasonal": "Seasonal Offer",
  "offer.kind.special": "Special Offer",
  // footer
  "footer.tagline": "Provides High Premium Quality Foods From Japan",
  "footer.marketplace": "Marketplace",
  "footer.sashimiFillets": "Sashimi & Fillets",
  "footer.shellfish": "Shellfish",
  "footer.roeUni": "Roe & Uni",
  "footer.company": "Company",
  "footer.mission": "Our Mission",
  "footer.fisheries": "Our Fisheries",
  "footer.sustainability": "Sustainability",
  "footer.careers": "Careers",
  "footer.followTitle": "Follow Us",
  "footer.followSub": "Recipes, offers and fresh arrivals on social media.",
  "footer.privacy": "Privacy",
  "footer.terms": "Terms",
  "footer.sitemap": "Sitemap",
} as const;

export type I18nKey = keyof typeof en;
type Dict = Record<I18nKey, string>;

const km: Dict = {
  "lang.name": "ខ្មែរ",
  "bar.storeLocator": "ទីតាំងហាង",
  "bar.delivery": "ដឹកជញ្ជូនត្រជាក់ឥតគិតថ្លៃសម្រាប់ការបញ្ជាទិញលើស {threshold}$",
  "theme.light": "ភ្លឺ",
  "theme.dark": "ងងឹត",
  "nav.allCategories": "ប្រភេទទាំងអស់",
  "nav.browse": "រកមើល",
  "nav.allProducts": "ផលិតផលទាំងអស់",
  "nav.searchPlaceholder": "ស្វែងរក ត្រាប់ ត្រីសាល់ម៉ុង អ៊ូនី...",
  "nav.wishlist": "បញ្ជីប្រាថ្នា",
  "nav.signIn": "ចូលគណនី",
  "nav.adminDashboard": "ផ្ទាំងគ្រប់គ្រង",
  "nav.myOrders": "ការបញ្ជាទិញរបស់ខ្ញុំ",
  "nav.myAddresses": "អាសយដ្ឋានរបស់ខ្ញុំ",
  "nav.account": "គណនី",
  "nav.signOut": "ចាកចេញ",
  "nav.cart": "កន្ត្រក",
  "home.premiumSelection": "ការជ្រើសរើសពិសេសរបស់យើង",
  "home.finestProducts": "ទិញផលិតផលល្អបំផុតរបស់យើង",
  "home.viewAll": "មើលទាំងអស់",
  "home.shopByCategory": "ទិញតាមប្រភេទ",
  "home.shopByCategorySub": "ពីសាស៊ីមី រហូតដល់សត្វសំបកសមុទ្រ ទាំងអស់នៅកន្លែងតែមួយ។",
  "home.shop": "ទិញ",
  "feature.delivery.title": "ដឹកជញ្ជូនត្រជាក់",
  "feature.delivery.body": "ដឹកជញ្ជូនឥតគិតថ្លៃសម្រាប់ការបញ្ជាទិញលើស ${threshold}",
  "feature.sashimi.title": "កម្រិតសាស៊ីមី",
  "feature.sashimi.body": "ប្រភពពីដែនទឹកជប៉ុន",
  "feature.quality.title": "ការធានាគុណភាព",
  "feature.quality.body": "ត្រួតពិនិត្យនៅផ្សារពេលព្រឹកព្រលឹម",
  "feature.cold.title": "ស្រស់ត្រជាក់",
  "feature.cold.body": "ខ្ចប់ជាមួយទឹកកក ដឹកជញ្ជូនពេលយប់",
  "cta.member": "ក្លាយជាសមាជិក",
  "cta.title": "ទទួលបានពិន្ទុរាល់ពេលដែលអ្នកទិញ។",
  "cta.body":
    "ទទួលបាន ១ ពិន្ទុ សម្រាប់រាល់ការចំណាយ ៥ ដុល្លារ នៅ BOSBA Premium Foods។ សន្សំពិន្ទុរបស់អ្នក រួចប្តូរយកផលិតផលដោយឥតគិតថ្លៃ។",
  "cta.join": "ចូលរួម BOSBA Plus",
  "product.addToCart": "បន្ថែមទៅកន្ត្រក",
  "product.noImage": "គ្មានរូបភាព",
  "product.from": "ចាប់ពី",
  "product.selectOptions": "ជ្រើសរើសជម្រើស",
  "shop.title": "ទិញនៅផ្សារ",
  "shop.count": "{n} ផលិតផលស្រស់",
  "shop.filters": "តម្រង",
  "shop.clearAll": "សម្អាតទាំងអស់",
  "shop.search": "ស្វែងរក",
  "shop.searchPlaceholder": "ត្រាប់ ត្រីសាល់ម៉ុង អ៊ូនី...",
  "shop.categories": "ប្រភេទ",
  "shop.allProducts": "ផលិតផលទាំងអស់",
  "shop.price": "តម្លៃ",
  "shop.offers": "ការផ្តល់ជូន",
  "shop.onSaleOnly": "តែទំនិញបញ្ចុះតម្លៃ",
  "shop.sort": "តម្រៀប",
  "shop.sort.featured": "លេចធ្លោ",
  "shop.sort.priceAsc": "តម្លៃ៖ ទាបទៅខ្ពស់",
  "shop.sort.priceDesc": "តម្លៃ៖ ខ្ពស់ទៅទាប",
  "shop.sort.rating": "ការវាយតម្លៃខ្ពស់",
  "shop.noProducts": "រកមិនឃើញផលិតផល",
  "shop.noProductsSub": "សូមកែតម្រូវតម្រង ឬពាក្យស្វែងរករបស់អ្នក។",
  "shop.clearFilters": "សម្អាតតម្រង",
  "nav.offers": "ការផ្តល់ជូន",
  "offers.title": "ការផ្តល់ជូនពិសេស",
  "offers.subtitle": "ការបញ្ចុះតម្លៃរយៈពេលកំណត់លើផលិតផលពិសេសរបស់យើង។",
  "offers.empty": "មិនមានការផ្តល់ជូនទេឥឡូវនេះ — សូមត្រឡប់មកវិញឆាប់ៗ!",
  "offers.viewAll": "មើលការផ្តល់ជូនទាំងអស់",
  "offers.ends": "បញ្ចប់ {date}",
  "offer.kind.limited": "ការផ្តល់ជូនមានកំណត់",
  "offer.kind.seasonal": "ការផ្តល់ជូនតាមរដូវ",
  "offer.kind.special": "ការផ្តល់ជូនពិសេស",
  "footer.tagline": "ផ្គត់ផ្គង់ម្ហូបអាហារគុណភាពខ្ពស់បំផុតពីប្រទេសជប៉ុន",
  "footer.marketplace": "ផ្សារ",
  "footer.sashimiFillets": "សាស៊ីមី និងសាច់ត្រី",
  "footer.shellfish": "សត្វសំបកសមុទ្រ",
  "footer.roeUni": "ពងត្រី និងអ៊ូនី",
  "footer.company": "ក្រុមហ៊ុន",
  "footer.mission": "បេសកកម្មរបស់យើង",
  "footer.fisheries": "កន្លែងនេសាទរបស់យើង",
  "footer.sustainability": "និរន្តរភាព",
  "footer.careers": "ការងារ",
  "footer.followTitle": "តាមដានពួកយើង",
  "footer.followSub": "រូបមន្ត ការផ្តល់ជូន និងទំនិញថ្មីៗនៅលើបណ្តាញសង្គម។",
  "footer.privacy": "ឯកជនភាព",
  "footer.terms": "លក្ខខណ្ឌ",
  "footer.sitemap": "ផែនទីគេហទំព័រ",
};

const ja: Dict = {
  "lang.name": "日本語",
  "bar.storeLocator": "店舗検索",
  "bar.delivery": "{threshold}$以上のご注文で冷蔵配送無料",
  "theme.light": "ライト",
  "theme.dark": "ダーク",
  "nav.allCategories": "すべてのカテゴリー",
  "nav.browse": "見る",
  "nav.allProducts": "すべての商品",
  "nav.searchPlaceholder": "マグロ、サーモン、うに、ホタテを検索...",
  "nav.wishlist": "お気に入り",
  "nav.signIn": "ログイン",
  "nav.adminDashboard": "管理ダッシュボード",
  "nav.myOrders": "注文履歴",
  "nav.myAddresses": "住所帳",
  "nav.account": "アカウント",
  "nav.signOut": "ログアウト",
  "nav.cart": "カート",
  "home.premiumSelection": "プレミアムセレクション",
  "home.finestProducts": "厳選された商品",
  "home.viewAll": "すべて見る",
  "home.shopByCategory": "カテゴリーから探す",
  "home.shopByCategorySub": "刺身から貝類まで、すべてここに。",
  "home.shop": "見る",
  "feature.delivery.title": "冷蔵配送",
  "feature.delivery.body": "${threshold}以上のご注文で送料無料",
  "feature.sashimi.title": "刺身グレード",
  "feature.sashimi.body": "日本の海から直送",
  "feature.quality.title": "品質保証",
  "feature.quality.body": "夜明けの市場で検品",
  "feature.cold.title": "コールドチェーン鮮度",
  "feature.cold.body": "氷詰めで翌日配送",
  "cta.member": "会員になる",
  "cta.title": "お買い物のたびにポイントが貯まる。",
  "cta.body":
    "BOSBA Premium Foods でのお買い物5ドルにつき1ポイント獲得。貯まったポイントは商品と交換できます。",
  "cta.join": "BOSBA Plus に参加",
  "product.addToCart": "カートに追加",
  "product.noImage": "画像なし",
  "product.from": "〜",
  "product.selectOptions": "オプションを選択",
  "shop.title": "マーケットで買う",
  "shop.count": "{n} 点の新鮮な商品",
  "shop.filters": "フィルター",
  "shop.clearAll": "すべてクリア",
  "shop.search": "検索",
  "shop.searchPlaceholder": "マグロ、サーモン、うに...",
  "shop.categories": "カテゴリー",
  "shop.allProducts": "すべての商品",
  "shop.price": "価格",
  "shop.offers": "セール",
  "shop.onSaleOnly": "セール商品のみ",
  "shop.sort": "並び替え",
  "shop.sort.featured": "おすすめ",
  "shop.sort.priceAsc": "価格: 安い順",
  "shop.sort.priceDesc": "価格: 高い順",
  "shop.sort.rating": "評価が高い順",
  "shop.noProducts": "商品が見つかりません",
  "shop.noProductsSub": "フィルターや検索語を調整してください。",
  "shop.clearFilters": "フィルターをクリア",
  "nav.offers": "セール",
  "offers.title": "特別オファー",
  "offers.subtitle": "厳選商品の期間限定セール。",
  "offers.empty": "現在開催中のオファーはありません — またチェックしてください！",
  "offers.viewAll": "すべてのオファーを見る",
  "offers.ends": "{date}まで",
  "offer.kind.limited": "数量限定オファー",
  "offer.kind.seasonal": "シーズンオファー",
  "offer.kind.special": "特別オファー",
  "footer.tagline": "日本産の高品質プレミアム食品をご提供します",
  "footer.marketplace": "マーケット",
  "footer.sashimiFillets": "刺身・切り身",
  "footer.shellfish": "貝類",
  "footer.roeUni": "魚卵・うに",
  "footer.company": "会社情報",
  "footer.mission": "私たちの使命",
  "footer.fisheries": "漁場について",
  "footer.sustainability": "サステナビリティ",
  "footer.careers": "採用情報",
  "footer.followTitle": "フォローする",
  "footer.followSub": "レシピ・お得な情報・新着をSNSでチェック。",
  "footer.privacy": "プライバシー",
  "footer.terms": "利用規約",
  "footer.sitemap": "サイトマップ",
};

const DICTS: Record<Locale, Dict> = { en, km, ja };

function interpolate(s: string, vars?: Record<string, string | number>) {
  if (!vars) return s;
  return s.replace(/\$?\{(\w+)\}/g, (_, k: string) =>
    vars[k] != null ? String(vars[k]) : `{${k}}`,
  );
}

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: I18nKey, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const saved = localStorage.getItem("locale") as Locale | null;
    if (saved && saved in DICTS) {
      setLocaleState(saved);
      document.documentElement.lang = saved;
    }
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("locale", l);
    document.documentElement.lang = l;
  };

  const t = useCallback<Ctx["t"]>(
    (key, vars) => interpolate(DICTS[locale][key] ?? en[key] ?? key, vars),
    [locale],
  );

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within LanguageProvider");
  return ctx;
}
