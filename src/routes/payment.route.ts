import { Router } from "express";
import { protectRoute } from "../middlewares/auth.middleware";
import { createRazorpayOrder, verifyPayment } from "../controllers/payment.controller";

const router = Router();

// All payment routes require authentication
router.use(protectRoute);

// Create Razorpay order (call before initiating payment)
router.post("/create-order", createRazorpayOrder);

// Verify payment and create order in database
router.post("/verify", verifyPayment);

export default router;
