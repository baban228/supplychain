import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

export type DeliveryStatus = 'CREATED' | 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';

export interface Delivery {
  id: string;
  orderId: string;
  deliveryAddress: string;
  courierName?: string;
  status: DeliveryStatus;
  createdAt: string;
}

@Injectable()
export class DeliveryService {
  private readonly deliveries = new Map<string, Delivery>();

  create(input: { orderId: string; deliveryAddress: string; courierName?: string }): Delivery {
    const delivery: Delivery = {
      id: randomUUID(),
      ...input,
      status: 'CREATED',
      createdAt: new Date().toISOString(),
    };
    this.deliveries.set(delivery.id, delivery);
    return delivery;
  }

  findAll(): Delivery[] {
    return [...this.deliveries.values()];
  }

  findOne(id: string): Delivery {
    const delivery = this.deliveries.get(id);
    if (!delivery) throw new NotFoundException('Delivery not found');
    return delivery;
  }

  findByOrder(orderId: string): Delivery[] {
    return this.findAll().filter((d) => d.orderId === orderId);
  }

  updateStatus(id: string, status: DeliveryStatus): Delivery {
    const old = this.findOne(id);
    const updated = { ...old, status };
    this.deliveries.set(id, updated);
    return updated;
  }
}
