import { useQuery } from "@tanstack/react-query";
import {
  listProducts,
  getProduct,
  listVariations,
  getVariations,
  getProductImages,
} from "@/data/products";
import { listCategories } from "@/data/categories";
import { listHeroSlides } from "@/data/banners";
import { listPromotions } from "@/data/promotions";
import { getSettings } from "@/data/settings";
import { countPendingOrders, listMyOrders } from "@/data/orders";
import { listMyAddresses } from "@/data/addresses";
import type {
  Product,
  ProductImage,
  ProductVariation,
  Category,
  HeroSlide,
  Promotion,
  StoreSettings,
  Order,
  Address,
} from "@/lib/types";

export function useProducts(opts?: { all?: boolean }) {
  return useQuery({
    queryKey: ["products", opts?.all ? "all" : "published"],
    queryFn: () => listProducts({ data: { all: !!opts?.all } }) as Promise<Product[]>,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ["product", id],
    queryFn: () => getProduct({ data: { id } }) as Promise<Product | null>,
    enabled: !!id,
  });
}

export function useAllVariations() {
  return useQuery({
    queryKey: ["variations"],
    queryFn: () => listVariations() as Promise<ProductVariation[]>,
  });
}

export function useProductVariations(productId: string) {
  return useQuery({
    queryKey: ["variations", productId],
    queryFn: () => getVariations({ data: { productId } }) as Promise<ProductVariation[]>,
    enabled: !!productId,
  });
}

export function useProductImages(productId: string) {
  return useQuery({
    queryKey: ["product_images", productId],
    queryFn: () => getProductImages({ data: { productId } }) as Promise<ProductImage[]>,
    enabled: !!productId,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => listCategories() as Promise<Category[]>,
  });
}

export function useHeroSlides(opts?: { all?: boolean }) {
  return useQuery({
    queryKey: ["hero_slides", opts?.all ? "all" : "active"],
    queryFn: () => listHeroSlides({ data: { all: !!opts?.all } }) as Promise<HeroSlide[]>,
  });
}

export function usePromotions(opts?: { all?: boolean }) {
  return useQuery({
    queryKey: ["promotions", opts?.all ? "all" : "live"],
    queryFn: () => listPromotions({ data: { all: !!opts?.all } }) as Promise<Promotion[]>,
  });
}

export function useStoreSettings() {
  return useQuery({
    queryKey: ["store_settings"],
    queryFn: () => getSettings() as Promise<StoreSettings | null>,
  });
}

export function useMyOrders(enabled: boolean) {
  return useQuery({
    queryKey: ["my-orders"],
    queryFn: () => listMyOrders() as Promise<Order[]>,
    enabled,
  });
}

export function useMyAddresses(enabled: boolean) {
  return useQuery({
    queryKey: ["my-addresses"],
    queryFn: () => listMyAddresses() as Promise<Address[]>,
    enabled,
  });
}

export function usePendingOrderCount(enabled: boolean) {
  return useQuery({
    queryKey: ["orders-pending-count"],
    queryFn: () => countPendingOrders() as Promise<number>,
    enabled,
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
  });
}
