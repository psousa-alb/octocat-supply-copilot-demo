/**
 * @swagger
 * tags:
 *   name: Products
 *   description: API endpoints for managing products
 */

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Returns all products
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: List of all products
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 *   post:
 *     summary: Create a new product
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Product'
 *     responses:
 *       201:
 *         description: Product created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 * 
 * /api/products/{id}:
 *   get:
 *     summary: Get a product by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       404:
 *         description: Product not found
 *   put:
 *     summary: Update a product
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Product'
 *     responses:
 *       200:
 *         description: Product updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       404:
 *         description: Product not found
 *   delete:
 *     summary: Delete a product
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *     responses:
 *       204:
 *         description: Product deleted successfully
 *       404:
 *         description: Product not found
 */

import express from 'express';
import { EventEmitter } from 'events';
import { Product } from '../models/product';
import { products as seedProducts } from '../seedData';

const router = express.Router();

let products: Product[] = [...seedProducts];
export const inventoryEvents = new EventEmitter();
const requiredPutFields: Array<keyof Product> = [
  'productId',
  'supplierId',
  'name',
  'description',
  'price',
  'sku',
  'unit',
  'imgName',
  'quantity',
  'reorder_threshold'
];

const getQuantity = (product: Product): number | undefined =>
  typeof product.quantity === 'number' ? product.quantity : undefined;

const getReorderThreshold = (product: Product): number | undefined => {
  if (typeof product.reorder_threshold === 'number') {
    return product.reorder_threshold;
  }
  return undefined;
};

export const resetProducts = () => {
  products = [...seedProducts];
};

// Create a new product
router.post('/', (req, res) => {
  const newProduct: Product = req.body;
  products.push(newProduct);
  res.status(201).json(newProduct);
});

// Get all products
router.get('/', (req, res) => {
  res.json(products);
});

// Get a product by ID
router.get('/:id', (req, res) => {
  const product = products.find(p => p.productId === parseInt(req.params.id));
  if (product) {
    res.json(product);
  } else {
    res.status(404).send('Product not found');
  }
});

// Update a product by ID
router.put('/:id', (req, res) => {
  const pathProductId = parseInt(req.params.id);
  const index = products.findIndex(p => p.productId === pathProductId);
  if (index !== -1) {
    const updatedProduct: Product = req.body;
    const missingRequiredFields = requiredPutFields.filter((field) => updatedProduct[field] === undefined || updatedProduct[field] === null);

    if (missingRequiredFields.length > 0) {
      res.status(400).json({
        message: `Missing required fields: ${missingRequiredFields.join(', ')}`
      });
      return;
    }

    if (updatedProduct.productId !== pathProductId) {
      res.status(400).json({
        message: 'productId in request body must match path id'
      });
      return;
    }

    const currentProduct = products[index];
    const previousQuantity = getQuantity(currentProduct);
    const updatedQuantity = getQuantity(updatedProduct);
    const reorderThreshold = getReorderThreshold(updatedProduct) ?? getReorderThreshold(currentProduct);

    products[index] = { ...updatedProduct, productId: pathProductId };

    if (
      typeof reorderThreshold === 'number' &&
      typeof previousQuantity === 'number' &&
      typeof updatedQuantity === 'number' &&
      previousQuantity >= reorderThreshold &&
      updatedQuantity < reorderThreshold
    ) {
      inventoryEvents.emit('low-stock-alert', {
        productId: pathProductId,
        quantity: updatedQuantity,
        reorder_threshold: reorderThreshold
      });
    }

    res.json(products[index]);
  } else {
    res.status(404).send('Product not found');
  }
});

// Delete a product by ID
router.delete('/:id', (req, res) => {
  const index = products.findIndex(p => p.productId === parseInt(req.params.id));
  if (index !== -1) {
    products.splice(index, 1);
    res.status(204).send();
  } else {
    res.status(404).send('Product not found');
  }
});

export default router;
