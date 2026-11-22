package com.supplychain.order;

public class SupplierUnavailableException extends RuntimeException {
    public SupplierUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
