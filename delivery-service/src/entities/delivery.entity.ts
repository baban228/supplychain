import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type DeliveryStatus =
  | 'CREATED'
  | 'ASSIGNED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED';

@Entity({ name: 'deliveries' })
@Index('idx_deliveries_order_id', ['orderId'])
export class DeliveryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'order_id', type: 'varchar', length: 100 })
  orderId!: string;

  @Column({ name: 'delivery_address', type: 'varchar', length: 500 })
  deliveryAddress!: string;

  @Column({ name: 'courier_name', type: 'varchar', length: 150, nullable: true })
  courierName?: string;

  @Column({ type: 'varchar', length: 30, default: 'CREATED' })
  status!: DeliveryStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
