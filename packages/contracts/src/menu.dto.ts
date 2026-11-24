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
  categoryName?: string;
  name: string;
  description?: string;
  basePriceMinor: number;
  currency: string;
  imageUrl?: string;
  isAvailable: boolean;
  isVegetarian: boolean;
  prepTimeMinutes: number;
  modifierGroups?: ModifierGroupDto[];
}

export interface MenuCategoryDto {
  id: string;
  name: string;
  slug: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
  itemsCount?: number;
  items: MenuItemDto[];
}

export interface PublicMenuResponseDto {
  tenantName: string;
  tenantSlug: string;
  locationName: string;
  currency: string;
  taxRatePercent: number | null;
  categories: MenuCategoryDto[];
}

// ==========================================
// Owner Menu Management DTOs (FR-OWN-01)
// ==========================================
export interface CreateCategoryDto {
  name: string;
  description?: string;
  displayOrder?: number;
}

export interface UpdateCategoryDto {
  name?: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface CreateMenuItemDto {
  categoryId: string;
  name: string;
  description?: string;
  basePriceMinor: number;
  isVegetarian: boolean;
  prepTimeMinutes?: number;
  imageUrl?: string;
  isAvailable?: boolean;
}

export interface UpdateMenuItemDto {
  categoryId?: string;
  name?: string;
  description?: string;
  basePriceMinor?: number;
  isVegetarian?: boolean;
  prepTimeMinutes?: number;
  imageUrl?: string;
  isAvailable?: boolean;
}

export interface ToggleMenuItemAvailabilityDto {
  isAvailable: boolean;
}

export interface CreateModifierGroupDto {
  name: string;
  minSelection?: number;
  maxSelection?: number;
  isRequired?: boolean;
}

export interface CreateModifierOptionDto {
  name: string;
  priceMinor: number;
  isAvailable?: boolean;
}
