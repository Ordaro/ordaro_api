# Order Service Integration Guide

## Overview

This document describes how to integrate the Inventory module with the Order service for automatic ingredient consumption and COGS calculation.

## Integration Points

### 1. After Order Creation

When an order is created, call `InventoryService.consumeRecipeForOrder()` to:

1. Expand order lines to recipe ingredients
2. Deduct ingredients using FIFO algorithm
3. Calculate total COGS
4. Create COGS ledger entry

### 2. Implementation Example

```typescript
// In OrderService.createOrder()
async createOrder(dto: CreateOrderDto, companyId: string) {
  // ... create order and order lines ...

  // After order is persisted, consume ingredients
  await this.inventoryService.consumeRecipeForOrder(order.id, companyId);

  return order;
}
```

### 3. consumeRecipeForOrder Implementation

The `consumeRecipeForOrder` method should:

1. Get order with order lines
2. For each order line:
   - Get menu item and its recipe
   - Expand recipe to ingredients with quantities
   - Aggregate ingredient quantities (orderQuantity × recipe quantity)
3. For each ingredient:
   - Call `deductStock()` with aggregated quantity
   - Track total cost
4. Sum all costs and create COGS ledger entry via `CogsService.recordOrderCogs()`

### 4. Example Flow

```
Order Created
  ↓
For each OrderLine:
  - Get MenuItem → Recipe
  - Expand Recipe → RecipeIngredients
  - Aggregate: ingredientQty = orderQty × recipeIngredient.quantityUsed
  ↓
For each Ingredient:
  - deductStock(ingredientId, aggregatedQty, { orderId, recipeId })
  - Track cost
  ↓
Sum all costs
  ↓
Create CogsLedger entry
```

## Notes

- The `consumeRecipeForOrder` method in `InventoryService` is currently a placeholder
- Full implementation will be added when OrderService is created
- FIFO algorithm ensures accurate COGS calculation
- All operations are transactional for data consistency
