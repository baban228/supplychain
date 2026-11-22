import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, Consumer } from 'kafkajs';
import { DeliveryService } from '../delivery.service';
import { OrderCreatedEvent } from './order-created.event';

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private consumer?: Consumer;

  async onModuleInit() {
    const brokers = (process.env.KAFKA_BROKERS ?? 'kafka:9092').split(',');
    const kafka = new Kafka({ clientId: 'delivery-service', brokers });
    this.consumer = kafka.consumer({ groupId: 'delivery-service-group' });

    const maxAttempts = 20;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.consumer.connect();
        break;
      } catch (error) {
        this.logger.warn(`Kafka connection attempt ${attempt}/${maxAttempts} failed`);
        if (attempt === maxAttempts) throw error;
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    await this.consumer.subscribe({ topic: 'orders.created', fromBeginning: true });
    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        if (!message.value) return;
        const event = JSON.parse(message.value.toString()) as OrderCreatedEvent;
        if (event.eventType !== 'OrderCreated' || !event.orderId || !event.deliveryAddress) {
          this.logger.warn(`Ignoring invalid message from ${topic}`);
          return;
        }
        await this.deliveryService.createFromOrderEvent(event);
        this.logger.log(`Processed OrderCreated for order ${event.orderId}`);
      },
    });
    this.logger.log('Kafka consumer subscribed to orders.created');
  }

  async onModuleDestroy() {
    if (this.consumer) await this.consumer.disconnect();
  }

  constructor(private readonly deliveryService: DeliveryService) {}
}
