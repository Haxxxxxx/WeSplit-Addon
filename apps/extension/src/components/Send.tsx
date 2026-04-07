import { useState } from 'react';
import { ArrowLeft, Wallet, Warning, Check, DeviceMobileCamera, PlugsConnected } from '@phosphor-icons/react';
import { useStore } from '../store';
import { isValidSolanaAddress, shortenAddress, isPhantomInstalled, connectWallet } from '../services/wallet';
import { sendUsdc, sendSol } from '../services/transactions';
import type { Transaction } from '../types';

type Currency = 'USDC' | 'SOL';
type Step = 'form' | 'confirm' | 'success' | 'error';
type SendMethod = 'browser' | 'mobile';

export function Send() {
  const { wallet, setWallet, addTransaction, authMethod } = useStore();

  // Check if we have a signing-capable wallet connected (browser wallet)
  const hasSigningWallet = wallet.provider !== 'none' && wallet.provider !== null;

  // Check if user logged in via mobile app auth (no browser wallet)
  const isMobileAuth = !hasSigningWallet && (authMethod === 'qr' || authMethod === 'email' || authMethod === 'passkey');

  // Check if Phantom is installed (most common wallet)
  const phantomAvailable = isPhantomInstalled();

  const [step, setStep] = useState<Step>('form');
  const [sendMethod, setSendMethod] = useState<SendMethod>(hasSigningWallet ? 'browser' : 'mobile');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('USDC');
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectingWallet, setConnectingWallet] = useState(false);

  // Generate deep link for mobile app
  const generateMobileDeepLink = () => {
    const params = new URLSearchParams({
      action: 'send',
      to: recipient,
      amount: amount,
      currency: currency,
    });
    // Try app scheme first, fallback to universal link
    return `wesplit://send?${params.toString()}`;
  };

  const generateUniversalLink = () => {
    const params = new URLSearchParams({
      action: 'send',
      to: recipient,
      amount: amount,
      currency: currency,
    });
    return `https://wesplit.app/send?${params.toString()}`;
  };

  // Open mobile app to complete transaction
  const openMobileApp = () => {
    const deepLink = generateMobileDeepLink();
    const universalLink = generateUniversalLink();

    // Try deep link first
    const startTime = Date.now();
    window.location.href = deepLink;

    // If deep link doesn't work after 1.5s, try universal link
    setTimeout(() => {
      if (Date.now() - startTime < 2000) {
        window.open(universalLink, '_blank');
      }
    }, 1500);
  };

  // Handle connecting browser wallet for signing
  const handleConnectWallet = async () => {
    setConnectingWallet(true);
    try {
      const result = await connectWallet('phantom');
      if (result) {
        // Update wallet with the connected provider
        setWallet({
          provider: result.provider,
          address: result.address,
          isConnected: true,
        });
        setSendMethod('browser');
      }
    } catch (err) {
      console.error('Failed to connect wallet:', err);
      setError('Failed to connect wallet. Please try again.');
    } finally {
      setConnectingWallet(false);
    }
  };

  const balance = currency === 'USDC' ? wallet.usdcBalance : wallet.balance;
  const isValidAddress = recipient ? isValidSolanaAddress(recipient) : true;
  const amountNum = parseFloat(amount) || 0;
  const hasEnoughBalance = amountNum <= balance;
  const isFormValid =
    recipient &&
    isValidAddress &&
    amountNum > 0 &&
    hasEnoughBalance;

  const handleConfirm = async () => {
    if (!wallet.address) return;

    setLoading(true);
    setError(null);

    try {
      const signature =
        currency === 'USDC'
          ? await sendUsdc(wallet.address, recipient, amountNum, wallet.provider)
          : await sendSol(wallet.address, recipient, amountNum, wallet.provider);

      if (signature) {
        setTxHash(signature);

        const tx: Transaction = {
          id: signature,
          type: 'send',
          amount: amountNum,
          currency,
          from_address: wallet.address,
          to_address: recipient,
          tx_hash: signature,
          status: 'completed',
          created_at: new Date().toISOString(),
        };
        addTransaction(tx);

        setStep('success');
      } else {
        throw new Error('Transaction failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('form');
    setRecipient('');
    setAmount('');
    setTxHash(null);
    setError(null);
  };

  if (step === 'success') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-green/20 flex items-center justify-center mb-4">
          <Check size={32} className="text-green" weight="bold" />
        </div>
        <h2 className="text-xl font-bold mb-2 font-archivo">Sent Successfully!</h2>
        <p className="text-white50 mb-4 font-satoshi">
          {amountNum} {currency} sent to {shortenAddress(recipient)}
        </p>
        {txHash && (
          <a
            href={`https://solscan.io/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green text-sm hover:underline mb-6 font-satoshi"
          >
            View on Solscan
          </a>
        )}
        <button onClick={handleReset} className="btn-primary">
          Send More
        </button>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-error/20 flex items-center justify-center mb-4">
          <Warning size={32} className="text-error" weight="bold" />
        </div>
        <h2 className="text-xl font-bold mb-2 font-archivo">Transaction Failed</h2>
        <p className="text-white50 mb-6 font-satoshi">{error || 'Something went wrong'}</p>
        <button onClick={handleReset} className="btn-primary">
          Try Again
        </button>
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <div className="p-4">
        <button
          onClick={() => setStep('form')}
          className="flex items-center gap-2 text-white70 hover:text-white mb-4 font-satoshi transition-all"
        >
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>

        <h2 className="text-xl font-bold mb-6 font-archivo">Confirm Transaction</h2>

        <div className="glass-card p-4 space-y-4 mb-6">
          <div className="flex justify-between">
            <span className="text-white50 font-satoshi">Amount</span>
            <span className="font-medium font-archivo">
              {amountNum} {currency}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-white50 font-satoshi">To</span>
            <span className="font-medium font-satoshi">{shortenAddress(recipient)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white50 font-satoshi">Network</span>
            <span className="font-medium font-satoshi">Solana</span>
          </div>
        </div>

        <button
          onClick={handleConfirm}
          disabled={loading}
          className="w-full btn-primary disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              Sending...
            </span>
          ) : (
            'Confirm & Send'
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4 font-archivo">Send Crypto</h2>

      {/* Send Method Selector - Only show if mobile auth (no browser wallet connected) */}
      {isMobileAuth && (
        <>
          <div className="mb-4">
            <label className="block text-sm text-white70 mb-2 font-satoshi">Send via</label>
            <div className="flex gap-2">
              <button
                onClick={() => setSendMethod('mobile')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all font-satoshi ${
                  sendMethod === 'mobile'
                    ? 'bg-green text-black'
                    : 'bg-white5 text-white hover:bg-white10 border border-white10'
                }`}
              >
                <DeviceMobileCamera size={18} />
                Mobile App
              </button>
              <button
                onClick={() => setSendMethod('browser')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all font-satoshi ${
                  sendMethod === 'browser'
                    ? 'bg-green text-black'
                    : 'bg-white5 text-white hover:bg-white10 border border-white10'
                }`}
              >
                <Wallet size={18} />
                Browser Wallet
              </button>
            </div>
          </div>

          {/* Browser wallet connection prompt */}
          {sendMethod === 'browser' && (
            <div className="glass-card p-4 mb-4 border-yellow-500/30">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                  <PlugsConnected size={20} className="text-yellow-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium font-satoshi mb-1">Connect Browser Wallet</p>
                  <p className="text-xs text-white50 font-satoshi mb-3">
                    Connect Phantom or another wallet to send directly from browser.
                  </p>
                  {phantomAvailable ? (
                    <button
                      onClick={handleConnectWallet}
                      disabled={connectingWallet}
                      className="btn-primary text-sm py-2 px-4"
                    >
                      {connectingWallet ? 'Connecting...' : 'Connect Phantom'}
                    </button>
                  ) : (
                    <a
                      href="https://phantom.app/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary text-sm py-2 px-4 inline-block"
                    >
                      Install Phantom
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Currency Selector */}
      <div className="flex gap-2 mb-4">
        {(['USDC', 'SOL'] as Currency[]).map((c) => (
          <button
            key={c}
            onClick={() => setCurrency(c)}
            className={`flex-1 py-2.5 rounded-lg font-medium transition-all font-satoshi ${
              currency === c
                ? 'bg-green text-black'
                : 'bg-white5 text-white hover:bg-white10 border border-white10'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Amount Input */}
      <div className="mb-4">
        <label className="block text-sm text-white70 mb-1 font-satoshi">Amount</label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-white5 border border-white10 rounded-lg px-4 py-2.5 text-lg focus:outline-none focus:border-green font-satoshi"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white50 font-satoshi">
            {currency}
          </span>
        </div>
        <div className="flex justify-between mt-1 text-xs">
          <span className="text-white50 font-satoshi">
            Balance: {balance.toFixed(currency === 'USDC' ? 2 : 4)} {currency}
          </span>
          <button
            onClick={() => setAmount(balance.toString())}
            className="text-green hover:underline font-satoshi"
          >
            Max
          </button>
        </div>
        {!hasEnoughBalance && amountNum > 0 && (
          <p className="text-error text-xs mt-1 font-satoshi">Insufficient balance</p>
        )}
      </div>

      {/* Recipient Input */}
      <div className="mb-6">
        <label className="block text-sm text-white70 mb-1 font-satoshi">Recipient Address</label>
        <div className="relative">
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Solana wallet address"
            className={`w-full bg-white5 border rounded-lg px-4 py-2.5 pr-10 focus:outline-none font-satoshi ${
              recipient && !isValidAddress
                ? 'border-error'
                : 'border-white10 focus:border-green'
            }`}
          />
          <Wallet
            size={20}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white50"
          />
        </div>
        {recipient && !isValidAddress && (
          <p className="text-error text-xs mt-1 font-satoshi">Invalid Solana address</p>
        )}
      </div>

      {/* Send Button */}
      {hasSigningWallet ? (
        // User has browser wallet connected - use it directly
        <button
          onClick={() => setStep('confirm')}
          disabled={!isFormValid}
          className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      ) : sendMethod === 'mobile' ? (
        // Mobile auth user chose mobile app
        <>
          <button
            onClick={openMobileApp}
            disabled={!isFormValid}
            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <DeviceMobileCamera size={18} />
            Open in Mobile App
          </button>
          {isFormValid && (
            <p className="text-center text-white50 text-xs mt-3 font-satoshi">
              This will open the WeSplit app on your phone to complete the transaction
            </p>
          )}
        </>
      ) : (
        // Mobile auth user chose browser but hasn't connected wallet
        <button
          disabled={true}
          className="w-full btn-primary opacity-50 cursor-not-allowed"
        >
          Connect Wallet First
        </button>
      )}
    </div>
  );
}
