import { useState, useEffect } from 'react';
import {
  ArrowUp,
  ArrowDown,
  Funnel,
  ArrowsDownUp,
  ArrowSquareOut,
  ArrowsClockwise,
  ArrowsLeftRight,
  ArrowLeft,
  Copy,
  Check,
  CheckCircle,
  XCircle,
  Clock,
} from '@phosphor-icons/react';
import { useStore } from '../store';
import { shortenAddress, getRecentTransactions } from '../services/wallet';
import type { TransactionType, Transaction } from '../types';
import { logger } from '../utils/logger';

type Filter = 'all' | TransactionType;
type ViewState = 'list' | 'detail';

export function History() {
  const { wallet, transactions } = useStore();

  const [viewState, setViewState] = useState<ViewState>('list');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchedTxs, setFetchedTxs] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchTransactions = async () => {
    if (!wallet.address) return;

    setLoading(true);
    setError(null);

    try {
      logger.log('Fetching transactions for:', wallet.address);
      const txs = await getRecentTransactions(wallet.address, 10);
      logger.log('Fetched transactions:', txs);
      setFetchedTxs(txs);
    } catch (err: unknown) {
      logger.error('Failed to fetch transactions:', err);
      setError('Failed to load transactions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount
  useEffect(() => {
    if (wallet.address) {
      fetchTransactions();
    }
  }, [wallet.address]);

  // Combine fetched and local transactions
  const allTransactions = [...fetchedTxs, ...transactions].reduce(
    (acc, tx) => {
      if (!acc.find((t) => t.id === tx.id)) {
        acc.push(tx);
      }
      return acc;
    },
    [] as Transaction[]
  );

  // Sort by date descending
  allTransactions.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const filteredTransactions =
    filter === 'all'
      ? allTransactions
      : allTransactions.filter((tx) => tx.type === filter);

  const getTypeIcon = (type: TransactionType) => {
    switch (type) {
      case 'send':
      case 'withdraw':
        return <ArrowUp size={16} className="text-error" />;
      case 'receive':
      case 'deposit':
        return <ArrowDown size={16} className="text-green" />;
      case 'swap':
        return <ArrowsLeftRight size={16} className="text-greenBlue" />;
      default:
        return <ArrowsDownUp size={16} className="text-white50" />;
    }
  };

  const getTypeColor = (type: TransactionType) => {
    switch (type) {
      case 'send':
      case 'withdraw':
        return 'text-error';
      case 'receive':
      case 'deposit':
        return 'text-green';
      case 'swap':
        return 'text-greenBlue';
      default:
        return 'text-white';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const groupedTransactions = filteredTransactions.reduce(
    (groups, tx) => {
      const dateKey = formatDate(tx.created_at);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(tx);
      return groups;
    },
    {} as Record<string, typeof filteredTransactions>
  );

  // Copy helper
  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} className="text-green" weight="fill" />;
      case 'failed':
        return <XCircle size={16} className="text-error" weight="fill" />;
      case 'pending':
        return <Clock size={16} className="text-yellow-400" />;
      default:
        return <CheckCircle size={16} className="text-green" weight="fill" />;
    }
  };

  // Transaction Detail View
  if (viewState === 'detail' && selectedTx) {
    const isOutgoing = selectedTx.type === 'send' || selectedTx.type === 'withdraw';
    const isSwap = selectedTx.type === 'swap';

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-4 pt-3 pb-2 border-b border-white10">
          <button
            onClick={() => {
              setViewState('list');
              setSelectedTx(null);
            }}
            className="flex items-center gap-1.5 text-white50 hover:text-white text-sm transition-all font-satoshi"
          >
            <ArrowLeft size={18} />
            Back
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Transaction Type & Amount */}
          <div className="text-center mb-6">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${
                isOutgoing ? 'bg-error/20' : isSwap ? 'bg-greenBlue/20' : 'bg-green/20'
              }`}
            >
              {isSwap ? (
                <ArrowsLeftRight size={28} className="text-greenBlue" />
              ) : isOutgoing ? (
                <ArrowUp size={28} className="text-error" />
              ) : (
                <ArrowDown size={28} className="text-green" />
              )}
            </div>
            <p className="text-sm text-white50 font-satoshi capitalize mb-1">
              {selectedTx.type === 'receive' ? 'Received' :
               selectedTx.type === 'send' ? 'Sent' :
               selectedTx.type === 'deposit' ? 'Deposited' :
               selectedTx.type === 'withdraw' ? 'Withdrawn' :
               selectedTx.type === 'swap' ? 'Swapped' : selectedTx.type}
            </p>
            {isSwap ? (
              <div>
                <p className="text-2xl font-bold font-archivo text-error">
                  -{selectedTx.swapFromAmount?.toFixed(selectedTx.swapFromCurrency === 'SOL' ? 4 : 2)} {selectedTx.swapFromCurrency}
                </p>
                <p className="text-xl font-bold font-archivo text-green mt-1">
                  +{selectedTx.swapToAmount?.toFixed(selectedTx.swapToCurrency === 'SOL' ? 4 : 2)} {selectedTx.swapToCurrency}
                </p>
              </div>
            ) : (
              <p className={`text-2xl font-bold font-archivo ${isOutgoing ? 'text-error' : 'text-green'}`}>
                {isOutgoing ? '-' : '+'}
                {selectedTx.amount.toFixed(selectedTx.currency === 'SOL' ? 4 : 2)} {selectedTx.currency}
              </p>
            )}
          </div>

          {/* Status */}
          <div className="glass-card p-3 mb-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white50 font-satoshi">Status</span>
              <div className="flex items-center gap-1.5">
                {getStatusIcon(selectedTx.status)}
                <span className="text-sm font-medium font-satoshi capitalize">
                  {selectedTx.status}
                </span>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="glass-card p-3 space-y-3">
            {/* Date & Time */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-white50 font-satoshi">Date & Time</span>
              <span className="text-sm font-satoshi">
                {new Date(selectedTx.created_at).toLocaleString()}
              </span>
            </div>

            {/* From Address */}
            {!isSwap && (
              <div>
                <span className="text-sm text-white50 font-satoshi">From</span>
                <div className="flex items-center justify-between mt-1">
                  <code className="text-xs text-white70 font-mono bg-white5 px-2 py-1 rounded">
                    {shortenAddress(selectedTx.from_address, 8)}
                  </code>
                  <button
                    onClick={() => handleCopy(selectedTx.from_address, 'from')}
                    className="p-1.5 hover:bg-white10 rounded transition-all"
                  >
                    {copied === 'from' ? (
                      <Check size={14} className="text-green" />
                    ) : (
                      <Copy size={14} className="text-white50" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* To Address */}
            {!isSwap && (
              <div>
                <span className="text-sm text-white50 font-satoshi">To</span>
                <div className="flex items-center justify-between mt-1">
                  <code className="text-xs text-white70 font-mono bg-white5 px-2 py-1 rounded">
                    {shortenAddress(selectedTx.to_address, 8)}
                  </code>
                  <button
                    onClick={() => handleCopy(selectedTx.to_address, 'to')}
                    className="p-1.5 hover:bg-white10 rounded transition-all"
                  >
                    {copied === 'to' ? (
                      <Check size={14} className="text-green" />
                    ) : (
                      <Copy size={14} className="text-white50" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Description */}
            {selectedTx.description && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-white50 font-satoshi">Description</span>
                <span className="text-sm font-satoshi text-right max-w-[60%] truncate">
                  {selectedTx.description}
                </span>
              </div>
            )}

            {/* Transaction Hash */}
            {selectedTx.tx_hash && (
              <div>
                <span className="text-sm text-white50 font-satoshi">Transaction ID</span>
                <div className="flex items-center justify-between mt-1">
                  <code className="text-xs text-white70 font-mono bg-white5 px-2 py-1 rounded">
                    {shortenAddress(selectedTx.tx_hash, 10)}
                  </code>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCopy(selectedTx.tx_hash!, 'hash')}
                      className="p-1.5 hover:bg-white10 rounded transition-all"
                    >
                      {copied === 'hash' ? (
                        <Check size={14} className="text-green" />
                      ) : (
                        <Copy size={14} className="text-white50" />
                      )}
                    </button>
                    <a
                      href={`https://solscan.io/tx/${selectedTx.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 hover:bg-white10 rounded transition-all"
                    >
                      <ArrowSquareOut size={14} className="text-white50" />
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* View on Explorer Button */}
          {selectedTx.tx_hash && (
            <a
              href={`https://solscan.io/tx/${selectedTx.tx_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full mt-4 py-3 bg-white5 hover:bg-white10 border border-white10 rounded-xl text-sm font-medium font-satoshi transition-all"
            >
              <ArrowSquareOut size={16} />
              View on Solscan
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold font-archivo">Transaction History</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchTransactions}
            disabled={loading}
            className="p-2 hover:bg-white10 rounded-lg transition-all"
          >
            <ArrowsClockwise
              size={20}
              className={`text-white70 ${loading ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-all ${
              showFilters || filter !== 'all'
                ? 'bg-green10 text-green'
                : 'hover:bg-white10 text-white70'
            }`}
          >
            <Funnel size={20} />
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide pb-1">
          {(['all', 'send', 'receive', 'swap'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-sm capitalize transition-all font-satoshi whitespace-nowrap ${
                filter === f
                  ? 'bg-green text-black font-medium'
                  : 'bg-white10 text-white70 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="mb-4 p-3 bg-error/10 border border-error/30 rounded-lg">
          <p className="text-error text-sm font-satoshi">{error}</p>
          <button
            onClick={fetchTransactions}
            className="text-xs text-white50 mt-1 hover:text-white"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && allTransactions.length === 0 && (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-green border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-white50 text-sm font-satoshi">Loading transactions...</p>
        </div>
      )}

      {/* Transaction List */}
      {!loading && Object.keys(groupedTransactions).length > 0 ? (
        <div className="space-y-4">
          {Object.entries(groupedTransactions).map(([date, txs]) => (
            <div key={date}>
              <p className="text-sm text-white50 mb-2 font-satoshi">{date}</p>
              <div className="space-y-2">
                {txs.map((tx) => (
                  <button
                    key={tx.id}
                    onClick={() => {
                      setSelectedTx(tx);
                      setViewState('detail');
                    }}
                    className="w-full flex items-center gap-3 glass-card p-3 text-left hover:bg-white10 transition-all"
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        tx.type === 'send' || tx.type === 'withdraw'
                          ? 'bg-error/20'
                          : tx.type === 'swap'
                          ? 'bg-greenBlue/20'
                          : 'bg-green/20'
                      }`}
                    >
                      {getTypeIcon(tx.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium capitalize font-satoshi text-sm">
                        {tx.type === 'receive' ? 'Received' :
                         tx.type === 'send' ? 'Sent' :
                         tx.type === 'deposit' ? 'Deposited' :
                         tx.type === 'withdraw' ? 'Withdrawn' :
                         tx.type === 'swap' ? 'Swapped' : tx.type}
                      </p>
                      <p className="text-xs text-white50 truncate font-satoshi">
                        {tx.type === 'swap'
                          ? tx.description || `${tx.swapFromCurrency} → ${tx.swapToCurrency}`
                          : tx.type === 'send' || tx.type === 'withdraw'
                          ? `To: ${shortenAddress(tx.to_address)}`
                          : `From: ${shortenAddress(tx.from_address)}`}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {tx.type === 'swap' ? (
                        <>
                          <p className="font-medium font-archivo text-greenBlue text-sm">
                            +{tx.swapToAmount?.toFixed(tx.swapToCurrency === 'SOL' ? 4 : 2)} {tx.swapToCurrency}
                          </p>
                          <p className="text-xs text-white50 font-satoshi">
                            -{tx.swapFromAmount?.toFixed(tx.swapFromCurrency === 'SOL' ? 4 : 2)} {tx.swapFromCurrency}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className={`font-medium font-archivo text-sm ${getTypeColor(tx.type)}`}>
                            {tx.type === 'send' || tx.type === 'withdraw' ? '-' : '+'}
                            {tx.amount.toFixed(tx.currency === 'SOL' ? 4 : 2)} {tx.currency}
                          </p>
                          <p className="text-xs text-white50 font-satoshi">
                            {new Date(tx.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : !loading ? (
        <div className="text-center py-12 glass-card">
          <div className="w-16 h-16 rounded-full bg-white10 flex items-center justify-center mx-auto mb-4">
            <ArrowsDownUp size={28} className="text-white50" />
          </div>
          <p className="text-white70 mb-1 font-satoshi">No transactions yet</p>
          <p className="text-white50 text-sm font-satoshi">
            {filter !== 'all'
              ? `No ${filter} transactions found`
              : 'Your transaction history will appear here'}
          </p>
        </div>
      ) : null}
    </div>
  );
}
