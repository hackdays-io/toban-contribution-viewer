# Docker Compose統合テストフレームワーク実装戦略

このドキュメントは、Toban Contribution Viewerプロジェクト用の統合テストフレームワークの実装戦略を詳細に説明します。

## 1. 目的

このフレームワークの主な目的は以下の通りです：

- フロントエンドとバックエンドを連携させた完全なエンドツーエンドテストを可能にする
- 実際のユーザーフローを自動的に検証する
- 外部依存関係（SlackAPI、OpenRouter API）をモック化して安定したテスト環境を提供する
- CI/CDパイプラインに統合して継続的な品質保証を実現する

## 2. アーキテクチャ

提案する統合テストフレームワークは以下のコンポーネントで構成されます：

```
integration-tests/
├── docker-compose.test.yml     # テスト用Docker Compose設定
├── setup/                      # テスト環境セットアップスクリプト
│   ├── init-db.sh              # テストデータベース初期化
│   └── wait-for-services.sh    # サービス起動待機
├── mocks/                      # 外部サービスモック
│   ├── slack-api/              # SlackAPIモック
│   │   ├── server.js           # モックサーバー
│   │   ├── data/               # テストデータ
│   │   └── Dockerfile          # コンテナ定義
│   └── openrouter-api/         # OpenRouter APIモック
│       ├── server.js           # モックサーバー
│       ├── data/               # テストデータ
│       └── Dockerfile          # コンテナ定義
├── tests/                      # テストケース
│   ├── e2e/                    # E2Eテスト
│   │   ├── auth.spec.js        # 認証フロー
│   │   ├── slack.spec.js       # Slack統合フロー
│   │   └── analysis.spec.js    # 分析フロー
│   └── api/                    # APIテスト
│       ├── slack.spec.js       # SlackAPI統合
│       └── teams.spec.js       # チーム管理API
├── utils/                      # ユーティリティ関数
│   ├── test-data-generator.js  # テストデータ生成
│   ├── auth-helper.js          # 認証ヘルパー
│   └── slack-data-fetcher.js   # 実際のSlackデータ取得
├── Dockerfile.test-runner      # テストランナーコンテナ定義
└── run-tests.sh                # テスト実行スクリプト
```

## 3. 実装詳細

### 3.1 Docker Compose設定

`docker-compose.test.yml`ファイルは、テスト環境用の完全なスタックを定義します：

```yaml
version: '3.8'

services:
  # テスト用PostgreSQLデータベース
  postgres-test:
    image: postgres:13
    environment:
      - POSTGRES_USER=test_user
      - POSTGRES_PASSWORD=test_password
      - POSTGRES_DB=test_db
    ports:
      - "5433:5432"  # 通常のDBと競合しないポート
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test_user -d test_db"]
      interval: 5s
      timeout: 5s
      retries: 5

  # モックSlack API
  slack-api-mock:
    build: ./mocks/slack-api
    ports:
      - "3001:3001"
    volumes:
      - ./mocks/slack-api/data:/app/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 5s
      timeout: 5s
      retries: 5

  # モックOpenRouter API
  openrouter-api-mock:
    build: ./mocks/openrouter-api
    ports:
      - "3002:3002"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/health"]
      interval: 5s
      timeout: 5s
      retries: 5

  # バックエンドサービス（テストモード）
  backend-test:
    build:
      context: ../backend
      dockerfile: Dockerfile
    environment:
      - TESTING=True
      - DATABASE_URL=postgresql://test_user:test_password@postgres-test:5432/test_db
      - SLACK_API_BASE_URL=http://slack-api-mock:3001
      - OPENROUTER_API_URL=http://openrouter-api-mock:3002
      - FRONTEND_URL=http://frontend-test:5173
    ports:
      - "8001:8000"  # 通常のバックエンドと競合しないポート
    depends_on:
      postgres-test:
        condition: service_healthy
      slack-api-mock:
        condition: service_healthy
      openrouter-api-mock:
        condition: service_healthy
    volumes:
      - ../backend:/app:cached
      - /app/__pycache__

  # フロントエンドサービス（テストモード）
  frontend-test:
    build:
      context: ../frontend
      dockerfile: Dockerfile
    environment:
      - VITE_API_URL=http://backend-test:8000/api/v1
      - VITE_ENVIRONMENT=test
      - VITE_SUPABASE_URL=http://supabase-mock:9000
      - VITE_SUPABASE_ANON_KEY=test-key
    ports:
      - "5174:5173"  # 通常のフロントエンドと競合しないポート
    depends_on:
      - backend-test
    volumes:
      - ../frontend:/app:cached
      - /app/node_modules

  # テストランナー
  test-runner:
    build:
      context: .
      dockerfile: Dockerfile.test-runner
    volumes:
      - ./tests:/tests
      - ./reports:/reports
    depends_on:
      - frontend-test
      - backend-test
    command: ["./wait-for-services.sh", "npm", "run", "test"]
```

### 3.2 テストランナー

Playwrightを使用してE2Eテストを実装します。テストランナーのDockerfileは以下のようになります：

```dockerfile
FROM mcr.microsoft.com/playwright:latest

WORKDIR /app

# 依存関係をインストール
COPY package.json package-lock.json ./
RUN npm install

# テストスクリプトとユーティリティをコピー
COPY tests/ ./tests/
COPY utils/ ./utils/
COPY setup/ ./setup/
COPY playwright.config.js ./

# 実行権限を付与
RUN chmod +x ./setup/wait-for-services.sh

# レポートディレクトリを作成
RUN mkdir -p /reports

CMD ["npm", "run", "test"]
```

### 3.3 Slack APIモック

Slack APIモックサーバーは、実際のSlack APIと同じレスポンス形式を返すExpressサーバーとして実装します：

```javascript
// mocks/slack-api/server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
app.use(express.json());

// テストデータを読み込む
const loadTestData = (filename) => {
  try {
    const dataPath = path.join(__dirname, 'data', filename);
    if (fs.existsSync(dataPath)) {
      return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    }
    console.warn(`Warning: Test data file ${filename} not found`);
    return null;
  } catch (error) {
    console.error(`Error loading test data ${filename}:`, error);
    return null;
  }
};

// チャンネル一覧エンドポイント
app.get('/api/conversations.list', (req, res) => {
  const channelsData = loadTestData('channels.json') || {
    ok: true,
    channels: [
      { id: 'C12345', name: 'general', is_private: false },
      { id: 'C67890', name: 'random', is_private: false }
    ],
    response_metadata: { next_cursor: '' }
  };
  
  res.json(channelsData);
});

// メッセージ履歴エンドポイント
app.get('/api/conversations.history', (req, res) => {
  const channelId = req.query.channel;
  const messagesData = loadTestData(`messages_${channelId}.json`) || {
    ok: true,
    messages: [
      { ts: '1620000000.000100', text: 'Hello world', user: 'U12345' },
      { ts: '1620000001.000200', text: 'Test message', user: 'U67890' }
    ],
    has_more: false
  };
  
  res.json(messagesData);
});

// ユーザー情報エンドポイント
app.get('/api/users.info', (req, res) => {
  const userId = req.query.user;
  const usersData = loadTestData('users.json') || {
    users: [
      { id: 'U12345', name: 'testuser1', real_name: 'Test User 1' },
      { id: 'U67890', name: 'testuser2', real_name: 'Test User 2' }
    ]
  };
  
  const user = usersData.users.find(u => u.id === userId) || {
    id: userId,
    name: `unknown_${userId}`,
    real_name: `Unknown User (${userId})`
  };
  
  res.json({
    ok: true,
    user
  });
});

// OAuth認証エンドポイント
app.post('/api/oauth.v2.access', (req, res) => {
  const oauthData = loadTestData('oauth.json') || {
    ok: true,
    app_id: 'A12345',
    authed_user: { id: 'U12345' },
    scope: 'channels:history,channels:read',
    token_type: 'bot',
    access_token: 'xoxb-test-token',
    bot_user_id: 'B12345',
    team: { id: 'T12345', name: 'Test Team', domain: 'test' },
    is_enterprise_install: false
  };
  
  res.json(oauthData);
});

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Slack API mock server running on port ${PORT}`);
});
```

### 3.4 Slackデータ取得スクリプト

実際のSlack APIからテストデータを取得するスクリプトを実装します：

```javascript
// utils/slack-data-fetcher.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 設定
const SLACK_TOKEN = process.env.SLACK_TOKEN;
const OUTPUT_DIR = path.join(__dirname, '..', 'mocks', 'slack-api', 'data');

// 出力ディレクトリが存在しない場合は作成
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// データをJSONファイルとして保存
const saveData = (filename, data) => {
  const filePath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Saved data to ${filePath}`);
};

// Slack APIクライアント
const slackClient = axios.create({
  baseURL: 'https://slack.com/api',
  headers: {
    Authorization: `Bearer ${SLACK_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

// チャンネル一覧を取得
const fetchChannels = async () => {
  try {
    const response = await slackClient.get('/conversations.list', {
      params: {
        types: 'public_channel,private_channel',
        limit: 100,
      },
    });
    
    if (response.data.ok) {
      saveData('channels.json', response.data);
      return response.data.channels;
    } else {
      console.error('Error fetching channels:', response.data.error);
      return [];
    }
  } catch (error) {
    console.error('Error fetching channels:', error.message);
    return [];
  }
};

// チャンネルのメッセージを取得
const fetchMessages = async (channelId) => {
  try {
    const response = await slackClient.get('/conversations.history', {
      params: {
        channel: channelId,
        limit: 50,
      },
    });
    
    if (response.data.ok) {
      saveData(`messages_${channelId}.json`, response.data);
      return response.data.messages;
    } else {
      console.error(`Error fetching messages for channel ${channelId}:`, response.data.error);
      return [];
    }
  } catch (error) {
    console.error(`Error fetching messages for channel ${channelId}:`, error.message);
    return [];
  }
};

// ユーザー情報を取得
const fetchUsers = async (userIds) => {
  const users = [];
  
  for (const userId of userIds) {
    try {
      const response = await slackClient.get('/users.info', {
        params: {
          user: userId,
        },
      });
      
      if (response.data.ok) {
        users.push(response.data.user);
      } else {
        console.error(`Error fetching user ${userId}:`, response.data.error);
      }
    } catch (error) {
      console.error(`Error fetching user ${userId}:`, error.message);
    }
  }
  
  saveData('users.json', { users });
  return users;
};

// OAuth情報を取得（モック用）
const createOAuthMock = () => {
  const oauthData = {
    ok: true,
    app_id: 'A12345',
    authed_user: { id: 'U12345' },
    scope: 'channels:history,channels:read',
    token_type: 'bot',
    access_token: 'xoxb-test-token',
    bot_user_id: 'B12345',
    team: { id: 'T12345', name: 'Test Team', domain: 'test' },
    is_enterprise_install: false
  };
  
  saveData('oauth.json', oauthData);
};

// メイン関数
const main = async () => {
  if (!SLACK_TOKEN) {
    console.error('Error: SLACK_TOKEN environment variable is required');
    process.exit(1);
  }
  
  console.log('Fetching Slack data for testing...');
  
  // チャンネル一覧を取得
  const channels = await fetchChannels();
  console.log(`Fetched ${channels.length} channels`);
  
  // 最大5つのチャンネルからメッセージを取得
  const channelsToFetch = channels.slice(0, 5);
  const userIds = new Set();
  
  for (const channel of channelsToFetch) {
    console.log(`Fetching messages for channel: ${channel.name} (${channel.id})`);
    const messages = await fetchMessages(channel.id);
    console.log(`Fetched ${messages.length} messages`);
    
    // メッセージからユーザーIDを収集
    messages.forEach(msg => {
      if (msg.user) {
        userIds.add(msg.user);
      }
    });
  }
  
  // ユーザー情報を取得
  console.log(`Fetching information for ${userIds.size} users`);
  await fetchUsers([...userIds]);
  
  // OAuth情報を作成
  createOAuthMock();
  
  console.log('Data fetching complete!');
};

// スクリプトが直接実行された場合のみ実行
if (require.main === module) {
  main().catch(error => {
    console.error('Error in main function:', error);
    process.exit(1);
  });
}

module.exports = {
  fetchChannels,
  fetchMessages,
  fetchUsers,
  createOAuthMock,
};
```

### 3.5 テスト実行スクリプト

```bash
#!/bin/bash
# run-tests.sh

# 環境変数設定
export TEST_ENV=integration

# 引数解析
SKIP_DATA_FETCH=false
SKIP_CLEANUP=false

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --skip-data-fetch) SKIP_DATA_FETCH=true ;;
    --skip-cleanup) SKIP_CLEANUP=true ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
  shift
done

# テストデータ取得（スキップされない場合）
if [ "$SKIP_DATA_FETCH" = false ]; then
  echo "Fetching test data from Slack API..."
  
  if [ -z "$SLACK_TOKEN" ]; then
    echo "Error: SLACK_TOKEN environment variable is required for data fetching"
    echo "Set it with: export SLACK_TOKEN=xoxb-your-token"
    echo "Or skip data fetching with: $0 --skip-data-fetch"
    exit 1
  fi
  
  node utils/slack-data-fetcher.js
  
  if [ $? -ne 0 ]; then
    echo "Error fetching test data"
    exit 1
  fi
fi

# Docker Composeでテスト環境を起動
echo "Starting test environment..."
docker-compose -f docker-compose.test.yml up -d

# サービスの起動を待機
echo "Waiting for services to be ready..."
./setup/wait-for-services.sh

# テストを実行
echo "Running tests..."
docker-compose -f docker-compose.test.yml run test-runner

# テスト結果を保存
TEST_EXIT_CODE=$?
echo "Saving test reports..."
mkdir -p ./reports
docker cp test-runner:/reports ./reports

# テスト環境をクリーンアップ（スキップされない場合）
if [ "$SKIP_CLEANUP" = false ]; then
  echo "Cleaning up test environment..."
  docker-compose -f docker-compose.test.yml down -v
fi

echo "Test execution complete!"
exit $TEST_EXIT_CODE
```

### 3.6 サービス待機スクリプト

```bash
#!/bin/bash
# setup/wait-for-services.sh

# 最大待機時間（秒）
MAX_WAIT=120
INTERVAL=5

# バックエンドの準備ができているか確認
wait_for_backend() {
  local url="http://backend-test:8000/api/v1/health"
  local elapsed=0
  
  echo "Waiting for backend to be ready..."
  
  while [ $elapsed -lt $MAX_WAIT ]; do
    if curl -s $url > /dev/null; then
      echo "Backend is ready!"
      return 0
    fi
    
    echo "Backend not ready yet, waiting ${INTERVAL}s..."
    sleep $INTERVAL
    elapsed=$((elapsed + INTERVAL))
  done
  
  echo "Timed out waiting for backend"
  return 1
}

# フロントエンドの準備ができているか確認
wait_for_frontend() {
  local url="http://frontend-test:5173"
  local elapsed=0
  
  echo "Waiting for frontend to be ready..."
  
  while [ $elapsed -lt $MAX_WAIT ]; do
    if curl -s $url > /dev/null; then
      echo "Frontend is ready!"
      return 0
    fi
    
    echo "Frontend not ready yet, waiting ${INTERVAL}s..."
    sleep $INTERVAL
    elapsed=$((elapsed + INTERVAL))
  done
  
  echo "Timed out waiting for frontend"
  return 1
}

# すべてのサービスを待機
wait_for_backend && wait_for_frontend

if [ $? -eq 0 ]; then
  echo "All services are ready!"
  exit 0
else
  echo "Failed to start all services"
  exit 1
fi
```

## 4. テスト対象ユーザーフロー

以下の主要なユーザーフローをテスト対象とします：

### 4.1 認証フロー

- ユーザー登録
- ログイン
- チーム切り替え

### 4.2 Slack統合フロー

- Slackワークスペース接続
- チャンネル同期
- チャンネル選択
- メッセージ取得

### 4.3 分析フロー

- チャンネル分析実行
- 分析結果表示
- レポート生成

### 4.4 チーム管理フロー

- チーム作成
- メンバー招待
- 権限管理

## 5. CI/CD統合

GitHub Actionsワークフローに統合テストを追加します：

```yaml
name: Integration Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Run integration tests
        env:
          SLACK_TOKEN: ${{ secrets.SLACK_TEST_TOKEN }}
        run: |
          cd integration-tests
          ./run-tests.sh
      
      - name: Upload test reports
        uses: actions/upload-artifact@v4
        with:
          name: integration-test-reports
          path: integration-tests/reports
```

## 6. 実装ステップ

統合テストフレームワークの実装は、以下のステップで進めます：

1. 基本構造のセットアップ
   - `integration-tests`ディレクトリの作成
   - 必要なサブディレクトリとファイルの作成

2. モックサービスの実装
   - Slack APIモックサーバーの実装
   - OpenRouter APIモックサーバーの実装

3. テストデータ取得スクリプトの実装
   - Slack APIからのデータ取得機能
   - テストデータの保存と管理

4. Docker Compose設定の作成
   - テスト環境用のサービス定義
   - ヘルスチェックと依存関係の設定

5. テストランナーの設定
   - Playwrightの設定
   - テスト実行環境の構築

6. E2Eテストケースの実装
   - 認証フローのテスト
   - Slack統合フローのテスト
   - 分析フローのテスト

7. APIテストケースの実装
   - バックエンドAPIのテスト
   - 外部サービス統合のテスト

8. CI/CD統合
   - GitHub Actionsワークフローの作成
   - テスト結果のレポート設定

## 7. 注意点

- **モックの正確性**: モックサービスは実際のAPIと完全に一致するように維持する必要があります。APIの仕様変更があった場合は、モックも更新する必要があります。

- **テストデータの鮮度**: テストデータは定期的に更新して実際のユースケースを反映させる必要があります。CI/CDパイプラインでは、定期的にテストデータを再取得するジョブを設定することを検討してください。

- **環境変数の管理**: テスト環境で使用する環境変数は、`.env.test`ファイルで管理し、機密情報はCI/CDシステムのシークレットとして保存します。

- **テスト実行時間**: CI環境ではテスト実行時間を最適化するための戦略が必要です。長時間実行されるテストは分割するか、並列実行を検討してください。

- **フロントエンドのレンダリング**: ヘッドレスブラウザでのテスト実行時に、一部のUIコンポーネントが正しくレンダリングされない場合があります。そのような場合は、テスト環境固有の調整が必要になることがあります。

## 8. メリット

- **完全なエンドツーエンドテスト**: フロントエンドからバックエンド、データベースまでの全フローをテスト
- **安定したテスト環境**: モックサービスにより外部依存関係を制御
- **CI/CD統合**: 自動化されたテスト実行とレポート生成
- **並行開発サポート**: 開発環境に影響を与えずにテストを実行可能
- **包括的なカバレッジ**: 主要なユーザーフローをすべてカバー

## 9. 将来の拡張

- **パフォーマンステスト**: 負荷テストと応答時間測定の追加
- **アクセシビリティテスト**: UIコンポーネントのアクセシビリティチェック
- **セキュリティテスト**: 脆弱性スキャンとペネトレーションテスト
- **ビジュアルリグレッションテスト**: UIの視覚的変更を検出するスナップショットテスト
- **クロスブラウザテスト**: 複数のブラウザでのテスト実行
