import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import productRouter, { inventoryEvents, resetProducts } from './product';

let app: express.Express;

describe('Product API', () => {
    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/products', productRouter);
        resetProducts();
        inventoryEvents.removeAllListeners();
    });

    it('should emit low-stock alert only when quantity drops below reorder threshold', async () => {
        const lowStockListener = vi.fn();
        inventoryEvents.on('low-stock-alert', lowStockListener);

        const product = {
            productId: 999,
            supplierId: 1,
            name: 'Threshold Tester',
            description: 'Inventory boundary test product',
            price: 10,
            sku: 'THRESHOLD-001',
            unit: 'piece',
            imgName: 'threshold.png',
            quantity: 6,
            reorder_threshold: 5
        };

        const createResponse = await request(app).post('/products').send(product);
        expect(createResponse.status).toBe(201);

        const atThresholdResponse = await request(app)
            .put('/products/999')
            .send({ ...product, quantity: 5 });
        expect(atThresholdResponse.status).toBe(200);
        expect(lowStockListener).not.toHaveBeenCalled();

        const belowThresholdResponse = await request(app)
            .put('/products/999')
            .send({ ...product, quantity: 4 });
        expect(belowThresholdResponse.status).toBe(200);
        expect(lowStockListener).toHaveBeenCalledTimes(1);
        expect(lowStockListener).toHaveBeenCalledWith({
            productId: 999,
            quantity: 4,
            reorder_threshold: 5
        });
    });
});
