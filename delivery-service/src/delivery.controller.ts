import {
  BadRequestException, Body, Controller, Get, Param, Patch, Post, Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DeliveryService, DeliveryStatus } from './delivery.service';

class CreateDeliveryDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsString()
  @IsNotEmpty()
  deliveryAddress!: string;

  @IsOptional()
  @IsString()
  courierName?: string;
}

@ApiTags('deliveries')
@Controller('deliveries')
export class DeliveryController {
  constructor(private readonly service: DeliveryService) {}

  @Get('/health')
  health() {
    return { status: 'UP', service: 'delivery-service' };
  }

  @Post()
  @ApiOperation({ summary: 'Создать доставку (пока вручную, Kafka подключим позже)' })
  create(@Body() body: CreateDeliveryDto) {
    return this.service.create(body);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('/by-order/:orderId')
  findByOrder(@Param('orderId') orderId: string) {
    return this.service.findByOrder(orderId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Query('status') status: DeliveryStatus,
  ) {
    const allowed: DeliveryStatus[] = ['CREATED', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Invalid status. Allowed: ${allowed.join(', ')}`);
    }
    return this.service.updateStatus(id, status);
  }
}
