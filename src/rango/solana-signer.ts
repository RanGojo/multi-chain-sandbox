import { Commitment, Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { PhantomSolanaProvider } from "../types";
import { FREE_SOLANA_RPC } from "./constants";
import { SolanaTransaction } from "rango-sdk-basic";

function getSolanaConnection(): Connection {
  const connectionConfig = {
      commitment: 'confirmed' as Commitment,
      disableRetryOnRateLimit: false,
  };
  return new Connection(FREE_SOLANA_RPC, connectionConfig);
}

export async function signAndSendTransaction(tx: SolanaTransaction, solana: PhantomSolanaProvider): Promise<string> {
    const connection = getSolanaConnection();
    let versionedTransaction: VersionedTransaction | undefined = undefined;
    let transaction: Transaction | undefined = undefined;
    if (tx.serializedMessage != null) {
      if (tx.txType === 'VERSIONED') {
        versionedTransaction = VersionedTransaction.deserialize(new Uint8Array(tx.serializedMessage));
        const blockhash = (await connection.getLatestBlockhash('confirmed')).blockhash;
        if (!!blockhash) versionedTransaction.message.recentBlockhash = blockhash;
      } else if (tx.txType === 'LEGACY') {
        transaction = Transaction.from(Buffer.from(new Uint8Array(tx.serializedMessage)));
        transaction.feePayer = new PublicKey(tx.from);
        transaction.recentBlockhash = undefined;
      }
    }
    const finalTx: Transaction | VersionedTransaction = transaction || versionedTransaction;
    if (!finalTx) {
        throw new Error('error creating transaction');
    }
    console.log({finalTx})
    const raw = await solana.signTransaction(finalTx);
    const signature = await connection.sendRawTransaction(raw.serialize())
    if (!signature)
        throw new Error('tx cant send to blockchain. signature=' + signature);
    const confirmed = await connection.confirmTransaction(signature);
    if (!confirmed)
      throw new Error('tx cant confirm on blockchain. signature=' + signature);
    return signature;
}
