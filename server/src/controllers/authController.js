const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { successResponse, createdResponse, errorResponse } = require('../utils/apiResponse');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: parseInt(process.env.JWT_COOKIE_EXPIRES_IN || 7) * 24 * 60 * 60 * 1000,
};

const signToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const sendTokenResponse = (res, user, message, statusCode = 200) => {
  const token = signToken(user._id);
  res.cookie('token', token, COOKIE_OPTIONS);

  const userData = user.toJSON ? user.toJSON() : user;
  delete userData.password;

  return res.status(statusCode).json({
    success: true,
    message,
    data: { user: userData, token },
  });
};

// POST /api/v1/auth/register
const register = async (req, res, next) => {
  try {
    const { name, email, password, businessName } = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return errorResponse(res, 'An account with this email already exists.', 409);
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      businessName: businessName || '',
    });

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    return sendTokenResponse(res, user, 'Account created successfully', 201);
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !user.isActive) {
      return errorResponse(res, 'Invalid email or password.', 401);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return errorResponse(res, 'Invalid email or password.', 401);
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    return sendTokenResponse(res, user, 'Login successful');
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/auth/logout
const logout = async (req, res) => {
  res.cookie('token', '', {
    httpOnly: true,
    expires: new Date(0),
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  });
  return successResponse(res, null, 'Logged out successfully');
};

// GET /api/v1/auth/me
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    return successResponse(res, { user });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, logout, getMe };
