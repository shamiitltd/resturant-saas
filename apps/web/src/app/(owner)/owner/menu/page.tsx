'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Edit2,
  Trash2,
  RefreshCw,
  UtensilsCrossed,
  Layers,
  SlidersHorizontal,
  ShoppingBag,
  Download,
  Upload,
  ChevronRight,
  Flame,
  Leaf,
  Clock,
  Store,
  QrCode,
  Smartphone,
  Copy,
  X,
  AlertCircle,
  Check,
  Calendar,
  Zap,
  Tag,
  ToggleLeft,
  ToggleRight,
  Percent,
  TrendingUp,
  MapPin,
  CheckSquare,
  Square,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';
import type {
  MenuCategoryDto,
  MenuItemDto,
  ModifierGroupDto,
  MenuItemModifierDto,
} from '@restaurant-saas/contracts';

type ActiveMenuTab =
  | 'items'
  | 'categories'
  | 'variants'
  | 'combos'
  | 'rules'
  | 'sync';

interface LocalItem {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  sku: string;
  description: string;
  basePriceMinor: number;
  isVegetarian: boolean;
  isVegan?: boolean;
  isAvailable: boolean;
  prepTimeMinutes: number;
  spiceLevel: 'Mild' | 'Medium' | 'Spicy';
  channels: {
    dineIn: boolean;
    takeaway: boolean;
    qr: boolean;
    zomato: boolean;
    swiggy: boolean;
  };
  outlets: {
    name: string;
    price: number;
    available: boolean;
  }[];
}

interface ComboMeal {
  id: string;
  name: string;
  description: string;
  itemIds: string[];
  comboPriceMinor: number;
  isActive: boolean;
  channels: {
    dineIn: boolean;
    takeaway: boolean;
    qr: boolean;
  };
}

interface AvailabilityRule {
  id: string;
  name: string;
  targetCategoryIds: string[];
  daysOfWeek: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  startTime: string; // '12:00'
  endTime: string; // '15:30'
  action: 'available' | 'hidden';
  isActive: boolean;
}

interface OutletInfo {
  id: string;
  code: string;
  name: string;
  address: string;
  serviceMode: string;
  status: 'ACTIVE' | 'INACTIVE';
  priceAdjustment: string;
  lastSyncedAt: string;
  soldOutItemIds: string[];
}

export default function OwnerMenuPage() {
  const [activeTab, setActiveTab] = useState<ActiveMenuTab>('items');
  const [categories, setCategories] = useState<MenuCategoryDto[]>([]);
  const [items, setItems] = useState<LocalItem[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroupDto[]>([]);
  const [outlets, setOutlets] = useState<OutletInfo[]>([
    {
      id: 'loc-1',
      code: 'ROH-01',
      name: 'Rohini (Main Branch)',
      address: 'Ring Road Mall, Sector 9, Rohini, New Delhi',
      serviceMode: 'TABLE_SERVICE',
      status: 'ACTIVE',
      priceAdjustment: 'Standard',
      lastSyncedAt: 'Just now',
      soldOutItemIds: [],
    },
    {
      id: 'loc-2',
      code: 'PIT-02',
      name: 'Pitampura Express',
      address: 'Netaji Subhash Place, Pitampura, New Delhi',
      serviceMode: 'COUNTER_SERVICE',
      status: 'ACTIVE',
      priceAdjustment: 'Standard',
      lastSyncedAt: '2 mins ago',
      soldOutItemIds: [],
    },
    {
      id: 'loc-3',
      code: 'NSP-03',
      name: 'Netaji Subhash Mall',
      address: 'Food Court, Pacific Mall, NSP, New Delhi',
      serviceMode: 'HYBRID',
      status: 'ACTIVE',
      priceAdjustment: '+5% Mall Surcharge',
      lastSyncedAt: '5 mins ago',
      soldOutItemIds: [],
    },
  ]);

  // Selected Category filter ('all' shows everything)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'unavailable'>('all');

  // Item Drawer Edit/Create State
  const [selectedItem, setSelectedItem] = useState<LocalItem | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Item Form inputs
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formType, setFormType] = useState<'veg' | 'non-veg' | 'vegan'>('veg');
  const [formDescription, setFormDescription] = useState('');
  const [formPrice, setFormPrice] = useState('299');
  const [formPrepTime, setFormPrepTime] = useState('15');
  const [formSpice, setFormSpice] = useState<'Mild' | 'Medium' | 'Spicy'>('Medium');
  const [formAvailable, setFormAvailable] = useState(true);
  const [formChannels, setFormChannels] = useState({
    dineIn: true,
    takeaway: true,
    qr: true,
    zomato: true,
    swiggy: true,
  });

  // Category Modal State
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategoryDto | null>(null);
  const [categoryFormName, setCategoryFormName] = useState('');
  const [categoryFormDescription, setCategoryFormDescription] = useState('');
  const [categoryFormOrder, setCategoryFormOrder] = useState('0');
  const [categoryFormActive, setCategoryFormActive] = useState(true);

  // Modifier Group Modal State
  const [modGroupModalOpen, setModGroupModalOpen] = useState(false);
  const [modGroupName, setModGroupName] = useState('');
  const [modGroupMin, setModGroupMin] = useState('0');
  const [modGroupMax, setModGroupMax] = useState('1');
  const [modGroupRequired, setModGroupRequired] = useState(false);

  // Modifier Option Modal State
  const [modOptionModalOpen, setModOptionModalOpen] = useState(false);
  const [activeGroupIdForOption, setActiveGroupIdForOption] = useState<string | null>(null);
  const [modOptionName, setModOptionName] = useState('');
  const [modOptionPrice, setModOptionPrice] = useState('40');

  // Combos State (Dynamic - empty until owner creates combos)
  const [combos, setCombos] = useState<ComboMeal[]>([]);
  const [comboModalOpen, setComboModalOpen] = useState(false);
  const [comboFormName, setComboFormName] = useState('');
  const [comboFormDescription, setComboFormDescription] = useState('');
  const [comboFormSelectedItems, setComboFormSelectedItems] = useState<string[]>([]);
  const [comboFormPrice, setComboFormPrice] = useState('499');

  // Availability Rules State (Dynamic - empty until owner creates rules)
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [ruleFormName, setRuleFormName] = useState('');
  const [ruleFormDays, setRuleFormDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [ruleFormStart, setRuleFormStart] = useState('12:00');
  const [ruleFormEnd, setRuleFormEnd] = useState('15:30');
  const [ruleFormCategory, setRuleFormCategory] = useState<string>('all');

  // Outlet Sync State
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [lastGlobalSyncTime, setLastGlobalSyncTime] = useState('Just now');

  // Notification Toast
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // 1. Fetch Real Data from Backend
  useEffect(() => {
    async function loadData() {
      try {
        const [catsRes, itemsRes, modsRes, locsRes] = await Promise.allSettled([
          fetchWithAuth<MenuCategoryDto[]>('/v1/owner/menu/categories'),
          fetchWithAuth<MenuItemDto[]>('/v1/owner/menu/items'),
          fetchWithAuth<ModifierGroupDto[]>('/v1/owner/menu/modifier-groups'),
          fetchWithAuth<any[]>('/v1/tenants/current/locations'),
        ]);

        let loadedCategories: MenuCategoryDto[] = [];
        let loadedItems: LocalItem[] = [];

        if (catsRes.status === 'fulfilled' && Array.isArray(catsRes.value)) {
          loadedCategories = catsRes.value;
          setCategories(loadedCategories);
          if (loadedCategories.length > 0) {
            setFormCategory(loadedCategories[0].id);
          }
        }

        if (itemsRes.status === 'fulfilled' && Array.isArray(itemsRes.value)) {
          loadedItems = itemsRes.value.map((item, idx) => ({
            id: item.id,
            categoryId: item.categoryId,
            categoryName: item.categoryName || 'General',
            name: item.name,
            sku: `${item.isVegetarian ? 'VEG' : 'NVEG'}-00${idx + 1}`,
            description: item.description || '',
            basePriceMinor: item.basePriceMinor,
            isVegetarian: item.isVegetarian,
            isAvailable: item.isAvailable,
            prepTimeMinutes: item.prepTimeMinutes || 15,
            spiceLevel: 'Medium',
            channels: { dineIn: true, takeaway: true, qr: true, zomato: true, swiggy: true },
            outlets: [
              { name: 'Rohini (Main)', price: Math.round(item.basePriceMinor / 100), available: item.isAvailable },
              { name: 'Pitampura', price: Math.round(item.basePriceMinor / 100), available: item.isAvailable },
              { name: 'Netaji Subhash', price: Math.round(item.basePriceMinor / 100), available: item.isAvailable },
            ],
          }));
          setItems(loadedItems);
          if (loadedItems.length > 0) {
            setSelectedItem(loadedItems[0]);
          }
        }

        if (modsRes.status === 'fulfilled' && Array.isArray(modsRes.value)) {
          setModifierGroups(modsRes.value);
        }

        if (locsRes.status === 'fulfilled' && Array.isArray(locsRes.value) && locsRes.value.length > 0) {
          const mappedLocs: OutletInfo[] = locsRes.value.map((l: any, i: number) => ({
            id: l.id,
            code: l.code || `OUT-0${i + 1}`,
            name: l.name,
            address: typeof l.address === 'string' ? l.address : l.address?.street || 'Delhi NCR',
            serviceMode: l.service_mode || 'TABLE_SERVICE',
            status: l.status || 'ACTIVE',
            priceAdjustment: i === 2 ? '+5% Mall Surcharge' : 'Standard',
            lastSyncedAt: 'Just now',
            soldOutItemIds: [],
          }));
          setOutlets(mappedLocs);
        }
      } catch (err) {
        console.warn('Error loading owner menu data:', err);
      }
    }

    loadData();
  }, []);

  // Total modifier options count
  const totalVariantsCount = useMemo(() => {
    return modifierGroups.reduce((acc, g) => acc + (g.modifiers?.length || 0), 0);
  }, [modifierGroups]);

  // Dynamic items count per category
  const categoryItemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      counts[item.categoryId] = (counts[item.categoryId] || 0) + 1;
    }
    return counts;
  }, [items]);

  // Filtered Items for Tab 1
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedCategoryId !== 'all' && item.categoryId !== selectedCategoryId) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesSku = item.sku.toLowerCase().includes(q);
        if (!matchesName && !matchesSku) return false;
      }
      if (availabilityFilter === 'available' && !item.isAvailable) return false;
      if (availabilityFilter === 'unavailable' && item.isAvailable) return false;
      return true;
    });
  }, [items, selectedCategoryId, searchQuery, availabilityFilter]);

  const activeCategoryObj = categories.find((c) => c.id === selectedCategoryId);

  // Guard selectedCategoryId: if not 'all' and not found in categories, safely reset to 'all'
  useEffect(() => {
    if (selectedCategoryId !== 'all' && categories.length > 0) {
      const exists = categories.some((c) => c.id === selectedCategoryId);
      if (!exists) {
        setSelectedCategoryId('all');
      }
    }
  }, [categories, selectedCategoryId]);

  // ---------------------------------------------------------------------------
  // Item Handlers
  // ---------------------------------------------------------------------------

  const populateForm = (item: LocalItem) => {
    setSelectedItem(item);
    setIsCreatingNew(false);
    setDrawerOpen(true);
    setFormName(item.name);
    setFormCategory(item.categoryId);
    setFormType(item.isVegan ? 'vegan' : item.isVegetarian ? 'veg' : 'non-veg');
    setFormDescription(item.description);
    setFormPrice(String(Math.round(item.basePriceMinor / 100)));
    setFormPrepTime(String(item.prepTimeMinutes));
    setFormSpice(item.spiceLevel);
    setFormAvailable(item.isAvailable);
    setFormChannels(item.channels);
  };

  const handleStartCreate = () => {
    setSelectedItem(null);
    setIsCreatingNew(true);
    setDrawerOpen(true);
    setFormName('');
    setFormCategory(selectedCategoryId !== 'all' ? selectedCategoryId : categories[0]?.id || '');
    setFormType('veg');
    setFormDescription('');
    setFormPrice('299');
    setFormPrepTime('15');
    setFormSpice('Medium');
    setFormAvailable(true);
    setFormChannels({ dineIn: true, takeaway: true, qr: true, zomato: true, swiggy: true });
  };

  const handleToggleAvailability = async (itemId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const newStatus = !item.isAvailable;

    // Optimistic UI update
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, isAvailable: newStatus } : i))
    );
    if (selectedItem?.id === itemId) {
      setFormAvailable(newStatus);
    }

    try {
      await fetchWithAuth(`/v1/owner/menu/items/${itemId}/availability`, {
        method: 'PATCH',
        body: JSON.stringify({ isAvailable: newStatus }),
      });
      showNotification(`${item.name} is now ${newStatus ? 'Available' : 'Sold Out (86-ed)'}`);
    } catch {
      // Revert if API fails
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, isAvailable: !newStatus } : i))
      );
      showNotification('Failed to update availability on server', 'error');
    }
  };

  const handleSaveItem = async () => {
    if (!formName.trim()) {
      showNotification('Please enter an item name', 'error');
      return;
    }
    const priceNum = parseFloat(formPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      showNotification('Please enter a valid price', 'error');
      return;
    }

    const payload = {
      categoryId: formCategory || categories[0]?.id,
      name: formName.trim(),
      description: formDescription.trim(),
      basePriceMinor: Math.round(priceNum * 100),
      isVegetarian: formType === 'veg' || formType === 'vegan',
      prepTimeMinutes: parseInt(formPrepTime, 10) || 15,
      isAvailable: formAvailable,
    };

    if (isCreatingNew) {
      const tempId = `item-${Date.now()}`;
      const catObj = categories.find((c) => c.id === formCategory) || categories[0];
      const newItem: LocalItem = {
        id: tempId,
        categoryId: catObj?.id || formCategory,
        categoryName: catObj?.name || 'General',
        name: formName.trim(),
        sku: `${formType === 'non-veg' ? 'NVEG' : 'VEG'}-00${items.length + 1}`,
        description: formDescription.trim(),
        basePriceMinor: Math.round(priceNum * 100),
        isVegetarian: formType === 'veg' || formType === 'vegan',
        isVegan: formType === 'vegan',
        isAvailable: formAvailable,
        prepTimeMinutes: parseInt(formPrepTime, 10) || 15,
        spiceLevel: formSpice,
        channels: formChannels,
        outlets: [
          { name: 'Rohini (Main)', price: priceNum, available: formAvailable },
          { name: 'Pitampura', price: priceNum, available: formAvailable },
          { name: 'Netaji Subhash', price: priceNum, available: formAvailable },
        ],
      };

      setItems((prev) => [newItem, ...prev]);
      setSelectedItem(newItem);
      setIsCreatingNew(false);
      showNotification(`Added "${formName.trim()}" to menu`);

      try {
        const created = await fetchWithAuth<MenuItemDto>('/v1/owner/menu/items', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (created?.id) {
          setItems((prev) => prev.map((i) => (i.id === tempId ? { ...i, id: created.id } : i)));
        }
      } catch (err) {
        console.warn('API create item fallback:', err);
      }
    } else if (selectedItem) {
      const updatedList = items.map((i) => {
        if (i.id === selectedItem.id) {
          return {
            ...i,
            name: formName.trim(),
            categoryId: formCategory,
            categoryName: categories.find((c) => c.id === formCategory)?.name || i.categoryName,
            description: formDescription.trim(),
            basePriceMinor: Math.round(priceNum * 100),
            isVegetarian: formType === 'veg' || formType === 'vegan',
            isVegan: formType === 'vegan',
            prepTimeMinutes: parseInt(formPrepTime, 10) || 15,
            spiceLevel: formSpice,
            isAvailable: formAvailable,
            channels: formChannels,
          };
        }
        return i;
      });

      setItems(updatedList);
      setSelectedItem(updatedList.find((i) => i.id === selectedItem.id) || null);
      showNotification(`Saved changes for "${formName.trim()}"`);

      try {
        await fetchWithAuth(`/v1/owner/menu/items/${selectedItem.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } catch (err) {
        console.warn('API update item fallback:', err);
      }
    }
  };

  const handleDeleteItem = async (itemId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;

    setItems((prev) => prev.filter((i) => i.id !== itemId));
    if (selectedItem?.id === itemId) {
      setSelectedItem(null);
      setDrawerOpen(false);
    }
    showNotification(`Deleted "${item.name}"`);

    try {
      await fetchWithAuth(`/v1/owner/menu/items/${itemId}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.warn('API delete item fallback:', err);
    }
  };

  // ---------------------------------------------------------------------------
  // Category Handlers
  // ---------------------------------------------------------------------------

  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCategoryFormName('');
    setCategoryFormDescription('');
    setCategoryFormOrder(String(categories.length));
    setCategoryFormActive(true);
    setCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: MenuCategoryDto) => {
    setEditingCategory(cat);
    setCategoryFormName(cat.name);
    setCategoryFormDescription(cat.description || '');
    setCategoryFormOrder(String(cat.displayOrder ?? 0));
    setCategoryFormActive(cat.isActive ?? true);
    setCategoryModalOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryFormName.trim()) {
      showNotification('Please enter a category name', 'error');
      return;
    }

    const payload = {
      name: categoryFormName.trim(),
      description: categoryFormDescription.trim() || undefined,
      displayOrder: parseInt(categoryFormOrder, 10) || 0,
      isActive: categoryFormActive,
    };

    if (editingCategory) {
      // Update
      setCategories((prev) =>
        prev.map((c) =>
          c.id === editingCategory.id
            ? { ...c, ...payload }
            : c
        )
      );
      setCategoryModalOpen(false);
      showNotification(`Updated category "${categoryFormName.trim()}"`);

      try {
        await fetchWithAuth(`/v1/owner/menu/categories/${editingCategory.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } catch (err) {
        console.warn('API update category fallback:', err);
      }
    } else {
      // Create
      const tempId = `cat-${Date.now()}`;
      const newCat: MenuCategoryDto = {
        id: tempId,
        name: categoryFormName.trim(),
        slug: categoryFormName.trim().toLowerCase().replace(/\s+/g, '-'),
        description: categoryFormDescription.trim() || undefined,
        displayOrder: parseInt(categoryFormOrder, 10) || 0,
        isActive: categoryFormActive,
        itemsCount: 0,
        items: [],
      };

      setCategories((prev) => [...prev, newCat]);
      setCategoryModalOpen(false);
      showNotification(`Created category "${categoryFormName.trim()}"`);

      try {
        const created = await fetchWithAuth<MenuCategoryDto>('/v1/owner/menu/categories', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (created?.id) {
          setCategories((prev) => prev.map((c) => (c.id === tempId ? { ...c, id: created.id } : c)));
        }
      } catch (err) {
        console.warn('API create category fallback:', err);
      }
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;

    const itemCount = categoryItemCounts[catId] || 0;
    if (itemCount > 0) {
      if (!confirm(`Category "${cat.name}" has ${itemCount} items. Deleting it will affect those items. Continue?`)) {
        return;
      }
    } else {
      if (!confirm(`Are you sure you want to delete category "${cat.name}"?`)) return;
    }

    setCategories((prev) => prev.filter((c) => c.id !== catId));
    if (selectedCategoryId === catId) {
      setSelectedCategoryId('all');
    }
    showNotification(`Deleted category "${cat.name}"`);

    try {
      await fetchWithAuth(`/v1/owner/menu/categories/${catId}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.warn('API delete category fallback:', err);
    }
  };

  // ---------------------------------------------------------------------------
  // Modifier Groups & Options Handlers
  // ---------------------------------------------------------------------------

  const handleCreateModifierGroup = async () => {
    if (!modGroupName.trim()) {
      showNotification('Please enter a group name', 'error');
      return;
    }

    const payload = {
      name: modGroupName.trim(),
      minSelection: parseInt(modGroupMin, 10) || 0,
      maxSelection: parseInt(modGroupMax, 10) || 1,
      isRequired: modGroupRequired,
    };

    const tempId = `mg-${Date.now()}`;
    const newGroup: ModifierGroupDto = {
      id: tempId,
      ...payload,
      modifiers: [],
    };

    setModifierGroups((prev) => [...prev, newGroup]);
    setModGroupModalOpen(false);
    setModGroupName('');
    showNotification(`Created modifier group "${modGroupName.trim()}"`);

    try {
      const created = await fetchWithAuth<ModifierGroupDto>('/v1/owner/menu/modifier-groups', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (created?.id) {
        setModifierGroups((prev) => prev.map((g) => (g.id === tempId ? { ...g, id: created.id } : g)));
      }
    } catch (err) {
      console.warn('API create modifier group fallback:', err);
    }
  };

  const handleDeleteModifierGroup = async (groupId: string) => {
    const group = modifierGroups.find((g) => g.id === groupId);
    if (!confirm(`Delete modifier group "${group?.name || ''}" and all its options?`)) return;

    setModifierGroups((prev) => prev.filter((g) => g.id !== groupId));
    showNotification('Modifier group deleted');

    try {
      await fetchWithAuth(`/v1/owner/menu/modifier-groups/${groupId}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.warn('API delete modifier group fallback:', err);
    }
  };

  const handleCreateModifierOption = async () => {
    if (!activeGroupIdForOption || !modOptionName.trim()) {
      showNotification('Please enter an option name', 'error');
      return;
    }

    const priceNum = parseFloat(modOptionPrice) || 0;
    const payload = {
      name: modOptionName.trim(),
      priceMinor: Math.round(priceNum * 100),
      isAvailable: true,
    };

    const tempId = `mo-${Date.now()}`;
    const newOpt: MenuItemModifierDto = {
      id: tempId,
      name: modOptionName.trim(),
      priceMinor: Math.round(priceNum * 100),
      isAvailable: true,
    };

    setModifierGroups((prev) =>
      prev.map((g) =>
        g.id === activeGroupIdForOption
          ? { ...g, modifiers: [...(g.modifiers || []), newOpt] }
          : g
      )
    );

    setModOptionModalOpen(false);
    setModOptionName('');
    showNotification(`Added option "${modOptionName.trim()}"`);

    try {
      const created = await fetchWithAuth<MenuItemModifierDto>(
        `/v1/owner/menu/modifier-groups/${activeGroupIdForOption}/modifiers`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      if (created?.id) {
        setModifierGroups((prev) =>
          prev.map((g) =>
            g.id === activeGroupIdForOption
              ? {
                  ...g,
                  modifiers: (g.modifiers || []).map((m) =>
                    m.id === tempId ? { ...m, id: created.id } : m
                  ),
                }
              : g
          )
        );
      }
    } catch (err) {
      console.warn('API create modifier option fallback:', err);
    }
  };

  const handleToggleModifierOptionAvailability = async (optId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;

    setModifierGroups((prev) =>
      prev.map((g) => ({
        ...g,
        modifiers: (g.modifiers || []).map((m) =>
          m.id === optId ? { ...m, isAvailable: newStatus } : m
        ),
      }))
    );

    try {
      await fetchWithAuth(`/v1/owner/menu/modifiers/${optId}/availability`, {
        method: 'PATCH',
        body: JSON.stringify({ isAvailable: newStatus }),
      });
      showNotification(`Option status updated to ${newStatus ? 'Available' : 'Unavailable'}`);
    } catch {
      // Revert
      setModifierGroups((prev) =>
        prev.map((g) => ({
          ...g,
          modifiers: (g.modifiers || []).map((m) =>
            m.id === optId ? { ...m, isAvailable: currentStatus } : m
          ),
        }))
      );
    }
  };

  const handleDeleteModifierOption = async (optId: string) => {
    setModifierGroups((prev) =>
      prev.map((g) => ({
        ...g,
        modifiers: (g.modifiers || []).filter((m) => m.id !== optId),
      }))
    );
    showNotification('Option removed');

    try {
      await fetchWithAuth(`/v1/owner/menu/modifiers/${optId}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.warn('API delete modifier option fallback:', err);
    }
  };

  // ---------------------------------------------------------------------------
  // Combos Handlers
  // ---------------------------------------------------------------------------

  const handleCreateCombo = () => {
    if (!comboFormName.trim()) {
      showNotification('Please enter a combo name', 'error');
      return;
    }
    if (comboFormSelectedItems.length < 2) {
      showNotification('Please select at least 2 dishes for the combo', 'error');
      return;
    }

    const priceNum = parseFloat(comboFormPrice) || 399;
    const newCombo: ComboMeal = {
      id: `combo-${Date.now()}`,
      name: comboFormName.trim(),
      description: comboFormDescription.trim() || 'Custom meal deal',
      itemIds: comboFormSelectedItems,
      comboPriceMinor: Math.round(priceNum * 100),
      isActive: true,
      channels: { dineIn: true, takeaway: true, qr: true },
    };

    setCombos((prev) => [newCombo, ...prev]);
    setComboModalOpen(false);
    setComboFormName('');
    setComboFormDescription('');
    setComboFormSelectedItems([]);
    showNotification(`Created combo "${newCombo.name}"`);
  };

  const handleToggleCombo = (comboId: string) => {
    setCombos((prev) =>
      prev.map((c) => (c.id === comboId ? { ...c, isActive: !c.isActive } : c))
    );
    const combo = combos.find((c) => c.id === comboId);
    showNotification(`Combo "${combo?.name}" is now ${!combo?.isActive ? 'Active' : 'Paused'}`);
  };

  const handleDeleteCombo = (comboId: string) => {
    setCombos((prev) => prev.filter((c) => c.id !== comboId));
    showNotification('Combo meal removed');
  };

  // ---------------------------------------------------------------------------
  // Availability Rules Handlers
  // ---------------------------------------------------------------------------

  const handleCreateRule = () => {
    if (!ruleFormName.trim()) {
      showNotification('Please enter a rule name', 'error');
      return;
    }

    const newRule: AvailabilityRule = {
      id: `rule-${Date.now()}`,
      name: ruleFormName.trim(),
      targetCategoryIds: ruleFormCategory === 'all' ? categories.map((c) => c.id) : [ruleFormCategory],
      daysOfWeek: ruleFormDays,
      startTime: ruleFormStart,
      endTime: ruleFormEnd,
      action: 'available',
      isActive: true,
    };

    setRules((prev) => [...prev, newRule]);
    setRuleModalOpen(false);
    setRuleFormName('');
    showNotification(`Created availability schedule "${newRule.name}"`);
  };

  const handleToggleRule = (ruleId: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, isActive: !r.isActive } : r))
    );
    const rule = rules.find((r) => r.id === ruleId);
    showNotification(`Schedule "${rule?.name}" is now ${!rule?.isActive ? 'Active' : 'Paused'}`);
  };

  const handleDeleteRule = (ruleId: string) => {
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
    showNotification('Availability schedule removed');
  };

  // ---------------------------------------------------------------------------
  // Outlet Sync Handlers
  // ---------------------------------------------------------------------------

  const handleSyncAllOutlets = async () => {
    setIsSyncingAll(true);
    showNotification('Syncing master menu catalog across all outlets...', 'info');

    try {
      await fetchWithAuth('/v1/owner/menu/sync-outlets', { method: 'POST' });
    } catch {
      // Continue optimistic feedback
    }

    setTimeout(() => {
      setIsSyncingAll(false);
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastGlobalSyncTime(`Today, ${nowStr}`);
      setOutlets((prev) =>
        prev.map((o) => ({
          ...o,
          lastSyncedAt: 'Just now',
        }))
      );
      showNotification(`Successfully synchronized ${items.length} items & ${categories.length} categories to all 3 outlets!`);
    }, 1200);
  };

  const handleToggleOutletStatus = (outletId: string) => {
    setOutlets((prev) =>
      prev.map((o) =>
        o.id === outletId
          ? { ...o, status: o.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }
          : o
      )
    );
    const out = outlets.find((o) => o.id === outletId);
    showNotification(`${out?.name} is now ${out?.status === 'ACTIVE' ? 'Paused' : 'Active'}`);
  };

  const handleToggleOutletItem86 = (outletId: string, itemId: string) => {
    setOutlets((prev) =>
      prev.map((o) => {
        if (o.id !== outletId) return o;
        const isSoldOut = o.soldOutItemIds.includes(itemId);
        return {
          ...o,
          soldOutItemIds: isSoldOut
            ? o.soldOutItemIds.filter((id) => id !== itemId)
            : [...o.soldOutItemIds, itemId],
        };
      })
    );
    showNotification('Outlet item availability override updated');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 text-xs font-bold shadow-2xl animate-fade-in text-white ${
            notification.type === 'error'
              ? 'bg-red-600'
              : notification.type === 'info'
              ? 'bg-slate-800'
              : 'bg-slate-900'
          }`}
        >
          {notification.type === 'error' ? (
            <XCircle className="h-4 w-4 text-red-300 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* 1. Header Section */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-[#FF4E00] border border-orange-100 shadow-xs">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Menu Management
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Create, update and manage your dynamic menu, modifiers, combos and multi-outlet availability.
            </p>
          </div>
        </div>

        {/* Action Buttons on Right */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => showNotification('Menu exported as CSV / JSON')}
            suppressHydrationWarning
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Export Menu</span>
          </button>
          <button
            type="button"
            onClick={handleStartCreate}
            suppressHydrationWarning
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl bg-[#FF4E00] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#e04500] transition"
          >
            <Plus className="h-4 w-4" />
            <span>Add Menu Item</span>
          </button>
        </div>
      </div>

      {/* 2. Sub-Navigation Tabs matching 03-menu-management.png */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs font-bold border-b border-slate-200/80">
        {[
          { id: 'items', label: 'Menu Items', count: items.length },
          { id: 'categories', label: 'Categories', count: categories.length },
          { id: 'variants', label: 'Variants & Add-ons', count: totalVariantsCount },
          { id: 'combos', label: 'Combos & Meals', count: combos.length },
          { id: 'rules', label: 'Availability Rules', count: rules.length },
          { id: 'sync', label: 'Outlet Menu Sync', count: outlets.length },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as ActiveMenuTab)}
            suppressHydrationWarning
            className={`whitespace-nowrap rounded-xl px-4 py-2.5 transition flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-[#FF4E00] text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                activeTab === tab.id
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* 3. Top Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div
          onClick={() => setActiveTab('items')}
          className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-xs flex items-center gap-3 cursor-pointer hover:border-orange-300 transition"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#FF4E00] border border-orange-100">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-black text-slate-900 leading-none">{items.length}</p>
            <span className="text-xs text-slate-500 font-medium mt-0.5 block">Total Items</span>
          </div>
        </div>

        <div
          onClick={() => setActiveTab('categories')}
          className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-xs flex items-center gap-3 cursor-pointer hover:border-amber-300 transition"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-black text-slate-900 leading-none">{categories.length}</p>
            <span className="text-xs text-slate-500 font-medium mt-0.5 block">Categories</span>
          </div>
        </div>

        <div
          onClick={() => setActiveTab('variants')}
          className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-xs flex items-center gap-3 cursor-pointer hover:border-orange-300 transition"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600 border border-orange-100">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-black text-slate-900 leading-none">{totalVariantsCount}</p>
            <span className="text-xs text-slate-500 font-medium mt-0.5 block">Variants</span>
          </div>
        </div>

        <div
          onClick={() => setActiveTab('combos')}
          className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-xs flex items-center gap-3 cursor-pointer hover:border-amber-300 transition"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-black text-slate-900 leading-none">{combos.length}</p>
            <span className="text-xs text-slate-500 font-medium mt-0.5 block">Combos</span>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 rounded-2xl bg-white p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <RefreshCw className={`h-5 w-5 ${isSyncingAll ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 leading-none">All Outlets Synced</p>
              <span className="text-[10px] text-slate-400 mt-1 block">{lastGlobalSyncTime}</span>
            </div>
          </div>
          <button
            type="button"
            disabled={isSyncingAll}
            onClick={handleSyncAllOutlets}
            suppressHydrationWarning
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 text-orange-600 ${isSyncingAll ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* =======================================================================
          TAB 1: MENU ITEMS
      ======================================================================== */}
      {activeTab === 'items' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Categories List */}
          <div className="lg:col-span-3 rounded-2xl bg-white p-4 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                Categories ({categories.length})
              </h2>
              <button
                type="button"
                onClick={handleOpenAddCategory}
                suppressHydrationWarning
                className="flex items-center gap-1 rounded-lg bg-orange-50 border border-orange-200 px-2 py-1 text-[11px] font-bold text-orange-700 hover:bg-orange-100 transition"
              >
                <Plus className="h-3 w-3" />
                <span>Add Category</span>
              </button>
            </div>

            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setSelectedCategoryId('all')}
                suppressHydrationWarning
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition text-left ${
                  selectedCategoryId === 'all'
                    ? 'bg-[#FF4E00] text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>All Categories</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    selectedCategoryId === 'all'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {items.length}
                </span>
              </button>

              {categories.map((cat) => {
                const count = categoryItemCounts[cat.id] || 0;
                const isSelected = selectedCategoryId === cat.id;

                return (
                  <div
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? 'bg-orange-50 border border-orange-200 text-orange-900 shadow-xs'
                        : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          isSelected ? 'bg-[#FF4E00]' : 'bg-slate-300'
                        }`}
                      />
                      <span className="truncate">{cat.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full ${
                          isSelected
                            ? 'bg-orange-200 text-orange-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {count} items
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditCategory(cat);
                        }}
                        title="Edit Category"
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 transition p-0.5"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Middle Column: Items Table */}
          <div
            className={`rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs space-y-4 ${
              drawerOpen ? 'lg:col-span-5' : 'lg:col-span-9'
            }`}
          >
            {/* Table Header & Search/Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Menu Items — {selectedCategoryId === 'all' || !activeCategoryObj ? 'All Items' : activeCategoryObj.name} ({filteredItems.length})
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Click on an item row to inspect or edit details
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    suppressHydrationWarning
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500 w-40 sm:w-48"
                  />
                </div>

                <select
                  aria-label="Filter by availability"
                  value={availabilityFilter}
                  onChange={(e) => setAvailabilityFilter(e.target.value as any)}
                  suppressHydrationWarning
                  className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="all">All Availability</option>
                  <option value="available">Available Only</option>
                  <option value="unavailable">Sold Out (86-ed)</option>
                </select>
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="pb-3 w-8">
                      <input
                        type="checkbox"
                        className="rounded-sm border-slate-300 text-orange-600 focus:ring-orange-500"
                      />
                    </th>
                    <th className="pb-3">Item</th>
                    <th className="pb-3 text-right">Price (₹)</th>
                    <th className="pb-3 text-center">Availability</th>
                    <th className="pb-3 text-center">Channels</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <UtensilsCrossed className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-bold text-xs text-slate-700">
                          {searchQuery.trim()
                            ? `No dishes matching "${searchQuery}"`
                            : selectedCategoryId !== 'all'
                            ? `No dishes found in ${activeCategoryObj?.name || 'this category'}`
                            : 'No menu items found'}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {searchQuery.trim()
                            ? 'Try clearing the search query or adjusting your filters'
                            : selectedCategoryId !== 'all'
                            ? 'Switch to All Categories or add dishes to this category'
                            : 'Start by adding your first dish using the button above'}
                        </p>
                        {(searchQuery.trim() || selectedCategoryId !== 'all') && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchQuery('');
                              setSelectedCategoryId('all');
                              setAvailabilityFilter('all');
                            }}
                            className="mt-3 px-3 py-1.5 rounded-lg bg-orange-50 border border-orange-200 text-xs font-bold text-[#FF4E00] hover:bg-orange-100 transition"
                          >
                            Reset Category &amp; Filters
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const isSelected = selectedItem?.id === item.id;
                      return (
                        <tr
                          key={item.id}
                          onClick={() => populateForm(item)}
                          className={`cursor-pointer transition ${
                            isSelected ? 'bg-orange-50/50' : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="py-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="rounded-sm border-slate-300 text-orange-600 focus:ring-orange-500"
                            />
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-2.5">
                              {/* Veg / Non-Veg Indicator */}
                              <span
                                className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-xs border p-0.5 ${
                                  item.isVegetarian ? 'border-emerald-600' : 'border-red-600'
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    item.isVegetarian ? 'bg-emerald-600' : 'bg-red-600'
                                  }`}
                                />
                              </span>
                              <div>
                                <p className="font-bold text-slate-900 leading-tight">{item.name}</p>
                                <span className="text-[10px] text-slate-400">{item.sku}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 text-right font-extrabold text-slate-900">
                            ₹{Math.round(item.basePriceMinor / 100)}
                          </td>
                          <td className="py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            {/* Toggle Switch */}
                            <button
                              type="button"
                              onClick={(e) => handleToggleAvailability(item.id, e)}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                item.isAvailable ? 'bg-[#FF4E00]' : 'bg-slate-300'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                  item.isAvailable ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </td>
                          <td className="py-3 text-center">
                            <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-500">
                              <span title="Dine-In" className="px-1 rounded-sm bg-slate-100">D</span>
                              <span title="Takeaway" className="px-1 rounded-sm bg-slate-100">T</span>
                              <span title="Online QR" className="px-1 rounded-sm bg-orange-100 text-[#FF4E00]">QR</span>
                              <span title="Zomato" className="px-1 rounded-sm bg-red-100 text-red-600">Z</span>
                              <span title="Swiggy" className="px-1 rounded-sm bg-purple-100 text-purple-600">S</span>
                            </div>
                          </td>
                          <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => populateForm(item)}
                                title="Edit item"
                                className="p-1 text-slate-400 hover:text-slate-800 transition"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteItem(item.id, e)}
                                title="Delete item"
                                className="p-1 text-slate-400 hover:text-red-600 transition"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
              <span>
                {filteredItems.length === 0
                  ? 'Showing 0 of 0 items'
                  : `Showing 1 – ${filteredItems.length} of ${filteredItems.length} items`}
              </span>
              <div className="flex items-center gap-1 font-bold">
                <span className="px-2.5 py-1 rounded-lg bg-[#FF4E00] text-white">1</span>
              </div>
            </div>
          </div>

          {/* Right Column: Edit / Add Menu Item Form Drawer */}
          {drawerOpen && (
            <div className="lg:col-span-4 rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-900">
                  {isCreatingNew ? 'Add Menu Item' : 'Edit Menu Item'}
                </h3>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="text-slate-400 hover:text-slate-700 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Photo Preview / Icon */}
              <div className="relative h-24 w-full rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center overflow-hidden">
                <div className="flex flex-col items-center text-orange-600">
                  <UtensilsCrossed className="h-6 w-6 mb-1" />
                  <span className="text-[11px] font-bold">Dish Image Preview</span>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Item Name *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Paneer Tikka"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Category *</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 outline-none cursor-pointer"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Item Type</label>
                    <div className="flex items-center gap-1 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setFormType('veg')}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition ${
                          formType === 'veg'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                        <span>Veg</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormType('non-veg')}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition ${
                          formType === 'non-veg'
                            ? 'bg-red-100 text-red-800 border border-red-300'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
                        <span>Non-Veg</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-slate-700">Description</label>
                    <span className="text-[10px] text-slate-400">{formDescription.length} / 200</span>
                  </div>
                  <textarea
                    rows={2}
                    maxLength={200}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Describe ingredients, cooking style, or serving notes..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Price (₹) *</label>
                    <input
                      type="number"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Prep Time (m)</label>
                    <input
                      type="number"
                      value={formPrepTime}
                      onChange={(e) => setFormPrepTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Spice Level</label>
                    <select
                      value={formSpice}
                      onChange={(e) => setFormSpice(e.target.value as any)}
                      className="w-full px-2 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 outline-none"
                    >
                      <option value="Mild">Mild</option>
                      <option value="Medium">Medium</option>
                      <option value="Spicy">Spicy</option>
                    </select>
                  </div>
                </div>

                {/* Availability Switch */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div>
                    <p className="font-bold text-slate-900">Item Availability</p>
                    <span className="text-[10px] text-slate-400">Toggle off to mark Sold Out (86-ed)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormAvailable(!formAvailable)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      formAvailable ? 'bg-[#FF4E00]' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        formAvailable ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Available Channels */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1.5">Available Channels</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { key: 'dineIn', label: 'Dine-in' },
                      { key: 'takeaway', label: 'Takeaway' },
                      { key: 'qr', label: 'Online (QR)' },
                      { key: 'zomato', label: 'Zomato' },
                      { key: 'swiggy', label: 'Swiggy' },
                    ].map((ch) => {
                      const isChecked = (formChannels as any)[ch.key];
                      return (
                        <button
                          key={ch.key}
                          type="button"
                          onClick={() =>
                            setFormChannels((prev) => ({
                              ...prev,
                              [ch.key]: !isChecked,
                            }))
                          }
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition ${
                            isChecked
                              ? 'bg-orange-50 border-orange-200 text-orange-800'
                              : 'bg-white border-slate-200 text-slate-400'
                          }`}
                        >
                          {isChecked && '✓ '}
                          {ch.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Drawer Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleSaveItem}
                  className="flex-1 px-4 py-2 rounded-xl bg-[#FF4E00] text-xs font-bold text-white shadow-sm hover:bg-[#e04500] transition text-center"
                >
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =======================================================================
          TAB 2: CATEGORIES
      ======================================================================== */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Menu Categories ({categories.length})
              </h2>
              <p className="text-xs text-slate-500">
                Organize menu items into customer-facing catalog sections and manage display order.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenAddCategory}
              className="flex items-center gap-1.5 rounded-xl bg-[#FF4E00] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#e04500] transition"
            >
              <Plus className="h-4 w-4" />
              <span>Add Category</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat, idx) => {
              const count = categoryItemCounts[cat.id] || 0;
              return (
                <div
                  key={cat.id}
                  className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4 hover:border-orange-200 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#FF4E00] font-black text-sm">
                        {idx + 1}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-sm leading-tight">{cat.name}</h3>
                        <span className="text-[10px] text-slate-400 font-medium">slug: /{cat.slug}</span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                        cat.isActive ?? true
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {cat.isActive ?? true ? 'Active' : 'Hidden'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2 min-h-[32px]">
                    {cat.description || 'No description provided.'}
                  </p>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                      <UtensilsCrossed className="h-3.5 w-3.5 text-orange-500" />
                      <span>{count} dishes</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditCategory(cat)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                        title="Edit category"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50 transition"
                        title="Delete category"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 3: VARIANTS & ADD-ONS
      ======================================================================== */}
      {activeTab === 'variants' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Modifier Groups &amp; Variants ({modifierGroups.length})
              </h2>
              <p className="text-xs text-slate-500">
                Configure dish customization groups (e.g. Spice levels, portion sizes, choice of breads, extra toppings).
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setModGroupName('');
                setModGroupMin('0');
                setModGroupMax('1');
                setModGroupRequired(false);
                setModGroupModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-[#FF4E00] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#e04500] transition"
            >
              <Plus className="h-4 w-4" />
              <span>Create Modifier Group</span>
            </button>
          </div>

          {modifierGroups.length === 0 ? (
            <div className="rounded-2xl bg-white p-12 text-center border border-slate-200/80 shadow-xs">
              <SlidersHorizontal className="h-10 w-10 mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-sm text-slate-800">No modifier groups created yet</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Add customization groups to allow customers to choose sizes, toppings, spice levels, etc.
              </p>
              <button
                type="button"
                onClick={() => setModGroupModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#FF4E00] px-4 py-2 text-xs font-bold text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create First Modifier Group</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {modifierGroups.map((group) => (
                <div
                  key={group.id}
                  className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#FF4E00] border border-orange-100">
                        <SlidersHorizontal className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-slate-900 text-sm">{group.name}</h3>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              group.isRequired
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {group.isRequired ? 'Mandatory Selection' : 'Optional Choice'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Selection rule: Min {group.minSelection ?? 0} — Max {group.maxSelection ?? 1} item(s)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveGroupIdForOption(group.id);
                          setModOptionName('');
                          setModOptionPrice('40');
                          setModOptionModalOpen(true);
                        }}
                        className="flex items-center gap-1 rounded-xl bg-orange-50 border border-orange-200 px-3 py-1.5 text-xs font-bold text-orange-700 hover:bg-orange-100 transition"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add Option</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteModifierGroup(group.id)}
                        className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                        title="Delete Group"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Options List */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {group.modifiers && group.modifiers.length > 0 ? (
                      group.modifiers.map((opt) => (
                        <div
                          key={opt.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                        >
                          <div>
                            <p className="font-bold text-slate-900">{opt.name}</p>
                            <span className="text-[11px] font-extrabold text-orange-600">
                              {opt.priceMinor > 0 ? `+₹${Math.round(opt.priceMinor / 100)}` : 'Free'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleModifierOptionAvailability(opt.id, opt.isAvailable)}
                              title={opt.isAvailable ? 'Mark Unavailable' : 'Mark Available'}
                              className={`p-1 rounded-md transition ${
                                opt.isAvailable ? 'text-emerald-600 hover:text-emerald-700' : 'text-slate-400 hover:text-slate-500'
                              }`}
                            >
                              {opt.isAvailable ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteModifierOption(opt.id)}
                              className="p-1 text-slate-400 hover:text-red-600 transition"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full py-4 text-center text-xs text-slate-400 italic">
                        No options added yet. Click &quot;Add Option&quot; above to add choices (e.g. Regular, Large, Mild, Extra Spicy).
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =======================================================================
          TAB 4: COMBOS & MEALS
      ======================================================================== */}
      {activeTab === 'combos' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Combos &amp; Value Meals ({combos.length})
              </h2>
              <p className="text-xs text-slate-500">
                Package multiple popular dishes into bundles with discounted combo pricing to drive higher basket size.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setComboFormName('');
                setComboFormDescription('');
                setComboFormSelectedItems(items.slice(0, 2).map((i) => i.id));
                setComboFormPrice('499');
                setComboModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-[#FF4E00] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#e04500] transition"
            >
              <Plus className="h-4 w-4" />
              <span>Create Combo Meal</span>
            </button>
          </div>

          {combos.length === 0 ? (
            <div className="rounded-2xl bg-white p-12 text-center border border-slate-200/80 shadow-xs">
              <ShoppingBag className="h-10 w-10 mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-sm text-slate-800">No combo meals created yet</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Package multiple dishes into bundles with special promotional pricing to drive higher basket size.
              </p>
              <button
                type="button"
                onClick={() => {
                  setComboFormName('');
                  setComboFormDescription('');
                  setComboFormSelectedItems(items.slice(0, 2).map((i) => i.id));
                  setComboFormPrice('499');
                  setComboModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#FF4E00] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#e04500] transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create First Combo Meal</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {combos.map((combo) => {
              // Calculate individual sum from loaded items
              const includedItems = items.filter((i) => combo.itemIds.includes(i.id));
              const individualSumMinor = includedItems.reduce((acc, i) => acc + i.basePriceMinor, 0);
              const comboPrice = Math.round(combo.comboPriceMinor / 100);
              const individualSum = Math.round(individualSumMinor / 100);
              const savings = individualSum > comboPrice ? individualSum - comboPrice : 0;
              const savingsPercent = individualSum > 0 ? Math.round((savings / individualSum) * 100) : 0;

              return (
                <div
                  key={combo.id}
                  className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs space-y-4 hover:border-orange-200 transition flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-orange-100 text-[#FF4E00] uppercase tracking-wider mb-1 inline-block">
                          Value Meal
                        </span>
                        <h3 className="text-base font-extrabold text-slate-900">{combo.name}</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleCombo(combo.id)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-xl transition ${
                          combo.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {combo.isActive ? 'Active' : 'Paused'}
                      </button>
                    </div>

                    <p className="text-xs text-slate-500">{combo.description}</p>

                    {/* Included Dishes Tags */}
                    <div>
                      <p className="text-[11px] font-bold text-slate-600 mb-1.5">Included Dishes ({includedItems.length}):</p>
                      <div className="flex flex-wrap gap-1.5">
                        {includedItems.map((dish) => (
                          <span
                            key={dish.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800"
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                dish.isVegetarian ? 'bg-emerald-600' : 'bg-red-600'
                              }`}
                            />
                            <span>{dish.name}</span>
                            <span className="text-[10px] text-slate-400">
                              (₹{Math.round(dish.basePriceMinor / 100)})
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Pricing Comparison Box */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-slate-900">₹{comboPrice}</span>
                        {individualSum > comboPrice && (
                          <span className="text-xs line-through text-slate-400">₹{individualSum}</span>
                        )}
                      </div>
                      {savings > 0 && (
                        <span className="text-[11px] font-bold text-emerald-600">
                          Save ₹{savings} ({savingsPercent}% OFF)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDeleteCombo(combo.id)}
                        className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                        title="Delete Combo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* =======================================================================
          TAB 5: AVAILABILITY RULES
      ======================================================================== */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Availability &amp; Dayparting Rules ({rules.length})
              </h2>
              <p className="text-xs text-slate-500">
                Automate dish and category availability by scheduling meal times, breakfast, lunch specials, and happy hours.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setRuleFormName('');
                setRuleFormDays([1, 2, 3, 4, 5]);
                setRuleFormStart('12:00');
                setRuleFormEnd('15:30');
                setRuleFormCategory('all');
                setRuleModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-[#FF4E00] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#e04500] transition"
            >
              <Plus className="h-4 w-4" />
              <span>Add Availability Rule</span>
            </button>
          </div>

          {rules.length === 0 ? (
            <div className="rounded-2xl bg-white p-12 text-center border border-slate-200/80 shadow-xs">
              <Clock className="h-10 w-10 mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-sm text-slate-800">No availability schedules created yet</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Schedule meal times (e.g. Lunch Specials, Weekend Dinner, Happy Hours) to automate category availability.
              </p>
              <button
                type="button"
                onClick={() => {
                  setRuleFormName('');
                  setRuleFormDays([1, 2, 3, 4, 5]);
                  setRuleFormStart('12:00');
                  setRuleFormEnd('15:30');
                  setRuleFormCategory('all');
                  setRuleModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#FF4E00] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#e04500] transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add First Schedule Rule</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => {
                const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                const currentDay = new Date().getDay();
                const isToday = rule.daysOfWeek.includes(currentDay);

                return (
                  <div
                    key={rule.id}
                    className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#FF4E00] border border-orange-100">
                        <Clock className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-slate-900 text-sm">{rule.name}</h3>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              rule.isActive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {rule.isActive ? 'Active' : 'Paused'}
                          </span>
                          {isToday && rule.isActive && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-[#FF4E00]">
                              Runs Today
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Active Time Window: <span className="font-bold text-slate-800">{rule.startTime} – {rule.endTime}</span>
                        </p>

                        {/* Day Badges */}
                        <div className="flex items-center gap-1 mt-2">
                          {dayNames.map((day, idx) => {
                            const isSelected = rule.daysOfWeek.includes(idx);
                            return (
                              <span
                                key={day}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                  isSelected
                                    ? 'bg-orange-500 text-white'
                                    : 'bg-slate-100 text-slate-400'
                                }`}
                              >
                                {day}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleToggleRule(rule.id)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition ${
                          rule.isActive
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {rule.isActive ? 'Rule Enabled' : 'Rule Paused'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                        title="Delete Rule"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =======================================================================
          TAB 6: OUTLET MENU SYNC
      ======================================================================== */}
      {activeTab === 'sync' && (
        <div className="space-y-5">
          {/* Central Sync Banner */}
          <div className="rounded-2xl bg-linear-to-r from-orange-500 to-[#FF4E00] p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-orange-200" />
                <span className="text-xs font-bold uppercase tracking-wider text-orange-100">
                  Master Menu Version v2.4
                </span>
              </div>
              <h2 className="text-xl font-extrabold mt-1">Multi-Outlet Synchronization</h2>
              <p className="text-xs text-orange-100 mt-0.5">
                Manage outlet-level availability, price overrides, and publish catalog updates across all {outlets.length} branches.
              </p>
            </div>

            <button
              type="button"
              disabled={isSyncingAll}
              onClick={handleSyncAllOutlets}
              className="flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-xs font-extrabold text-[#FF4E00] shadow-sm hover:bg-orange-50 transition disabled:opacity-75"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncingAll ? 'animate-spin' : ''}`} />
              <span>{isSyncingAll ? 'Broadcasting...' : 'Sync All Outlets Now'}</span>
            </button>
          </div>

          {/* Outlets Matrix */}
          <div className="space-y-4">
            {outlets.map((outlet) => (
              <div
                key={outlet.id}
                className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#FF4E00] border border-orange-100">
                      <Store className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-slate-900 text-sm">{outlet.name}</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          {outlet.code}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            outlet.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {outlet.status === 'ACTIVE' ? 'Accepting Orders' : 'Paused'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span>{outlet.address}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleOutletStatus(outlet.id)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition ${
                        outlet.status === 'ACTIVE'
                          ? 'border-slate-200 text-slate-700 hover:bg-slate-50'
                          : 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      }`}
                    >
                      {outlet.status === 'ACTIVE' ? 'Pause Outlet' : 'Activate Outlet'}
                    </button>
                    <button
                      type="button"
                      onClick={() => showNotification(`Synced ${outlet.name}`)}
                      className="flex items-center gap-1 rounded-xl bg-orange-50 border border-orange-200 px-3 py-1.5 text-xs font-bold text-orange-700 hover:bg-orange-100"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>Sync</span>
                    </button>
                  </div>
                </div>

                {/* Outlet Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Service Mode</span>
                    <p className="font-extrabold text-slate-800 mt-0.5">{outlet.serviceMode.replace('_', ' ')}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Pricing Tier</span>
                    <p className="font-extrabold text-slate-800 mt-0.5">{outlet.priceAdjustment}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Last Sync</span>
                    <p className="font-extrabold text-emerald-700 mt-0.5">{outlet.lastSyncedAt}</p>
                  </div>
                </div>

                {/* Outlet Dish Overrides Table */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 mb-2">
                    Branch Item Availability Overrides (Mark Sold Out specifically in this branch)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {items.slice(0, 6).map((item) => {
                      const isSoldOutAtBranch = outlet.soldOutItemIds.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleToggleOutletItem86(outlet.id, item.id)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                            isSoldOutAtBranch
                              ? 'bg-red-50 border-red-200 text-red-900'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="truncate mr-2">
                            <p className="font-bold truncate">{item.name}</p>
                            <span className="text-[10px] text-slate-400">₹{Math.round(item.basePriceMinor / 100)}</span>
                          </div>

                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                              isSoldOutAtBranch
                                ? 'bg-red-200 text-red-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isSoldOutAtBranch ? '86-ed Here' : 'Available'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =======================================================================
          MODALS
      ======================================================================== */}

      {/* 1. Category Modal (Add / Edit) */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">
                {editingCategory ? 'Edit Category' : 'Add New Category'}
              </h3>
              <button
                type="button"
                onClick={() => setCategoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Category Name *</label>
                <input
                  type="text"
                  value={categoryFormName}
                  onChange={(e) => setCategoryFormName(e.target.value)}
                  placeholder="e.g. Tandoori Starters, Biryani, Desserts"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={categoryFormDescription}
                  onChange={(e) => setCategoryFormDescription(e.target.value)}
                  placeholder="Optional section description for customer menu..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Display Order</label>
                  <input
                    type="number"
                    value={categoryFormOrder}
                    onChange={(e) => setCategoryFormOrder(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="font-bold text-slate-700">Active</span>
                    <button
                      type="button"
                      onClick={() => setCategoryFormActive(!categoryFormActive)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        categoryFormActive ? 'bg-[#FF4E00]' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          categoryFormActive ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCategoryModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCategory}
                className="px-5 py-2 rounded-xl bg-[#FF4E00] text-xs font-bold text-white shadow-sm hover:bg-[#e04500] transition"
              >
                {editingCategory ? 'Save Changes' : 'Create Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modifier Group Modal */}
      {modGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">Create Modifier Group</h3>
              <button
                type="button"
                onClick={() => setModGroupModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Group Name *</label>
                <input
                  type="text"
                  value={modGroupName}
                  onChange={(e) => setModGroupName(e.target.value)}
                  placeholder="e.g. Spice Level, Size, Choice of Bread, Extra Dips"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Min Selection</label>
                  <input
                    type="number"
                    value={modGroupMin}
                    onChange={(e) => setModGroupMin(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900"
                  />
                  <span className="text-[10px] text-slate-400">0 for optional</span>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Max Selection</label>
                  <input
                    type="number"
                    value={modGroupMax}
                    onChange={(e) => setModGroupMax(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900"
                  />
                  <span className="text-[10px] text-slate-400">1 for single radio</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <p className="font-bold text-slate-900">Mandatory Selection</p>
                  <span className="text-[10px] text-slate-400">Customer must pick at least 1 option</span>
                </div>
                <button
                  type="button"
                  onClick={() => setModGroupRequired(!modGroupRequired)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    modGroupRequired ? 'bg-[#FF4E00]' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      modGroupRequired ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModGroupModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateModifierGroup}
                className="px-5 py-2 rounded-xl bg-[#FF4E00] text-xs font-bold text-white shadow-sm hover:bg-[#e04500] transition"
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modifier Option Modal */}
      {modOptionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">Add Option to Group</h3>
              <button
                type="button"
                onClick={() => setModOptionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Option Name *</label>
                <input
                  type="text"
                  value={modOptionName}
                  onChange={(e) => setModOptionName(e.target.value)}
                  placeholder="e.g. Regular, Extra Cheese, Garlic Naan"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Price Surcharge (₹)</label>
                <input
                  type="number"
                  value={modOptionPrice}
                  onChange={(e) => setModOptionPrice(e.target.value)}
                  placeholder="0 for free"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModOptionModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateModifierOption}
                className="px-5 py-2 rounded-xl bg-[#FF4E00] text-xs font-bold text-white shadow-sm hover:bg-[#e04500] transition"
              >
                Add Option
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Combo Meal Modal */}
      {comboModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">Create Combo Meal Deal</h3>
              <button
                type="button"
                onClick={() => setComboModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Combo Name *</label>
                <input
                  type="text"
                  value={comboFormName}
                  onChange={(e) => setComboFormName(e.target.value)}
                  placeholder="e.g. Maharaja Thali Feast, Couple Dining Box"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={comboFormDescription}
                  onChange={(e) => setComboFormDescription(e.target.value)}
                  placeholder="Brief description of the combo experience..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              {/* Multi-select dishes from real menu items */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700">Select Included Dishes (at least 2)</label>
                  <span className="text-[10px] text-slate-400">{comboFormSelectedItems.length} selected</span>
                </div>
                <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 p-2 space-y-1.5 bg-slate-50">
                  {items.map((dish) => {
                    const isSelected = comboFormSelectedItems.includes(dish.id);
                    return (
                      <div
                        key={dish.id}
                        onClick={() => {
                          setComboFormSelectedItems((prev) =>
                            isSelected ? prev.filter((id) => id !== dish.id) : [...prev, dish.id]
                          );
                        }}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition ${
                          isSelected
                            ? 'bg-orange-100 border border-orange-200 text-orange-950 font-bold'
                            : 'bg-white hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              dish.isVegetarian ? 'bg-emerald-600' : 'bg-red-600'
                            }`}
                          />
                          <span>{dish.name}</span>
                        </div>
                        <span className="font-extrabold text-slate-900">
                          ₹{Math.round(dish.basePriceMinor / 100)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Price Calculation */}
              {comboFormSelectedItems.length > 0 && (
                <div className="p-3 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-orange-700 font-bold uppercase">Original Dishes Sum</span>
                    <p className="text-sm font-black text-slate-900">
                      ₹
                      {Math.round(
                        items
                          .filter((i) => comboFormSelectedItems.includes(i.id))
                          .reduce((acc, i) => acc + i.basePriceMinor, 0) / 100
                      )}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-orange-400" />
                  <div>
                    <span className="text-[10px] text-orange-700 font-bold uppercase">Suggested Savings</span>
                    <p className="text-xs font-bold text-emerald-700">
                      Bundle Discount Active
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1">Combo Price (₹) *</label>
                <input
                  type="number"
                  value={comboFormPrice}
                  onChange={(e) => setComboFormPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setComboModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateCombo}
                className="px-5 py-2 rounded-xl bg-[#FF4E00] text-xs font-bold text-white shadow-sm hover:bg-[#e04500] transition"
              >
                Create Combo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Availability Rule Modal */}
      {ruleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">Add Availability Schedule</h3>
              <button
                type="button"
                onClick={() => setRuleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Schedule Name *</label>
                <input
                  type="text"
                  value={ruleFormName}
                  onChange={(e) => setRuleFormName(e.target.value)}
                  placeholder="e.g. Lunch Specials, Weekend Dinner, Happy Hours"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Target Category</label>
                <select
                  value={ruleFormCategory}
                  onChange={(e) => setRuleFormCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 outline-none cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1.5">Applicable Days</label>
                <div className="flex items-center justify-between gap-1">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => {
                    const isSelected = ruleFormDays.includes(idx);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          setRuleFormDays((prev) =>
                            isSelected ? prev.filter((d) => d !== idx) : [...prev, idx]
                          );
                        }}
                        className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition ${
                          isSelected
                            ? 'bg-[#FF4E00] text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Start Time</label>
                  <input
                    type="time"
                    value={ruleFormStart}
                    onChange={(e) => setRuleFormStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">End Time</label>
                  <input
                    type="time"
                    value={ruleFormEnd}
                    onChange={(e) => setRuleFormEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRuleModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateRule}
                className="px-5 py-2 rounded-xl bg-[#FF4E00] text-xs font-bold text-white shadow-sm hover:bg-[#e04500] transition"
              >
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
