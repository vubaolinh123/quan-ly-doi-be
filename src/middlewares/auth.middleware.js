import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import env from '../config/env.js';

const extractBearerToken = (authorization = '') => {
  if (!authorization.startsWith('Bearer ')) return null;
  return authorization.split(' ')[1];
};

export const protect = async (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Không có token xác thực hoặc định dạng Bearer không hợp lệ'
      });
    }

    const decoded = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Người dùng không tồn tại hoặc token không hợp lệ'
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token không hợp lệ hoặc đã hết hạn'
    });
  }
};

export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền truy cập tài nguyên này'
    });
  }
  return next();
};
