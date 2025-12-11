import { Request, Response } from "express";
import { prisma } from "../config/prisma";

export async function createReview(req: Request, res: Response) {
  try {
    const { productId, orderId, rating } = req.body;
    const user = req.user!;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    // verify order exists and is delivered
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.clerkId !== user.clerkId) {
      return res.status(403).json({ error: "Not authorized to review this order" });
    }

    if (order.status !== "DELIVERED") {
      return res.status(400).json({ error: "Can only review delivered orders" });
    }

    // verify product is in the order
    const productInOrder = order.items.find(
      (item) => item.productId === productId
    );
    if (!productInOrder) {
      return res.status(400).json({ error: "Product not found in this order" });
    }

    // check if review already exists
    const existingReview = await prisma.review.findFirst({
      where: { productId, userId: user.id },
    });

    if (existingReview) {
      return res.status(400).json({ error: "You have already reviewed this product" });
    }

    const review = await prisma.$transaction(async (tx) => {
      const newReview = await tx.review.create({
        data: {
          productId,
          userId: user.id,
          orderId,
          rating,
        },
      });

      // update the product rating with atomic aggregation
      const reviews = await tx.review.findMany({ where: { productId } });
      const totalRating = reviews.reduce((sum, rev) => sum + rev.rating, 0);
      const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;

      await tx.product.update({
        where: { id: productId },
        data: {
          averageRating,
          totalReviews: reviews.length,
        },
      });

      return newReview;
    });

    res.status(201).json({ message: "Review submitted successfully", review });
  } catch (error) {
    console.error("Error in createReview controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function deleteReview(req: Request, res: Response) {
  try {
    const { reviewId } = req.params;
    const user = req.user!;

    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    if (review.userId !== user.id) {
      return res.status(403).json({ error: "Not authorized to delete this review" });
    }

    const productId = review.productId;

    await prisma.$transaction(async (tx) => {
      await tx.review.delete({ where: { id: reviewId } });

      const reviews = await tx.review.findMany({ where: { productId } });
      const totalRating = reviews.reduce((sum, rev) => sum + rev.rating, 0);
      const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;

      await tx.product.update({
        where: { id: productId },
        data: {
          averageRating,
          totalReviews: reviews.length,
        },
      });
    });

    res.status(200).json({ message: "Review deleted successfully" });
  } catch (error) {
    console.error("Error in deleteReview controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
