import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { MenuService } from './menu.service.js';
import { RolesGuard } from '../rbac/roles.guard.js';
import { RequireRoles } from '../rbac/decorators.js';
import type {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateMenuItemDto,
  UpdateMenuItemDto,
  ToggleMenuItemAvailabilityDto,
  CreateModifierGroupDto,
  CreateModifierOptionDto,
} from '@restaurant-saas/contracts';

@Controller('v1/owner/menu')
@UseGuards(RolesGuard)
@RequireRoles('OWNER', 'MANAGER', 'RESTAURANT_OWNER', 'CHEF')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  // ---------------------------------------------------------------------------
  // Categories
  // ---------------------------------------------------------------------------

  @Get('categories')
  async listCategories(@Req() req: any) {
    const tenantId = req.tenantContext?.tenantId;
    if (!tenantId) throw new ForbiddenException('Tenant context missing');
    return this.menuService.listCategories(tenantId);
  }

  @Post('categories')
  async createCategory(@Req() req: any, @Body() body: CreateCategoryDto) {
    const tenantId = req.tenantContext?.tenantId;
    const locationId = req.tenantContext?.locationId;
    if (!tenantId) throw new ForbiddenException('Tenant context missing');
    return this.menuService.createCategory(tenantId, locationId, body);
  }

  @Patch('categories/:id')
  async updateCategory(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateCategoryDto
  ) {
    const tenantId = req.tenantContext?.tenantId;
    if (!tenantId) throw new ForbiddenException('Tenant context missing');
    return this.menuService.updateCategory(tenantId, id, body);
  }

  @Delete('categories/:id')
  async deleteCategory(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantContext?.tenantId;
    if (!tenantId) throw new ForbiddenException('Tenant context missing');
    return this.menuService.deleteCategory(tenantId, id);
  }

  // ---------------------------------------------------------------------------
  // Menu Items
  // ---------------------------------------------------------------------------

  @Get('items')
  async listItems(
    @Req() req: any,
    @Query('categoryId') categoryId?: string
  ) {
    const tenantId = req.tenantContext?.tenantId;
    if (!tenantId) throw new ForbiddenException('Tenant context missing');
    return this.menuService.listItems(tenantId, categoryId);
  }

  @Post('items')
  async createItem(@Req() req: any, @Body() body: CreateMenuItemDto) {
    const tenantId = req.tenantContext?.tenantId;
    const locationId = req.tenantContext?.locationId;
    if (!tenantId) throw new ForbiddenException('Tenant context missing');
    return this.menuService.createItem(tenantId, locationId, body);
  }

  @Patch('items/:id')
  async updateItem(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateMenuItemDto
  ) {
    const tenantId = req.tenantContext?.tenantId;
    if (!tenantId) throw new ForbiddenException('Tenant context missing');
    return this.menuService.updateItem(tenantId, id, body);
  }

  @Patch('items/:id/availability')
  async toggleAvailability(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: ToggleMenuItemAvailabilityDto
  ) {
    const tenantId = req.tenantContext?.tenantId;
    if (!tenantId) throw new ForbiddenException('Tenant context missing');
    return this.menuService.toggleAvailability(tenantId, id, body.isAvailable);
  }

  @Delete('items/:id')
  async deleteItem(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantContext?.tenantId;
    if (!tenantId) throw new ForbiddenException('Tenant context missing');
    return this.menuService.deleteItem(tenantId, id);
  }

  // ---------------------------------------------------------------------------
  // Modifiers & Variants
  // ---------------------------------------------------------------------------

  @Get('modifier-groups')
  async listModifierGroups(@Req() req: any) {
    const tenantId = req.tenantContext?.tenantId;
    if (!tenantId) throw new ForbiddenException('Tenant context missing');
    return this.menuService.listModifierGroups(tenantId);
  }

  @Post('modifier-groups')
  async createModifierGroup(
    @Req() req: any,
    @Body() body: CreateModifierGroupDto
  ) {
    const tenantId = req.tenantContext?.tenantId;
    if (!tenantId) throw new ForbiddenException('Tenant context missing');
    return this.menuService.createModifierGroup(tenantId, body);
  }

  @Delete('modifier-groups/:id')
  async deleteModifierGroup(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantContext?.tenantId;
    if (!tenantId) throw new ForbiddenException('Tenant context missing');
    return this.menuService.deleteModifierGroup(tenantId, id);
  }

  @Post('modifier-groups/:groupId/modifiers')
  async createModifierOption(
    @Req() req: any,
    @Param('groupId') groupId: string,
    @Body() body: CreateModifierOptionDto
  ) {
    const tenantId = req.tenantContext?.tenantId;
    if (!tenantId) throw new ForbiddenException('Tenant context missing');
    return this.menuService.createModifierOption(tenantId, groupId, body);
  }

  @Delete('modifiers/:id')
  async deleteModifierOption(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantContext?.tenantId;
    if (!tenantId) throw new ForbiddenException('Tenant context missing');
    return this.menuService.deleteModifierOption(tenantId, id);
  }

  @Patch('modifiers/:id/availability')
  async toggleModifierAvailability(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { isAvailable: boolean }
  ) {
    const tenantId = req.tenantContext?.tenantId;
    if (!tenantId) throw new ForbiddenException('Tenant context missing');
    return this.menuService.toggleModifierOptionAvailability(tenantId, id, body.isAvailable);
  }

  @Post('sync-outlets')
  async syncOutlets(@Req() req: any) {
    const tenantId = req.tenantContext?.tenantId;
    if (!tenantId) throw new ForbiddenException('Tenant context missing');
    return this.menuService.syncOutlets(tenantId);
  }
}
