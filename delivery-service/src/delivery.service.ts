import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DeliveryEntity, DeliveryStatus } from './entities/delivery.entity';
import { DeliveryEventsProducer } from './kafka/delivery-events.producer';

export type Delivery = DeliveryEntity;

@Injectable()
export class DeliveryService implements OnModuleInit {
  async onModuleInit() {
    // Ensure the schema exists on a fresh installation and upgrade older local databases safely.
    await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"');
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS deliveries (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id VARCHAR(100) NOT NULL,
        delivery_address VARCHAR(500) NOT NULL,
        courier_name VARCHAR(150),
        status VARCHAR(30) NOT NULL DEFAULT 'CREATED',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.dataSource.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_deliveries_order_id ON deliveries(order_id)',
    );
  }

  constructor(
    @InjectRepository(DeliveryEntity)
    private readonly deliveries: Repository<DeliveryEntity>,
    private readonly dataSource: DataSource,
    private readonly eventsProducer: DeliveryEventsProducer,
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
    const saved = await this.deliveries.save(delivery);
    await this.eventsProducer.publishStatus(saved);
    return saved;
  }


  async createFromOrderEvent(event: {
    orderId: string;
    deliveryAddress: string;
  }): Promise<Delivery> {
    const existing = await this.deliveries.findOneBy({ orderId: event.orderId });
    if (existing) return existing;

    try {
      const delivery = this.deliveries.create({
        orderId: event.orderId,
        deliveryAddress: event.deliveryAddress,
        status: 'CREATED',
      });
      const saved = await this.deliveries.save(delivery);
      await this.eventsProducer.publishStatus(saved);
      return saved;
    } catch (error) {
      // A unique DB constraint protects against concurrent/replayed Kafka messages.
      const duplicate = await this.deliveries.findOneBy({ orderId: event.orderId });
      if (duplicate) return duplicate;
      throw error;
    }
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
    const saved = await this.deliveries.save(delivery);
    await this.eventsProducer.publishStatus(saved);
    return saved;
  }

  async databaseHealth(): Promise<{ status: string }> {
    await this.dataSource.query('SELECT 1');
    return { status: 'UP' };
  }
}
