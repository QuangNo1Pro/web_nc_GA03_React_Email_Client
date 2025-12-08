import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../auth/AuthContext';
import { detectProvider, getProviderInstructions } from '../utils/emailProviders';

const schema = z.object({
  email: z.string().email({ message: 'Email không hợp lệ' }),
  password: z.string().min(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' }),
});

type FormValues = z.infer<typeof schema>;

const imapSchema = z.object({
  email: z.string().email({ message: 'Email không hợp lệ' }),
  password: z.string().min(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' }),
  imapHost: z.string().min(1, { message: 'IMAP host không được để trống' }),
  imapPort: z.number().min(1, { message: 'Port không hợp lệ' }),
  imapTls: z.boolean(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().optional(),
  smtpTls: z.boolean().optional(),
});

type ImapFormValues = z.infer<typeof imapSchema>;

export default function Login() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const {
    register: registerImap,
    handleSubmit: handleSubmitImap,
    formState: { errors: imapErrors },
    setValue: setImapValue,
    watch: watchImap,
  } = useForm<ImapFormValues>({
    resolver: zodResolver(imapSchema),
    defaultValues: {
      imapTls: true,
      smtpTls: true,
    },
  });

  const navigate = useNavigate();
  const { login } = useAuth();
  const [serverMessage, setServerMessage] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<'email' | 'imap'>('email');
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [showInstructions, setShowInstructions] = React.useState(false);
  const [providerInstructions, setProviderInstructions] = React.useState<string[]>([]);
  
  const imapEmail = watchImap('email');

  // Auto-fill IMAP/SMTP config when email changes
  React.useEffect(() => {
    if (imapEmail && imapEmail.includes('@')) {
      const provider = detectProvider(imapEmail);
      if (provider) {
        setImapValue('imapHost', provider.imapHost);
        setImapValue('imapPort', provider.imapPort);
        setImapValue('smtpHost', provider.smtpHost);
        setImapValue('smtpPort', provider.smtpPort);
        setProviderInstructions(provider.instructions);
        setShowInstructions(true);
      } else {
        setProviderInstructions(getProviderInstructions(imapEmail));
        setShowInstructions(false);
      }
    }
  }, [imapEmail, setImapValue]);

  const mutation = useMutation<any, any, FormValues, unknown>({
    mutationFn: (data: FormValues) =>
      api.post('/auth/login', data).then((res) => res.data),
    onSuccess: async () => {
      await login();
      setServerMessage('Đăng nhập thành công');
      setTimeout(() => navigate('/inbox'), 800);
    },
    onError: (err: any) => {
      setServerMessage(err?.response?.data?.message || 'Lỗi khi đăng nhập');
    },
  });

  const imapMutation = useMutation<any, any, ImapFormValues, unknown>({
    mutationFn: (data: ImapFormValues) =>
      api.post('/auth/imap-login', {
        email: data.email,
        password: data.password,
        imapConfig: {
          host: data.imapHost,
          port: data.imapPort,
          tls: data.imapTls,
        },
        smtpConfig: data.smtpHost ? {
          host: data.smtpHost,
          port: data.smtpPort || 587,
          tls: data.smtpTls,
        } : undefined,
      }).then((res) => res.data),
    onSuccess: async () => {
      await login();
      setServerMessage('IMAP login successful');
      setTimeout(() => navigate('/inbox'), 800);
    },
    onError: (err: any) => {
      setServerMessage(err?.response?.data?.message || 'IMAP login failed');
    },
  });

  const onSubmit = (data: FormValues) => {
    setServerMessage(null);
    mutation.mutate(data);
  };

  const onSubmitImap = (data: ImapFormValues) => {
    setServerMessage(null);
    imapMutation.mutate(data);
  };

  const handleGoogleLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/auth/google`;
  };

  return (
    <div className="lg:grid lg:grid-cols-2 min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="p-4 md:p-12 overflow-y-auto" style={{ backgroundColor: 'var(--bg-secondary)', maxHeight: '100vh' }}>
        <div className="max-w-md w-full mx-auto py-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
              Sign in to your account
            </h2>
          </div>

          {/* Tab buttons */}
          <div className="mt-8 flex border-b" style={{ borderColor: 'var(--border-primary)' }}>
            <button
              onClick={() => setActiveTab('email')}
              className={`flex-1 py-2 px-4 text-center font-medium transition-colors ${
                activeTab === 'email'
                  ? 'text-accent-primary border-b-2'
                  : 'text-text-secondary'
              }`}
              style={{
                color: activeTab === 'email' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                borderBottomColor: activeTab === 'email' ? 'var(--accent-primary)' : 'transparent',
              }}
            >
              Email Login
            </button>
            <button
              onClick={() => setActiveTab('imap')}
              className={`flex-1 py-2 px-4 text-center font-medium transition-colors ${
                activeTab === 'imap'
                  ? 'text-accent-primary border-b-2'
                  : 'text-text-secondary'
              }`}
              style={{
                color: activeTab === 'imap' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                borderBottomColor: activeTab === 'imap' ? 'var(--accent-primary)' : 'transparent',
              }}
            >
              IMAP Login
            </button>
          </div>

          {/* Email Login Tab */}
          {activeTab === 'email' && (
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
                    className="appearance-none rounded-none relative block w-full px-3 py-2 border rounded-t-md focus:outline-none focus:z-10 sm:text-sm"
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      borderColor: 'var(--border-primary)',
                      color: 'var(--text-primary)'
                    }}
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
                    autoComplete="current-password"
                    required
                    {...register('password')}
                    className="appearance-none rounded-none relative block w-full px-3 py-2 border rounded-b-md focus:outline-none focus:z-10 sm:text-sm"
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      borderColor: 'var(--border-primary)',
                      color: 'var(--text-primary)'
                    }}
                    placeholder="Password"
                  />
                </div>
              </div>

              {serverMessage && activeTab === 'email' && (
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
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md focus:outline-none"
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
                  {mutation.isPending ? 'Signing in...' : 'Sign in'}
                </button>
              </div>
            </form>
          )}

          {/* IMAP Login Tab */}
          {activeTab === 'imap' && (
            <form className="mt-8 space-y-6" onSubmit={handleSubmitImap(onSubmitImap)}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="imap-email" className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    Email
                  </label>
                  <input
                    id="imap-email"
                    type="email"
                    required
                    {...registerImap('email')}
                    className="mt-1 block w-full px-3 py-2 border rounded-md focus:outline-none focus:z-10 sm:text-sm"
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      borderColor: imapErrors.email ? '#ef4444' : 'var(--border-primary)',
                      color: 'var(--text-primary)'
                    }}
                    placeholder="your@email.com"
                  />
                  {imapErrors.email && <p className="text-red-500 text-sm mt-1">{imapErrors.email.message}</p>}
                </div>

                <div>
                  <label htmlFor="imap-password" className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    Password
                  </label>
                  <input
                    id="imap-password"
                    type="password"
                    required
                    {...registerImap('password')}
                    className="mt-1 block w-full px-3 py-2 border rounded-md focus:outline-none focus:z-10 sm:text-sm"
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      borderColor: imapErrors.password ? '#ef4444' : 'var(--border-primary)',
                      color: 'var(--text-primary)'
                    }}
                    placeholder="Password"
                  />
                  {imapErrors.password && <p className="text-red-500 text-sm mt-1">{imapErrors.password.message}</p>}
                </div>

                {/* App Password Instructions */}
                {showInstructions && providerInstructions.length > 0 && (
                  <div 
                    className="p-4 rounded-lg border"
                    style={{
                      backgroundColor: 'var(--bg-hover)',
                      borderColor: 'var(--accent-primary)',
                      borderWidth: '1px',
                    }}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <span className="material-symbols-outlined text-sm" style={{ color: 'var(--accent-primary)' }}>
                        info
                      </span>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                          Hướng dẫn lấy App Password
                        </h4>
                        <ol className="text-xs space-y-1 ml-4" style={{ color: 'var(--text-secondary)', listStyleType: 'decimal' }}>
                          {providerInstructions.map((instruction, index) => (
                            <li key={index}>{instruction}</li>
                          ))}
                        </ol>
                        {detectProvider(imapEmail)?.appPasswordUrl && (
                          <a
                            href={detectProvider(imapEmail)!.appPasswordUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-2 text-xs font-medium hover:underline"
                            style={{ color: 'var(--accent-primary)' }}
                          >
                            <span>Mở trang cài đặt</span>
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                              open_in_new
                            </span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="imap-host" className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      IMAP Host
                    </label>
                    {showInstructions && (
                      <span className="text-xs flex items-center gap-1" style={{ color: 'var(--accent-primary)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check_circle</span>
                        <span>Đã tự động điền</span>
                      </span>
                    )}
                  </div>
                  <input
                    id="imap-host"
                    type="text"
                    required
                    {...registerImap('imapHost')}
                    className="mt-1 block w-full px-3 py-2 border rounded-md focus:outline-none focus:z-10 sm:text-sm"
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      borderColor: imapErrors.imapHost ? '#ef4444' : 'var(--border-primary)',
                      color: 'var(--text-primary)'
                    }}
                    placeholder="imap.gmail.com"
                  />
                  {imapErrors.imapHost && <p className="text-red-500 text-sm mt-1">{imapErrors.imapHost.message}</p>}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="imap-port" className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      IMAP Port
                    </label>
                    {showInstructions && (
                      <span className="text-xs flex items-center gap-1" style={{ color: 'var(--accent-primary)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check_circle</span>
                        <span>Đã tự động điền</span>
                      </span>
                    )}
                  </div>
                  <input
                    id="imap-port"
                    type="number"
                    required
                    {...registerImap('imapPort')}
                    className="mt-1 block w-full px-3 py-2 border rounded-md focus:outline-none focus:z-10 sm:text-sm"
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      borderColor: imapErrors.imapPort ? '#ef4444' : 'var(--border-primary)',
                      color: 'var(--text-primary)'
                    }}
                    placeholder="993"
                  />
                  {imapErrors.imapPort && <p className="text-red-500 text-sm mt-1">{imapErrors.imapPort.message}</p>}
                </div>

                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      {...registerImap('imapTls')}
                      defaultChecked
                      style={{
                        accentColor: 'var(--accent-primary)',
                      }}
                    />
                    <span style={{ color: 'var(--text-primary)' }}>Use TLS</span>
                  </label>
                </div>

                {/* Advanced settings */}
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-sm font-medium"
                  style={{ color: 'var(--accent-primary)' }}
                >
                  {showAdvanced ? '- Hide' : '+ Show'} SMTP Settings
                </button>

                {showAdvanced && (
                  <div className="border-t pt-4" style={{ borderColor: 'var(--border-primary)' }}>
                    <div>
                      <label htmlFor="smtp-host" className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        SMTP Host
                      </label>
                      <input
                        id="smtp-host"
                        type="text"
                        {...registerImap('smtpHost')}
                        className="mt-1 block w-full px-3 py-2 border rounded-md focus:outline-none focus:z-10 sm:text-sm"
                        style={{
                          backgroundColor: 'var(--bg-primary)',
                          borderColor: 'var(--border-primary)',
                          color: 'var(--text-primary)'
                        }}
                        placeholder="smtp.gmail.com"
                      />
                    </div>

                    <div className="mt-3">
                      <label htmlFor="smtp-port" className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        SMTP Port
                      </label>
                      <input
                        id="smtp-port"
                        type="number"
                        {...registerImap('smtpPort')}
                        className="mt-1 block w-full px-3 py-2 border rounded-md focus:outline-none focus:z-10 sm:text-sm"
                        style={{
                          backgroundColor: 'var(--bg-primary)',
                          borderColor: 'var(--border-primary)',
                          color: 'var(--text-primary)'
                        }}
                        placeholder="587"
                      />
                    </div>

                    <div className="mt-3">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          {...registerImap('smtpTls')}
                          defaultChecked
                          style={{
                            accentColor: 'var(--accent-primary)',
                          }}
                        />
                        <span style={{ color: 'var(--text-primary)' }}>Use TLS</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {serverMessage && activeTab === 'imap' && (
                <div
                  className={`p-2 rounded mb-4 ${
                    imapMutation.isError
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
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md focus:outline-none"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: 'white'
                  }}
                  disabled={imapMutation.isPending}
                  onMouseEnter={(e) => {
                    if (!imapMutation.isPending) {
                      e.currentTarget.style.backgroundColor = 'var(--accent-primary-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!imapMutation.isPending) {
                      e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
                    }
                  }}
                >
                  {imapMutation.isPending ? 'Connecting...' : 'Connect IMAP'}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" style={{ borderColor: 'var(--border-primary)' }} />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                  Or continue with
                </span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={handleGoogleLogin}
                className="w-full inline-flex justify-center py-2 px-4 border rounded-md shadow-sm text-sm font-medium"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-secondary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                }}
              >
                <span className="sr-only">Sign in with Google</span>
                <svg
                  className="w-5 h-5"
                  aria-hidden="true"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="hidden lg:flex items-center justify-center min-h-screen sticky top-0" style={{ backgroundColor: 'var(--accent-primary)' }}>
        <div className="max-w-md text-center" style={{ color: 'white' }}>
          <h2 className="text-3xl font-bold">Welcome Back!</h2>
          <p className="mt-4">
            Sign in to access your account and continue your journey with us.
          </p>
        </div>
      </div>
    </div>
  );
}
