

import { prisma } from '../config/db';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import * as UserInterface from '../interface/user.types';

export type SafeUser = Omit<Prisma.usersGetPayload<{}>, 'password_hash'>;

const SALT_ROUNDS = 10; 

export const signup = async (credentials: UserInterface.SignupCredentials): Promise<SafeUser> => {
  const { username, email, password } = credentials;
  if (!username || !email || !password) {
    throw new Error('Username, email, and password are required.');
  }
  const existingUser = await prisma.users.findUnique({
    where: { email },
  });
  if (existingUser) {
    const error = new Error('Email address is already in use.');
    (error as any).statusCode = 409;
    throw error;
  }
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  try {
    const newUser = await prisma.users.create({
      data: {
        username,
        email,
        password_hash: passwordHash,
      },
    });
    const { password_hash, ...safeUserData } = newUser;
    return safeUserData;
  } catch (error) {
    console.error("Error during user creation:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
         if (error.code === 'P2002') {
             const conflictError = new Error('Email address is already in use (database constraint).');
             (conflictError as any).statusCode = 409;
             throw conflictError;
         }
    }
    throw new Error('Failed to create user due to a database error.');
  }
};


export const login = async (credentials: UserInterface.LoginCredentials): Promise<SafeUser> => {
  const { email, password } = credentials;
  if (!email || !password) {
    throw new Error('Email and password are required.');
  }
  const user = await prisma.users.findUnique({
    where: { email },
  });

  if (!user) {
    const error = new Error('Invalid email or password.');
    (error as any).statusCode = 401;
    throw error;
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);

  if (!isPasswordValid) {
    const error = new Error('Invalid email or password.');
    (error as any).statusCode = 401;
    throw error;
  }

  const { password_hash, ...safeUserData } = user;
  return safeUserData;
};

export const findUserById = async (userId: number): Promise<SafeUser | null> => {
    const user = await prisma.users.findUnique({
        where: { user_id: userId },
    });

    if (!user) {
        return null;
    }

    const { password_hash, ...safeUserData } = user;
    return safeUserData;
};