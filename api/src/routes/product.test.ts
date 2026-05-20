import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import router, { inventoryEvents, resetProducts } from './product';

let app: express.Express;

describe('Product API', () => {
    const baseProduct = {
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

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/products', router);
        resetProducts();
        inventoryEvents.removeAllListeners();
    });

    it('should reject PUT when required fields are missing', async () => {
        await request(app).post('/products').send(baseProduct);

        const response = await request(app)
            .put('/products/999')
            .send({
                productId: 999,
                supplierId: 1,
                name: 'Threshold Tester',
                description: 'Inventory boundary test product',
                price: 10,
                sku: 'THRESHOLD-001',
                unit: 'piece',
                imgName: 'threshold.png',
                quantity: 6
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('reorder_threshold');
    });

    it('should reject PUT when body productId does not match path id', async () => {
        await request(app).post('/products').send(baseProduct);

        const response = await request(app)
            .put('/products/999')
            .send({ ...baseProduct, productId: 1000 });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('productId in request body must match path id');
    });

    it('should not emit low-stock alert at threshold boundary', async () => {
        const lowStockListener = vi.fn();
        inventoryEvents.on('low-stock-alert', lowStockListener);

        const createResponse = await request(app).post('/products').send(baseProduct);
        expect(createResponse.status).toBe(201);

        const atThresholdResponse = await request(app)
            .put('/products/999')
            .send({ ...baseProduct, quantity: 5 });

        expect(atThresholdResponse.status).toBe(200);
        expect(lowStockListener).not.toHaveBeenCalled();
    });

    it('should emit one low-stock alert when quantity crosses below threshold', async () => {
        const lowStockListener = vi.fn();
        inventoryEvents.on('low-stock-alert', lowStockListener);

        const createResponse = await request(app).post('/products').send(baseProduct);
        expect(createResponse.status).toBe(201);

        const belowThresholdResponse = await request(app)
            .put('/products/999')
            .send({ ...baseProduct, quantity: 4 });

        expect(belowThresholdResponse.status).toBe(200);
        expect(lowStockListener).toHaveBeenCalledTimes(1);
        expect(lowStockListener).toHaveBeenCalledWith({
            productId: 999,
            quantity: 4,
            reorder_threshold: 5
        });
    });

    it('should not emit duplicate low-stock alert when already below threshold', async () => {
        const lowStockListener = vi.fn();
        inventoryEvents.on('low-stock-alert', lowStockListener);

        await request(app).post('/products').send(baseProduct);

        const firstBelowThresholdResponse = await request(app)
            .put('/products/999')
            .send({ ...baseProduct, quantity: 4 });
        expect(firstBelowThresholdResponse.status).toBe(200);

        const secondBelowThresholdResponse = await request(app)
            .put('/products/999')
            .send({ ...baseProduct, quantity: 3 });
        expect(secondBelowThresholdResponse.status).toBe(200);

        expect(lowStockListener).toHaveBeenCalledTimes(1);
        expect(lowStockListener).toHaveBeenCalledWith({
            productId: 999,
            quantity: 4,
            reorder_threshold: 5
        });
    });
});
