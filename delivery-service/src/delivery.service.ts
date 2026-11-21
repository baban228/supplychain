import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DeliveryEntity, DeliveryStatus } from './entities/delivery.entity';

export type Delivery = DeliveryEntity;

@Injectable()
export class DeliveryService {
  constructor(
    @InjectRepository(DeliveryEntity)
    private readonly deliveries: Repository<DeliveryEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async create(input: {
    orderId: string;
    deliveryAddress: string;
    courierName?: string;
  }): Promise<Delivery> {
    const delivery = this.deliveries.create({
      ...input,
      status: 'CREATED',
    });
    return this.deliveries.save(delivery);
  }

  async findAll(): Promise<Delivery[]> {
    return this.deliveries.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Delivery> {
    const delivery = await this.deliveries.findOneBy({ id });
    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }
    return delivery;
  }

  async findByOrder(orderId: string): Promise<Delivery[]> {
    return this.deliveries.find({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(id: string, status: DeliveryStatus): Promise<Delivery> {
    const delivery = await this.findOne(id);
    delivery.status = status;
    return this.deliveries.save(delivery);
  }

  async databaseHealth(): Promise<{ status: string }> {
    await this.dataSource.query('SELECT 1');
    return { status: 'UP' };
  }
}
