import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const fallbackUsers = [];

const isMongoConnected = () => mongoose.connection.readyState === 1;

const buildFallbackUser = async (userData) => {
  const safePassword = userData.password;
  const hashedPassword = await bcrypt.hash(safePassword, 10);

  const user = {
    ...userData,
    _id: userData._id || new mongoose.Types.ObjectId(),
    password: hashedPassword,
    refreshToken: userData.refreshToken || undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  user.isPasswordCorrect = async function (password) {
    return bcrypt.compare(password, this.password);
  };

  user.generateAccessToken = function () {
    return jwt.sign(
      {
        _id: this._id,
        email: this.email,
        username: this.username,
        fullname: this.fullname,
      },
      process.env.ACCESS_TOKEN_SECRET,
      {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
      }
    );
  };

  user.generateRefreshToken = function () {
    return jwt.sign(
      {
        _id: this._id,
      },
      process.env.REFRESH_TOKEN_SECRET,
      {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
      }
    );
  };

  user.save = async function () {
    const index = fallbackUsers.findIndex(
      (entry) => entry._id.toString() === this._id.toString()
    );

    if (index >= 0) {
      fallbackUsers[index] = { ...this, updatedAt: new Date() };
    } else {
      fallbackUsers.push({ ...this, updatedAt: new Date() });
    }

    return this;
  };

  fallbackUsers.push(user);
  return user;
};

const createFallbackUser = async (userData) => {
  const existingUser = fallbackUsers.find(
    (entry) =>
      entry.username === userData.username?.toLowerCase() ||
      entry.email === userData.email?.toLowerCase()
  );

  if (existingUser) {
    return existingUser;
  }

  return buildFallbackUser(userData);
};

const findFallbackUserByIdentifier = async (identifier) => {
  const normalizedIdentifier = identifier?.toLowerCase();

  return fallbackUsers.find(
    (entry) =>
      entry.username === normalizedIdentifier ||
      entry.email === normalizedIdentifier
  );
};

const findFallbackUserById = async (id) => {
  return fallbackUsers.find((entry) => entry._id.toString() === id.toString());
};

const updateFallbackUserById = async (id, updateData) => {
  const user = await findFallbackUserById(id);

  if (!user) {
    return null;
  }

  Object.assign(user, updateData);
  user.updatedAt = new Date();
  return user;
};

export {
  isMongoConnected,
  createFallbackUser,
  findFallbackUserByIdentifier,
  findFallbackUserById,
  updateFallbackUserById,
};
