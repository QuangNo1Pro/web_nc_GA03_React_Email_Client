import React from "react";

export const GoogleLoginButton: React.FC = () => {
  const handleGoogleLogin = () => {
    window.location.href = "/api/auth/google";
  };

  return (
    <button
      type="button"
      onClick={handleGoogleLogin}
      className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded shadow hover:bg-gray-100"
    >
      <img
        src="https://developers.google.com/identity/images/g-logo.png"
        alt="Google logo"
        className="w-5 h-5 mr-2"
      />
      <span className="text-gray-700 font-medium">Sign in with Google</span>
    </button>
  );
};
