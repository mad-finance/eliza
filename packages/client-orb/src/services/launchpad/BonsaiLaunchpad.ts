export default [
    {
        type: "constructor",
        inputs: [
            {
                name: "_owner",
                type: "address",
                internalType: "address",
            },
            {
                name: "_quoteToken",
                type: "address",
                internalType: "address",
            },
            {
                name: "_poolManager",
                type: "address",
                internalType: "address",
            },
            {
                name: "_posm",
                type: "address",
                internalType: "address",
            },
            {
                name: "_defaultHook",
                type: "address",
                internalType: "address",
            },
            {
                name: "_bonsaiNFT",
                type: "address",
                internalType: "address",
            },
            {
                name: "_bonsaiToken",
                type: "address",
                internalType: "address",
            },
            {
                name: "_agentCreator",
                type: "address",
                internalType: "address",
            },
            {
                name: "_v3factory",
                type: "address",
                internalType: "address",
            },
            {
                name: "_v3positionManager",
                type: "address",
                internalType: "address",
            },
        ],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "balances",
        inputs: [
            {
                name: "clubId",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "account",
                type: "address",
                internalType: "address",
            },
        ],
        outputs: [
            {
                name: "amount",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "buyChips",
        inputs: [
            {
                name: "clubId",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "amount",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "clientAddress",
                type: "address",
                internalType: "address",
            },
            {
                name: "recipient",
                type: "address",
                internalType: "address",
            },
            {
                name: "referral",
                type: "address",
                internalType: "address",
            },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "calculatePurchaseAllocation",
        inputs: [
            {
                name: "price",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "clubId",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        outputs: [
            {
                name: "maxAllowed",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "excess",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "claimTokens",
        inputs: [
            {
                name: "clubId",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "recipient",
                type: "address",
                internalType: "address",
            },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "clubIdCount",
        inputs: [],
        outputs: [
            {
                name: "",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "clubToToken",
        inputs: [
            {
                name: "",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        outputs: [
            {
                name: "",
                type: "address",
                internalType: "address",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "collectUniswapFees",
        inputs: [
            {
                name: "tokenId",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "token0",
                type: "address",
                internalType: "address",
            },
            {
                name: "token1",
                type: "address",
                internalType: "address",
            },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "feesEarned",
        inputs: [
            {
                name: "account",
                type: "address",
                internalType: "address",
            },
        ],
        outputs: [
            {
                name: "amount",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "getBuyPrice",
        inputs: [
            {
                name: "clubId",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "amount",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        outputs: [
            {
                name: "",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "getFees",
        inputs: [],
        outputs: [
            {
                name: "",
                type: "uint16",
                internalType: "uint16",
            },
            {
                name: "",
                type: "uint16",
                internalType: "uint16",
            },
            {
                name: "",
                type: "uint16",
                internalType: "uint16",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "getMcap",
        inputs: [
            {
                name: "supply",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "curve",
                type: "uint8",
                internalType: "enum CURVE_TYPE",
            },
        ],
        outputs: [
            {
                name: "",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "getRegistrationFee",
        inputs: [
            {
                name: "amount",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "curve",
                type: "uint8",
                internalType: "enum CURVE_TYPE",
            },
        ],
        outputs: [
            {
                name: "fee",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "getSellPrice",
        inputs: [
            {
                name: "clubId",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "amount",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        outputs: [
            {
                name: "",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "getSellPriceAfterFees",
        inputs: [
            {
                name: "clubId",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "amount",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        outputs: [
            {
                name: "",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "getTokensForSpend",
        inputs: [
            {
                name: "clubId",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "spendAmount",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        outputs: [
            {
                name: "tokenAmount",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "owner",
        inputs: [],
        outputs: [
            {
                name: "",
                type: "address",
                internalType: "address",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "registerClub",
        inputs: [
            {
                name: "hook",
                type: "address",
                internalType: "address",
            },
            {
                name: "token",
                type: "bytes",
                internalType: "bytes",
            },
            {
                name: "initialSupply",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "curve",
                type: "uint8",
                internalType: "enum CURVE_TYPE",
            },
            {
                name: "creator",
                type: "address",
                internalType: "address",
            },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "registeredClubs",
        inputs: [
            {
                name: "clubId",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        outputs: [
            {
                name: "creator",
                type: "address",
                internalType: "address",
            },
            {
                name: "hook",
                type: "address",
                internalType: "address",
            },
            {
                name: "supply",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "createdAt",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "liquidity",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "curve",
                type: "uint8",
                internalType: "enum CURVE_TYPE",
            },
            {
                name: "token",
                type: "bytes",
                internalType: "bytes",
            },
            {
                name: "complete",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "releaseLiquidity",
        inputs: [
            {
                name: "clubId",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "minAmountOut",
                type: "uint128",
                internalType: "uint128",
            },
            {
                name: "swapInfoV4",
                type: "tuple",
                internalType: "struct SwapInfoV4",
                components: [
                    {
                        name: "path",
                        type: "tuple[]",
                        internalType: "struct PathKey[]",
                        components: [
                            {
                                name: "intermediateCurrency",
                                type: "address",
                                internalType: "Currency",
                            },
                            {
                                name: "fee",
                                type: "uint24",
                                internalType: "uint24",
                            },
                            {
                                name: "tickSpacing",
                                type: "int24",
                                internalType: "int24",
                            },
                            {
                                name: "hooks",
                                type: "address",
                                internalType: "contract IHooks",
                            },
                            {
                                name: "hookData",
                                type: "bytes",
                                internalType: "bytes",
                            },
                        ],
                    },
                    {
                        name: "router",
                        type: "address",
                        internalType: "contract IUniversalRouter",
                    },
                ],
            },
            {
                name: "swapInfoV3",
                type: "tuple",
                internalType: "struct SwapInfoV3",
                components: [
                    {
                        name: "path",
                        type: "bytes",
                        internalType: "bytes",
                    },
                    {
                        name: "router",
                        type: "address",
                        internalType: "address",
                    },
                ],
            },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "renounceOwnership",
        inputs: [],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "reservedTokens",
        inputs: [
            {
                name: "",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        outputs: [
            {
                name: "",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "sellChips",
        inputs: [
            {
                name: "clubId",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "amount",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "clientAddress",
                type: "address",
                internalType: "address",
            },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "setAgentCreator",
        inputs: [
            {
                name: "_agentCreator",
                type: "address",
                internalType: "address",
            },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "setClaimWindow",
        inputs: [
            {
                name: "_claimWindow",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "setClubCurve",
        inputs: [
            {
                name: "clubId",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "curve",
                type: "uint8",
                internalType: "enum CURVE_TYPE",
            },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "setDefaultHook",
        inputs: [
            {
                name: "_defaultHook",
                type: "address",
                internalType: "address",
            },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "setFees",
        inputs: [
            {
                name: "_protocolFeeBps",
                type: "uint16",
                internalType: "uint16",
            },
            {
                name: "_creatorFeeBps",
                type: "uint16",
                internalType: "uint16",
            },
            {
                name: "_clientFeeBps",
                type: "uint16",
                internalType: "uint16",
            },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "setMinLiquidityThreshold",
        inputs: [
            {
                name: "_minLiquidityThreshold",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "setQuoteTokenPercent",
        inputs: [
            {
                name: "_quoteTokenPercentForPool",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "_quoteTokenPercentForAgent",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "setRampUpParameters",
        inputs: [
            {
                name: "_rampUpPeriod",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "_maxInitialPurchasePercent",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "setRegisteredClubHookData",
        inputs: [
            {
                name: "clubId",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "data",
                type: "bytes",
                internalType: "bytes",
            },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "setRegistrationCost",
        inputs: [
            {
                name: "_registrationCost",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "setUniV4",
        inputs: [
            {
                name: "_univ4",
                type: "bool",
                internalType: "bool",
            },
            {
                name: "_poolManager",
                type: "address",
                internalType: "address",
            },
            {
                name: "_posm",
                type: "address",
                internalType: "address",
            },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "setWhitelistedHook",
        inputs: [
            {
                name: "_hook",
                type: "address",
                internalType: "address",
            },
            {
                name: "_whitelisted",
                type: "bool",
                internalType: "bool",
            },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "transferOwnership",
        inputs: [
            {
                name: "newOwner",
                type: "address",
                internalType: "address",
            },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "whitelistedHooks",
        inputs: [
            {
                name: "",
                type: "address",
                internalType: "address",
            },
        ],
        outputs: [
            {
                name: "",
                type: "bool",
                internalType: "bool",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "withdrawFeesEarned",
        inputs: [
            {
                name: "recipient",
                type: "address",
                internalType: "address",
            },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "event",
        name: "Complete",
        inputs: [
            {
                name: "clubId",
                type: "uint256",
                indexed: true,
                internalType: "uint256",
            },
        ],
        anonymous: false,
    },
    {
        type: "event",
        name: "FeesSet",
        inputs: [
            {
                name: "protocolFee",
                type: "uint16",
                indexed: false,
                internalType: "uint16",
            },
            {
                name: "creatorFee",
                type: "uint16",
                indexed: false,
                internalType: "uint16",
            },
            {
                name: "clientFee",
                type: "uint16",
                indexed: false,
                internalType: "uint16",
            },
        ],
        anonymous: false,
    },
    {
        type: "event",
        name: "LiqThresholdSet",
        inputs: [
            {
                name: "liquidityThreshold",
                type: "uint256",
                indexed: false,
                internalType: "uint256",
            },
        ],
        anonymous: false,
    },
    {
        type: "event",
        name: "LiquidityReleased",
        inputs: [
            {
                name: "clubId",
                type: "uint256",
                indexed: true,
                internalType: "uint256",
            },
            {
                name: "token",
                type: "address",
                indexed: true,
                internalType: "address",
            },
            {
                name: "hook",
                type: "address",
                indexed: false,
                internalType: "address",
            },
            {
                name: "agentCreatorAmount",
                type: "uint256",
                indexed: false,
                internalType: "uint256",
            },
        ],
        anonymous: false,
    },
    {
        type: "event",
        name: "OwnershipTransferred",
        inputs: [
            {
                name: "previousOwner",
                type: "address",
                indexed: true,
                internalType: "address",
            },
            {
                name: "newOwner",
                type: "address",
                indexed: true,
                internalType: "address",
            },
        ],
        anonymous: false,
    },
    {
        type: "event",
        name: "RampUpParametersSet",
        inputs: [
            {
                name: "rampUpPeriod",
                type: "uint256",
                indexed: false,
                internalType: "uint256",
            },
            {
                name: "maxInitialPurchasePercent",
                type: "uint256",
                indexed: false,
                internalType: "uint256",
            },
        ],
        anonymous: false,
    },
    {
        type: "event",
        name: "RegisteredClub",
        inputs: [
            {
                name: "clubId",
                type: "uint256",
                indexed: true,
                internalType: "uint256",
            },
            {
                name: "creator",
                type: "address",
                indexed: true,
                internalType: "address",
            },
            {
                name: "initialSupply",
                type: "uint256",
                indexed: false,
                internalType: "uint256",
            },
        ],
        anonymous: false,
    },
    {
        type: "event",
        name: "TokensClaimed",
        inputs: [
            {
                name: "clubId",
                type: "uint256",
                indexed: true,
                internalType: "uint256",
            },
            {
                name: "user",
                type: "address",
                indexed: true,
                internalType: "address",
            },
            {
                name: "amount",
                type: "uint256",
                indexed: false,
                internalType: "uint256",
            },
        ],
        anonymous: false,
    },
    {
        type: "event",
        name: "Trade",
        inputs: [
            {
                name: "clubId",
                type: "uint256",
                indexed: false,
                internalType: "uint256",
            },
            {
                name: "amount",
                type: "uint256",
                indexed: false,
                internalType: "uint256",
            },
            {
                name: "isBuy",
                type: "bool",
                indexed: false,
                internalType: "bool",
            },
            {
                name: "actor",
                type: "address",
                indexed: false,
                internalType: "address",
            },
            {
                name: "price",
                type: "uint256",
                indexed: false,
                internalType: "uint256",
            },
            {
                name: "priceAfterProtocolFee",
                type: "uint256",
                indexed: false,
                internalType: "uint256",
            },
            {
                name: "complete",
                type: "bool",
                indexed: false,
                internalType: "bool",
            },
            {
                name: "creatorFee",
                type: "uint256",
                indexed: false,
                internalType: "uint256",
            },
        ],
        anonymous: false,
    },
    {
        type: "event",
        name: "UniswapFeesCollected",
        inputs: [
            {
                name: "tokenId",
                type: "uint256",
                indexed: false,
                internalType: "uint256",
            },
            {
                name: "token0",
                type: "address",
                indexed: false,
                internalType: "address",
            },
            {
                name: "token1",
                type: "address",
                indexed: false,
                internalType: "address",
            },
        ],
        anonymous: false,
    },
    {
        type: "error",
        name: "CannotSellLastChip",
        inputs: [],
    },
    {
        type: "error",
        name: "InitialTooLarge",
        inputs: [],
    },
    {
        type: "error",
        name: "InsufficientBalance",
        inputs: [],
    },
    {
        type: "error",
        name: "InsufficientLiquidity",
        inputs: [],
    },
    {
        type: "error",
        name: "InsufficientPayment",
        inputs: [],
    },
    {
        type: "error",
        name: "InvalidHook",
        inputs: [],
    },
    {
        type: "error",
        name: "InvalidInput",
        inputs: [],
    },
    {
        type: "error",
        name: "NotAllowed",
        inputs: [],
    },
    {
        type: "error",
        name: "NotRegistered",
        inputs: [],
    },
    {
        type: "error",
        name: "OwnableInvalidOwner",
        inputs: [
            {
                name: "owner",
                type: "address",
                internalType: "address",
            },
        ],
    },
    {
        type: "error",
        name: "OwnableUnauthorizedAccount",
        inputs: [
            {
                name: "account",
                type: "address",
                internalType: "address",
            },
        ],
    },
    {
        type: "error",
        name: "SafeERC20FailedOperation",
        inputs: [
            {
                name: "token",
                type: "address",
                internalType: "address",
            },
        ],
    },
];