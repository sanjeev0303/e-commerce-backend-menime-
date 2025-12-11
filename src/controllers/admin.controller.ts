import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import cloudinary from "../config/cloudinary";

export async function createProduct(req: Request, res: Response) {
  try {
    const { name, description, price, stock, category } = req.body;

    if (!name || !description || !price || !stock || !category) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ message: "At least one image is required" });
    }

    if (files.length > 3) {
      return res.status(400).json({ message: "Maximum 3 images allowed" });
    }

    const uploadPromises = files.map((file) => {
      return cloudinary.uploader.upload(file.path, {
        folder: "products",
      });
    });

    const uploadResults = await Promise.all(uploadPromises);

    const imageUrls = uploadResults.map((result) => result.secure_url);

    const product = await prisma.product.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        stock: parseInt(stock),
        category,
        images: imageUrls,
      },
    });

    res.status(201).json(product);
  } catch (error) {
    console.error("Error creating product", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getAllProducts(_: Request, res: Response) {
  try {
    // -1 means in desc order: most recent products first
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function updateProduct(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, description, price, stock, category } = req.body;

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    let imageUrls = product.images;
    const files = req.files as Express.Multer.File[];

    // handle image updates if new images are uploaded
    if (files && files.length > 0) {
      if (files.length > 3) {
        return res.status(400).json({ message: "Maximum 3 images allowed" });
      }

      const uploadPromises = files.map((file) => {
        return cloudinary.uploader.upload(file.path, {
          folder: "products",
        });
      });

      const uploadResults = await Promise.all(uploadPromises);
      imageUrls = uploadResults.map((result) => result.secure_url);
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        name: name || undefined,
        description: description || undefined,
        price: price !== undefined ? parseFloat(price) : undefined,
        stock: stock !== undefined ? parseInt(stock) : undefined,
        category: category || undefined,
        images: imageUrls,
      },
    });

    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error("Error updating products:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getAllOrders(_: Request, res: Response) {
  try {
    const orders = await prisma.order.findMany({
      include: {
        user: {
          select: { name: true, email: true },
        },
        items: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ orders });
  } catch (error) {
    console.error("Error in getAllOrders controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateOrderStatus(req: Request, res: Response) {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!["PENDING", "SHIPPED", "DELIVERED"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const updateData: any = { status };

    if (status === "SHIPPED" && !order.shippedAt) {
      updateData.shippedAt = new Date();
    }

    if (status === "DELIVERED" && !order.deliveredAt) {
      updateData.deliveredAt = new Date();
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
    });

    res.status(200).json({ message: "Order status updated successfully", order: updatedOrder });
  } catch (error) {
    console.error("Error in updateOrderStatus controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getAllCustomers(_: Request, res: Response) {
  try {
    const customers = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ customers });
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getDashboardStats(_: Request, res: Response) {
  try {
    const totalOrders = await prisma.order.count();

    const revenueResult = await prisma.order.aggregate({
      _sum: {
        totalPrice: true,
      },
    });

    const totalRevenue = revenueResult._sum.totalPrice || 0;

    const totalCustomers = await prisma.user.count();
    const totalProducts = await prisma.product.count();

    res.status(200).json({
      totalRevenue,
      totalOrders,
      totalCustomers,
      totalProducts,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Delete images from Cloudinary
    if (product.images && product.images.length > 0) {
      const deletePromises = product.images.map((imageUrl) => {
        // Extract public_id from URL (assumes format: .../products/publicId.ext)
        const parts = imageUrl.split("/products/");
        if (parts.length > 1) {
             const publicId = "products/" + parts[1].split(".")[0];
             return cloudinary.uploader.destroy(publicId);
        }
        return null;
      });

      await Promise.all(deletePromises.filter((p) => p !== null));
    }

    await prisma.product.delete({ where: { id } });

    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
