import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import type {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateMenuItemDto,
  UpdateMenuItemDto,
  MenuCategoryDto,
  MenuItemDto,
  CreateModifierGroupDto,
  CreateModifierOptionDto,
  ModifierGroupDto,
  MenuItemModifierDto,
} from '@restaurant-saas/contracts';

@Injectable()
export class MenuService {
  constructor(private readonly db: DatabaseService) {}

  // ---------------------------------------------------------------------------
  // Categories Management (FR-OWN-01)
  // ---------------------------------------------------------------------------

  async listCategories(tenantId: string): Promise<MenuCategoryDto[]> {
    const res = await this.db.query(
      `SELECT 
         c.id,
         c.name,
         c.slug,
         c.description,
         c.display_order,
         c.is_active,
         COUNT(i.id)::int AS items_count
       FROM menu_categories c
       LEFT JOIN menu_items i ON i.category_id = c.id
       WHERE c.tenant_id = $1
       GROUP BY c.id
       ORDER BY c.display_order ASC, c.name ASC`,
      [tenantId]
    );

    return res.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description || undefined,
      displayOrder: row.display_order,
      isActive: row.is_active,
      itemsCount: row.items_count,
      items: [],
    }));
  }

  async createCategory(
    tenantId: string,
    locationId: string | undefined,
    dto: CreateCategoryDto
  ): Promise<MenuCategoryDto> {
    const slug = dto.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const res = await this.db.query(
      `INSERT INTO menu_categories (tenant_id, location_id, name, slug, description, display_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, name, slug, description, display_order, is_active`,
      [
        tenantId,
        locationId || null,
        dto.name.trim(),
        slug || 'category',
        dto.description || null,
        dto.displayOrder ?? 0,
      ]
    );

    const row = res.rows[0];
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description || undefined,
      displayOrder: row.display_order,
      isActive: row.is_active,
      itemsCount: 0,
      items: [],
    };
  }

  async updateCategory(
    tenantId: string,
    id: string,
    dto: UpdateCategoryDto
  ): Promise<MenuCategoryDto> {
    const existing = await this.db.query(
      `SELECT id FROM menu_categories WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (existing.rows.length === 0) {
      throw new NotFoundException('Category not found');
    }

    const updates: string[] = [];
    const values: any[] = [id, tenantId];
    let idx = 3;

    if (dto.name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(dto.name.trim());
      const slug = dto.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      updates.push(`slug = $${idx++}`);
      values.push(slug || 'category');
    }
    if (dto.description !== undefined) {
      updates.push(`description = $${idx++}`);
      values.push(dto.description);
    }
    if (dto.displayOrder !== undefined) {
      updates.push(`display_order = $${idx++}`);
      values.push(dto.displayOrder);
    }
    if (dto.isActive !== undefined) {
      updates.push(`is_active = $${idx++}`);
      values.push(dto.isActive);
    }

    if (updates.length === 0) {
      throw new BadRequestException('No fields to update');
    }

    updates.push(`updated_at = now()`);

    const query = `
      UPDATE menu_categories
      SET ${updates.join(', ')}
      WHERE id = $1 AND tenant_id = $2
      RETURNING id, name, slug, description, display_order, is_active
    `;

    const res = await this.db.query(query, values);
    const row = res.rows[0];
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description || undefined,
      displayOrder: row.display_order,
      isActive: row.is_active,
      items: [],
    };
  }

  async deleteCategory(tenantId: string, id: string): Promise<{ success: boolean }> {
    const res = await this.db.query(
      `DELETE FROM menu_categories WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, tenantId]
    );
    if (res.rows.length === 0) {
      throw new NotFoundException('Category not found');
    }
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Menu Items Management (FR-OWN-01, FR-ORD-03)
  // ---------------------------------------------------------------------------

  async listItems(tenantId: string, categoryId?: string): Promise<MenuItemDto[]> {
    let query = `
      SELECT 
        i.id,
        i.category_id,
        c.name AS category_name,
        i.name,
        i.description,
        i.base_price_minor,
        i.currency,
        i.image_url,
        i.is_available,
        i.is_vegetarian,
        i.preparation_time_minutes,
        i.display_order
      FROM menu_items i
      JOIN menu_categories c ON c.id = i.category_id
      WHERE i.tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (categoryId) {
      query += ` AND i.category_id = $2`;
      params.push(categoryId);
    }

    query += ` ORDER BY c.display_order ASC, i.display_order ASC, i.name ASC`;

    const res = await this.db.query(query, params);

    return res.rows.map((row: any) => ({
      id: row.id,
      categoryId: row.category_id,
      categoryName: row.category_name,
      name: row.name,
      description: row.description || undefined,
      basePriceMinor: row.base_price_minor,
      currency: row.currency || 'INR',
      imageUrl: row.image_url || undefined,
      isAvailable: row.is_available,
      isVegetarian: row.is_vegetarian,
      prepTimeMinutes: row.preparation_time_minutes,
    }));
  }

  async createItem(
    tenantId: string,
    locationId: string | undefined,
    dto: CreateMenuItemDto
  ): Promise<MenuItemDto> {
    if (dto.basePriceMinor < 0) {
      throw new BadRequestException('Price must be greater than or equal to 0');
    }

    const catRes = await this.db.query(
      `SELECT name FROM menu_categories WHERE id = $1 AND tenant_id = $2`,
      [dto.categoryId, tenantId]
    );
    if (catRes.rows.length === 0) {
      throw new NotFoundException('Category not found');
    }
    const categoryName = catRes.rows[0].name;

    const res = await this.db.query(
      `INSERT INTO menu_items (
         tenant_id,
         location_id,
         category_id,
         name,
         description,
         base_price_minor,
         currency,
         is_available,
         is_vegetarian,
         preparation_time_minutes,
         image_url
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'INR', $7, $8, $9, $10)
       RETURNING id, category_id, name, description, base_price_minor, currency, is_available, is_vegetarian, preparation_time_minutes, image_url`,
      [
        tenantId,
        locationId || null,
        dto.categoryId,
        dto.name.trim(),
        dto.description || null,
        dto.basePriceMinor,
        dto.isAvailable ?? true,
        dto.isVegetarian ?? false,
        dto.prepTimeMinutes ?? 15,
        dto.imageUrl || null,
      ]
    );

    const row = res.rows[0];
    return {
      id: row.id,
      categoryId: row.category_id,
      categoryName,
      name: row.name,
      description: row.description || undefined,
      basePriceMinor: row.base_price_minor,
      currency: row.currency,
      isAvailable: row.is_available,
      isVegetarian: row.is_vegetarian,
      prepTimeMinutes: row.preparation_time_minutes,
      imageUrl: row.image_url || undefined,
    };
  }

  async updateItem(
    tenantId: string,
    id: string,
    dto: UpdateMenuItemDto
  ): Promise<MenuItemDto> {
    const existing = await this.db.query(
      `SELECT id, category_id FROM menu_items WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (existing.rows.length === 0) {
      throw new NotFoundException('Menu item not found');
    }

    const updates: string[] = [];
    const values: any[] = [id, tenantId];
    let idx = 3;

    if (dto.categoryId !== undefined) {
      const catCheck = await this.db.query(
        `SELECT id FROM menu_categories WHERE id = $1 AND tenant_id = $2`,
        [dto.categoryId, tenantId]
      );
      if (catCheck.rows.length === 0) {
        throw new NotFoundException('Selected category not found');
      }
      updates.push(`category_id = $${idx++}`);
      values.push(dto.categoryId);
    }
    if (dto.name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(dto.name.trim());
    }
    if (dto.description !== undefined) {
      updates.push(`description = $${idx++}`);
      values.push(dto.description);
    }
    if (dto.basePriceMinor !== undefined) {
      if (dto.basePriceMinor < 0) throw new BadRequestException('Price must be >= 0');
      updates.push(`base_price_minor = $${idx++}`);
      values.push(dto.basePriceMinor);
    }
    if (dto.isVegetarian !== undefined) {
      updates.push(`is_vegetarian = $${idx++}`);
      values.push(dto.isVegetarian);
    }
    if (dto.prepTimeMinutes !== undefined) {
      updates.push(`preparation_time_minutes = $${idx++}`);
      values.push(dto.prepTimeMinutes);
    }
    if (dto.imageUrl !== undefined) {
      updates.push(`image_url = $${idx++}`);
      values.push(dto.imageUrl);
    }
    if (dto.isAvailable !== undefined) {
      updates.push(`is_available = $${idx++}`);
      values.push(dto.isAvailable);
    }

    if (updates.length === 0) {
      throw new BadRequestException('No fields to update');
    }

    updates.push(`updated_at = now()`);

    const query = `
      UPDATE menu_items
      SET ${updates.join(', ')}
      WHERE id = $1 AND tenant_id = $2
      RETURNING id, category_id, name, description, base_price_minor, currency, is_available, is_vegetarian, preparation_time_minutes, image_url
    `;

    const res = await this.db.query(query, values);
    const row = res.rows[0];

    const catRes = await this.db.query(
      `SELECT name FROM menu_categories WHERE id = $1`,
      [row.category_id]
    );

    return {
      id: row.id,
      categoryId: row.category_id,
      categoryName: catRes.rows[0]?.name || '',
      name: row.name,
      description: row.description || undefined,
      basePriceMinor: row.base_price_minor,
      currency: row.currency,
      isAvailable: row.is_available,
      isVegetarian: row.is_vegetarian,
      prepTimeMinutes: row.preparation_time_minutes,
      imageUrl: row.image_url || undefined,
    };
  }

  async toggleAvailability(
    tenantId: string,
    id: string,
    isAvailable: boolean
  ): Promise<{ id: string; isAvailable: boolean }> {
    const res = await this.db.query(
      `UPDATE menu_items
       SET is_available = $1, updated_at = now()
       WHERE id = $2 AND tenant_id = $3
       RETURNING id, is_available`,
      [isAvailable, id, tenantId]
    );

    if (res.rows.length === 0) {
      throw new NotFoundException('Menu item not found');
    }

    return {
      id: res.rows[0].id,
      isAvailable: res.rows[0].is_available,
    };
  }

  async deleteItem(tenantId: string, id: string): Promise<{ success: boolean }> {
    const res = await this.db.query(
      `DELETE FROM menu_items WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, tenantId]
    );
    if (res.rows.length === 0) {
      throw new NotFoundException('Menu item not found');
    }
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Modifiers & Variants Management (FR-ORD-03)
  // ---------------------------------------------------------------------------

  async listModifierGroups(tenantId: string): Promise<ModifierGroupDto[]> {
    const groupRes = await this.db.query(
      `SELECT id, name, min_selection, max_selection, is_required
       FROM modifier_groups
       WHERE tenant_id = $1
       ORDER BY name ASC`,
      [tenantId]
    );

    const groups: ModifierGroupDto[] = [];

    for (const g of groupRes.rows) {
      const itemsRes = await this.db.query(
        `SELECT id, name, price_minor, is_available
         FROM item_modifiers
         WHERE group_id = $1
         ORDER BY display_order ASC, name ASC`,
        [g.id]
      );

      groups.push({
        id: g.id,
        name: g.name,
        minSelection: g.min_selection,
        maxSelection: g.max_selection,
        isRequired: g.is_required,
        modifiers: itemsRes.rows.map((m: any) => ({
          id: m.id,
          name: m.name,
          priceMinor: m.price_minor,
          isAvailable: m.is_available,
        })),
      });
    }

    return groups;
  }

  async createModifierGroup(tenantId: string, dto: CreateModifierGroupDto): Promise<ModifierGroupDto> {
    const res = await this.db.query(
      `INSERT INTO modifier_groups (tenant_id, name, min_selection, max_selection, is_required)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, min_selection, max_selection, is_required`,
      [
        tenantId,
        dto.name.trim(),
        dto.minSelection ?? 0,
        dto.maxSelection ?? 1,
        dto.isRequired ?? false,
      ]
    );

    const row = res.rows[0];
    return {
      id: row.id,
      name: row.name,
      minSelection: row.min_selection,
      maxSelection: row.max_selection,
      isRequired: row.is_required,
      modifiers: [],
    };
  }

  async deleteModifierGroup(tenantId: string, id: string): Promise<{ success: boolean }> {
    const res = await this.db.query(
      `DELETE FROM modifier_groups WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, tenantId]
    );
    if (res.rows.length === 0) {
      throw new NotFoundException('Modifier group not found');
    }
    return { success: true };
  }

  async createModifierOption(
    tenantId: string,
    groupId: string,
    dto: CreateModifierOptionDto
  ): Promise<MenuItemModifierDto> {
    const groupCheck = await this.db.query(
      `SELECT id FROM modifier_groups WHERE id = $1 AND tenant_id = $2`,
      [groupId, tenantId]
    );
    if (groupCheck.rows.length === 0) {
      throw new NotFoundException('Modifier group not found');
    }

    const res = await this.db.query(
      `INSERT INTO item_modifiers (group_id, name, price_minor, is_available, display_order)
       VALUES ($1, $2, $3, $4, 0)
       RETURNING id, name, price_minor, is_available`,
      [groupId, dto.name.trim(), dto.priceMinor, dto.isAvailable ?? true]
    );

    const row = res.rows[0];
    return {
      id: row.id,
      name: row.name,
      priceMinor: row.price_minor,
      isAvailable: row.is_available,
    };
  }

  async deleteModifierOption(tenantId: string, id: string): Promise<{ success: boolean }> {
    // Verify tenant ownership via modifier group
    const res = await this.db.query(
      `DELETE FROM item_modifiers
       WHERE id = $1 AND group_id IN (SELECT id FROM modifier_groups WHERE tenant_id = $2)
       RETURNING id`,
      [id, tenantId]
    );
    if (res.rows.length === 0) {
      throw new NotFoundException('Modifier option not found');
    }
    return { success: true };
  }

  async toggleModifierOptionAvailability(
    tenantId: string,
    id: string,
    isAvailable: boolean
  ): Promise<{ id: string; isAvailable: boolean }> {
    const res = await this.db.query(
      `UPDATE item_modifiers
       SET is_available = $1
       WHERE id = $2 AND group_id IN (SELECT id FROM modifier_groups WHERE tenant_id = $3)
       RETURNING id, is_available`,
      [isAvailable, id, tenantId]
    );
    if (res.rows.length === 0) {
      throw new NotFoundException('Modifier option not found');
    }
    return { id: res.rows[0].id, isAvailable: res.rows[0].is_available };
  }

  async syncOutlets(tenantId: string): Promise<{ success: boolean; syncedAt: string; outletsCount: number }> {
    const locRes = await this.db.query(
      `SELECT count(*)::int as count FROM locations WHERE tenant_id = $1 AND status = 'ACTIVE'`,
      [tenantId]
    );
    return {
      success: true,
      syncedAt: new Date().toISOString(),
      outletsCount: locRes.rows[0]?.count || 0,
    };
  }
}
