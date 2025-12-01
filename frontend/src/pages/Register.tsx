import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation } from '@tanstack/react-query';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';

const schema = z
  .object({
    email: z.string().email({ message: 'Email không hợp lệ' }),
    password: z.string().min(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu không khớp',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export default function Register() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const navigate = useNavigate();
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  // ⭐ mutation chỉ nhận email + password
  const mutation = useMutation<any, any, { email: string; password: string }>({
    mutationFn: (data) =>
      api.post('/auth/register', data).then((res) => res.data),

    onSuccess: () => {
      setServerMessage('Đăng ký thành công — chuyển hướng tới Login...');
      setTimeout(() => navigate('/login'), 1200);
    },

    onError: (err: any) => {
      setServerMessage(err?.response?.data?.message || 'Lỗi khi đăng ký');
    },
  });

  const onSubmit = (data: FormValues) => {
    setServerMessage(null);

    // ⭐ Chỉ gửi email + password
    const { email, password } = data;

    mutation.mutate({ email, password });
  };

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="hidden lg:flex flex-1 items-center justify-center" style={{ backgroundColor: 'var(--accent-primary)' }}>
        <div className="max-w-md text-center" style={{ color: 'white' }}>
          <h2 className="text-3xl font-bold">Join Us!</h2>
          <p className="mt-4">Create an account to get started with our platform.</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-12" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="max-w-md w-full">
          <h2 className="mt-6 text-center text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
            Create your account
          </h2>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div className="rounded-md shadow-sm -space-y-px">
              <input
                {...register('email')}
                type="email"
                placeholder="Email address"
                className="block w-full px-3 py-2 border rounded-t-md"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-primary)'
                }}
              />
              {errors.email && <p className="text-red-600">{errors.email.message}</p>}

              <input
                {...register('password')}
                type="password"
                placeholder="Password"
                className="block w-full px-3 py-2 border"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-primary)'
                }}
              />
              {errors.password && <p className="text-red-600">{errors.password.message}</p>}

              <input
                {...register('confirmPassword')}
                type="password"
                placeholder="Confirm Password"
                className="block w-full px-3 py-2 border rounded-b-md"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-primary)'
                }}
              />
              {errors.confirmPassword && (
                <p className="text-red-600">{errors.confirmPassword.message}</p>
              )}
            </div>

            {serverMessage && (
              <div
                className={`p-2 rounded ${
                  mutation.isError ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                }`}
              >
                {serverMessage}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2 px-4 rounded-md"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'white'
              }}
              disabled={mutation.isPending}
              onMouseEnter={(e) => {
                if (!mutation.isPending) {
                  e.currentTarget.style.backgroundColor = 'var(--accent-primary-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (!mutation.isPending) {
                  e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
                }
              }}
            >
              {mutation.isPending ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
