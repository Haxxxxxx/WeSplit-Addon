import { useState, useEffect, useCallback } from 'react';
import {
  MagnifyingGlass,
  User,
  Check,
  Warning,
  PaperPlaneTilt,
  ArrowsClockwise,
  Clock,
  CheckCircle,
  XCircle,
} from '@phosphor-icons/react';
import { useStore } from '../store';
import { paymentRequestService, type PaymentRequest } from '../services/paymentRequests';
import type { User as WeSplitUser, Currency } from '../types';
import { logger } from '../utils/logger';

type Step = 'search' | 'amount' | 'confirm' | 'success' | 'error';
type Tab = 'new' | 'sent';

export function Request() {
  const { wallet, user } = useStore();

  const [tab, setTab] = useState<Tab>('new');
  const [step, setStep] = useState<Step>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<WeSplitUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<WeSplitUser | null>(null);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('USDC');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sent requests
  const [sentRequests, setSentRequests] = useState<PaymentRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const amountNum = parseFloat(amount) || 0;

  // Load sent requests
  const loadSentRequests = useCallback(async () => {
    if (!user?.id) return;
    setLoadingRequests(true);
    try {
      const requests = await paymentRequestService.getSentRequests(user.id);
      setSentRequests(requests);
    } catch (err) {
      logger.error('Failed to load sent requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id && tab === 'sent') {
      loadSentRequests();
    }
  }, [user?.id, tab, loadSentRequests]);

  // Search for users
  const handleSearch = useCallback(async () => {
    if (!user?.id || searchQuery.length < 2) return;

    setSearching(true);
    try {
      const results = await paymentRequestService.searchUsers(searchQuery, user.id);
      setSearchResults(results);
    } catch (err) {
      logger.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  }, [user?.id, searchQuery]);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length >= 2) {
      const timeout = setTimeout(handleSearch, 300);
      return () => clearTimeout(timeout);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, handleSearch]);

  // Send request
  const handleSendRequest = async () => {
    if (!user || !selectedUser || !wallet.address) return;

    setLoading(true);
    setError(null);

    try {
      const result = await paymentRequestService.createRequest(
        {
          id: user.id,
          name: user.name,
          walletAddress: wallet.address,
        },
        {
          id: selectedUser.id,
          name: selectedUser.name,
          walletAddress: selectedUser.wallet_address,
        },
        amountNum,
        currency,
        message || undefined
      );

      if (result.success) {
        setStep('success');
      } else {
        setError(result.error || 'Failed to send request');
        setStep('error');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send request';
      setError(message);
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('search');
    setSearchQuery('');
    setSearchResults([]);
    setSelectedUser(null);
    setAmount('');
    setMessage('');
    setError(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle size={16} className="text-green" weight="fill" />;
      case 'declined':
        return <XCircle size={16} className="text-error" weight="fill" />;
      case 'pending':
      default:
        return <Clock size={16} className="text-yellow-400" />;
    }
  };

  // Success state
  if (step === 'success') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-green/20 flex items-center justify-center mb-4">
          <Check size={32} className="text-green" weight="bold" />
        </div>
        <h2 className="text-xl font-bold mb-2 font-archivo">Request Sent!</h2>
        <p className="text-white50 mb-2 font-satoshi">
          {selectedUser?.name} will receive a notification to pay you
        </p>
        <p className="text-lg font-bold gradient-text font-archivo mb-6">
          {amountNum} {currency}
        </p>
        <button onClick={handleReset} className="btn-primary">
          Send Another Request
        </button>
      </div>
    );
  }

  // Error state
  if (step === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-error/20 flex items-center justify-center mb-4">
          <Warning size={32} className="text-error" weight="bold" />
        </div>
        <h2 className="text-xl font-bold mb-2 font-archivo">Request Failed</h2>
        <p className="text-white50 mb-6 font-satoshi">{error || 'Something went wrong'}</p>
        <button onClick={handleReset} className="btn-primary">
          Try Again
        </button>
      </div>
    );
  }

  // Confirm step
  if (step === 'confirm' && selectedUser) {
    return (
      <div className="p-4">
        <h2 className="text-lg font-bold mb-4 font-archivo">Confirm Request</h2>

        <div className="glass-card p-4 space-y-4 mb-6">
          <div className="flex justify-between">
            <span className="text-white50 font-satoshi">Requesting from</span>
            <span className="font-medium font-satoshi">{selectedUser.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white50 font-satoshi">Amount</span>
            <span className="font-medium font-archivo">
              {amountNum} {currency}
            </span>
          </div>
          {message && (
            <div className="flex justify-between">
              <span className="text-white50 font-satoshi">Message</span>
              <span className="font-medium font-satoshi text-right max-w-[60%]">{message}</span>
            </div>
          )}
        </div>

        <p className="text-white50 text-xs text-center mb-4 font-satoshi">
          {selectedUser.name} will receive a push notification and can pay directly from the WeSplit app.
        </p>

        <button
          onClick={handleSendRequest}
          disabled={loading}
          className="w-full btn-primary disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              Sending...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <PaperPlaneTilt size={18} />
              Send Request
            </span>
          )}
        </button>

        <button
          onClick={() => setStep('amount')}
          className="w-full mt-2 py-2.5 text-white70 hover:text-white font-satoshi"
        >
          Back
        </button>
      </div>
    );
  }

  // Amount step
  if (step === 'amount' && selectedUser) {
    return (
      <div className="p-4">
        <h2 className="text-lg font-bold mb-4 font-archivo">Request Amount</h2>

        {/* Selected user */}
        <div className="glass-card p-3 mb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white10 flex items-center justify-center">
            {selectedUser.avatar ? (
              <img src={selectedUser.avatar} alt="" className="w-10 h-10 rounded-full" />
            ) : (
              <User size={20} className="text-white50" />
            )}
          </div>
          <div>
            <p className="font-medium font-satoshi">{selectedUser.name}</p>
            <p className="text-xs text-white50 font-satoshi">{selectedUser.email}</p>
          </div>
        </div>

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
        </div>

        {/* Message Input */}
        <div className="mb-6">
          <label className="block text-sm text-white70 mb-1 font-satoshi">Message (optional)</label>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What's this for?"
            className="w-full bg-white5 border border-white10 rounded-lg px-4 py-2.5 focus:outline-none focus:border-green font-satoshi"
          />
        </div>

        <button
          onClick={() => setStep('confirm')}
          disabled={amountNum <= 0}
          className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>

        <button
          onClick={() => {
            setStep('search');
            setSelectedUser(null);
          }}
          className="w-full mt-2 py-2.5 text-white70 hover:text-white font-satoshi"
        >
          Back
        </button>
      </div>
    );
  }

  // Main view with tabs
  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4 font-archivo">Request Payment</h2>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('new')}
          className={`flex-1 py-2 rounded-lg font-medium transition-all font-satoshi text-sm ${
            tab === 'new'
              ? 'bg-green text-black'
              : 'bg-white5 text-white70 hover:bg-white10 border border-white10'
          }`}
        >
          New Request
        </button>
        <button
          onClick={() => setTab('sent')}
          className={`flex-1 py-2 rounded-lg font-medium transition-all font-satoshi text-sm ${
            tab === 'sent'
              ? 'bg-green text-black'
              : 'bg-white5 text-white70 hover:bg-white10 border border-white10'
          }`}
        >
          Sent Requests
        </button>
      </div>

      {/* New Request Tab */}
      {tab === 'new' && (
        <>
          {/* Search Input */}
          <div className="mb-4">
            <label className="block text-sm text-white70 mb-1 font-satoshi">
              Find WeSplit user
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by email or name..."
                className="w-full bg-white5 border border-white10 rounded-lg px-4 py-2.5 pr-10 focus:outline-none focus:border-green font-satoshi"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {searching ? (
                  <ArrowsClockwise size={18} className="text-white50 animate-spin" />
                ) : (
                  <MagnifyingGlass size={18} className="text-white50" />
                )}
              </div>
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-white50 font-satoshi">Select a user</p>
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => {
                    setSelectedUser(result);
                    setStep('amount');
                  }}
                  className="w-full flex items-center gap-3 glass-card p-3 text-left hover:bg-white10 transition-all"
                >
                  <div className="w-10 h-10 rounded-full bg-white10 flex items-center justify-center">
                    {result.avatar ? (
                      <img src={result.avatar} alt="" className="w-10 h-10 rounded-full" />
                    ) : (
                      <User size={20} className="text-white50" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium font-satoshi">{result.name}</p>
                    <p className="text-xs text-white50 font-satoshi">{result.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No Results */}
          {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
            <div className="text-center py-8 glass-card">
              <User size={32} className="text-white30 mx-auto mb-2" />
              <p className="text-white50 text-sm font-satoshi">No WeSplit users found</p>
              <p className="text-white30 text-xs font-satoshi mt-1">
                Try searching by email address
              </p>
            </div>
          )}

          {/* Empty State */}
          {searchQuery.length < 2 && (
            <div className="text-center py-8 glass-card">
              <MagnifyingGlass size={32} className="text-white30 mx-auto mb-2" />
              <p className="text-white50 text-sm font-satoshi">Search for a WeSplit user</p>
              <p className="text-white30 text-xs font-satoshi mt-1">
                Enter their email or name to request payment
              </p>
            </div>
          )}
        </>
      )}

      {/* Sent Requests Tab */}
      {tab === 'sent' && (
        <>
          {loadingRequests ? (
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-green border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-white50 text-sm font-satoshi">Loading requests...</p>
            </div>
          ) : sentRequests.length === 0 ? (
            <div className="text-center py-8 glass-card">
              <PaperPlaneTilt size={32} className="text-white30 mx-auto mb-2" />
              <p className="text-white50 text-sm font-satoshi">No sent requests yet</p>
              <p className="text-white30 text-xs font-satoshi mt-1">
                Your payment requests will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sentRequests.map((request) => (
                <div key={request.id} className="glass-card p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium font-satoshi">{request.toUserName}</span>
                    <span className="font-medium font-archivo text-green">
                      {request.amount} {request.currency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white50 font-satoshi">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(request.status)}
                      <span className="text-xs text-white50 font-satoshi capitalize">
                        {request.status}
                      </span>
                    </div>
                  </div>
                  {request.message && (
                    <p className="text-xs text-white30 font-satoshi mt-1 truncate">
                      "{request.message}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={loadSentRequests}
            disabled={loadingRequests}
            className="w-full mt-4 py-2 text-white50 hover:text-white font-satoshi text-sm flex items-center justify-center gap-2"
          >
            <ArrowsClockwise size={14} className={loadingRequests ? 'animate-spin' : ''} />
            Refresh
          </button>
        </>
      )}
    </div>
  );
}
