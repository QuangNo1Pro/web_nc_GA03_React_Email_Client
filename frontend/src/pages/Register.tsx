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

  const mutation = useMutation<any, any, FormValues, unknown>({
    mutationFn: (data: FormValues) =>
      api.post('/auth/register', data).then((res) => res.data),
    onSuccess: (data) => {
      setServerMessage('Đăng ký thành công — chuyển hướng tới Login...');
      setTimeout(() => navigate('/login'), 1200);
    },
    onError: (err: any) => {
      setServerMessage(err?.response?.data?.message || 'Lỗi khi đăng ký');
    },
  });

  const onSubmit = (data: FormValues) => {
    setServerMessage(null);
    const { confirmPassword, ...rest } = data;
    mutation.mutate(rest);
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex flex-1 items-center justify-center bg-indigo-700">
        <div className="max-w-md text-white text-center">
          <h2 className="text-3xl font-bold">Join Us!</h2>
          <p className="mt-4">
            Create an account to get started with our platform.
          </p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-12 bg-gray-50">
        <div className="max-w-md w-full">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Create your account
            </h2>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="email-address" className="sr-only">
                  Email address
                </label>
                <input
                  id="email-address"
                  type="email"
                  autoComplete="email"
                  required
                  {...register('email')}
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Email address"
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  {...register('password')}
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Password"
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="sr-only">
                  Confirm Password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  {...register('confirmPassword')}
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Confirm Password"
                />
              </div>
            </div>

            {serverMessage && (
              <div
                className={`p-2 rounded mb-4 ${
                  mutation.isError
                    ? 'bg-red-100 text-red-800'
                    : 'bg-green-100 text-green-800'
                }`}
              >
                {serverMessage}
              </div>
            )}

            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                disabled={mutation.isLoading}
              >
                {mutation.isLoading ? 'Creating account...' : 'Create account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
