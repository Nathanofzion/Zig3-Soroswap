import { fetchAllSoroswapPairs } from 'services/pairs';
import { findToken } from 'hooks/tokens/useToken';
import { getPairsFromFactory } from './getPairs';
import { getTotalLpShares } from './getTotalLpShares';
import { Networks } from '@stellar/stellar-sdk';
import { reservesBigNumber } from 'hooks/useReserves';
import { SorobanContextType } from '@soroban-react/core';
import { tokenBalance } from 'hooks';
import { TokenMapType, TokenType } from 'interfaces';
import BigNumber from 'bignumber.js';

export type LpTokensObj = {
  token_0: TokenType | undefined;
  token_1: TokenType | undefined;
  balance: BigNumber;
  lpPercentage: string;
  totalShares: string | BigNumber;
  status: string;
  reserve0: BigNumber | undefined;
  reserve1: BigNumber | undefined;
  myReserve0: BigNumber | undefined;
  myReserve1: BigNumber | undefined;
};

const getLpResultsFromBackendPairs = async (
  passphrase: string,
  sorobanContext: SorobanContextType,
  tokensAsMap: TokenMapType,
) => {
  if (!sorobanContext.address) return;

  const pairsBackend = await fetchAllSoroswapPairs(passphrase); // This one uses pairs from the backend

  const results: LpTokensObj[] = [];

  for (const element of pairsBackend) {
    const pairLpTokens = await tokenBalance(
      element.contractId,
      sorobanContext.address,
      sorobanContext,
    );

    if (pairLpTokens != 0) {
      const token_0 = await findToken(element.token0, tokensAsMap, sorobanContext);
      const token_1 = await findToken(element.token1, tokensAsMap, sorobanContext);

      const lpPercentage = BigNumber(pairLpTokens as BigNumber)
        .dividedBy(Number(element.totalShares))
        .multipliedBy(100)
        .decimalPlaces(7);

      if (!token_0 || !token_1) return;

      const myReserve0 = BigNumber(pairLpTokens as BigNumber)
        ?.multipliedBy(BigNumber(element.reserve0))
        .dividedBy(Number(element.totalShares));
      const myReserve1 = BigNumber(pairLpTokens as BigNumber)
        ?.multipliedBy(BigNumber(element.reserve1))
        .dividedBy(Number(element.totalShares));

      const toReturn = {
        token_0,
        token_1,
        balance: pairLpTokens,
        lpPercentage: lpPercentage.toString(),
        status: 'Active',
        reserve0: BigNumber(element.reserve0),
        reserve1: BigNumber(element.reserve1),
        totalShares: element.totalShares,
        myReserve0,
        myReserve1,
      };

      results.push(toReturn as LpTokensObj);
    }
  }

  return results;
};

const getLpResultsFromBlockchainPairs = async (
  sorobanContext: SorobanContextType,
  tokensAsMap: TokenMapType,
) => {
  if (!sorobanContext.address) return;

  const pairs = await getPairsFromFactory(sorobanContext); // This one uses pairs from factory

  const results: LpTokensObj[] = [];

  for (const element of pairs) {
    const pairLpTokens = await tokenBalance(
      element.pair_address,
      sorobanContext.address,
      sorobanContext,
    );

    if (pairLpTokens != 0) {
      const token_0 = await findToken(element.token_a_address, tokensAsMap, sorobanContext);
      const token_1 = await findToken(element.token_b_address, tokensAsMap, sorobanContext);
      const totalShares = await getTotalLpShares(element.pair_address, sorobanContext);
      const reservesResponse = await reservesBigNumber(element.pair_address, sorobanContext);

      const lpPercentage = BigNumber(pairLpTokens as BigNumber)
        .dividedBy(totalShares)
        .multipliedBy(100)
        .decimalPlaces(7);

      if (!token_0 || !token_1 || !reservesResponse) return;

      const myReserve0 = BigNumber(pairLpTokens as BigNumber)
        ?.multipliedBy(reservesResponse?.reserve0)
        .dividedBy(totalShares);
      const myReserve1 = BigNumber(pairLpTokens as BigNumber)
        ?.multipliedBy(reservesResponse?.reserve0)
        .dividedBy(totalShares);

      const toReturn = {
        token_0,
        token_1,
        balance: pairLpTokens,
        lpPercentage: lpPercentage.toString(),
        status: 'Active',
        reserve0: reservesResponse?.reserve0,
        reserve1: reservesResponse?.reserve1,
        totalShares: totalShares,
        myReserve0,
        myReserve1,
      };

      results.push(toReturn as LpTokensObj);
    }
  }

  return results;
};

export async function getLpTokens(sorobanContext: SorobanContextType, tokensAsMap: TokenMapType) {
  if (!sorobanContext.activeChain || !sorobanContext.address) return;
  const currentPassphrase = sorobanContext.activeChain.networkPassphrase;
  const isMainnet = currentPassphrase === Networks.PUBLIC;
  const isTestnet = currentPassphrase === Networks.TESTNET;

  if (isMainnet || isTestnet) {
    try {
      const results = await getLpResultsFromBackendPairs(
        currentPassphrase,
        sorobanContext,
        tokensAsMap,
      );
      return results;
    } catch (error) {
      return getLpResultsFromBlockchainPairs(sorobanContext, tokensAsMap);
    }
  } else {
    return getLpResultsFromBlockchainPairs(sorobanContext, tokensAsMap);
  }
}
