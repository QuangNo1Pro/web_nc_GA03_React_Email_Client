# React Email Client with Gmail Integration

This is a full-stack application that implements a real-time email client with Gmail integration. It uses Google OAuth2 to access a user’s Gmail account via the Gmail REST API.

## Features

- **Real-time Gmail Integration:** Connects to your Gmail account and displays your emails in a 3-column dashboard.
- **Secure Google OAuth2 Authentication:** Uses a secure, server-side OAuth2 flow to access your Gmail data.
- **Full Email Functionality:** Read, compose, reply, delete, star, and manage your emails.
- **Token-Based Security:** Uses JWT access and refresh tokens for secure API communication with the backend proxy.
- **Automatic Token Refresh:** Automatically refreshes expired access tokens without interrupting the user.
- **3-Column Email Dashboard:** A responsive, interactive email client UI.

## Tech Stack

### Frontend

- **React:** A JavaScript library for building user interfaces.
- **TypeScript:** A typed superset of JavaScript.
- **Vite:** A fast build tool and development server.
- **React Router v6:** A declarative routing library for React.
- **TanStack Query:** A powerful data-fetching and state management library.
- **Axios:** A promise-based HTTP client.
- **Tailwind CSS:** A utility-first CSS framework.
- **react-hot-toast:** For toast notifications.

### Backend

- **NestJS:** A progressive Node.js framework for building efficient and scalable server-side applications.
- **TypeScript:** A typed superset of JavaScript.
- **MongoDB & Mongoose:** A NoSQL database and an elegant object modeling tool.
- **Passport.js:** A simple, unobtrusive authentication middleware for Node.js.
- **JWT & Google OAuth2 Strategies:** Passport.js strategies for token-based and Google authentication.
- **googleapis:** The official Google API client library for Node.js.
- **bcrypt:** A library for hashing passwords.

## Getting Started

### Prerequisites

- **Node.js:** v18 or higher.
- **npm or Yarn:** For managing project dependencies.
- **MongoDB:** A running MongoDB instance (local or cloud).
- **Google Cloud Platform Account:** To get OAuth2 credentials.

### How to get Google OAuth2 Credentials

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a new project.
3.  Go to **APIs & Services > Credentials**.
4.  Click **Create Credentials > OAuth client ID**.
5.  Select **Web application** as the application type.
6.  Add `http://localhost:3000/auth/google/callback` to the **Authorized redirect URIs**.
7.  Click **Create**. You will get a client ID and client secret.

### Backend Setup

1.  **Navigate to the backend directory:**
    ```sh
    cd backend
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
    cd frontend
    ```
2.  **Install dependencies:**
    ```sh
    npm install
    ```
3.  **Create a `.env` file** in the `frontend` directory and add the following environment variables:
    ```
    VITE_API_URL=http://localhost:3000
    ```
4.  **Start the development server:**
    ```sh
    npm run dev
    ```
    The frontend application will be available at `http://localhost:5173`.

## Token Storage Choices

-   **Application Access Token:** Stored in-memory for the session. This is a secure approach as it prevents XSS attacks from accessing the token.
-   **Application Refresh Token:** Stored in `localStorage`. This allows the user to stay logged in across browser sessions.
-   **Google Refresh Token:** Stored securely in the backend database. It is encrypted before being saved. The frontend never has access to this token.

## Deployment
The application is deployed and publicly accessible at the following URLs:

-   **Frontend (Vercel):** [https://web-nc-ga-03-react-email-client.vercel.app/](https://web-nc-ga-03-react-email-client.vercel.app/)
-   **Backend (Render):** [https://web-nc-ga03-react-email-client.onrender.com](https://web-nc-ga03-react-email-client.onrender.com)

**Note:** The deployed backend has the necessary environment variables for the Google credentials.