import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { StaffManagementController } from './staff-management.controller.js';
import { StaffManagementService } from './staff-management.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [StaffManagementController],
  providers: [StaffManagementService],
  exports: [StaffManagementService],
})
export class StaffManagementModule {}
