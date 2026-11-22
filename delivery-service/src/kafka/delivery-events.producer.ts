import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Kafka, Producer } from 'kafkajs';

@Injectable()
export class DeliveryEventsProducer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeliveryEventsProducer.name);
  private producer?: Producer;

  async onModuleInit() {
    const brokers = (process.env.KAFKA_BROKERS ?? 'kafka:9092').split(',');
    const kafka = new Kafka({ clientId: 'delivery-service-events', brokers });
    this.producer = kafka.producer();

    for (let attempt = 1; attempt <= 20; attempt++) {
      try {
        await this.producer.connect();
        this.logger.log('Connected to Kafka producer');
        return;
      } catch (error) {
        this.logger.warn(`Kafka producer connection attempt ${attempt}/20 failed`);
        if (attempt === 20) throw error;
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }

  async publishStatus(delivery: { id: string; orderId: string; status: string }): Promise<void> {
    if (!this.producer) {
      this.logger.warn(`Kafka producer is not ready; status event for ${delivery.orderId} was not sent`);
      return;
    }
    const event = {
      eventId: randomUUID(),
      eventType: 'DeliveryStatusUpdated',
      orderId: delivery.orderId,
      deliveryId: delivery.id,
      status: delivery.status,
      occurredAt: new Date().toISOString(),
    };
    try {
      await this.producer.send({
        topic: 'deliveries.status.updated',
        messages: [{ key: delivery.orderId, value: JSON.stringify(event) }],
      });
      this.logger.log(`Published ${delivery.status} for order ${delivery.orderId}`);
    } catch (error) {
      this.logger.error(
        `Could not publish status event for order ${delivery.orderId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async onModuleDestroy() {
    if (this.producer) await this.producer.disconnect();
  }
}
