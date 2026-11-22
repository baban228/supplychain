import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';
import { DeliveryEntity } from './entities/delivery.entity';
import { KafkaConsumerService } from './kafka/kafka-consumer.service';
import { DeliveryEventsProducer } from './kafka/delivery-events.producer';
export { DeliveryStatus } from './entities/delivery.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DELIVERY_DB_HOST ?? 'localhost',
      port: Number(process.env.DELIVERY_DB_PORT ?? 5432),
      username: process.env.DELIVERY_DB_USER ?? 'supplychain',
      password: process.env.DELIVERY_DB_PASSWORD ?? 'supplychain_dev_password',
      database: process.env.DELIVERY_DB_NAME ?? 'delivery_db',
      entities: [DeliveryEntity],
      synchronize: false,
      retryAttempts: 10,
      retryDelay: 3000,
    }),
    TypeOrmModule.forFeature([DeliveryEntity]),
  ],
  controllers: [DeliveryController],
  providers: [DeliveryEventsProducer, DeliveryService, KafkaConsumerService],
})
export class AppModule {}
