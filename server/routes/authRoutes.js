import { Router } from "express";
import { login, changePassword, session } from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { loginSchema, changePasswordSchema } from "../validators/authValidators.js";

const authRouter = Router();
authRouter.post("/login", validateBody(loginSchema), login);
authRouter.get("/session", protect, session);
authRouter.post("/change-password", protect, validateBody(changePasswordSchema), changePassword);

export default authRouter;
