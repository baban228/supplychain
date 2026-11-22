package com.supplychain.order;

public class SupplierProductNotFoundException extends RuntimeException {
    public SupplierProductNotFoundException(String message) {
        super(message);
    }
}
