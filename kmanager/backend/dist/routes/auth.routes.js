"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("@controllers/auth.controller");
const auth_middleware_1 = require("@middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.post('/login', (req, res) => auth_controller_1.authController.login(req, res));
router.post('/refresh', (req, res) => auth_controller_1.authController.refresh(req, res));
router.post('/google', (req, res) => auth_controller_1.authController.googleLogin(req, res));
router.get('/me', auth_middleware_1.authMiddleware, (req, res) => auth_controller_1.authController.me(req, res));
exports.default = router;
//# sourceMappingURL=auth.routes.js.map