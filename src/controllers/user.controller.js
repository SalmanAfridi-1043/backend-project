import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/Cloudinary.js";
import {
  isMongoConnected,
  createFallbackUser,
  findFallbackUserByIdentifier,
  findFallbackUserById,
  updateFallbackUserById,
} from "../utils/userStore.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const getUserModel = async () => {
  if (isMongoConnected()) {
    return User;
  }

  return null;
};

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const UserModel = await getUserModel();
    const user = UserModel
      ? await UserModel.findById(userId)
      : await findFallbackUserById(userId);

    if (!user) {
      throw new ApiError(404, "User not found during token generation");
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;

    await user.save({ validateBeforeSave: false });

    return { refreshToken, accessToken };
  } catch (error) {
    console.error("generateAccessAndRefreshToken error:", error);
    throw new ApiError(
      500,
      "Something went wrong while generating access and refresh tokens"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { fullname, username, email, password } = req.body;

  if (
    [fullname, username, email, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const normalizedUsername = username.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();

  const UserModel = await getUserModel();

  const userExist = UserModel
    ? await UserModel.findOne({
        $or: [{ username: normalizedUsername }, { email: normalizedEmail }],
      })
    : await findFallbackUserByIdentifier(normalizedUsername);

  if (userExist) {
    throw new ApiError(409, "User with email or username already exists");
  }

  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

  let avatarUrl = "";
  let coverImageUrl = "";

  if (avatarLocalPath) {
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    avatarUrl = avatar?.url || "";
  }

  if (coverImageLocalPath) {
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    coverImageUrl = coverImage?.url || "";
  }

  if (!avatarUrl) {
    avatarUrl = "https://via.placeholder.com/150";
  }

  const user = UserModel
    ? await UserModel.create({
        fullname: fullname.trim(),
        email: normalizedEmail,
        username: normalizedUsername,
        avatar: avatarUrl,
        coverImage: coverImageUrl,
        password,
      })
    : await createFallbackUser({
        fullname: fullname.trim(),
        email: normalizedEmail,
        username: normalizedUsername,
        avatar: avatarUrl,
        coverImage: coverImageUrl,
        password,
      });

  const createdUser = UserModel
    ? await UserModel.findById(user._id).select("-password -refreshToken")
    : {
        ...user,
        password: undefined,
        refreshToken: undefined,
      };

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;
  const loginIdentifier = username?.trim() || email?.trim();
  const normalizedIdentifier = loginIdentifier?.toLowerCase();

  if (!normalizedIdentifier) {
    throw new ApiError(400, "Username or email is required");
  }

  const UserModel = await getUserModel();

  const user = UserModel
    ? await UserModel.findOne({
        $or: [
          { username: normalizedIdentifier },
          { email: normalizedIdentifier },
        ],
      })
    : await findFallbackUserByIdentifier(normalizedIdentifier);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = UserModel
    ? await UserModel.findById(user._id).select("-password -refreshToken")
    : {
        ...user,
        password: undefined,
        refreshToken: undefined,
      };

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options) // cookie sending process
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          refreshToken,
          accessToken,
        },
        "User logged in successfully"
      )
    );
});

const loggOutUser = asyncHandler(async (req, res) => {
  const UserModel = await getUserModel();

  if (UserModel) {
    await UserModel.findByIdAndUpdate(
      req.user._id,
      {
        $unset: { refreshToken: 1 },
      },
      {
        new: true,
      }
    );
  } else {
    await updateFallbackUserById(req.user._id, { refreshToken: undefined });
  }

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"));
});

const refreshAccessToken = asyncHandler(async (req, res, next) => {
  const incommingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incommingRefreshToken) {
    throw new ApiError(401, "Authorized access");
  }
  try {
    const decodedToken = await jwt.verify(
      incommingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const UserModel = await getUserModel();
    const user = UserModel
      ? await UserModel.findById(decodedToken?._id)
      : await findFallbackUserById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid Refresh Token");
    }

    if (incommingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh Token has expired or used");
    }

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    };

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            refreshToken: newRefreshToken,
          },
          "Access Token refreshed successfully"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password");
  }

  user.password = newPassword;

  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password updated successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullname, email } = req.body;

  if (!fullname || !email) {
    throw new ApiError(400, "All fields are required");
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullname,
        email,
      },
    },
    { new: true } // used to retrun all the user data/object
  ).select("-password");

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedUser, "Account details updated successfully")
    );
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is required");
  }

  // fetch existing avatar url so we can delete it later
  const existingUser = await User.findById(req.user?._id).select("avatar");
  const oldAvatarUrl = existingUser?.avatar;

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(500, "Error while uploading avatar on cloudinary");
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");

  // delete the old image from cloudinary (best-effort)
  if (oldAvatarUrl && oldAvatarUrl !== avatar.url) {
    try {
      await deleteFromCloudinary(oldAvatarUrl);
    } catch (error) {
      console.error("Error deleting old avatar from Cloudinary:", error);
    }
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedUser, "Avatar updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover image is required");
  }

  // fetch existing cover image url so we can delete it later
  const existingUserForCover = await User.findById(req.user?._id).select(
    "coverImage"
  );
  const oldCoverImageUrl = existingUserForCover?.coverImage;

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(500, "Error while uploading cover image on cloudinary");
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");

  // delete the old cover image from cloudinary (best-effort)
  if (oldCoverImageUrl && oldCoverImageUrl !== coverImage.url) {
    try {
      await deleteFromCloudinary(oldCoverImageUrl);
    } catch (error) {
      console.error("Error deleting old cover image from Cloudinary:", error);
    }
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedUser, "Cover image updated successfully")
    );
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(400, "username doesnot exist");
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },

    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },

    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },

    {
      $addFields: {
        subscriberCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },

    {
      $project: {
        fullname: 1,
        username: 1,
        subscriberCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        email: 1,
        coverImage: 1,
      },
    },
  ]);

  // console.log("Channel : ", channel);

  if (!channel?.length) {
    throw new ApiError(400, "Channel doesnot exist");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "User channel fetched successfully")
    );
});

const getWatchHistory = asyncHandler(async (req, res) => {
  // console.log("User :", req.user._id);

  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user?._id),
      },
    },

    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",

        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",

              pipeline: [
                {
                  $project: {
                    fullname: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);

  if (!user?.length) {
    throw new ApiError(400, "User does not exist");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch history fetched successfully"
      )
    );
});

export {
  getUserChannelProfile,
  updateAccountDetails,
  getCurrentUser,
  registerUser,
  loginUser,
  loggOutUser,
  refreshAccessToken,
  changeCurrentPassword,
  updateUserAvatar,
  updateUserCoverImage,
  getWatchHistory,
};
