'use client';

import React, { useState, useMemo } from 'react';
import { X, Plus, Minus, Check } from 'lucide-react';
import type { MenuItemDto, ModifierGroupDto, MenuItemModifierDto } from '@restaurant-saas/contracts';
import type { CartModifier } from '@/lib/customer-cart';

interface FoodDetailsModalProps {
  item: MenuItemDto;
  onClose: () => void;
  onAddToCart: (
    item: MenuItemDto,
    quantity: number,
    selectedModifiers: CartModifier[],
    notes?: string
  ) => void;
}

export default function FoodDetailsModal({ item, onClose, onAddToCart }: FoodDetailsModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize required single-select groups with their first available option
  React.useEffect(() => {
    const initialSelections: Record<string, string[]> = {};
    for (const group of item.modifierGroups || []) {
      if (group.isRequired && group.minSelection === 1 && group.maxSelection === 1 && group.modifiers.length > 0) {
        initialSelections[group.id] = [group.modifiers[0].id];
      }
    }
    setSelectedModifiers(initialSelections);
  }, [item]);

  // Handle modifier selection change
  const handleModifierToggle = (group: ModifierGroupDto, mod: MenuItemModifierDto) => {
    setValidationError(null);
    const currentSelected = selectedModifiers[group.id] || [];

    if (group.maxSelection === 1) {
      // Radio behavior
      setSelectedModifiers((prev) => ({
        ...prev,
        [group.id]: [mod.id],
      }));
      return;
    }

    // Checkbox behavior
    if (currentSelected.includes(mod.id)) {
      setSelectedModifiers((prev) => ({
        ...prev,
        [group.id]: currentSelected.filter((id) => id !== mod.id),
      }));
    } else {
      if (group.maxSelection && currentSelected.length >= group.maxSelection) {
        setValidationError(`Maximum ${group.maxSelection} selections allowed for ${group.name}`);
        return;
      }
      setSelectedModifiers((prev) => ({
        ...prev,
        [group.id]: [...currentSelected, mod.id],
      }));
    }
  };

  // Calculate live item price including selected modifiers
  const { totalUnitMinor, selectedModsList } = useMemo(() => {
    let modsSum = 0;
    const modsList: CartModifier[] = [];

    for (const group of item.modifierGroups || []) {
      const selectedIds = selectedModifiers[group.id] || [];
      for (const modId of selectedIds) {
        const mod = group.modifiers.find((m) => m.id === modId);
        if (mod) {
          modsSum += mod.priceMinor;
          modsList.push({
            id: mod.id,
            name: mod.name,
            priceMinor: mod.priceMinor,
          });
        }
      }
    }

    return {
      totalUnitMinor: item.basePriceMinor + modsSum,
      selectedModsList: modsList,
    };
  }, [item, selectedModifiers]);

  const handleSubmit = () => {
    // Validate required groups
    for (const group of item.modifierGroups || []) {
      const count = (selectedModifiers[group.id] || []).length;
      if (group.isRequired && count < group.minSelection) {
        setValidationError(`Please select at least ${group.minSelection} option(s) for ${group.name}`);
        return;
      }
    }

    onAddToCart(item, quantity, selectedModsList, specialInstructions.trim() || undefined);
    onClose();
  };

  const formattedBasePrice = (item.basePriceMinor / 100).toFixed(2);
  const formattedTotalPrice = ((totalUnitMinor * quantity) / 100).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in-50 slide-in-from-bottom-5">
        {/* Header / Close */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            {/* Veg / Non-Veg Indicator */}
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-xs border p-0.5 ${
                item.isVegetarian
                  ? 'border-emerald-600'
                  : 'border-red-600'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  item.isVegetarian ? 'bg-emerald-600' : 'bg-red-600'
                }`}
              />
            </span>
            <span className="font-bold text-slate-900 text-lg">{item.name}</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* Item details */}
          <div>
            <div className="flex items-baseline justify-between">
              <span className="font-extrabold text-slate-900 text-xl">₹{formattedBasePrice}</span>
              {item.prepTimeMinutes && (
                <span className="text-xs text-slate-500 font-medium">⏱ ~{item.prepTimeMinutes} mins</span>
              )}
            </div>
            {item.description && (
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{item.description}</p>
            )}
          </div>

          {validationError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
              {validationError}
            </div>
          )}

          {/* Modifier Groups */}
          {item.modifierGroups && item.modifierGroups.map((group) => {
            const isSingle = group.maxSelection === 1;
            const currentSelected = selectedModifiers[group.id] || [];

            return (
              <div key={group.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{group.name}</h4>
                    <p className="text-xs text-slate-500">
                      {isSingle
                        ? group.isRequired
                          ? 'Select 1 (Required)'
                          : 'Select 1 (Optional)'
                        : `Choose up to ${group.maxSelection || 'any'}`}
                    </p>
                  </div>
                  {group.isRequired && (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                      REQUIRED
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {group.modifiers.map((mod) => {
                    const isSelected = currentSelected.includes(mod.id);
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => handleModifierToggle(group, mod)}
                        className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition ${
                          isSelected
                            ? 'border-orange-500 bg-orange-50/50 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-4 w-4 items-center justify-center rounded-${
                              isSingle ? 'full' : 'sm'
                            } border transition ${
                              isSelected
                                ? 'border-orange-600 bg-orange-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                          <span className={`text-sm ${isSelected ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                            {mod.name}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-slate-900">
                          {mod.priceMinor > 0 ? `+₹${(mod.priceMinor / 100).toFixed(2)}` : 'Free'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Special Instructions */}
          <div>
            <label className="block font-bold text-slate-900 text-sm mb-1.5">
              Special Instructions
            </label>
            <textarea
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="e.g. Extra spicy, no onions, dressing on the side..."
              rows={2}
              className="w-full rounded-xl border border-slate-200 p-3 text-sm placeholder:text-slate-400 focus:border-orange-500 focus:outline-hidden focus:ring-1 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* Footer with Quantity & Add to Cart */}
        <div className="border-t border-slate-100 bg-white p-4">
          <div className="flex items-center gap-3">
            {/* Quantity Stepper */}
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-700 shadow-xs hover:bg-slate-100"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-9 text-center font-bold text-slate-900 text-sm">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-700 shadow-xs hover:bg-slate-100"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Add Button */}
            <button
              type="button"
              onClick={handleSubmit}
              className="flex-1 rounded-xl bg-orange-600 py-3 px-4 font-bold text-white shadow-md shadow-orange-200 transition hover:bg-orange-700 active:scale-[0.99]"
            >
              Add to Cart • ₹{formattedTotalPrice}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
