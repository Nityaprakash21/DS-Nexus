import jwt from "jsonwebtoken";

export const protect = (req, res, next) => {
    try {
        let token;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        } else if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        } else if (req.headers.cookie) {
            const match = req.headers.cookie.match(/(?:^|;\s*)token=([^;]+)/);
            if (match) token = decodeURIComponent(match[1]);
        }

        if (!token) {
            return res.status(401).json({ error: "Unauthorized: Missing authentication token" });
        }

        const session = jwt.verify(token, process.env.JWT_SECRET);
        if (!session) {
            return res.status(401).json({ error: "Unauthorized: Invalid token payload" });
        }

        req.session = session;
        req.user = session;
        next();
    } catch (err) {
        return res.status(401).json({ error: "Failed to authenticate" });
    }
};

export const protectAdmin = (req, res, next) => {
    const role = req?.session?.role || req?.user?.role;
    if (role !== "ADMIN") {
        return res.status(403).json({ error: "Admin access required" });
    }
    next();
};