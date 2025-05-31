// src/controllers/user.controller.ts
//done_for_this
import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/user.service';
import { SafeUser } from '../services/user.service';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    user?: SafeUser;
  }
}

export const isLoggedIn = async (req: Request, res: Response) => {
  if (req.session && req.session.userId) {
    const userFromSession = req.session.user;
    console.log(userFromSession);
    if (userFromSession) {
         console.log(`User is logged in (from session): ${userFromSession.username}`);
         return res.status(200).json({ loggedIn: true, user: userFromSession });
    } else {
        try {
            const user = await userService.findUserById(req.session.userId);
            if (user) {
                 console.log(`User is logged in (fetched by ID): ${user.username}`);
                 req.session.user = user;
                 return res.status(200).json({ loggedIn: true, user: user });
            } else {
                 console.warn(`User ID ${req.session.userId} found in session but not in DB. Destroying session.`);
                 req.session.destroy((err) => {
                     if (err) console.error("Error destroying invalid session:", err);
                     res.clearCookie('connect.sid');
                     return res.status(401).json({ loggedIn: false, message: "Invalid session." });
                 });
            }
        } catch(fetchError) {
             console.error("Error fetching user during isLoggedIn check:", fetchError);
             return res.status(500).json({ loggedIn: false, message: "Error checking login status." });
        }
    }

  } else {
    console.log("User is not logged in (no valid session).");
    return res.status(401).json({ loggedIn: false, message: "User not logged in" });
  }
};

export const signup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email, and password are required.' });
    }
    username = username.trim() + "_";
    let newUser = await userService.signup({ username, email, password });
    newUser.username = newUser.username.replace(/_$/, "");
    console.log(`User signed up: ${newUser.username} (ID: ${newUser.user_id})`);
    res.status(201).json({ message: 'Signup successful!', user: newUser });

  } catch (error: any) {
     console.error("Signup Controller Error:", error.message);
     next(error);
  }
};


export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    const user = await userService.login({ email, password });
    req.session.userId = user.user_id;
    req.session.user = user; 
    console.log(`User logged in: ${user.username} (ID: ${user.user_id})`);
    res.status(200).json({ message: 'Login successful!', user: user });

  } catch (error: any) {
     console.error("Login Controller Error:", error.message);
     next(error);
  }
};

export const logout = (req: Request, res: Response, next: NextFunction) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return next(new Error('Failed to logout. Please try again.'));
    }
    res.clearCookie('connect.sid');
    console.log("User logged out successfully.");
    res.status(200).json({ message: 'Logout successful!' });
  });
};