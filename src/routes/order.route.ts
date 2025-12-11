import { Router } from "express";
import { protectRoute } from "../middlewares/auth.middleware";
import { createOrder, getUserOrders } from "../controllers";

const router = Router();

router.post("/", protectRoute, createOrder);
router.get("/", protectRoute, getUserOrders);

export default router;
