# AI Sales Assistant

ระบบผู้ช่วยขายอัจฉริยะ (AI Sales Assistant) สำหรับธุรกิจออนไลน์ — แชทบอท AI ที่เข้าใจภาษาไทย ตอบลูกค้าอัตโนมัติ รับออเดอร์ ตรวจสลิป และจัดการร้านค้าครบวงจร

## Features

- **AI Chatbot** — ตอบคำถามลูกค้า 24/7 เข้าใจบริบทและแนะนำสินค้า
- **Multi-channel** — เชื่อมต่อ LINE, Facebook Messenger และ Web Widget
- **Order Management** — สร้างออเดอร์อัตโนมัติ ติดตามสถานะ แจ้งเตือนแอดมิน
- **Payment Slip Analysis** — AI ตรวจสอบสลิปโอนเงินอัตโนมัติ
- **Knowledge Base** — Web scraping และอัปโหลดไฟล์เพื่อเทรน AI
- **Admin Dashboard** — Analytics, Audit Logs, Error Logs, API Usage
- **Broadcast & Notifications** — ส่งข้อความถึงลูกค้าและ Auto follow-up
- **Booking System** — ระบบจองนัดหมาย
- **Coupon Management** — สร้างและจัดการคูปองส่วนลด
- **Embeddable Widget** — ฝัง chat widget ในเว็บไซต์อื่นได้

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (Auth, Database, Edge Functions, Storage)
- **State Management:** TanStack React Query
- **Routing:** React Router v6
- **Charts:** Recharts
- **Forms:** React Hook Form + Zod validation

## Getting Started

### Prerequisites

- Node.js 20+
- npm or bun

### Installation

```bash
# Clone the repository
git clone https://github.com/praphawach29/aisalesassistant.git
cd aisalesassistant

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Then fill in your Supabase credentials in .env

# Start development server
npm run dev
```

The app will be available at `http://localhost:8080`.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ID |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |
| `VITE_SUPABASE_URL` | Supabase project URL |

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |

## Project Structure

```
src/
├── assets/          # Static assets (images)
├── components/
│   ├── admin/       # Admin panel components
│   ├── chat/        # Chat UI components
│   ├── landing/     # Landing page components
│   └── ui/          # Reusable UI components (shadcn/ui)
├── hooks/           # Custom React hooks
├── integrations/
│   └── supabase/    # Supabase client & types
├── lib/             # Utility functions
├── pages/           # Route page components
├── test/            # Test setup
└── types/           # TypeScript type definitions

supabase/
├── functions/       # Edge Functions (chat, webhooks, etc.)
└── migrations/      # Database migrations
```

## Supabase Edge Functions

| Function | Description |
|----------|-------------|
| `chat` | Main AI chat processing |
| `line-webhook` | LINE messaging webhook |
| `facebook-webhook` | Facebook Messenger webhook |
| `analyze-payment-slip` | AI payment slip verification |
| `send-broadcast` | Broadcast messaging |
| `scrape-website` | Web scraping for knowledge base |
| `auto-follow-up` | Automated customer follow-up |
| `weekly-summary` | Weekly analytics summary |

## License

This project is private.
