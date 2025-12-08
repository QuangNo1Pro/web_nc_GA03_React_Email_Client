// Email provider configurations
export interface ProviderConfig {
  name: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  appPasswordUrl: string;
  instructions: string[];
}

export const emailProviders: Record<string, ProviderConfig> = {
  'gmail.com': {
    name: 'Gmail',
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    appPasswordUrl: 'https://myaccount.google.com/apppasswords',
    instructions: [
      'Truy cập Google Account → Bảo mật',
      'Bật xác minh 2 bước (nếu chưa bật)',
      'Chọn "Mật khẩu ứng dụng"',
      'Chọn ứng dụng: "Mail" và thiết bị của bạn',
      'Copy mật khẩu 16 ký tự và dán vào ô Password',
    ],
  },
  'outlook.com': {
    name: 'Outlook',
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    appPasswordUrl: 'https://account.microsoft.com/security',
    instructions: [
      'Đăng nhập Microsoft Account',
      'Vào Security → Advanced security options',
      'Chọn "App passwords"',
      'Tạo mật khẩu ứng dụng mới cho Email',
      'Copy mật khẩu và dán vào ô Password',
    ],
  },
  'hotmail.com': {
    name: 'Hotmail',
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    appPasswordUrl: 'https://account.microsoft.com/security',
    instructions: [
      'Đăng nhập Microsoft Account',
      'Vào Security → Advanced security options',
      'Chọn "App passwords"',
      'Tạo mật khẩu ứng dụng mới cho Email',
      'Copy mật khẩu và dán vào ô Password',
    ],
  },
  'yahoo.com': {
    name: 'Yahoo Mail',
    imapHost: 'imap.mail.yahoo.com',
    imapPort: 993,
    smtpHost: 'smtp.mail.yahoo.com',
    smtpPort: 587,
    appPasswordUrl: 'https://login.yahoo.com/account/security',
    instructions: [
      'Đăng nhập Yahoo Account',
      'Vào Account Security',
      'Chọn "Generate app password"',
      'Chọn app: "Other App" → nhập tên',
      'Copy mật khẩu và dán vào ô Password',
    ],
  },
  'icloud.com': {
    name: 'iCloud Mail',
    imapHost: 'imap.mail.me.com',
    imapPort: 993,
    smtpHost: 'smtp.mail.me.com',
    smtpPort: 587,
    appPasswordUrl: 'https://appleid.apple.com/account/manage',
    instructions: [
      'Đăng nhập Apple ID',
      'Vào Security → App-Specific Passwords',
      'Click "Generate Password"',
      'Nhập tên cho password (vd: Email Client)',
      'Copy mật khẩu và dán vào ô Password',
    ],
  },
};

// Education email domains (Google Workspace for Education)
const educationDomains = [
  'student.hcmus.edu.vn', // HCMUS
  'hcmus.edu.vn',
  'fit.hcmus.edu.vn',
  'student.ptithcm.edu.vn', // PTIT HCM
  'ptithcm.edu.vn',
  'student.uit.edu.vn', // UIT
  'gm.uit.edu.vn',
  'student.hcmut.edu.vn', // HCMUT
  'hcmut.edu.vn',
  'stu.edu.vn', // Trường khác
];

const educationConfig: ProviderConfig = {
  name: 'Email Giáo Dục (Google Workspace)',
  imapHost: 'imap.gmail.com',
  imapPort: 993,
  smtpHost: 'smtp.gmail.com',
  smtpPort: 587,
  appPasswordUrl: '',
  instructions: [
    'Email giáo dục dùng Google Workspace cho trường học',
    'Không thể tạo App Password như Gmail thông thường',
    'Bạn CẦN DÙNG MẬT KHẨU ĐĂNG NHẬP EMAIL THÔNG THƯỜNG',
    'Nhập email sinh viên (vd: 21120xxx@student.hcmus.edu.vn)',
    'Nhập mật khẩu đăng nhập email của trường',
    'Nếu bị lỗi xác thực, liên hệ IT trường để bật IMAP',
    'Một số trường yêu cầu bật "Less secure app access" hoặc cấu hình đặc biệt',
  ],
};

export function detectProvider(email: string): ProviderConfig | null {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;
  
  // Check education domains first
  if (educationDomains.includes(domain)) {
    return educationConfig;
  }
  
  return emailProviders[domain] || null;
}

export function getProviderInstructions(email: string): string[] {
  const provider = detectProvider(email);
  if (!provider) {
    return [
      'Liên hệ nhà cung cấp email để biết cách cấu hình IMAP/SMTP',
      'Thông thường bạn cần tạo App Password hoặc bật truy cập IMAP trong cài đặt email',
    ];
  }
  return provider.instructions;
}
