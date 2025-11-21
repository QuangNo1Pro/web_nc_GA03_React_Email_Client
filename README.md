# React Authentication & Email Dashboard

This is a full-stack application that implements secure authentication using email + password and Google Sign-In (OAuth). After authentication, users land on a mock email dashboard.

## Features

- **Email & Password Authentication:** Secure user registration and login.
- **Google Sign-In:** Seamless authentication using Google accounts.
- **Token-Based Security:** Uses JWT access and refresh tokens for secure API communication.
- **Automatic Token Refresh:** Automatically refreshes expired access tokens without interrupting the user.
- **Protected Routes:** Ensures that only authenticated users can access protected content.
- **3-Column Email Dashboard:** A responsive, interactive mockup of an email client.
- **Mock API:** A mock API for all email-related endpoints.

## Tech Stack

### Frontend

- **React:** A JavaScript library for building user interfaces.
- **TypeScript:** A typed superset of JavaScript.
- **Vite:** A fast build tool and development server.
- **React Router v6:** A declarative routing library for React.
- **TanStack Query:** A powerful data-fetching and state management library.
- **Axios:** A promise-based HTTP client.
- **Tailwind CSS:** A utility-first CSS framework.
- **React Hook Form & Zod:** For flexible and validated forms.
- **@react-oauth/google:** For Google Sign-In integration.

### Backend

- **NestJS:** A progressive Node.js framework for building efficient and scalable server-side applications.
- **TypeScript:** A typed superset of JavaScript.
- **MongoDB & Mongoose:** A NoSQL database and an elegant object modeling tool.
- **Passport.js:** A simple, unobtrusive authentication middleware for Node.js.
- **JWT & Google OAuth2 Strategies:** Passport.js strategies for token-based and Google authentication.
- **bcrypt:** A library for hashing passwords.

## Getting Started

### Prerequisites

- **Node.js:** v18 or higher.
- **npm or Yarn:** For managing project dependencies.
- **MongoDB:** A running MongoDB instance (local or cloud).

### Backend Setup

1.  **Navigate to the backend directory:**
    ```sh
    cd Source/backend
    ```
2.  **Install dependencies:**
    ```sh
    npm install
    ```
3.  **Create a `.env` file** in the `backend` directory and add the following environment variables:
    ```
    MONGODB_URI=your_mongodb_connection_string
    PORT=3000
    JWT_SECRET=your_jwt_secret
    JWT_REFRESH_SECRET=your_jwt_refresh_secret
    CORS_ORIGIN=http://localhost:5173
    FRONTEND_URL=http://localhost:5173
    GOOGLE_CLIENT_ID=your_google_client_id
    GOOGLE_CLIENT_SECRET=your_google_client_secret
    GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
    ```
4.  **Start the development server:**
    ```sh
    npm run start:dev
    ```
    The backend server will start on `http://localhost:3000`.

### Frontend Setup

1.  **Navigate to the frontend directory:**
    ```sh
    cd Source/frontend
    ```
2.  **Install dependencies:**
    ```sh
    npm install
    ```
3.  **Create a `.env` file** in the `frontend` directory and add the following environment variables:
    ```
    VITE_API_URL=http://localhost:3000
    VITE_GOOGLE_CLIENT_ID=your_google_client_id
    ```
4.  **Start the development server:**
    ```sh
    npm run dev
    ```
    The frontend application will be available at `http://localhost:5173`.

## Token Storage Choices

-   **Access Token:** Stored in-memory for the session. This is a secure approach as it prevents XSS attacks from accessing the token.
-   **Refresh Token:** Stored in `localStorage`. This allows the user to stay logged in across browser sessions. While this approach is vulnerable to XSS attacks, it is a common trade-off for better user experience. To mitigate this risk, the refresh token is invalidated on logout and has a shorter expiration time. A more secure approach would be to store the refresh token in an `HttpOnly` cookie, but that would require a more complex setup.

## Third-Party Services

-   **Google OAuth 2.0:** For Google Sign-In functionality.
-   **Vercel:** For hosting the frontend application.
-   **Render:** For hosting the backend application.

## Github

- **Guthub:** [https://github.com/QuangNo1Pro/web_nc_GA03_React_Authentication.git](https://github.com/QuangNo1Pro/web_nc_GA03_React_Authentication.git)

## Deployment
The application is deployed and publicly accessible at the following URLs:

-   **Frontend (Vercel):** [https://web-nc-ga-03-react-authentication.vercel.app/](https://web-nc-ga-03-react-authentication.vercel.app/)
-   **Backend (Render):** [https://web-nc-ga03-react-authentication.onrender.com](https://web-nc-ga03-react-authentication.onrender.com)