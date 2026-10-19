import { Router } from "express";
import { createEmployee, deleteEmployee, getEmployees, updateEmployee } from "../controllers/employeeController.js";
import { protect, protectAdmin } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { createEmployeeSchema, updateEmployeeSchema } from "../validators/employeeValidators.js";

const employeesRouter = Router();
employeesRouter.get("/", protect, protectAdmin, getEmployees);
employeesRouter.post("/", protect, protectAdmin, validateBody(createEmployeeSchema), createEmployee);
employeesRouter.put("/:id", protect, protectAdmin, validateBody(updateEmployeeSchema), updateEmployee);
employeesRouter.delete("/:id", protect, protectAdmin, deleteEmployee);

export default employeesRouter;
