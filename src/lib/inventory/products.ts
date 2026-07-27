import "server-only";
import { Decimal } from "@prisma/client/runtime/library";
import type { StockMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertTenantResource, type AuthenticatedUser } from "@/lib/authz";
import { writeAuditLog } from "@/lib/audit";

export type InventoryContext = {
  user: AuthenticatedUser & { tenantId: string };
};

function toDecimal(value: number | string | Decimal): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

export async function deriveStockFromMovements(productId: string): Promise<number> {
  const movements = await prisma.stockMovement.findMany({
    where: { productId },
    select: { type: true, quantity: true },
  });

  let qty = 0;
  for (const m of movements) {
    if (m.type === "OUT" || m.type === "SALE") {
      qty -= m.quantity;
    } else {
      qty += m.quantity;
    }
  }
  return qty;
}

export async function syncProductStockQty(productId: string) {
  const qty = await deriveStockFromMovements(productId);
  return prisma.product.update({
    where: { id: productId },
    data: { stockQty: qty },
  });
}

export async function createProduct(
  ctx: InventoryContext,
  input: {
    name: string;
    sku?: string | null;
    price: number | string;
    cost?: number | string | null;
    categoryId?: string | null;
    initialStock?: number;
  }
) {
  const { user } = ctx;
  const product = await prisma.product.create({
    data: {
      tenantId: user.tenantId,
      name: input.name.trim(),
      sku: input.sku?.trim() || null,
      price: toDecimal(input.price),
      cost: input.cost != null ? toDecimal(input.cost) : null,
      categoryId: input.categoryId ?? null,
      stockQty: input.initialStock ?? 0,
      active: true,
    },
  });

  if (input.initialStock && input.initialStock > 0) {
    await recordStockMovement(ctx, {
      productId: product.id,
      type: "IN",
      quantity: input.initialStock,
      notes: "Estoque inicial",
    });
  }

  return product;
}

export async function recordStockMovement(
  ctx: InventoryContext,
  input: {
    productId: string;
    type: StockMovementType;
    quantity: number;
    notes?: string | null;
    saleItemId?: string | null;
  }
) {
  const { user } = ctx;
  if (input.quantity <= 0) throw new Error("Quantidade deve ser positiva");

  const product = await prisma.product.findFirst({
    where: { id: input.productId, tenantId: user.tenantId },
  });
  if (!product) throw new Error("Produto não encontrado");

  const movement = await prisma.stockMovement.create({
    data: {
      tenantId: user.tenantId,
      productId: input.productId,
      type: input.type,
      quantity: input.quantity,
      notes: input.notes ?? null,
      saleItemId: input.saleItemId ?? null,
      createdByUserId: user.id,
    },
  });

  await syncProductStockQty(input.productId);

  if (input.type === "ADJUSTMENT") {
    await writeAuditLog({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "inventory.adjusted",
      entityType: "Product",
      entityId: input.productId,
      metadata: { quantity: input.quantity, type: input.type },
    });
  }

  return movement;
}

export async function listProducts(tenantId: string, opts?: { lowStockOnly?: boolean }) {
  const products = await prisma.product.findMany({
    where: {
      tenantId,
      active: true,
      ...(opts?.lowStockOnly ? { stockQty: { lte: 5 } } : {}),
    },
    include: { category: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
  return products;
}

export async function listProductCategories(tenantId: string) {
  return prisma.productCategory.findMany({
    where: { tenantId, active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export type SerializedProduct = {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  cost: number | null;
  stockQty: number;
  categoryName: string | null;
  lowStock: boolean;
};

export function serializeProduct(p: {
  id: string;
  name: string;
  sku: string | null;
  price: { toString(): string };
  cost: { toString(): string } | null;
  stockQty: number;
  category?: { name: string } | null;
}): SerializedProduct {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    price: Number(p.price),
    cost: p.cost ? Number(p.cost) : null,
    stockQty: p.stockQty,
    categoryName: p.category?.name ?? null,
    lowStock: p.stockQty <= 5,
  };
}
