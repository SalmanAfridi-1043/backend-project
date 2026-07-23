import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);

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

  // console.log("fullname ", name);
  // console.log("Request body : ", req.body);

  if (
    [fullname, username, email, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const userExist = await User.findOne({
    $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }],
  });

  if (userExist) {
    throw new ApiError(409, "User with email or username already exists");
  }

  // below is return from multer when it saves the images on cloudinary
  // req.body is from express while req.files is from multer
  const avatarPath = req.files?.avatar[0]?.path;
  // const coverImagePath = req.files?.coverImage[0]?.path;

  let coverImagePath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImagePath = req.files.coverImage[0].path;
  }

  // console.log("Request file : ", req.files);

  if (!avatarPath) {
    throw new ApiError(400, "Avatar is required");
  }

  const avatar = await uploadOnCloudinary(avatarPath);
  const coverImage = await uploadOnCloudinary(coverImagePath);

  if (!avatar) throw new ApiError(400, "Avatar is required");

  const user = await User.create({
    fullname,
    email,
    username: username.toLowerCase(),
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    password,
  });

  // removing password and refreshToken from data using select()
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  // req.body - data
  //check all field are required.
  // check username or email . if not exit return 401
  //check password.
  // generate access + refresh token to user
  // send cookies

  const { username, email, password } = req.body;
  const normalizedUsername = username?.toLowerCase();
  const normalizedEmail = email?.toLowerCase();

  if (!(normalizedUsername || normalizedEmail)) {
    throw new ApiError(400, "username or email is required");
  }

  const user = await User.findOne({
    $or: [{ username: normalizedUsername }, { email: normalizedEmail }],
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user cradentails");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // to make the refresh token ReadMe only for frontend
  const options = {
    httpOnly: true,
    secure: true,
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
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: { refreshToken: undefined },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
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

  if (incommingRefreshToken) {
    throw new ApiError(401, "Authorized access");
  }
  try {
    const decodedToken = await jwt.verify(
      incommingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid Refresh Token");
    }

    if (incommingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh Token has expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
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

export { registerUser, loginUser, loggOutUser, refreshAccessToken };
