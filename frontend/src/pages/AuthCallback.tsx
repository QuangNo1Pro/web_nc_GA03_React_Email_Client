import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/**
 * Handles OAuth callback - extracts token from URL and stores in localStorage
 */
export default function AuthCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { login } = useAuth();

    useEffect(() => {
        const token = searchParams.get('token');

        if (token) {
            // Store token and trigger login
            login({ access_token: token });
            navigate('/inbox', { replace: true });
        } else {
            // No token, redirect to login
            navigate('/login', { replace: true });
        }
    }, [searchParams, login, navigate]);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <p>Đang xử lý đăng nhập...</p>
        </div>
    );
}
