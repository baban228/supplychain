export interface OrderCreatedEvent {
  eventId: string;
  eventType: 'OrderCreated';
  orderId: string;
  customerId: string;
  productId: string;
  quantity: number;
  deliveryAddress: string;
  createdAt: string;
}
