import { Request, Response } from "express";
import { prisma } from "../config/prisma";

export async function createOrder(req: Request, res: Response) {
  try {
    const user = req.user!;
    const { orderItems, shippingAddress, paymentResult, totalPrice } = req.body;

    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({ error: "No order items" });
    }

    // Use a transaction to ensure stock is updated and order is created atomically
    const order = await prisma.$transaction(async (tx) => {
      // 1. Validate stock for all items
      for (const item of orderItems) {
        // Handle both formats if possible, but likely item.product._id from frontend
        const productId = item.product?._id || item.productId || item.product;

        const product = await tx.product.findUnique({ where: { id: productId } });

        if (!product) {
          throw new Error(`Product not found: ${item.name}`);
        }
        if (product.stock < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}`);
        }
      }

      // 2. Create Order
      const newOrder = await tx.order.create({
        data: {
          userId: user.id,
          clerkId: user.clerkId,
          shippingAddress,
          paymentResult: paymentResult || {},
          totalPrice: parseFloat(totalPrice),
          items: {
            create: orderItems.map((item: any) => ({
              name: item.name || item.product.name,
              price: parseFloat(item.price),
              quantity: item.quantity,
              image: item.image || item.product.images?.[0] || "",
              productId: item.product?._id || item.productId || item.product,
            })),
          },
        },
        include: { items: true },
      });

      // 3. Update Stock
      for (const item of orderItems) {
        const productId = item.product?._id || item.productId || item.product;
        await tx.product.update({
          where: { id: productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      return newOrder;
    });

    res.status(201).json({ message: "Order created successfully", order });
  } catch (error: any) {
    console.error("Error in createOrder controller:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
}

export async function getUserOrders(req: Request, res: Response) {
  try {
    const orders = await prisma.order.findMany({
      where: { clerkId: req.user!.clerkId },
      include: {
        items: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // check if each order has been reviewed
    const orderIds = orders.map((order) => order.id);
    const reviews = await prisma.review.findMany({
      where: {
        orderId: { in: orderIds },
        userId: req.user!.id,
      },
      select: { orderId: true },
    });

    const reviewedOrderIds = new Set(reviews.map((review) => review.orderId));

    const ordersWithReviewStatus = orders.map((order) => ({
      ...order,
      hasReviewed: reviewedOrderIds.has(order.id),
    }));

    res.status(200).json({ orders: ordersWithReviewStatus });
  } catch (error) {
    console.error("Error in getUserOrders controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
