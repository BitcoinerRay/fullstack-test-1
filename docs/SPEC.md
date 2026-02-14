# MEME Launch & Trading Platform - 模块化开发规范

## 项目概述

基于 BNB Smart Chain 的 MEME 代币发射和交易平台，核心机制采用 Bonding Curve，参考 flap.sh/pump.fun 模式。

---

## 一、技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React + Vite)              │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│   │  Create  │  │   Swap   │  │  Charts  │  │  Stats   │  │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │    Backend API    │
                    │    (NestJS)       │
                    └─────────┬─────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼───────┐   ┌─────────▼─────────┐  ┌────────▼────────┐
│  PostgreSQL   │   │  Redis Cache     │  │  BNB Chain     │
│  (Prisma)    │   │  (Price/Stats)   │  │  (viem/ethers)│
└───────────────┘   └───────────────────┘  └─────────────────┘
```

---

## 二、技术栈清单

| 层级       | 技术选型            | 版本要求            |
| ---------- | ------------------- | ------------------- |
| 区块链     | BNB Smart Chain     | Testnet (Sepolia)   |
| 智能合约   | Solidity            | ^0.8.20             |
| 合约框架   | Hardhat             | ^2.19.0             |
| 后端框架   | NestJS              | ^11.0               |
| 数据库     | PostgreSQL + Prisma | PG 15+ / Prisma 6.x |
| 缓存       | Redis               | 7.x                 |
| 前端框架   | React               | ^19.0               |
| 构建工具   | Vite                | ^6.0                |
| 区块链交互 | viem                | ^2.0                |
| 钱包连接   | wagmi               | ^2.0                |
| 图表       | Recharts            | ^2.0                |
| 状态管理   | Zustand             | ^5.0                |

---

## 三、模块边界与接口定义

### 模块 A: 智能合约 (contracts)

**位置**: `packages/contracts/`

**依赖**: 无 (独立模块)

**输出**:

- 编译后的 ABI 文件 (供其他模块使用)
- 合约地址配置 (JSON)

#### A1: 代币工厂合约 (TokenFactory)

```
职责: 部署新代币和对应 Bonding Curve

接口:
function createToken(
    string name,
    string symbol,
    uint8 decimals,
    bool isTaxToken,
    uint256 taxRate,
    address taxRecipient,
    string description,
    string imageUrl
) external returns (address token, address curve)

function getAllTokens() external view returns (address[])
function getTokenCount() external view returns (uint256)
```

#### A2: Bonding Curve 合约

```
职责: 自动化做市，支持即时买卖

核心算法: 常数乘积 x * y = k (类似 Uniswap V2)

接口:
function buy(address token) external payable
function sell(address token, uint256 amount) external returns (uint256)
function getCurrentPrice(address token) external view returns (uint256)
function getVirtualReserves(address token) external view returns (uint256 virtualToken, uint256 virtualQuote)
function calculateBuyReturn(address token, uint256 amount) external view returns (uint256)
function calculateSellReturn(address token, uint256 amount) external view returns (uint256)
```

**价格计算公式**:

```
// 买入价格 (积分计算)
price = k * (1 / (supply - amount) - 1 / supply)

// 卖出价格
price = k * (1 / (supply + amount) - 1 / supply)
```

#### A3: MEME 代币模板 (MemeToken)

```
职责: 可配置的 MEME 代币，支持征税

接口:
function mint(address to, uint256 amount) external
function burn(uint256 amount) external
function setTax(uint256 rate, address recipient) external
function transferWithTax(address from, address to, uint256 amount) external returns (uint256 tax, uint256 transferAmount)

事件:
event Transfer(address indexed from, address indexed to, uint256 value)
event TaxUpdated(uint256 rate, address recipient)
```

#### A4: 毕业机制 (Graduation)

```
职责: 将流动性从 Bonding Curve 转移到 DEX

触发条件 (满足任一):
- 池子规模达到阈值 (如 50 BNB)
- 手动触发

接口:
function graduate(address token) external
function getGraduationStatus(address token) external view returns (bool isGraduated, address dexPair, uint256 lpLockedUntil)
```

#### A5: 部署脚本

```
输出:
- BSC Testnet: 部署配置 + 验证脚本
- 主网: 部署配置 (预留)

部署命令:
npx hardhat run scripts/deploy.ts --network bscTestnet
```

---

### 模块 B: 后端 API (backend)

**位置**: `apps/nestjs-backend/`

**依赖**:

- 模块 A (合约 ABI)
- PostgreSQL (Prisma)
- Redis

**输出**: REST API + WebSocket

#### B1: 项目初始化与基础配置

```
内容:
- 安装: viem, @nestjs/websockets, @nestjs/platform-socket.io
- 配置: RPC_URL, CONTRACT_ADDRESSES, BLOCK_CONFIRMATIONS
- 创建: Prisma schema 迁移

验收: npm run build 成功，数据库连接正常
```

#### B2: 合约交互服务

```
文件: src/contracts/contracts.service.ts

接口:
- createToken(params: CreateTokenDto): Promise<{tokenAddress, curveAddress, txHash}>
- getTokenInfo(address: string): Promise<TokenInfo>
- getPrice(address: string): Promise<PriceInfo>
- buy(address: string, amount: string, walletAddress: string): Promise<tx>
- sell(address: string, amount: string, walletAddress: string): Promise<tx>
- getBalance(address: string, token: string): Promise<string>
- getHolderCount(address: string): Promise<number>
- getTradeVolume24h(address: string): Promise<string>

验收: 单元测试覆盖 > 80%
```

#### B3: 代币管理 API

```
路由:
POST   /api/v1/tokens              - 创建代币
GET    /api/v1/tokens              - 列表查询
GET    /api/v1/tokens/:address     - 详情
GET    /api/v1/tokens/:address/price - 价格
POST   /api/v1/tokens/:address/graduate - 毕业

查询参数:
- page: 页码 (默认 1)
- limit: 每页数量 (默认 20, 最大 100)
- sort: 排序字段 (createdAt, marketCap, tradeVolume, priceChange)
- order: 排序方向 (asc, desc)
- search: 搜索 (name, symbol)
- isTaxToken: 是否征税 (true/false)
- isGraduated: 是否已毕业 (true/false)

响应格式 (符合 fullstack-contracts.mdc):
{
  data: Token[],
  pagination: { page, limit, total, totalPages }
}
```

#### B4: 交易历史 API

```
路由: GET /api/v1/tokens/:address/trades

参数:
- type: buy | sell
- from: 开始时间 (ISO 8601)
- to: 结束时间 (ISO 8601)
- page, limit

响应:
{
  data: Trade[],
  pagination: { page, limit, total, totalPages }
}
```

#### B5: 市场统计 API

```
路由:
GET /api/v1/stats/global      - 全局统计
GET /api/v1/stats/leaderboard - 排行榜 (Top 50)
GET /api/v1/stats/recent     - 最近创建的代币

响应:
{
  totalTokens: number,
  totalVolume24h: string,
  totalTrades: number,
  totalMarketCap: string,
  priceChange24h: number
}
```

#### B6: WebSocket 实时价格

```
端点: /ws/prices

协议: Socket.IO

消息格式:
{
  type: 'price_update',
  data: {
    address: string,
    price: string,
    priceChange24h: number,
    timestamp: number
  }
}

订阅:
- 客户端: socket.emit('subscribe', { addresses: ['0x...'] })
- 服务端: socket.on('price_update', callback)
```

#### B7: 事件监听服务

```
功能:
- 监听 BondingCurve.Buy 事件 → 写入 Trade 表 + 更新 Holder
- 监听 BondingCurve.Sell 事件 → 写入 Trade 表 + 更新 Holder
- 监听 Token.Transfer 事件 → 更新 Holder 表
- 轮询最新区块 → 补漏丢失事件

配置:
- 轮询间隔: 5 秒
- 区块确认: 2 个区块
- 重试策略: 指数退避 (最多 5 次)

验收: 事件解析正确，错误重试机制完善
```

#### B8: 价格缓存服务

```
策略:
┌─────────────┬────────────┬──────────┐
│ 代币类型    │ 缓存 TTL   │ 更新频率  │
├─────────────┼────────────┼──────────┤
│ 热门代币    │ 5 秒       │ 5 秒     │
│ 普通代币    │ 30 秒      │ 30 秒    │
│ 冷门代币    │ 60 秒      │ 60 秒    │
└─────────────┴────────────┴──────────┘

热门代币定义: 24h 交易量 > 10 BNB

验收: 减少合约调用 90%+，缓存命中率 > 95%
```

---

### 模块 C: 前端 (frontend)

**位置**: `apps/vite-frontend/`

**依赖**:

- 模块 B (API)
- wagmi + viem
- 模块 A (ABI)

**输出**: 用户界面

#### C1: 项目初始化

```
安装依赖:
npm install wagmi viem @tanstack/react-query recharts zustand

配置:
- Networks: BSC Testnet (97), BSC Mainnet (56)
- 合约地址: 从环境变量读取
- WalletConnect: 项目 ID (可选)
```

#### C2: 钱包连接组件

```
功能:
- MetaMask 连接 (必需)
- WalletConnect (可选)
- 余额实时显示
- 网络切换提示

文件: src/components/wallet/WalletButton.tsx

状态:
- disconnected: 未连接
- connecting: 连接中
- connected: 已连接 (显示地址 + 余额)
- error: 连接失败
```

#### C3: 创建代币页面

```
路由: /create

表单字段:
┌─────────────┬──────────┬──────────┬────────────┐
│ 字段         │ 类型      │ 必填      │ 验证规则    │
├─────────────┼──────────┼──────────┼────────────┤
│ name        │ string   │ 是        │ 3-30 字符  │
│ symbol      │ string   │ 是        │ 3-10 字符  │
│ description │ string   │ 否        │ max 500    │
│ imageUrl    │ string   │ 否        │ URL        │
│ tokenType   │ enum     │ 是        │ tax/no-tax │
│ taxRate     │ number   │ 条件      │ 1/3/5/10   │
│ taxRecipient│ address  │ 条件      │ 有效地址   │
│ twitter     │ string   │ 否        │ URL        │
│ telegram    │ string   │ 否        │ URL        │
│ website     │ string   │ 否        │ URL        │
└─────────────┴──────────┴──────────┴────────────┘

流程:
1. 验证表单 → 2. 签名创建交易 → 3. 等待确认 → 4. 跳转详情页

验收: 完整表单验证，钱包未连接提示，创建进度反馈
```

#### C4: 代币列表页面

```
路由: /

布局: 卡片网格 (responsive grid)

展示字段:
- 代币图片
- 名称 + 符号
- 当前价格
- 24h 涨跌 (颜色区分: 绿涨/红跌)
- 市值
- 24h 交易量
- 创建时间

筛选器:
- 排序: 最新创建 / 热门 / 涨幅榜 / 成交量
- 搜索: 名称 / 符号
- 状态: 全部 / 已毕业 / 未毕业

分页: 无限滚动 (Intersection Observer)

验收: 首屏加载 < 1s，滚动流畅
```

#### C5: 代币详情页面

```
路由: /token/:address

布局:
┌─────────────────────────────────────────────────┐
│  Header: 代币名称 + 价格 + 24h 涨跌 + 操作按钮   │
├─────────────────────────────────────────────────┤
│  Price Chart (TradingView 风格)                │
├───────────────────────┬─────────────────────────┤
│  Swap Panel           │  Info Panel            │
│  ┌─────────────────┐  │  • 代币信息            │
│  │ [Buy] [Sell]    │  │  • 持币者 (Top 10)    │
│  │ Amount: [____]  │  │  • 交易历史            │
│  │ Price: $0.001   │  │  • 社区链接           │
│  │ [Swap Button]   │  │                        │
│  └─────────────────┘  │                        │
└───────────────────────┴─────────────────────────┘

Swap Panel 交互:
- 买入/卖出 切换
- 数量输入 (支持 max 按钮)
- 滑点设置 (默认 1%, 可调)
- Gas 预估
- 价格 impact 提示
- 交易签名 + 广播 + 确认

验收: 数据展示完整，交易流程顺畅
```

#### C6: Swap 交易组件

```
组件: src/components/swap/SwapWidget.tsx

状态机:
idle → loading (签名) → pending (广播) → success → idle
                                    ↓ error

错误处理:
- 滑点不足: "Price impact too high"
- 余额不足: "Insufficient balance"
- 交易失败: "Transaction failed"
- 超时: "Transaction pending..."

验收: 所有状态正确展示，错误信息清晰
```

#### C7: 价格图表组件

```
组件: src/components/chart/PriceChart.tsx

依赖: Recharts

功能:
- 折线图 (价格走势)
- 区域图 (可选)
- 时间范围: 1H, 4H, 24H, 7D, ALL
- 悬停显示: 时间 + 价格 + 涨跌
- 自动刷新 (每 10 秒)

数据源:
- 后端: GET /api/v1/tokens/:address/chart
- WebSocket: 实时价格更新
```

#### C8: 全局状态管理

```
Store: Zustand

文件结构:
src/store/
├── wallet.store.ts    # 连接状态 + 余额
├── tokens.store.ts    # 代币列表缓存
├── ui.store.ts       # 主题 + 语言 + 模态框
└── index.ts          # 导出

状态持久化:
- wallet: sessionStorage
- tokens: React Query (缓存)
- ui: localStorage
```

---

### 模块 D: 基础设施 (infra)

#### D1: Docker 配置

```
文件: docker-compose.yml

服务:
- postgres: PostgreSQL 15
- redis: Redis 7 (alpine)

端口:
- postgres: 5432
- redis: 6379

启动: docker compose up -d
```

#### D2: 环境配置

```
文件: .env.example

# 后端
DATABASE_URL="postgresql://user:pass@localhost:5432/meme"
REDIS_URL="redis://localhost:6379"
RPC_URL_BSC_TEST="https://data-seed-prebsc-1-s1.bnbchain.org:8545"
RPC_URL_BSC_MAIN="https://bsc-dataseed1.binance.org"
PRIVATE_KEY=""

# 前端
VITE_BSC_CHAIN_ID="97"
VITE_BSC_CHAIN_NAME="BNB Smart Chain Testnet"
VITE_WALLET_CONNECT_PROJECT_ID=""
VITE_TOKEN_FACTORY_ADDRESS=""
```

#### D3: Prisma Schema

```
文件: packages/db/prisma/schema.prisma

模型:

Token (代币)
- id: String (cuid)
- address: String (unique, indexed)
- name: String
- symbol: String
- decimals: Int
- totalSupply: BigInt
- creator: String (indexed)
- isTaxToken: Boolean
- taxRate: Float?
- taxRecipient: String?
- curveAddress: String?
- isGraduated: Boolean @default(false)
- graduatedAt: DateTime?
- dexPairAddress: String?
- marketCap: BigInt @default(0)
- tradeVolume24h: BigInt @default(0)
- holderCount: Int @default(0)
- description: String?
- imageUrl: String?
- twitter: String?
- telegram: String?
- website: String?
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt
- trades: Trade[]
- holders: Holder[]

Trade (交易记录)
- id: String (cuid)
- tokenId: String (indexed)
- token: Token @relation
- trader: String (indexed)
- type: TradeType (BUY/SELL)
- amountIn: BigInt
- amountOut: BigInt
- taxAmount: BigInt?
- price: BigInt
- txHash: String (unique)
- blockNumber: BigInt
- createdAt: DateTime @default(now())

Holder (持币者)
- id: String (cuid)
- tokenId: String (indexed)
- token: Token @relation
- address: String (indexed)
- balance: BigInt
- updatedAt: DateTime @updatedAt
- @@unique([tokenId, address])

PriceCache (价格缓存)
- id: String (cuid)
- tokenId: String (unique, indexed)
- token: Token @relation
- price: BigInt
- priceChange24h: Float
- updatedAt: DateTime @updatedAt
```

---

## 四、模块依赖关系

```
                    ┌─────────────────┐
                    │  Module D: Infra │
                    │  (DB/Redis/Docker)│
                    └────────┬────────┘
                             │
       ┌─────────────────────┼─────────────────────┐
       │                     │                     │
       ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Module A     │    │ Module B     │    │ Module C     │
│ Contracts    │    │ Backend API  │    │ Frontend    │
│              │    │              │    │              │
│ - TokenFactory│    │ - REST API  │    │ - React UI  │
│ - BondingCurve│    │ - WebSocket │    │ - wagmi     │
│ - MemeToken  │    │ - Events    │    │ - Charts    │
│ - Graduation │    │ - Cache     │    │ - Store     │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       │ ABI               │                   │
       └───────────────────┼───────────────────┘
                           │
                    ┌──────▼──────┐
                    │  API Layer  │
                    │  (REST/WS)  │
                    └─────────────┘
```

**并行开发建议**:

- 模块 D (基础设施): 完全独立
- 模块 A (合约): 完全独立
- 模块 B (后端): 依赖 A (ABI) + D
- 模块 C (前端): 依赖 B (API) + A (ABI)

---

## 五、详细任务清单 (共 28 个)

### Module A: Smart Contracts (5 tasks)

| ID  | Task               | 输入 | 输出       | 验收标准             |
| --- | ------------------ | ---- | ---------- | -------------------- |
| A1  | 代币工厂合约       | 参数 | 合约       | 部署成功，可创建代币 |
| A2  | Bonding Curve 逻辑 | 交易 | 结果       | 价格计算正确         |
| A3  | MEME 代币模板      | 无   | 模板       | 支持征税/转账        |
| A4  | 毕业机制           | 代币 | 流动性转移 | DEX 对创建成功       |
| A5  | 部署脚本           | 网络 | 配置       | Testnet 部署成功     |

### Module B: Backend API (8 tasks)

| ID  | Task           | 输入     | 输出     | 验收标准         |
| --- | -------------- | -------- | -------- | ---------------- |
| B1  | 项目初始化     | -        | 可运行   | npm run dev 正常 |
| B2  | 合约交互服务   | 地址     | 服务     | 单元测试通过     |
| B3  | 代币 CRUD API  | 请求     | REST API | Postman 测试通过 |
| B4  | 交易历史 API   | 地址     | Trade[]  | 分页正常         |
| B5  | 市场统计 API   | -        | 统计     | 数据准确         |
| B6  | WebSocket 服务 | 连接     | 推送     | 连接稳定         |
| B7  | 事件监听服务   | 事件     | DB 写入  | 事件不丢失       |
| B8  | 价格缓存服务   | 代币列表 | Redis    | 命中率 > 95%     |

### Module C: Frontend (8 tasks)

| ID  | Task       | 输入 | 输出     | 验收标准         |
| --- | ---------- | ---- | -------- | ---------------- |
| C1  | 项目初始化 | -    | 可运行   | npm run dev 正常 |
| C2  | 钱包连接   | 插件 | 连接状态 | MetaMask 可连接  |
| C3  | 创建代币页 | 表单 | 新代币   | 创建成功         |
| C4  | 代币列表页 | API  | 列表展示 | 渲染正常         |
| C5  | 代币详情页 | 地址 | 详情页   | 数据完整         |
| C6  | Swap 组件  | 参数 | 交易结果 | 买卖成功         |
| C7  | 图表组件   | 数据 | 图表     | 交互正常         |
| C8  | 状态管理   | 定义 | Store    | 多页面共享       |

### Module D: Infrastructure (3 tasks)

| ID  | Task          | 输入    | 输出 | 验收标准                |
| --- | ------------- | ------- | ---- | ----------------------- |
| D1  | Docker 配置   | compose | 容器 | docker compose up 成功  |
| D2  | 环境配置      | example | 配置 | 各模块可读取            |
| D3  | Prisma Schema | schema  | 表   | npx prisma db push 成功 |

---

## 六、接口契约

### 创建代币

**POST** `/api/v1/tokens`

Request:

```json
{
  "name": "My Meme Coin",
  "symbol": "MEME",
  "decimals": 18,
  "isTaxToken": true,
  "taxRate": 5,
  "taxRecipient": "0x1234567890123456789012345678901234567890",
  "description": "The best meme coin",
  "imageUrl": "https://example.com/image.png",
  "twitter": "https://twitter.com/meme",
  "telegram": "https://t.me/meme",
  "website": "https://meme.example.com"
}
```

Response (201):

```json
{
  "data": {
    "address": "0xABC...",
    "curveAddress": "0xDEF...",
    "txHash": "0x123...",
    "creator": "0xUSER..."
  },
  "message": "Token created successfully"
}
```

### 代币列表

**GET** `/api/v1/tokens?page=1&limit=20&sort=marketCap&order=desc&search=dog`

Response (200):

```json
{
  "data": [
    {
      "address": "0xABC...",
      "name": "Doge",
      "symbol": "DOGE",
      "imageUrl": "https://...",
      "price": "0.00012345",
      "priceChange24h": 5.2,
      "marketCap": "12345.67",
      "tradeVolume24h": "5000.00",
      "holderCount": 150,
      "isGraduated": false,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1500,
    "totalPages": 75
  }
}
```

### 价格查询

**GET** `/api/v1/tokens/0xABC.../price`

Response (200):

```json
{
  "data": {
    "address": "0xABC...",
    "price": "0.00012345",
    "priceChange24h": -2.5,
    "virtualToken": "1000000000000000000",
    "virtualQuote": "100000000000000000000",
    "updatedAt": "2024-01-15T12:00:00Z"
  }
}
```

### 交易历史

**GET** `/api/v1/tokens/0xABC.../trades?type=buy&page=1&limit=20`

Response (200):

```json
{
  "data": [
    {
      "id": "cuid...",
      "trader": "0xUSER...",
      "type": "BUY",
      "amountIn": "1000000000000000000",
      "amountOut": "1000000",
      "taxAmount": "50000",
      "price": "1000000000000",
      "txHash": "0xTX...",
      "createdAt": "2024-01-15T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 500,
    "totalPages": 25
  }
}
```

### 市场统计

**GET** `/api/v1/stats/global`

Response (200):

```json
{
  "data": {
    "totalTokens": 5000,
    "totalVolume24h": "1000000.00",
    "totalTrades": 15000,
    "totalMarketCap": "50000000.00",
    "priceChange24h": 2.5
  }
}
```

---

## 七、开发顺序

### 第一阶段: 基础设施 (并行)

```
D1: Docker 配置
    ↓
D2: 环境配置
    ↓
D3: Prisma Schema
```

```
A1: 代币工厂合约
    ↓
A2: Bonding Curve 核心
    ↓
A3: MEME 代币模板
    ↓
A4: 毕业机制
    ↓
A5: 部署脚本
```

### 第二阶段: 后端核心 (依赖 A + D)

```
B1: 项目初始化 + B2: 合约交互服务
    ↓
B3: 代币 CRUD API + B4: 交易历史 API
    ↓
B5: 市场统计 API + B6: WebSocket 服务
    ↓
B7: 事件监听服务 + B8: 价格缓存服务
```

### 第三阶段: 前端核心 (依赖 B)

```
C1: 项目初始化 + C2: 钱包连接
    ↓
C3: 创建代币页 + C4: 代币列表页
    ↓
C5: 代币详情页 + C6: Swap 组件
    ↓
C7: 图表组件 + C8: 状态管理
```

### 第四阶段: 联调测试

```
1. A + B 联调: 合约部署 + API 对接
2. B + C 联调: API 联调 + UI 对接
3. E2E 测试: 完整用户流程
4. 性能优化: 首屏 / 并发 / 缓存
5. 安全审计: 合约 + API
```

---

## 八、命名规范

| 类型       | 规范             | 示例                                         |
| ---------- | ---------------- | -------------------------------------------- |
| 前端组件   | PascalCase       | `TokenCard.tsx`, `SwapWidget.tsx`            |
| 前端页面   | PascalCase       | `TokenList.tsx`, `TokenDetail.tsx`           |
| 后端模块   | kebab-case       | `token.service.ts`, `price.cache.service.ts` |
| 后端控制器 | kebab-case       | `tokens.controller.ts`                       |
| 数据库字段 | snake_case       | `created_at`, `trade_volume_24h`             |
| 数据库表   | PascalCase       | `Token`, `Trade`, `Holder`                   |
| TypeScript | camelCase        | `tokenAddress`, `tradeVolume`                |
| Solidity   | mixedCase        | `tokenAddress`, `totalSupply`                |
| 合约函数   | mixedCase        | `createToken`, `getCurrentPrice`             |
| 事件       | MixedCase        | `TokenCreated`, `TradeExecuted`              |
| 环境变量   | UPPER_SNAKE_CASE | `RPC_URL_BSC_TEST`, `DATABASE_URL`           |

---

## 九、验收标准

### 智能合约

- [ ] 所有合约通过语法检查
- [ ] 测试网部署成功
- [ ] 单元测试覆盖率 > 90%
- [ ] 无 critical/high 漏洞

### 后端 API

- [ ] `npm run build` 成功
- [ ] `npm run test` 通过
- [ ] API 响应时间 < 200ms (P95)
- [ ] WebSocket 连接稳定

### 前端

- [ ] `npm run build` 成功
- [ ] 首屏加载 < 1.5s (LCP)
- [ ] 所有交互有 loading/error 状态
- [ ] 响应式布局正常

### 集成

- [ ] 端到端测试通过
- [ ] 合约事件正确同步到数据库
- [ ] 价格实时更新延迟 < 5s
- [ ] 交易成功率 > 99%

---

## 十、注意事项

1. **合约安全**:
   - 所有合约需通过形式化验证或第三方审计
   - 添加 Circuit Breaker 机制
   - 设置合理的 gas limit

2. **Gas 优化**:
   - 考虑 EIP-1559
   - 批量操作减少 gas 成本

3. **前端体验**:
   - 交易需有完整状态反馈
   - 错误信息本地化
   - 支持 Dark Mode

4. **API 安全**:
   - 添加 rate limiting
   - 敏感接口添加验证
   - 输入严格校验

5. **错误处理**:
   - 区块链操作需处理 revert
   - 设置超时机制
   - 错误日志记录
