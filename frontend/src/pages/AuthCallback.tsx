import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/**
 * Handles OAuth callback - extracts token from URL and stores in localStorage
 */
export default function AuthCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { login, user, loading } = useAuth();
    const [isProcessing, setIsProcessing] = useState(false);
    const [hasProcessed, setHasProcessed] = useState(false);

    // Process the token once
    useEffect(() => {
        const handleCallback = async () => {
            const token = searchParams.get('token');

            if (token && !isProcessing && !hasProcessed) {
                setIsProcessing(true);
                // Store token and trigger login - WAIT for it to complete
                await login({ access_token: token });
                setHasProcessed(true);
                setIsProcessing(false);
            } else if (!token) {
                // No token, redirect to login
                navigate('/login', { replace: true });
            }
        };

        handleCallback();
    }, [searchParams, login, navigate, isProcessing, hasProcessed]);

    // Navigate to inbox only after user is confirmed and loading is done
    useEffect(() => {
        if (hasProcessed && !loading && user) {
            navigate('/inbox', { replace: true });
        }
    }, [hasProcessed, loading, user, navigate]);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p>Đang xử lý đăng nhập...</p>
            </div>
        </div>
    );
}
