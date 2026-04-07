# WeSplit Browser Extension

A Chrome/Firefox browser extension for splitting expenses with crypto on Solana. This extension provides quick access to WeSplit functionality directly from your browser.

## Features

- **Wallet Connection**: Connect with Phantom or Solflare wallet extensions
- **Dashboard**: View your SOL and USDC balances at a glance
- **Send Crypto**: Quickly send SOL or USDC to any Solana address
- **Request Payments**: Generate payment requests to share with friends
- **Split Expenses**: Create and manage group expense splits
- **Transaction History**: Track all your transactions

## Tech Stack

- **React 18** + **TypeScript** - Modern UI framework
- **Tailwind CSS** - Styling (matching WeSplit mobile design tokens)
- **Zustand** - State management (same as mobile app)
- **Solana Web3.js** - Blockchain interactions
- **Vite** - Build tool
- **Phosphor Icons** - Consistent iconography

## Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Phantom or Solflare browser extension

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
# Build the extension
npm run build

# Package as ZIP for Chrome Web Store
npm run package
```

## Loading the Extension

### Chrome

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select any file in the `dist` folder

## Design System

The extension uses the same design tokens as the WeSplit mobile app:

### Colors
- **Primary**: `#A5EA15` (Lime) → `#53EF97` (Mint) gradient
- **Background**: `#061113` (Dark) / `#121D1F` (Surface)
- **Error**: `#DC3434`
- **Success**: `#53EF97`

### Typography
- Font: Inter (web) / Satoshi (mobile)
- Sizes: xs (12px), sm (14px), md (16px), lg (18px), xl (20px)

## Project Structure

```
src/
├── __tests__/           # Test files organized by feature
│   ├── components/      # Component tests
│   ├── services/        # Service tests
│   └── utils/           # Utility tests
├── components/          # React components
│   ├── AppHeader.tsx    # App header with user info
│   ├── AppNav.tsx       # Bottom navigation
│   ├── AuthLogin.tsx    # Email/Google/Passkey auth
│   ├── ConnectWallet.tsx # Wallet connection UI
│   ├── Dashboard.tsx    # Main dashboard view
│   ├── ErrorBoundary.tsx # Error boundary component
│   ├── History.tsx      # Transaction history
│   ├── QRLogin.tsx      # QR code authentication
│   ├── Request.tsx      # Payment requests
│   ├── Send.tsx         # Send crypto
│   ├── Settings.tsx     # User settings
│   ├── SharedWalletCard.tsx # Shared wallet card component
│   └── SharedWalletsView.tsx # Shared wallets list
├── config/              # Configuration modules
│   ├── app.ts           # App-wide configuration
│   └── firebase.ts      # Firebase initialization
├── services/            # Business logic layer
│   ├── auth.ts          # Authentication service
│   ├── passkey.ts       # Passkey/WebAuthn service
│   ├── paymentRequests.ts # Payment request service
│   ├── phantomAuth.ts   # Phantom wallet auth
│   ├── qrAuth.ts        # QR code auth service
│   ├── sharedWallets.ts # Shared wallet service
│   ├── transactions.ts  # Transaction service
│   └── wallet.ts        # Wallet connection & balance
├── store/               # Zustand state management
│   └── index.ts         # Global app state
├── styles/              # CSS styles
│   ├── base.css         # Base styles & variables
│   ├── components.css   # Component classes
│   ├── utilities.css    # Utility classes
│   └── index.css        # Main entry point
├── types/               # TypeScript type definitions
│   └── index.ts         # Shared types
├── utils/               # Utility functions
│   ├── logger.ts        # Logging utility
│   └── validation.ts    # Input validation
├── App.tsx              # Root component
├── main.tsx             # Entry point
└── polyfills.ts         # Browser polyfills
```

## Security

- Private keys are never stored or transmitted
- All transactions require wallet signature
- Works with Phantom and Solflare secure wallet extensions

## License

MIT
