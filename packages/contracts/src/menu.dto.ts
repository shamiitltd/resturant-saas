export interface MenuItemModifierDto {
  id: string;
  name: string;
  priceMinor: number;
  isAvailable: boolean;
}

export type ItemModifierDto = MenuItemModifierDto;

export interface ModifierGroupDto {
  id: string;
  name: string;
  minSelection: number;
  maxSelection: number;
  isRequired: boolean;
  modifiers: MenuItemModifierDto[];
}

export interface MenuItemDto {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  basePriceMinor: number;
  currency: string;
  imageUrl?: string;
  isAvailable: boolean;
  isVegetarian: boolean;
  prepTimeMinutes: number;
  modifierGroups: ModifierGroupDto[];
}

export interface MenuCategoryDto {
  id: string;
  name: string;
  slug: string;
  description?: string;
  items: MenuItemDto[];
}

export interface PublicMenuResponseDto {
  tenantName: string;
  tenantSlug: string;
  locationName: string;
  currency: string;
  taxRatePercent: number;
  categories: MenuCategoryDto[];
}
