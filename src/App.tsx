/**
 * @DEV: If the sandbox is throwing dependency errors, chances are you need to clear your browser history.
 * This will trigger a re-install of the dependencies in the sandbox – which should fix things right up.
 * Alternatively, you can fork this sandbox to refresh the dependencies manually.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { PublicKey } from '@solana/web3.js';

import {
  detectPhantomMultiChainProvider,
  signMessageOnSolana,
} from './utils';

import { PhantomInjectedProvider, TLog } from './types';

import { Logs, NoProvider, Sidebar } from './components';
import { connect, silentlyConnect } from './utils/connect';
import { setupEvents } from './utils/setupEvents';
import { useEthereumSelectedAddress } from './utils/getEthereumSelectedAddress';
import { RangoClient, SwapResponse as RangoSwap } from 'rango-sdk-basic';
import { RANGO_API_KEY, SOLANA, SOLANA_SOL, SOLANA_USDC, SOL_DECIMALS, signAndSendTransaction, swapToString } from './rango';
import BigNumber from 'bignumber.js';

// =============================================================================
// Styled Components
// =============================================================================

const StyledApp = styled.div`
  display: flex;
  flex-direction: row;
  height: 100vh;
  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

// =============================================================================
// Typedefs
// =============================================================================

export type ConnectedAccounts = {
  solana: PublicKey | null;
  ethereum: string | null;
};

export type ConnectedMethods =
  | {
      chain: string;
      name: string;
      onClick: (props?: any) => Promise<string>;
    }
  | {
      chain: string;
      name: string;
      onClick: (chainId?: any) => Promise<void | boolean>;
    };

interface Props {
  connectedAccounts: ConnectedAccounts;
  connectedMethods: ConnectedMethods[];
  handleConnect: () => Promise<void>;
  logs: TLog[];
  clearLogs: () => void;
}

// =============================================================================
// Hooks
// =============================================================================
/**
 * @DEVELOPERS
 * The fun stuff!
 */
const useProps = (provider: PhantomInjectedProvider | null, rango: RangoClient): Props => {
  /** Logs to display in the Sandbox console */
  const [logs, setLogs] = useState<TLog[]>([]);
  const [rangoSwap, setRangoSwap] = useState<RangoSwap | null>(null);

  const createLog = useCallback(
    (log: TLog) => {
      return setLogs((logs) => [...logs, log]);
    },
    [setLogs]
  );

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, [setLogs]);

  const [ethereumSelectedAddress, setEthereumSelectedAddress] = useEthereumSelectedAddress(provider?.ethereum);

  /** Side effects to run once providers are detected */
  useEffect(() => {
    if (!provider) return;
    const { solana, ethereum } = provider;

    // attempt to eagerly connect on initial startup
    silentlyConnect({ solana, ethereum }, createLog);
    setupEvents({ solana, ethereum }, createLog, setEthereumSelectedAddress);

    return () => {
      solana.disconnect();
    };
  }, [provider, createLog, setEthereumSelectedAddress]);

  /** Connect to both Solana and Ethereum Providers */
  const handleConnect = useCallback(async () => {
    if (!provider) return;
    const { solana, ethereum } = provider;

    await connect({ solana, ethereum }, createLog);

    // Immediately switch to Ethereum Goerli for Sandbox purposes
    // await ensureEthereumChain(ethereum, SupportedEVMChainIds.EthereumGoerli, createLog);
  }, [provider, createLog]);

  // /** SignMessage via Solana Provider */
  const handleSignMessageOnSolana = useCallback(async () => {
    if (!provider) return;
    const { solana } = provider;
    try {
      const message = 'To avoid digital dognappers, sign below to authenticate with CryptoCorgis.';
      const signedMessage = await signMessageOnSolana(solana, message);
      createLog({
        providerType: 'solana',
        status: 'success',
        method: 'signMessage',
        message: `Message signed: ${JSON.stringify(signedMessage)}`,
      });
      return signedMessage;
    } catch (error) {
      createLog({
        providerType: 'solana',
        status: 'error',
        method: 'signMessage',
        message: error.message,
      });
    }
  }, [provider, createLog]);

  const handleGetRangoQuote = useCallback(async () => {
    if (!provider?.solana) return;
    const { solana } = provider;
    createLog({
      providerType: 'rango',
      status: 'info',
      method: 'swap',
      message: `Requesting Rango Swap API for a sample Solana route ${solana.publicKey}`,
    })
    const wallet = solana.publicKey.toString()
    const input_amount = "0.0001"
    const machine_amount = new BigNumber(input_amount).shiftedBy(SOL_DECIMALS).toString()
    const swap = await rango.swap({
      from: SOLANA_SOL,
      to: SOLANA_USDC,
      amount: machine_amount,
      slippage: "3",
      fromAddress: wallet,
      toAddress: wallet,
      disableEstimate: true,
    })
    const message = `Route Status: ${swap.resultType}, TX: ${swap.tx ? "OK": "-"}`
    const detail = swapToString(swap, input_amount)
    setRangoSwap(swap);
    createLog({
      providerType: 'rango',
      status: swap.resultType === "OK" ? 'success' : 'error',
      method: 'swap',
      message: message,
      messageTwo: detail,
    })
  }, [createLog, provider, rango, setRangoSwap]);

  const handleSignAndSendRangoSolanaTransaction = useCallback(async () => {
    if (!provider?.solana) return;
    if (!rangoSwap?.tx) {
      createLog({
        providerType: 'rango',
        status: 'error',
        method: 'signAndSendTransaction',
        message: `Please get a "Sample Solana Swap" first`,
      })
      return
    }
    const { solana } = provider;
    createLog({
      providerType: 'rango',
      status: 'info',
      method: 'signAndSendTransaction',
      message: `Trying to sign and send recent transaction`,
    })
    try {
      if (rangoSwap.tx.type !== SOLANA)
        throw Error("Unexpected tx type.")
      const signature = await signAndSendTransaction(rangoSwap.tx, solana)
      createLog({
        providerType: 'solana',
        status: 'success',
        method: 'signAndSendTransaction',
        message: `Signed and submitted transaction ${signature}.`,
      });
    } catch (error) {
      createLog({
        providerType: 'solana',
        status: 'error',
        method: 'signAndSendTransaction',
        message: error.message,
      });
    }
  }, [createLog, provider, rangoSwap]);


  /**
   * Disconnect from Solana
   * At this time, there is no way to programmatically disconnect from Ethereum
   * MULTI-CHAIN PROVIDER TIP: You can only disconnect on the solana provider. But after when disconnecting your should use the
   * multi-chain connect method to reconnect.
   */
  const handleDisconnect = useCallback(async () => {
    if (!provider) return;
    const { solana } = provider;
    try {
      await solana.disconnect();
    } catch (error) {
      createLog({
        providerType: 'solana',
        status: 'error',
        method: 'disconnect',
        message: error.message,
      });
    }
  }, [provider, createLog]);

  const connectedMethods = useMemo(() => {
    return [
      {
        chain: 'solana',
        name: 'Sign Message',
        onClick: handleSignMessageOnSolana,
      },
      {
        chain: 'solana',
        name: 'Sample Solana Swap (Rango)',
        onClick: handleGetRangoQuote,
      },
      {
        chain: 'solana',
        name: 'Sign and Send Solana Transaction (Rango)',
        onClick: handleSignAndSendRangoSolanaTransaction,
      },
      {
        chain: 'solana',
        name: 'Disconnect',
        onClick: handleDisconnect,
      },
    ];
  }, [
    handleSignMessageOnSolana,
    handleGetRangoQuote,
    handleSignAndSendRangoSolanaTransaction,
    handleDisconnect,
  ]);

  return {
    connectedAccounts: {
      solana: provider?.solana?.publicKey,
      ethereum: ethereumSelectedAddress,
    },
    connectedMethods,
    handleConnect,
    logs,
    clearLogs,
  };
};

// =============================================================================
// Stateless Component
// =============================================================================

const StatelessApp = React.memo((props: Props) => {
  const { connectedAccounts, connectedMethods, handleConnect, logs, clearLogs } = props;

  return (
    <StyledApp>
      <Sidebar connectedAccounts={connectedAccounts} connectedMethods={connectedMethods} connect={handleConnect} />
      <Logs connectedAccounts={connectedAccounts} logs={logs} clearLogs={clearLogs} />
    </StyledApp>
  );
});

// =============================================================================
// Main Component
// =============================================================================

const App = () => {
  const [provider, setProvider] = useState<PhantomInjectedProvider | null>(null);
  const rango = new RangoClient(RANGO_API_KEY)
  const props = useProps(provider, rango);

  useEffect(() => {
    const getPhantomMultiChainProvider = async () => {
      const phantomMultiChainProvider = await detectPhantomMultiChainProvider();
      setProvider(phantomMultiChainProvider);
    };
    getPhantomMultiChainProvider();
  }, []);

  if (!provider) {
    return <NoProvider />;
  }

  return <StatelessApp {...props} />;
};

export default App;
