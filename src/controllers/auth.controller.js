import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import env from '../config/env.js';
import asyncHandler from '../utils/asyncHandler.js';
import { successResponse } from '../utils/apiResponse.js';

const generateToken = (id) => jwt.sign({ id }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

export const register = asyncHandler(async (req, res) => {
  const { hoTen, email, password, role, chucVu, donViCongTac, soDienThoai } = req.body;

  if (!hoTen || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng cung cấp đầy đủ họ tên, email và mật khẩu'
    });
  }

  const existed = await User.findOne({ email: email.toLowerCase() });
  if (existed) {
    return res.status(409).json({
      success: false,
      message: 'Email đã tồn tại trong hệ thống'
    });
  }

  const user = await User.create({
    hoTen,
    email,
    password,
    role: role || 'user',
    chucVu,
    donViCongTac,
    soDienThoai
  });

  const userObj = user.toObject();
  delete userObj.password;

  return successResponse({
    res,
    statusCode: 201,
    message: 'Đăng ký tài khoản thành công',
    data: {
      user: userObj,
      token: generateToken(user._id)
    }
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng nhập email và mật khẩu'
    });
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Thông tin đăng nhập không chính xác'
    });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: 'Thông tin đăng nhập không chính xác'
    });
  }

  const userObj = user.toObject();
  delete userObj.password;

  return successResponse({
    res,
    message: 'Đăng nhập thành công',
    data: {
      user: userObj,
      token: generateToken(user._id)
    }
  });
});

export const me = asyncHandler(async (req, res) => {
  return successResponse({
    res,
    message: 'Lấy thông tin người dùng hiện tại thành công',
    data: req.user
  });
});
