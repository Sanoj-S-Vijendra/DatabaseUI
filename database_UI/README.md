# Spreadsheet Database UI

This is a web application providing a spreadsheet-like interface for databases. This project 

## Team Members:
- Sanoj S Vijendra (22B0916)   
- Aditya Ajey (22B0986)    
- Ujjwal Kumar (22B1065)  
- Abhay Kantiwal (22B1066)

## Objective:
----------
Creating an intuitive spreadsheet interface for interaction with relational databases.

## Current Progress:
1. Each user can:
   - Create, delete, and rename tables
   - Add/edit/delete rows and columns
   - View only their own tables after login
   - Navigate large tables using pagination
   - Developed a user authentication system with login and signup functionality.  
   - Displaying only the tables relevant to the currently logged-in user.  
   - Focused on building a user-friendly and interactive UI that closely resembles a spreadsheet experience.
   - Organizing primary and foreign keys
   - Creating different views of a single table (e.g., card view, notes view)  
   - Data manipulation through Filter, group by, search, and sort functionality
   - upload as csv table

## Structure

*   `/packages/backend`: Node.js/Express API
*   `/packages/frontend`: React/Ant Design UI

## Setup

*   In `/packages/backend`: create new file .env and copy the contents of .env.example in it with your credentials.
*   `Structure`: DATABASE_URL="YOUR_DATABASE_TYPE://USER_ID:PASSWORD@localhost:5432/YOUR_DATABASE?schema=public"
*   Do, similar in `/packages/frontend`. (You may or may not change the post in frontend).
*   Download all the dependencies as required like express-session, bycrypt, prisma etc.
*   In backend folder run the command `npx prisma db pull` and then `npx prisma generate`'
*   Run the command `npm install` in both backend and frontend folders.
*   Then, run the command `npm run dev` in both backend and frontend folders.